/**
 * "Esta pessoa PAGOU de verdade?" — a pergunta que já nos enganou.
 *
 * ⚠️ O ENGANO QUE ESTE SCRIPT EXISTE PARA IMPEDIR (18/08/2026):
 * a Hotmart emite a mensalidade de R$97 assim que o trial acaba e a deixa com
 * status OVERDUE para quem NUNCA pagou. Quem filtra só por `price.value > 0`
 * vê "R$97" e conclui "pagou". Isso levou a devolver 1.356.554 créditos a 14
 * pessoas que nunca pagaram. **O que decide é o `status`, não o valor.**
 *
 * Regra: pagou = price.value > 0  E  status IN (COMPLETE, APPROVED).
 *
 * ⚠️ O SEGUNDO ENGANO, medido em 31/08/2026 (incidente #173): este script
 * perguntava à Hotmart SOMENTE por `/subscriptions`. Compra AVULSA
 * (UNIQUE_PAYMENT / MULTIPLE_PAYMENTS) não é assinatura e NÃO aparece ali —
 * então ele imprimia **"NUNCA PAGOU" para quem pagou**, e o `payment_events`
 * (a "segunda fonte independente") também devolvia zero, o que fazia as duas
 * fontes concordarem no erro e o resultado parecer confirmado.
 * Medido lado a lado no mesmo dia:
 *   johnathan.ppires@gmail.com  → "NUNCA PAGOU" · R$ 2.391,00 APPROVED (3 compras)
 *   comercial@roteironamao.com  → "NUNCA PAGOU" · R$   185,61 APPROVED (2 compras)
 *   70rrosusa@gmail.com         → "NUNCA PAGOU" · R$   684,92 APPROVED (3 compras)
 * Com base nessa leitura nós pedimos a um aluno pagante, duas vezes, que
 * provasse uma compra que estava lá o tempo todo. **Zero de um endpoint que
 * não faz a pergunta certa não é "não pagou": é instrumento cego.**
 *
 * ⚠️ E NÃO COLAPSE OS DOIS FATOS NUM BIT SÓ. "Pagou a assinatura do
 * FastCloner" e "comprou um curso avulso" são coisas diferentes e decidem
 * coisas diferentes. Este script agora responde as duas SEPARADAS, de
 * propósito: quem for decidir crédito precisa saber QUAL das duas é o caso.
 * Um booleano único aqui foi exatamente o que produziu o engano.
 *
 * Classifica por PESSOA, não por assinatura (a outra armadilha: alguém pode
 * ter uma segunda assinatura viva). Somente leitura — não toca em saldo.
 *
 * Uso:  node _frank/ferramentas/pagou_de_verdade.cjs email@aluno.com [outro@...]
 */
