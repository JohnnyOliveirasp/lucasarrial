/** Conferencia 2: o PURCHASE_PROTEST de 21/09 e mesmo do drrigatti? SOMENTE LEITURA. */
const { supa } = require("/tmp/fc-main/_frank/ferramentas/_comum.cjs");
const ini="2026-09-21T00:00:00.000Z", fim="2026-09-22T00:00:00.000Z";
(async () => {
  const db = supa();
  const { data, error } = await db.from("payment_events")
    .select("id,event_type,received_at,payload")
    .eq("event_type","PURCHASE_PROTEST").gte("received_at",ini).lt("received_at",fim);
  if (error) return console.error("ERRO:", JSON.stringify(error));
  console.log(`PURCHASE_PROTEST na janela: ${data.length}`);
  for (const e of data) {
    const d = e.payload?.data ?? {};
    console.log(`  id=${e.id} recebido=${e.received_at}`);
    console.log(`  comprador: ${d.buyer?.email ?? d.subscriber?.email ?? "(sem email)"}`);
    console.log(`  transacao: ${d.purchase?.transaction ?? "-"}  status=${d.purchase?.status ?? "-"}  valor=${d.purchase?.price?.value ?? "-"}`);
    console.log("  --- payload cru (primeiros 700) ---");
    console.log("  " + JSON.stringify(e.payload).slice(0,700));
  }
  // busca direta por e-mail, SEM teto de 1000 (filtro no servidor)
  const { data: meus, error: e2 } = await db.from("payment_events")
    .select("id,event_type,received_at")
    .or("payload->data->buyer->>email.eq.mkt.drrigatti@gmail.com,payload->data->subscriber->>email.eq.mkt.drrigatti@gmail.com")
    .order("received_at",{ascending:true});
  console.log(`\n=== eventos do drrigatti (filtro no servidor): ${e2 ? "ERRO "+JSON.stringify(e2) : meus.length} ===`);
  for (const e of (meus||[])) console.log(`  ${e.received_at}  ${e.event_type}`);
})();
