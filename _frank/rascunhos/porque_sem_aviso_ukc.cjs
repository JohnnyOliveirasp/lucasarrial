/**
 * Rodada 08/09 — por que UKC2COC2 (R$97 pago em 06/09, sem conta) nao gerou
 * aviso de compra orfa, se a maquina do #239 ja estava viva (avisou as 00:35 e
 * as 12:10 do MESMO dia 06/09)? Aqui so se le o payload cru do evento.
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

(async () => {
  const db = supa();
  const { data: evs, error } = await db.from("payment_events")
    .select("id,event_type,received_at,processed_at,error,buyer_email,payload")
    .ilike("buyer_email", "rodrigo.limas.1978@gmail.com")
    .order("received_at", { ascending: true });
  if (error) { console.error("ERRO:", error.message); process.exit(1); }

  for (const e of evs) {
    const d = e.payload?.data ?? {};
    console.log("=".repeat(70));
    console.log(`${e.received_at} ${e.event_type}`);
    console.log(`  processed_at=${e.processed_at}  error=${JSON.stringify(e.error)}`);
    console.log(`  product.id=${d.product?.id}  product.ucode=${d.product?.ucode}  name=${d.product?.name}`);
    console.log(`  offer=${JSON.stringify(d.purchase?.offer ?? null)}`);
    console.log(`  buyer.email=${d.buyer?.email}  subscriber.email=${d.subscriber?.email}`);
    console.log(`  purchase.status=${d.purchase?.status} valor=${d.purchase?.price?.value} rec=${d.purchase?.recurrence_number}`);
  }

  // Comparar com um caso que AVISOU no mesmo dia, pra ver a diferenca
  console.log("\n" + "#".repeat(70));
  console.log("COMPARACAO — brunno.lopes@live.com (1206SZ6B) avisou em 06/09 12:10");
  const { data: ok } = await db.from("payment_events")
    .select("event_type,received_at,error,payload")
    .ilike("buyer_email", "brunno.lopes@live.com")
    .order("received_at", { ascending: true });
  for (const e of ok || []) {
    const d = e.payload?.data ?? {};
    console.log(`  ${e.received_at?.slice(0, 19)} ${e.event_type} product.id=${d.product?.id} valor=${d.purchase?.price?.value} error=${JSON.stringify(e.error)}`);
  }

  console.log(`\nHOTMART_PRODUCT_ID no .env = ${process.env.HOTMART_PRODUCT_ID ?? "(nao definido)"}`);
})();
