/** O evento de protesto do drrigatti morreu igual aos da Paula (#446)? SOMENTE LEITURA. */
const { supa } = require("/tmp/fc-main/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data, error } = await db.from("payment_events").select("*")
    .eq("id","7e2a5440-be47-4b9e-a88a-080c60c472e7").maybeSingle();
  if (error) return console.error("ERRO:", JSON.stringify(error));
  console.log("=== evento PURCHASE_PROTEST do drrigatti ===");
  for (const k of Object.keys(data)) {
    if (k === "payload") continue;
    console.log(`  ${k}: ${JSON.stringify(data[k])?.slice(0,300)}`);
  }
  // Todos os eventos de dinheiro-de-volta e seu processed_at
  const { data: all, error: e2 } = await db.from("payment_events")
    .select("id,event_type,received_at,processed_at,error")
    .in("event_type",["PURCHASE_REFUNDED","PURCHASE_CHARGEBACK","PURCHASE_PROTEST"])
    .gte("received_at","2026-09-14T00:00:00Z").order("received_at",{ascending:true});
  if (e2) return console.error("ERRO2:", JSON.stringify(e2));
  console.log(`\n=== eventos de dinheiro-de-volta desde o merge de 14/09 (#446): ${all.length} ===`);
  for (const e of all) {
    const em = e.error ? String(e.error).slice(0,90) : "-";
    console.log(`  ${e.received_at.slice(0,19)}  ${e.event_type.padEnd(20)} processed_at=${e.processed_at ?? "NULL"}  erro=${em}`);
  }
})();
