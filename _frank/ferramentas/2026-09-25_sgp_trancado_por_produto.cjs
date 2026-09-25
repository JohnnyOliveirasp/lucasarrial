#!/usr/bin/env node
/**
 * 2026-09-25_sgp_trancado_por_produto.cjs — READ-ONLY.
 *
 * A PERGUNTA QUE O #505 NUNCA FEZ, E QUE DECIDE SE ELE FOI BEM FECHADO.
 *
 * O #505 ("ENTREGAMOS O CLONE E TRANCAMOS A PORTA") foi fechado em 21/09 como
 * NAO-DEFEITO: comprar o SGP (7283229) ou a Fabrica (7283335) e produto de
 * CURSO e nao da a plataforma — regra comercial do Lucas de 31/08, que o
 * `acesso-regra.ts` carrega como `PRODUTOS_DE_CURSO_PADRAO` e o webhook obedece
 * em `route.ts` ("SGP: CURSO, nao assinatura. Desvia ANTES de tudo").
 *
 * Em 25/09 o Vigia mediu a mesma regua e a classe tinha ido de 39 para 55, com
 * tres alunos daquele dia escrevendo "nao consigo entrar" DEPOIS de conseguir
 * entrar (a porta abriu; o quarto estava vazio).
 *
 * MAS O #505 CONTOU CABECAS, NAO PRODUTOS. Ele mediu "20 dos 39 tem compra paga
 * conferida" — e nao perguntou **QUAL** compra. E ai mora a unica coisa que
 * muda a decisao:
 *
 *   - comprou SO curso  -> nao ter plataforma e o CONTRATO. Nada a consertar
 *     aqui; o que resta e decisao comercial do Johnny (regra do Lucas de 31/08
 *     x weekly dele de 14/09, SGP=30 dias, migration 115 nunca aplicada).
 *   - comprou a PLATAFORMA e esta sem entitlement -> e PAGANTE TRANCADO. Isso
 *     nao e regra, e defeito nosso, tem dono (eu) e nao espera decisao de
 *     ninguem.
 *
 * Uma classe fechada como "todos por desenho" esconde o segundo caso dentro do
 * primeiro. O proprio manual manda desconfiar: "cheque incidentes
 * ignored/fixed com last_seen_at RECENTE — classe fechada que segue disparando
 * esconde bug nosso".
 *
 * ⚠️ CONTROLE POSITIVO, E O SCRIPT ABORTA SE ELE FALHAR. Um classificador que
 * responde "curso" para todo mundo produziria exatamente o silencio que esta
 * ordem quer quebrar — e seria indistinguivel de "nao ha pagante trancado".
 * Antes de qualquer numero, o script pega alunos com entitlement ATIVO de
 * plataforma (pagantes conhecidos, fora da classe) e exige que o classificador
 * os veja como PLATAFORMA. Se ele nao ve, o zero nao vale nada e o script sai
 * com erro. E a irma da regra do zero falso, e da regua de 25/09: instrumento
 * que responde "todos" nao esta medindo, esta reclamando.
 *
 * ⚠️ O QUE ESTE SCRIPT **NAO** PROVA. Ele le o NOSSO `payment_events`, nao a
 * Hotmart viva. Para o lado POSITIVO ("achei compra de plataforma") isso basta
 * para agir. Para o lado NEGATIVO ("so curso") NAO e prova: a pessoa pode ter
 * comprado com OUTRO e-mail (armadilhas #214/#218) ou o evento pode nunca ter
 * sido gravado (o proprio webhook descartava o 7283229 antes do insert ate
 * 03/09). Por isso o negativo sai rotulado como "SEM COMPRA DE PLATAFORMA
 * NESTE E-MAIL", nunca como "nao pagou". Quem for decidir dinheiro em cima de
 * um negativo daqui confirma no `pagou_de_verdade.cjs` (Hotmart viva) primeiro.
 *
 * Uso: node 2026-09-25_sgp_trancado_por_produto.cjs [--json]
 */
const { supa } = require("./_comum.cjs");

// A MESMA lista do `frontend/src/lib/payments/acesso-regra.ts`
// (PRODUTOS_DE_CURSO_PADRAO). Repetida aqui porque este script roda sem o
// bundler do front; a divergencia e checada no fim (§ CONFERENCIA DA LISTA).
const CURSOS = new Set(["7283229", "7283335"]);
const PAGO = new Set(["COMPLETE", "APPROVED"]);

