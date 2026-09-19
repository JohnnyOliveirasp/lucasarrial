/**
 * 2026-09-19_segundo_email_por_cpf.cjs — "este aluno tem OUTRO endereço vivo?"
 *
 * POR QUE EXISTE. Quando a carta de acesso quica (classe #249 e irmãs), a
 * pergunta que decide o caso é: existe um SEGUNDO e-mail do mesmo ser humano?
 * Se existir e estiver vivo, o caso se resolve HOJE por e-mail, que é canal
 * pré-autorizado (regra 8) — sem aval de ninguém, sem canal externo. Se não
 * existir, aí sim o caso está legitimamente travado em decisão.
 *
 * Em 17/09 essa pergunta foi respondida para o Glauber com um script de ocasião
 * que NÃO foi salvo. A resposta sobreviveu só como texto numa nota, e a
 * FERRAMENTA morreu junto com o worktree — exatamente o buraco do #101/#210,
 * agora na perna de medição. Como a classe tem NOVE pagantes (R$ 7.400,82,
 * medido hoje), a pergunta vai se repetir; então ela vira peça commitada, e não
 * script de ocasião pela segunda vez.
 *
 * ⚠️ SÓ LEITURA. Não manda e-mail, não escreve no banco, não fecha incidente.
 *
 * ══════════════════════════════════════════════════════════════════════
 * AS TRÊS ARMADILHAS QUE ESTA FERRAMENTA EXISTE PARA NÃO REPETIR
 * (todas medidas em 17/09, na apuração do #249 — estão na nota [5] do card)
 * ══════════════════════════════════════════════════════════════════════
 *
 * (1) JANELA CURTA POR PADRÃO. `/sales/history` SEM `start_date` usa uma
 *     janela curta e some com compra antiga: o Anderson (06/08) e as 5 compras
 *     da Eliane (desde 23/04) sumiam inteiros. Aqui `start_date` é SEMPRE
 *     explícito. Zero de janela curta parece "não tem" e não é.
 *
 * (2) buyer_name CASA POR PREFIXO, E AS DUAS PONTAS DA API DIVERGEM.
 *     `/sales/users` devolve "Glauber jiordany o lopes"; buscar
 *     `/sales/history` com esse nome inteiro devolve ZERO, enquanto
 *     "Glauber jiordany" devolve 2. Por isso aqui se tenta uma ESCADA de
 *     prefixos (nome inteiro, 3 palavras, 2 palavras, 1 palavra) e se une o
 *     resultado. Buscar só pelo nome canônico é como não buscar.
 *
 * (3) NOME PARECIDO NÃO É PESSOA — CPF É. A busca por "Glauber" devolveu 11
 *     transações de SEIS endereços, e um deles (glauber.neurologia@gmail.com)
 *     era e-mail VIVO e "cheirava" à mesma pessoa. NÃO ERA: CPF, telefone,
 *     sobrenome e cidade diferentes. Mandar o link de definir senha de um
 *     pagante para lá teria entregado a conta dele a um estranho.
 *     Por isso o veredito aqui é DECIDIDO POR DOCUMENTO, nunca por nome nem
 *     por domínio parecido. Candidato sem CPF conferível sai como NÃO PROVADO,
 *     que é diferente de "é ele".
 *
 * ⚠️ CONTROLE POSITIVO OBRIGATÓRIO (mesma disciplina do contato_hotmart.cjs).
 *     O Glauber é o controle: a busca por nome TEM que reencontrar as 2+
 *     transações dele. Se o controle voltar vazio, a ferramenta ABORTA em vez
 *     de dizer "ninguém tem segundo e-mail" — que é a mentira mais cara que ela
 *     poderia contar, e é literalmente o erro que esta ronda cometeu às 21:45Z
 *     lendo uma coluna que não existe e concluindo "cartão abandonado".
 *
 * Uso:
 *   node _frank/ferramentas/2026-09-19_segundo_email_por_cpf.cjs <email> [<email>...]
 *   node _frank/ferramentas/2026-09-19_segundo_email_por_cpf.cjs --fichas
 *
 * Credenciais: as MESMAS do pagou_de_verdade.cjs / contato_hotmart.cjs
 * (frontend/.env.local). Nenhum segredo é impresso.
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv"))
  .config({ path: path.join(RAIZ, "frontend", ".env.local") });

const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

/** Controle positivo: o caso do #249, cuja resposta já é conhecida e medida. */
const CONTROLE = "glaubermed@ig.com.br";

