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

  return {
    pagou: pagas.length > 0 || aprovados.length > 0,
    assinaturas: subs.length,
    cobrancas,
    pagas,
    aprovadosNoBanco: aprovados.length,
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
    console.log(`${e}\n  ${r.pagou ? "PAGOU DE VERDADE" : "NUNCA PAGOU"}`
      + ` | assinaturas: ${r.assinaturas} | PURCHASE_APPROVED>0 no nosso banco: ${r.aprovadosNoBanco}`);
    for (const c of r.cobrancas) {
      console.log(`    rec#${c.rec} R$${String(c.valor).padStart(5)} ${String(c.status).padEnd(16)} ${c.data ?? ""}`
        + `${c.valor > 0 && !PAGO.has(c.status) ? "   <-- cobranca EXISTE mas NAO foi paga" : ""}`);
    }
  }
})();
