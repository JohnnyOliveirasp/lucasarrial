/**
 * LEITURA PURA — a Hotmart viva sobre o Regis (#263, rossiclinicas@gmail.com).
 * Pergunta que a ronda de 05/09 NAO tinha como responder: a cobranca marcada
 * para 08/09 12:00Z disparou mesmo com o cancelamento de 30/08?
 * Hoje (14/09) a data ja passou, entao da pra medir em vez de supor.
 * NAO escreve nada.
 */
require("./../ferramentas/_comum.cjs");
const { token, BASE, assinaturasDe } = require("./../ferramentas/_hotmart.cjs");
const EMAIL = "rossiclinicas@gmail.com";

(async () => {
  const H = { Authorization: `Bearer ${await token()}` };

  const a = await assinaturasDe(EMAIL);
  console.log("=== ASSINATURAS (viva) ===");
  if (!a.ok) { console.log("FALHOU:", a.erro, a.status); }
  else for (const s of a.assinaturas) {
    console.log(` code=${s.subscriber_code || s.subscriber?.code} status=${s.status}` +
      ` dt_next=${s.date_next_charge ? new Date(s.date_next_charge).toISOString() : "-"}` +
      ` cancel=${s.cancelation_date ? new Date(s.cancelation_date).toISOString() : "-"}` +
      ` plano=${s.plan?.name || "-"} recorrencia=${s.plan?.recurrency_period || "-"}`);
  }

  const codes = a.ok ? a.assinaturas.map((s) => s.subscriber_code || s.subscriber?.code).filter(Boolean) : [];
  for (const c of codes) {
    const r = await fetch(`${BASE}/subscriptions/${c}/purchases?max_results=50`, { headers: H });
    const j = await r.json().catch(() => null);
    console.log(`\n=== COBRANCAS da ${c} (HTTP ${r.status}) ===`);
    const items = j?.items || [];
    console.log(`total ${items.length}`);
    for (const p of items) {
      console.log(`  ${new Date(p.order_date || p.approved_date).toISOString()} ` +
        `valor=${p.price?.value} status=${p.status} trans=${p.transaction} ` +
        `recorrencia=${p.recurrency_number ?? "-"}`);
    }
  }

  // Controle: historico de vendas por comprador, independente da assinatura.
  const r2 = await fetch(`${BASE}/sales/history?buyer_email=${encodeURIComponent(EMAIL)}&max_results=50`, { headers: H });
  const j2 = await r2.json().catch(() => null);
  console.log(`\n=== SALES/HISTORY (HTTP ${r2.status}) — controle independente ===`);
  const it2 = j2?.items || [];
  console.log(`total ${it2.length}`);
  for (const s of it2) {
    console.log(`  ${new Date(s.purchase?.order_date).toISOString()} valor=${s.purchase?.price?.value} ` +
      `status=${s.purchase?.status} trans=${s.purchase?.transaction} prod=${s.product?.id}`);
  }
  if (!it2.length) console.log("  (vazio — NAO concluir 'sem cobranca' sem controle positivo)");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