/**
 * Início da janela de busca. A casa não tem venda antes disto, e deixar
 * explícito é o conserto da armadilha (1). Nunca remover para "simplificar".
 */
const DESDE_MS = Date.UTC(2025, 0, 1);

const PAGO = new Set(["COMPLETE", "APPROVED"]);

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  let t;
  try { t = JSON.parse(raw).access_token; } catch { t = null; }
  if (!t) throw new Error(`sem access_token (HTTP ${r.status}) — credencial da Hotmart`);
  return t;
}

/** Corpo cru nunca vira [] em silêncio: se não parsear, o erro sobe. */
async function pedir(url, H, rotulo) {
  const r = await fetch(url, { headers: H });
  const raw = await r.text();
  try {
    const j = JSON.parse(raw);
    return j.items || (Array.isArray(j) ? j : []);
  } catch {
    throw new Error(`${rotulo} HTTP ${r.status}: ${raw.slice(0, 200)}`);
  }
}

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Ficha de identidade de UM endereço, como a Hotmart o conhece. */
async function identidade(email, H) {
  const us = await pedir(
    `${BASE}/sales/users?buyer_email=${encodeURIComponent(email)}&max_results=50`, H, "sales/users");
  for (const it of us) {
    for (const u of it.users || []) {
      if (String(u.role).toUpperCase() !== "BUYER") continue;
      const d = u.user || {};
      return {
        email,
        nome: d.name ?? null,
        doc: soDigitos(d.documents?.[0]?.value ?? d.ucode ?? ""),
        docTipo: d.documents?.[0]?.type ?? null,
        fone: soDigitos(d.phone?.number ?? ""),
      };
    }
  }
  return { email, nome: null, doc: "", docTipo: null, fone: "" };
}

/**
 * Escada de prefixos do nome — conserto da armadilha (2). Devolve as formas a
 * tentar, da mais específica para a mais ampla, sem repetir.
 */
function formasDoNome(nome) {
  const p = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  const formas = [];
  for (let n = p.length; n >= 1; n--) {
    const f = p.slice(0, n).join(" ");
    if (f && !formas.includes(f)) formas.push(f);
  }
  return formas;
}

/** Todos os endereços que aparecem sob QUALQUER forma do nome. */
async function enderecosPorNome(nome, H) {
  const achados = new Map(); // email -> { transacoes, forma }
  for (const forma of formasDoNome(nome)) {
    const vendas = await pedir(
      `${BASE}/sales/history?buyer_name=${encodeURIComponent(forma)}`
      + `&start_date=${DESDE_MS}&max_results=50`, H, "sales/history(buyer_name)");
    for (const v of vendas) {
      const em = String(v.buyer?.email ?? "").toLowerCase().trim();
      if (!em) continue;
      if (!achados.has(em)) achados.set(em, { transacoes: 0, formas: new Set() });
      const a = achados.get(em);
      a.transacoes++;
      a.formas.add(forma);
    }
  }
  return achados;
}

