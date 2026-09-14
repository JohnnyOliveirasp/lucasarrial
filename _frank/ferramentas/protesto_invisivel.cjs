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
 */
const { supa } = require("./_comum.cjs");
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

const STATUS_DISPUTA = ["PROTESTED", "CHARGEBACK"];
const CONTROLE = ["HP2585148563", "HP3361171770"]; // Evelyn, medidas na mao em 14/09

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

async function puxarTudo(H, status) {
  const out = [];
  let pageToken = null;
  for (let i = 0; i < 40; i++) {
    const u = `${BASE}/sales/history?transaction_status=${status}&max_results=100`
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

  let itens = [];
  for (const s of STATUS_DISPUTA) {
    const r = await puxarTudo(H, s);
    console.log(`Hotmart ${s}: ${r.length} transacao(oes)`);
    itens.push(...r);
  }

  // --- CONTROLE POSITIVO ---
  const achadas = new Set(itens.map((i) => i.purchase?.transaction));
  const faltando = CONTROLE.filter((t) => !achadas.has(t));
  if (faltando.length) {
    console.error(`\nABORTADO: o controle positivo sumiu (${faltando.join(", ")}).`);
    console.error("Instrumento cego devolvendo zero e pior que nao rodar. Nao confie neste numero.");
    process.exit(1);
  }
  console.log(`controle positivo OK: ${CONTROLE.join(", ")} reencontradas\n`);

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