/** Paginacao de verdade: o Supabase corta em 1000 linhas EM SILENCIO. */
async function todas(s, tabela, colunas, aplicar = (q) => q) {
  const out = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await aplicar(s.from(tabela).select(colunas)).range(de, de + passo - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return out;
}

/** Extrai (product_code, valor, status) de um payload da Hotmart/Stripe. */
function comprasDoEvento(ev) {
  const p = ev.payload || {};
  const d = p.data || {};
  if (ev.provider === "stripe") {
    // Pacote de credito avulso do Stripe: nao e curso, e dinheiro na plataforma.
    const o = d.object || {};
    const live = p.livemode ?? o.livemode;
    return [
      {
        produto: "stripe",
        valor: (o.amount_total ?? 0) / 100,
        pago: o.payment_status === "paid" && live === true,
        curso: false,
      },
    ];
  }
  const prod = d.product?.id ?? d.product?.ucode ?? d.purchase?.product?.id ?? null;
  const code = prod === null || prod === undefined ? "" : String(prod).trim();
  const valor = d.purchase?.price?.value ?? 0;
  const status = String(d.purchase?.status ?? "").toUpperCase();
  return [{ produto: code || "(sem product_code)", valor, pago: valor > 0 && PAGO.has(status), curso: CURSOS.has(code) }];
}

(async () => {
  const s = supa();
  const jsonOut = process.argv.includes("--json");
  const agora = Date.now();

  // ── 1. INSUMOS ────────────────────────────────────────────────────────────
  const pedidos = await todas(s, "sgp_pedidos", "id,user_id,email,status,voz_pronta_em,foto_pronta_em,criado_em");
  const perfis = await todas(s, "profiles", "id,email,access_until,credits_subscription,credits_extra,last_seen_at");
  const ents = await todas(s, "entitlements", "user_id,buyer_email,product_code,status,access_until");
  const eventos = await todas(s, "payment_events", "provider,event_type,buyer_email,payload", (q) => q);

  console.log(
    `insumos: sgp_pedidos ${pedidos.length} · profiles ${perfis.length} · entitlements ${ents.length} · payment_events ${eventos.length}`,
  );

  const perfilPorId = new Map(perfis.map((p) => [p.id, p]));
  const norm = (e) => String(e || "").trim().toLowerCase();

  // compras por e-mail
  const comprasPorEmail = new Map();
  for (const ev of eventos) {
    const em = norm(ev.buyer_email);
    if (!em) continue;
    if (!/PURCHASE_(APPROVED|COMPLETE)|checkout\.session\.completed/i.test(String(ev.event_type))) continue;
    for (const c of comprasDoEvento(ev)) {
      if (!comprasPorEmail.has(em)) comprasPorEmail.set(em, []);
      comprasPorEmail.get(em).push(c);
    }
  }

  // entitlement ATIVO de plataforma (product_code fora da lista de curso;
  // NULL conta como plataforma de proposito — ausencia de informacao nao e
  // "e curso", mesma guarda do acesso-regra.ts)
  const entAtivaPlataforma = new Map();
  for (const e of ents) {
    const code = String(e.product_code ?? "").trim();
    const ehPlataforma = !code || !CURSOS.has(code);
    const viva = String(e.status).toLowerCase() === "active";
    if (ehPlataforma && viva) {
      if (e.user_id) entAtivaPlataforma.set(e.user_id, e);
      if (e.buyer_email) entAtivaPlataforma.set(norm(e.buyer_email), e);
    }
  }

  const classificar = (email) => {
    const cs = comprasPorEmail.get(norm(email)) || [];
    const pagas = cs.filter((c) => c.pago);
    return {
      temPlataformaPaga: pagas.some((c) => !c.curso),
      temCursoPago: pagas.some((c) => c.curso),
      pagas,
    };
  };

  // ── 2. CONTROLE POSITIVO: o classificador ENXERGA plataforma? ────────────
  const conhecidos = [];
  for (const [k, e] of entAtivaPlataforma) {
    if (typeof k !== "string" || !k.includes("@")) continue;
    conhecidos.push(k);
    if (conhecidos.length >= 40) break;
  }
  const vistos = conhecidos.filter((em) => classificar(em).temPlataformaPaga).length;
  console.log(
    `\ncontrole positivo: de ${conhecidos.length} pagantes de plataforma conhecidos (entitlement ativo), ` +
      `o classificador ve compra de PLATAFORMA em ${vistos}`,
  );
  if (conhecidos.length === 0 || vistos === 0) {
    console.error(
      "\n✖ ABORTADO. O classificador nao reconheceu NENHUM pagante de plataforma conhecido.\n" +
        "  Qualquer 'so curso' desta varredura seria cegueira, nao medicao — e diria\n" +
        "  'ninguem esta trancado' exatamente onde pode haver gente trancada.",
    );
    process.exit(3);
  }

  // ── 3. A REGUA DO #505, RE-RODADA ─────────────────────────────────────────
  const classe = [];
  for (const ped of pedidos) {
    if (String(ped.status) !== "pronto" || !ped.user_id) continue;
    const perf = perfilPorId.get(ped.user_id);
    if (!perf) continue;
    const creditos = (perf.credits_subscription ?? 0) + (perf.credits_extra ?? 0);
    const venceu = !perf.access_until || new Date(perf.access_until).getTime() < agora;
    const temEnt = entAtivaPlataforma.has(ped.user_id) || entAtivaPlataforma.has(norm(perf.email));
    if (creditos === 0 && venceu && !temEnt) {
      classe.push({ ped, perf, email: norm(perf.email || ped.email) });
    }
  }

  const dias = (iso) => (iso ? (agora - new Date(iso).getTime()) / 86400000 : null);
  classe.sort((a, b) => (dias(b.ped.voz_pronta_em ?? b.ped.criado_em) ?? 0) - (dias(a.ped.voz_pronta_em ?? a.ped.criado_em) ?? 0));

  // ── 4. O SPLIT ────────────────────────────────────────────────────────────
  const trancadosDePlataforma = [];
  const soCurso = [];
  const semCompraNesteEmail = [];
  for (const c of classe) {
    const cl = classificar(c.email);
    if (cl.temPlataformaPaga) trancadosDePlataforma.push({ ...c, cl });
    else if (cl.temCursoPago) soCurso.push({ ...c, cl });
    else semCompraNesteEmail.push({ ...c, cl });
  }

  console.log("\n" + "═".repeat(72));
  console.log(`CLASSE DO #505, RE-MEDIDA AGORA: ${classe.length} aluno(s)`);
  console.log("  (SGP 'pronto' + zero credito + access_until nulo/vencido + sem entitlement ativo)");
  console.log("═".repeat(72));
  const maisVelho = classe[0];
  if (maisVelho) {
    const d = dias(maisVelho.ped.voz_pronta_em ?? maisVelho.ped.criado_em);
    console.log(`mais velho: ${maisVelho.email} ha ${d?.toFixed(1)}d`);
  }

  console.log(`\n── 🔴 COMPRA DE PLATAFORMA PAGA E SEM ENTITLEMENT (defeito nosso): ${trancadosDePlataforma.length}`);
  for (const t of trancadosDePlataforma) {
    const val = t.cl.pagas.filter((p) => !p.curso).map((p) => `${p.produto}=${p.valor}`).join(" ");
    console.log(`   ${t.email} · ${dias(t.ped.voz_pronta_em ?? t.ped.criado_em)?.toFixed(1)}d · PLATAFORMA: ${val}`);
  }
  if (!trancadosDePlataforma.length) {
    console.log("   (nenhum — a classe nao esconde pagante de plataforma trancado)");
  }

  console.log(`\n── ⚪ SO CURSO PAGO (o contrato: curso nao da a plataforma): ${soCurso.length}`);
  for (const t of soCurso.slice(0, 60)) {
    const val = t.cl.pagas.map((p) => `${p.produto}=${p.valor}`).join(" ");
    console.log(`   ${t.email} · ${dias(t.ped.voz_pronta_em ?? t.ped.criado_em)?.toFixed(1)}d · ${val}`);
  }

  console.log(`\n── ⚠️ SEM COMPRA NESTE E-MAIL (NAO e "nao pagou" — ver docstring): ${semCompraNesteEmail.length}`);
  for (const t of semCompraNesteEmail.slice(0, 60)) {
    console.log(`   ${t.email} · ${dias(t.ped.voz_pronta_em ?? t.ped.criado_em)?.toFixed(1)}d`);
  }

  // ── 5. CONFERENCIA DA LISTA CONTRA O FONTE ───────────────────────────────
  const fs = require("node:fs");
  const path = require("node:path");
  const fonte = fs.readFileSync(
    path.join(__dirname, "..", "..", "frontend", "src", "lib", "payments", "acesso-regra.ts"),
    "utf8",
  );
  const m = fonte.match(/PRODUTOS_DE_CURSO_PADRAO\s*=\s*\[([^\]]+)\]/);
  const noFonte = m ? Array.from(m[1].matchAll(/"(\d+)"/g)).map((x) => x[1]).sort() : [];
  const aqui = [...CURSOS].sort();
  const bate = JSON.stringify(noFonte) === JSON.stringify(aqui);
  console.log(`\nlista de curso: aqui ${JSON.stringify(aqui)} · no fonte ${JSON.stringify(noFonte)} · ${bate ? "BATE" : "✖ DIVERGE"}`);
  if (!bate) {
    console.error("✖ A lista deste script divergiu do acesso-regra.ts — o split acima nao vale.");
    process.exit(4);
  }

  console.log("\n>>> PRO RELATORIO:");
  console.log(`    classe ${classe.length} · plataforma trancada ${trancadosDePlataforma.length}` +
    ` · so curso ${soCurso.length} · sem compra neste e-mail ${semCompraNesteEmail.length}`);

  if (jsonOut) {
    console.log("\n" + JSON.stringify({
      classe: classe.length,
      trancadosDePlataforma: trancadosDePlataforma.map((t) => t.email),
      soCurso: soCurso.map((t) => t.email),
      semCompraNesteEmail: semCompraNesteEmail.map((t) => t.email),
    }, null, 2));
  }
})();
