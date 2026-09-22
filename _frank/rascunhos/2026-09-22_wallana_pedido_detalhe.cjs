const { supa } = require("../ferramentas/_comum.cjs");
const EMAIL = "wallanadaphiny@icloud.com";
const UID = "6ed87d18-5406-4572-86b6-f78fe32d4e19";
function exigir(r,e){ if(e){ console.error(`❌ FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();
  const { data: p, error: e0 } = await db.from("profiles").select("last_seen_at,updated_at,image_ref_key,onboarding_ready_email_at,whatsapp,ja_pagou").eq("id", UID).single();
  exigir("profiles", e0);
  console.log("PERFIL extra:", JSON.stringify(p, null, 1));

  const { data: s, error: e1 } = await db.from("sgp_pedidos").select("*").eq("email", EMAIL).single();
  exigir("sgp_pedidos", e1);
  console.log("\n=== PEDIDO SGP COMPLETO ===");
  console.log(JSON.stringify(s, null, 1).slice(0, 3000));

  const { data: pe, error: e2 } = await db.from("payment_events").select("*").eq("email", EMAIL).limit(5);
  exigir("payment_events", e2);
  console.log(`\n=== PAYMENT EVENTS: ${pe.length} ===`);
  for (const x of pe) console.log(JSON.stringify(x).slice(0,400));

  const { data: ee, error: e3 } = await db.from("emails_enviados").select("*").eq("para", EMAIL);
  exigir("emails_enviados", e3);
  console.log(`\n=== EMAILS_ENVIADOS (cobre desde 14/09): ${ee.length} ===`);
  for (const x of ee) console.log(JSON.stringify(x).slice(0,300));
})();
