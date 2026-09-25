/**
 * QUANTAS contestacoes (PROTESTED/CHARGEBACK) existem VIVAS na Hotmart que o
 * nosso lado nunca registrou?
 *
 * Nasceu do caso Evelyn (#385): a venda PROTESTED **nao aparece** em
 * /sales/history?buyer_email=... (so aparece se voce passar
 * transaction_status=PROTESTED explicitamente). Como o `pagou_de_verdade.cjs`
 * — a fonte de verdade da casa pra "essa pessoa pagou?" — consulta por
 * buyer_email SEM esse parametro, uma pessoa com R$924,45 contestados le como
 * "avulsas pagas: 0".
 *
 * CONTROLE POSITIVO: as 2 transacoes da Evelyn TEM que reaparecer. Se zerarem,
 * o script ABORTA em vez de reportar "nenhuma contestacao" — zero de
 * instrumento cego ja enganou a casa em 07/09 e em 13/09.
 *
 * ===========================================================================
 * CORRECAO DE 25/09 (ronda ~13hZ) — o instrumento estava com DOIS defeitos.
 * Ele abortou nesta ronda, e ao investigar o porque apareceram os dois:
 *
 * (1) JANELA DE DATA IMPLICITA — mediu MENOS do que existe, em silencio.
 *     `/sales/history` SEM start_date/end_date nao devolve "tudo": devolve uma
 *     janela movel de ~30 dias. Medido hoje, lado a lado, mesmo token:
 *         sem janela .............. 76 PROTESTED (mais velha 2026-08-25)
 *         com janela de 2 anos .... 80 PROTESTED (mais velha 2026-04-05)
 *     Ou seja 4 contestacoes REAIS liam como inexistentes, e liriam cada vez
 *     mais a cada dia que passasse, porque a janela anda junto com o relogio.
 *     Zero que envelhece sozinho e a familia de defeito que ja enganou a casa
 *     duas vezes. Agora a janela e EXPLICITA e vem impressa no cabecalho.
 *     Limite medido da API: range de ~2 anos. start_date=2024-01-01 devolve
 *     HTTP 400; 2 anos exatos passa. Por isso JANELA_ANOS=2, nao "desde sempre".
 *
 * (2) O CONTROLE POSITIVO ESTAVA PRESO A UM ESTADO QUE MUDA SOZINHO.
 *     As 2 transacoes da Evelyn nao sumiram da Hotmart: elas SAIRAM de
 *     PROTESTED e hoje estao REFUNDED — conferido uma a uma por
 *     `?transaction=`, que acha as duas na hora (status=REFUNDED, 07/09,
 *     evelyn.cheida@gmail.com, R$672 e R$252,45). A disputa dela foi RESOLVIDA.
 *     Um controle presO a "ainda estar em disputa" nao mede se o instrumento
 *     ENXERGA — mede se a Evelyn continua brigando. E como disputa resolvida
 *     nunca volta pra PROTESTED, esse controle abortaria PARA SEMPRE, num
 *     instrumento que esta certo. Controle que so sabe dar errado e tao ruim
 *     quanto controle que so sabe dar certo.
 *
 *     O controle agora e por ALCANCE, nao por estado: cada transacao fixada
 *     tem que continuar ACHAVEL na API e com status da familia de disputa
 *     (PROTESTED/CHARGEBACK/REFUNDED). Se ela RESOLVEU, isso e dito em voz
 *     alta e a rodada segue. Se ela sumiu de vez, ou trocou pra familia
 *     nenhuma, ai sim o instrumento esta cego e ABORTA.
 *
 *     Junto vai um CONTROLE DE JANELA que nao tem como envelhecer, porque nao
 *     depende de nenhuma transacao fixada: mede com e sem janela e denuncia a
 *     diferenca. No dia em que a Hotmart mudar o padrao, ele avisa sozinho.
 * ===========================================================================
 */
const { supa } = require("./_comum.cjs");
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