async function investigar(email, H) {
  const eu = await identidade(email, H);
  console.log("─".repeat(70));
  console.log(`🔎 ${email}`);
  if (!eu.nome) {
    console.log("   ⚠️  a Hotmart não devolve comprador para este endereço.");
    console.log("   NÃO concluo 'não tem segundo e-mail': a busca por nome parte do nome,");
    console.log("   e sem nome ela nem começa. Isto é NÃO MEDIDO, não é ausência.");
    return { email, veredito: "NAO_MEDIDO", candidatos: [] };
  }
  console.log(`   nome: ${eu.nome}`);
  console.log(`   doc:  ${eu.doc ? `${eu.doc} (${eu.docTipo ?? "?"})` : "(nenhum)"}`);

  const achados = await enderecosPorNome(eu.nome, H);
  achados.delete(email); // o próprio endereço não é "segundo"

  if (!achados.size) {
    console.log("   → nenhum OUTRO endereço sob este nome.");
    return { email, veredito: "SEM_SEGUNDO", candidatos: [] };
  }

  console.log(`   ${achados.size} outro(s) endereço(s) sob o mesmo nome — conferindo por DOCUMENTO:`);
  const candidatos = [];
  for (const [cand, info] of achados) {
    const ic = await identidade(cand, H);
    let veredito, marca;
    if (!eu.doc || !ic.doc) {
      veredito = "NAO_PROVADO"; marca = "❓";
    } else if (eu.doc === ic.doc) {
      veredito = "MESMA_PESSOA"; marca = "✅";
    } else {
      veredito = "OUTRA_PESSOA"; marca = "❌";
    }
    console.log(`      ${marca} ${cand}`);
    console.log(`         nome=${ic.nome ?? "?"} doc=${ic.doc || "(nenhum)"} · ${info.transacoes} transação(ões)`);
    console.log(`         veredito: ${veredito}`);
    candidatos.push({ email: cand, ...ic, veredito });
  }

  const bons = candidatos.filter((c) => c.veredito === "MESMA_PESSOA");
  console.log(bons.length
    ? `   ➡️  ${bons.length} endereço(s) da MESMA pessoa: ${bons.map((b) => b.email).join(", ")}`
    : "   ➡️  nenhum candidato passou no CPF. Homônimo não é rota.");
  return { email, veredito: bons.length ? "TEM_SEGUNDO" : "SEM_SEGUNDO", candidatos };
}

(async () => {
  const args = process.argv.slice(2);
  const H = { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" };

  // ── CONTROLE POSITIVO, antes de qualquer afirmação ──────────────────────
  const ctrlNome = (await identidade(CONTROLE, H)).nome;
  const ctrl = ctrlNome ? await enderecosPorNome(ctrlNome, H) : new Map();
  const ctrlTx = [...ctrl.values()].reduce((s, a) => s + a.transacoes, 0);
  if (!ctrlNome || ctrlTx < 2) {
    console.error(`\n❌ CONTROLE POSITIVO FALHOU (${CONTROLE}): nome=${ctrlNome ?? "—"} transações=${ctrlTx}`);
    console.error("   A busca por nome não está chegando à Hotmart.");
    console.error("   NÃO acredite em nenhum 'não tem segundo e-mail' desta rodada.");
    process.exit(1);
  }
  console.log(`✅ controle positivo OK (${CONTROLE}: nome resolvido, ${ctrlTx} transação(ões) por nome)\n`);

  let alvos = args.filter((a) => !a.startsWith("--"));
  if (args.includes("--fichas")) {
    const { supa } = require("./_comum.cjs");
    const db = supa();
    const { data, error } = await db.from("incidents")
      .select("affected_emails,title,status")
      .in("status", ["open", "investigating"]);
    if (error) { console.error(`❌ incidents: ${error.message}`); process.exit(1); }
    const set = new Set();
    for (const i of data) {
      if (!/E-mail não chegou no aluno/i.test(i.title ?? "")) continue;
      for (const e of i.affected_emails ?? []) set.add(String(e).toLowerCase());
    }
    alvos = [...set];
    console.log(`${alvos.length} endereço(s) de fichas de bounce abertas\n`);
  }
  if (!alvos.length) {
    console.error("uso: <email> [...] | --fichas");
    process.exit(1);
  }

  const res = [];
  for (const e of alvos) res.push(await investigar(e, H));

  console.log("\n" + "═".repeat(70));
  const tem = res.filter((r) => r.veredito === "TEM_SEGUNDO");
  const sem = res.filter((r) => r.veredito === "SEM_SEGUNDO");
  const nm = res.filter((r) => r.veredito === "NAO_MEDIDO");
  console.log(`TEM 2º endereço (mesma pessoa por CPF): ${tem.length}`);
  for (const t of tem) {
    const b = t.candidatos.filter((c) => c.veredito === "MESMA_PESSOA").map((c) => c.email);
    console.log(`   ${t.email} → ${b.join(", ")}`);
  }
  console.log(`SEM 2º endereço: ${sem.length}`);
  console.log(`NÃO MEDIDO (sem nome na Hotmart): ${nm.length}`);
  console.log("═".repeat(70));
  console.log("Endereço que passou no CPF é rota de E-MAIL, canal pré-autorizado (regra 8).");
  console.log("Endereço que NÃO passou não é rota: homônimo recebe a conta de outra pessoa.");
})().catch((e) => { console.error(`\n❌ ${e.message}`); process.exit(1); });
