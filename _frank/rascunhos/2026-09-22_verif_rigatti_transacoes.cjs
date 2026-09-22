/** O PURCHASE_COMPLETE de hoje e da MESMA transacao protestada? SOMENTE LEITURA. */
const { supa } = require("/tmp/fc-main/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data, error } = await db.from("payment_events")
    .select("id,event_type,received_at,payload")
    .or("payload->data->buyer->>email.eq.mkt.drrigatti@gmail.com,payload->data->subscriber->>email.eq.mkt.drrigatti@gmail.com")
    .order("received_at",{ascending:true});
  if (error) return console.error("ERRO:", JSON.stringify(error));
  for (const e of data) {
    const d = e.payload?.data ?? {};
    const p = d.purchase ?? {};
    console.log(`${e.received_at}  ${e.event_type}`);
    console.log(`    transacao=${p.transaction ?? "-"}  status=${p.status ?? "-"}  valor=${p.price?.value ?? "-"}  rec=${p.recurrence_number ?? d.subscription?.recurrence_number ?? "-"}`);
    if (p.order_date) console.log(`    order_date=${new Date(Number(p.order_date)).toISOString()}`);
  }
})();