const STATUS_DISPUTA = ["PROTESTED", "CHARGEBACK"];
// REFUNDED e da familia da disputa, mas NAO entra na conta de exposicao: quem
// foi reembolsado ja teve desfecho. Ele existe aqui so pra o controle positivo
// saber diferenciar "resolveu" de "sumiu".
const FAMILIA_DISPUTA = ["PROTESTED", "CHARGEBACK", "REFUNDED"];
const JANELA_ANOS = 2; // limite medido da API em 25/09: 2024-01-01 -> HTTP 400
// Integracao do SGP: a casa so passa a RECEBER webhook de compra do SGP em
// 09/06 (239 PURCHASE_APPROVED desde essa data, medido no #389). Disputa
// ANTERIOR a isso nao e cegueira do route.ts:206 — nunca houve por onde ver.
// Somar as duas infla o numero que vai pra decisao de dinheiro, que e
// exatamente o erro do "23 de 40" (regua inflada) que a casa ja pagou.
const CORTE_INTEGRACAO_SGP = new Date("2026-06-09").getTime();
const CONTROLE = ["HP2585148563", "HP3361171770"]; // Evelyn, medidas na mao em 14/09

function janela() {
  const fim = Date.now();
  const d = new Date(fim);
  d.setFullYear(d.getFullYear() - JANELA_ANOS);
  return { ini: d.getTime(), fim };
}

/** Acha UMA transacao pelo id, independente de status e de janela. */
async function porTransacao(H, trx) {
  const r = await fetch(`${BASE}/sales/history?transaction=${encodeURIComponent(trx)}`, { headers: H });
  if (!r.ok) return { erro: `HTTP ${r.status}` };
  const i = (JSON.parse(await r.text()).items ?? [])[0];
  if (!i) return { achada: false };
  return { achada: true, status: i.purchase?.status, email: i.buyer?.email, valor: i.purchase?.price?.value };
}

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const t = JSON.parse(await r.text()).access_token;
  if (!t) throw new Error(`sem access_token (HTTP ${r.status})`);
  return t;
}

const iso = (v) => (v ? new Date(Number(v)).toISOString().slice(0, 10) : "-");

async function puxarTudo(H, status, comJanela = true) {
  const out = [];
  let pageToken = null;
  const { ini, fim } = janela();
  const datas = comJanela ? `&start_date=${ini}&end_date=${fim}` : "";
  for (let i = 0; i < 40; i++) {
    const u = `${BASE}/sales/history?transaction_status=${status}&max_results=100${datas}`
      + (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "");
    const r = await fetch(u, { headers: H });
    const raw = await r.text();
    if (!r.ok) throw new Error(`sales/history ${status} HTTP ${r.status}: ${raw.slice(0, 200)}`);
    const j = JSON.parse(raw);
    out.push(...(j.items ?? []));
    pageToken = j.page_info?.next_page_token ?? null;
    if (!pageToken) break;
  }
  return out;
}

