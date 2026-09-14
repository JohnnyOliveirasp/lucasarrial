#!/usr/bin/env node
/** READ-ONLY. O que o webhook gravou em payment_events pras 2 transacoes do #324? */
const { supa } = require("../ferramentas/_comum.cjs");

const TX = ["HP0150302636", "HP1390733090"];
const EMAILS = ["jcesaram@gmail.com", "patricia.bp170@gmail.com"];

(async () => {
  const db = supa();
  for (const email of EMAILS) {
    console.log("=".repeat(70));
    console.log(email);
    const { data, error } = await db
      .from("payment_events")
      .select("*")
      .ilike("buyer_email", email)
      .order("created_at", { ascending: true });
    if (error) {
      console.log("  ERRO:", error.message);
      continue;
    }
    console.log(`  ${data?.length ?? 0} evento(s)`);
    for (const ev of data ?? []) {
      console.log(
        `   - ${ev.created_at} tipo=${ev.event_type} status=${ev.status ?? "-"} produto=${ev.product_code ?? "-"} tx=${ev.transaction ?? "-"}`,
      );
      console.log(`     valor=${ev.value ?? "-"} processed=${ev.processed ?? "-"}`);
      if (ev.error) console.log(`     ERROR: ${String(ev.error).slice(0, 500)}`);
    }
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