const fs = require("fs"), path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
for (const l of fs.readFileSync(path.join(RAIZ, "frontend", ".env.local"), "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0) {
    const k = l.slice(0, i).trim();
    const v = l.slice(i + 1).replace(/[\r\n]+$/g, "").replace(/^["']|["']$/g, "");
    if (/^[A-Za-z0-9_]+$/.test(k)) process.env[k] = v;
  }
}
const { supa } = require("./_comum.cjs");
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
const PAGO = new Set(["COMPLETE", "APPROVED"]);

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  const t = JSON.parse(raw).access_token;
  if (!t) throw new Error(`sem access_token (HTTP ${r.status})`);
  return t;
}

/** Devolve { pagou, cobrancas, pagas, erro } para um e-mail. */
async function pagouDeVerdade(email, H, db) {
  email = email.toLowerCase();
  const rs = await fetch(`${BASE}/subscriptions?subscriber_email=${encodeURIComponent(email)}`, { headers: H });
  const rawS = await rs.text();
  let subs;
  // zero de um endpoint não é prova: se não parsear, devolve o corpo cru
  try { const j = JSON.parse(rawS); subs = j.items || (Array.isArray(j) ? j : []); }
  catch { return { erro: `subscriptions HTTP ${rs.status}: ${rawS.slice(0, 150)}` }; }

  const cobrancas = [];
  for (const s of subs) {
    const code = s.subscriber_code || s.subscriber?.code || s.code;
    if (!code) continue;
    const rp = await fetch(`${BASE}/subscriptions/${code}/purchases`, { headers: H });
    const rawP = await rp.text();
    let lista;
    try { const j = JSON.parse(rawP); lista = Array.isArray(j) ? j : (j.items || []); } // array PURO
    catch { return { erro: `purchases ${code} HTTP ${rp.status}: ${rawP.slice(0, 150)}` }; }
    for (const c of lista) cobrancas.push({
      code,
      valor: c.price?.value ?? 0,
      status: c.status,
      rec: c.recurrency_number ?? c.recurrence_number,
      data: c.approved_date ? new Date(c.approved_date).toISOString().slice(0, 10) : null,
    });
  }
  const pagas = cobrancas.filter((c) => c.valor > 0 && PAGO.has(c.status));

  // segunda fonte, independente: o nosso próprio banco
  const { data: evs, error } = await db.from("payment_events")
    .select("event_type,payload").eq("provider", "hotmart")
    .or(`payload->data->buyer->>email.ilike.${email}`);
  if (error) return { erro: `payment_events: ${error.message}` };
  const aprovados = (evs || []).filter((ev) => ev.event_type === "PURCHASE_APPROVED"
    && (ev.payload?.data?.purchase?.price?.value ?? 0) > 0);

  // TERCEIRA fonte, e a que faltava: VENDAS. É aqui que mora a compra avulsa,
  // que /subscriptions não conhece. Sem esta pergunta o script mente (#173).
  const rv = await fetch(`${BASE}/sales/history?buyer_email=${encodeURIComponent(email)}&max_results=50`, { headers: H });
  const rawV = await rv.text();
  let vendasBrutas;
  // mesma disciplina do resto: zero que veio de falha NÃO pode virar "não pagou"
  if (!rv.ok) return { erro: `sales/history HTTP ${rv.status}: ${rawV.slice(0, 150)}` };
  try { const j = JSON.parse(rawV); vendasBrutas = j.items || (Array.isArray(j) ? j : []); }
  catch { return { erro: `sales/history não-JSON (HTTP ${rv.status}): ${rawV.slice(0, 150)}` }; }

  const vendas = vendasBrutas.map((i) => ({
    produto: (i.product?.name ?? "").trim() || "(sem nome)",
    valor: i.purchase?.price?.value ?? 0,
    status: i.purchase?.status,
    modo: i.purchase?.offer?.payment_mode,
    // is_subscription vem da Hotmart; só tratamos como avulsa quando ela diz
    // explicitamente que NÃO é assinatura — undefined não vira "avulsa".
    avulsa: i.purchase?.is_subscription === false,
    transacao: i.purchase?.transaction,
    data: i.purchase?.approved_date ? new Date(i.purchase.approved_date).toISOString().slice(0, 10) : null,
  }));
  const vendasPagas = vendas.filter((v) => v.valor > 0 && PAGO.has(v.status));
  const avulsasPagas = vendasPagas.filter((v) => v.avulsa);
  const totalAvulso = avulsasPagas.reduce((s, v) => s + v.valor, 0);

  return {
    // os dois fatos, SEPARADOS de propósito — ver o cabeçalho
    pagouAssinatura: pagas.length > 0 || aprovados.length > 0,
    pagouAvulso: avulsasPagas.length > 0,
    // mantido para quem só quer saber "entrou dinheiro desta pessoa?"
    pagou: pagas.length > 0 || aprovados.length > 0 || avulsasPagas.length > 0,
    assinaturas: subs.length,
    cobrancas,
    pagas,
    aprovadosNoBanco: aprovados.length,
    vendas,
    avulsasPagas,
    totalAvulso,
  };
}

module.exports = { pagouDeVerdade, PAGO };

if (require.main === module) (async () => {
  const emails = process.argv.slice(2);
  if (!emails.length) return console.log("uso: node pagou_de_verdade.cjs email@aluno.com [...]");
  const H = { Authorization: `Bearer ${await token()}` }, db = supa();
  for (const e of emails) {
    const r = await pagouDeVerdade(e, H, db);
    console.log("\n" + "=".repeat(70));
    if (r.erro) { console.log(`${e}\n  ERRO: ${r.erro}`); continue; }
    // NUNCA PAGOU só pode ser dito quando as TRÊS fontes vieram vazias.
    const veredito = r.pagou
      ? (r.pagouAssinatura && r.pagouAvulso ? "PAGOU — assinatura E compra avulsa"
        : r.pagouAssinatura ? "PAGOU — assinatura"
        : "PAGOU — SOMENTE compra avulsa (invisivel ao filtro antigo)")
      : "NUNCA PAGOU (nenhuma das 3 fontes)";
    console.log(`${e}\n  ${veredito}`
      + ` | assinaturas: ${r.assinaturas} | PURCHASE_APPROVED>0 no nosso banco: ${r.aprovadosNoBanco}`
      + ` | avulsas pagas: ${r.avulsasPagas.length}${r.totalAvulso ? ` (R$ ${r.totalAvulso.toFixed(2)})` : ""}`);
    for (const c of r.cobrancas) {
      console.log(`    assinatura rec#${c.rec} R$${String(c.valor).padStart(5)} ${String(c.status).padEnd(16)} ${c.data ?? ""}`
        + `${c.valor > 0 && !PAGO.has(c.status) ? "   <-- cobranca EXISTE mas NAO foi paga" : ""}`);
    }
    for (const v of r.vendas) {
      console.log(`    venda     ${(v.avulsa ? "AVULSA" : "assin.").padEnd(7)} R$${String(v.valor).padStart(8)}`
        + ` ${String(v.status).padEnd(16)} ${v.data ?? "sem data"} ${v.transacao ?? ""} ${v.produto}`
        + `${v.valor > 0 && !PAGO.has(v.status) ? "   <-- venda EXISTE mas NAO foi paga" : ""}`);
    }
    if (r.pagouAvulso && !r.pagouAssinatura) {
      console.log("    ⚠️  Esta pessoa PAGOU, mas nao pela assinatura do FastCloner."
        + " O que a compra avulsa da direito no FastCloner e decisao COMERCIAL, nao de script:"
        + " leve a gente. Nao trate como 'nunca pagou' (#173).");
    }
  }
})();