(async () => {
  const H = { Authorization: `Bearer ${await token()}` };
  const db = supa();

  const { ini, fim } = janela();
  console.log(`janela EXPLICITA: ${iso(ini)} -> ${iso(fim)} (${JANELA_ANOS} anos, limite da API)\n`);

  let itens = [];
  const totalPorStatus = {}; // contado na fonte, nao inferido do campo status
  for (const s of STATUS_DISPUTA) {
    const r = await puxarTudo(H, s);
    totalPorStatus[s] = r.length;
    console.log(`Hotmart ${s}: ${r.length} transacao(oes)`);
    itens.push(...r);
  }

  // --- CONTROLE DE JANELA (nao envelhece: nao depende de transacao fixada) ---
  // Mede o MESMO status com e sem janela. Se a janela implicita da API esconde
  // alguma coisa, a diferenca aparece aqui em vez de virar um numero menor e
  // plausivel no relatorio.
  console.log("\n-- controle de janela (com x sem start_date) --");
  let escondidasPelaJanela = 0;
  for (const s of STATUS_DISPUTA) {
    const semJanela = await puxarTudo(H, s, false);
    const comJanela = totalPorStatus[s];
    const dif = comJanela - semJanela.length;
    escondidasPelaJanela += Math.max(0, dif);
    console.log(`   ${s.padEnd(11)} com janela ${String(comJanela).padStart(3)} · sem janela ${String(semJanela.length).padStart(3)}`
      + (dif > 0 ? `  <- a janela implicita ESCONDIA ${dif}` : dif < 0 ? `  <- ATENCAO: sem janela veio MAIS (${-dif})` : "  (igual)"));
  }
  if (escondidasPelaJanela > 0) {
    console.log(`   >> ${escondidasPelaJanela} contestacao(oes) so aparecem com a janela explicita.`);
    console.log("      Quem rodar isto sem start_date le um numero MENOR e plausivel. Foi o defeito de 25/09.");
  }

  // --- CONTROLE POSITIVO, POR ALCANCE (nao por estado) ---
  // O controle antigo exigia que as transacoes fixadas AINDA estivessem em
  // disputa. Disputa resolvida nunca volta, entao aquilo abortava pra sempre
  // num instrumento correto. Aqui o que se cobra e que a API continue
  // ACHANDO a transacao e que ela siga na familia da disputa.
  console.log("\n-- controle positivo (alcance, nao estado) --");
  const cegueira = [];
  for (const t of CONTROLE) {
    const c = await porTransacao(H, t);
    if (c.erro) { cegueira.push(`${t}: ${c.erro}`); console.log(`   ${t}: FALHOU (${c.erro})`); continue; }
    if (!c.achada) { cegueira.push(`${t}: nao achada por ?transaction=`); console.log(`   ${t}: NAO ACHADA`); continue; }
    if (!FAMILIA_DISPUTA.includes(c.status)) {
      cegueira.push(`${t}: status ${c.status} fora da familia de disputa`);
      console.log(`   ${t}: status ${c.status} — FORA da familia de disputa`);
      continue;
    }
    const naLista = itens.some((i) => i.purchase?.transaction === t);
    console.log(`   ${t}: achavel OK · status ${c.status} · ${c.email} · R$ ${c.valor}`
      + (naLista ? " · consta na varredura" : ` · RESOLVIDA (saiu de ${STATUS_DISPUTA.join("/")}) — nao entra na exposicao, e isso esta certo`));
  }
  if (cegueira.length) {
    console.error(`\nABORTADO: o instrumento esta CEGO — ${cegueira.join(" | ")}`);
    console.error("Instrumento cego devolvendo zero e pior que nao rodar. Nao confie neste numero.");
    process.exit(1);
  }
  console.log("controle positivo OK: toda transacao fixada segue achavel e na familia da disputa.\n");

  const linhas = [];
  for (const i of itens) {
    const email = (i.buyer?.email ?? "").toLowerCase();
    const trx = i.purchase?.transaction;
    const valor = Number(i.purchase?.price?.value ?? 0);

    const { data: ents } = await db.from("entitlements")
      .select("id,status,access_until").ilike("buyer_email", email);
    // ⚠️ NAO existe coluna `credits` em profiles (armadilha medida em 13/09:
    // select inexistente devolve erro + data null e le como "SEM CONTA").
    const { data: prof, error: errProf } = await db.from("profiles")
      .select("id,credits_subscription,credits_extra").ilike("email", email).limit(1);
    if (errProf) throw new Error(`profiles: ${errProf.message}`);
    const { data: evs } = await db.from("payment_events")
      .select("event_type").ilike("buyer_email", email);

    const tipos = (evs ?? []).map((e) => e.event_type);
    const sabemosDaDisputa = tipos.some((t) => /PROTEST|CHARGEBACK|REFUND/i.test(t))
      || (ents ?? []).some((e) => ["chargeback", "refunded"].includes(e.status));
    const ativo = (ents ?? []).some((e) => e.status === "active");

    const p = prof?.[0];
    const creditos = p ? (p.credits_subscription ?? 0) + (p.credits_extra ?? 0) : null;
    const produto = i.product?.name ?? "";
    // So SGP e FastCloner sao provisionados por NOS. Curso/comunidade sao
    // outros produtos da casa: chargeback la nao e defeito deste sistema.
    const nosso = /Sistema de Gera|FastCloner/i.test(produto);

    linhas.push({
      trx, email, produto, valor, nosso,
      ordem: Number(i.purchase?.order_date ?? 0),
      status: i.purchase?.status, data: iso(i.purchase?.order_date),
      creditos, temConta: !!p,
      entAtivo: ativo,
      sabemos: sabemosDaDisputa,
    });
  }

  linhas.sort((a, b) => b.valor - a.valor);

  const soma = (xs) => xs.reduce((a, b) => a + b.valor, 0).toFixed(2);
  const pessoas = (xs) => new Set(xs.map((x) => x.email)).size;

  const cegos = linhas.filter((l) => !l.sabemos);
  const comAcesso = (xs) => xs.filter((l) => l.entAtivo || (l.creditos ?? 0) > 0);

  const nossos = linhas.filter((l) => l.nosso);
  const cegosNossos = cegos.filter((l) => l.nosso);
  const expostos = comAcesso(cegosNossos);

  console.log("=".repeat(104));
  console.log("TODOS OS PRODUTOS DA CASA (inclui curso/comunidade, que NAO sao provisionados por este sistema):");
  console.log(`  disputas na Hotmart: ${linhas.length} trx / ${pessoas(linhas)} pessoas  (R$ ${soma(linhas)})`);
  console.log(`  que o nosso lado NAO registrou: ${cegos.length} trx  (R$ ${soma(cegos)})`);
  console.log("");
  console.log("SO O QUE ESTE SISTEMA PROVISIONA (SGP + FastCloner) — o numero que e nosso:");
  console.log(`  disputas: ${nossos.length} trx / ${pessoas(nossos)} pessoas  (R$ ${soma(nossos)})`);
  console.log(`  invisiveis pra nos: ${cegosNossos.length} trx  (R$ ${soma(cegosNossos)})`);

  // --- CORTE DA INTEGRACAO: o que era PRA ter sido visto x o que predata ---
  const dep = nossos.filter((l) => l.ordem >= CORTE_INTEGRACAO_SGP);
  const ant = nossos.filter((l) => l.ordem < CORTE_INTEGRACAO_SGP);
  console.log("");
  console.log(`  >> DEPOIS de ${iso(CORTE_INTEGRACAO_SGP)} — a casa JA recebia webhook do SGP, era pra ter visto:`);
  console.log(`     ${dep.length} trx / ${pessoas(dep)} pessoas  (R$ ${soma(dep)})   <<< o numero da decisao`);
  console.log(`  -- ANTES do corte — predata a integracao, nunca houve por onde ver:`);
  console.log(`     ${ant.length} trx / ${pessoas(ant)} pessoas  (R$ ${soma(ant)})   (historico, nao e divida deste defeito)`);
  console.log(`  >> EXPOSICAO: em disputa, invisivel, e a pessoa AINDA tem acesso ou credito:`);
  console.log(`     ${expostos.length} trx / ${pessoas(expostos)} pessoas  (R$ ${soma(expostos)})`);
  console.log("=".repeat(104));

  console.log("\n-- EXPOSICAO (produto nosso, disputa invisivel, pessoa ainda servida) --");
  for (const l of expostos) {
    console.log(`  ${l.data} | ${String(l.valor).padStart(7)} | ${l.status.padEnd(10)} | ${l.email.padEnd(34)} | cred=${String(l.creditos ?? "SEM CONTA").padStart(9)} | entAtivo=${l.entAtivo} | ${l.produto}`);
  }

  const outrasNossas = cegosNossos.filter((x) => !expostos.includes(x));
  console.log(`\n-- produto nosso, disputa invisivel, mas SEM acesso/credito (${outrasNossas.length}) --`);
  for (const l of outrasNossas) {
    console.log(`  ${l.data} | ${String(l.valor).padStart(7)} | ${l.status.padEnd(10)} | ${l.email.padEnd(34)} | cred=${String(l.creditos ?? "SEM CONTA").padStart(9)} | ${l.produto}`);
  }

  const curso = comAcesso(cegos.filter((l) => !l.nosso));
  console.log(`\n-- CURSO/COMUNIDADE com acesso ativo aqui (${curso.length} trx / ${pessoas(curso)} pessoas, R$ ${soma(curso)}) --`);
  console.log("   (entitlement ativo e por E-MAIL: quase sempre a pessoa tambem comprou SGP/FastCloner.");
  console.log("    Chargeback do CURSO nao e divida deste sistema — listado so pra nao ficar invisivel.)");
  for (const l of curso) {
    console.log(`  ${l.data} | ${String(l.valor).padStart(7)} | ${l.status.padEnd(10)} | ${l.email.padEnd(34)} | ${l.produto}`);
  }
})();
