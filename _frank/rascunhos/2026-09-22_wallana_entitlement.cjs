const { supa } = require("../ferramentas/_comum.cjs");
const G = "wallanadaphiny@gmail.com", I = "wallanadaphiny@icloud.com";
const UID_G = "b7d51cf2-9965-4067-babe-b1ba19817039", UID_I = "6ed87d18-5406-4572-86b6-f78fe32d4e19";
function exigir(r,e){ if(e){ console.error(`❌ FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();
  const { data: ent, error: e1 } = await db.from("entitlements").select("*").or(`buyer_email.eq.${G},buyer_email.eq.${I},user_id.eq.${UID_G},user_id.eq.${UID_I}`);
  exigir("entitlements", e1);
  console.log(`=== ENTITLEMENTS: ${ent.length} ===`);
  for (const x of ent) console.log(" ", JSON.stringify({id:x.id,user_id:x.user_id,buyer_email:x.buyer_email,provider:x.provider,product_code:x.product_code,status:x.status,access_until:x.access_until,external_id:x.external_id,created_at:x.created_at}));

  const { data: pe, error: e2 } = await db.from("payment_events").select("id,provider,event_id,event_type,buyer_email,received_at,processed_at,error").in("buyer_email",[G,I]);
  exigir("payment_events", e2);
  console.log(`\n=== PAYMENT_EVENTS nos 2 enderecos: ${pe.length} ===`);
  for (const x of pe) console.log(" ", JSON.stringify(x));

  // as transacoes da Hotmart existem no nosso banco?
  for (const tx of ["HP1969848133","HP1469289814"]) {
    const { data: r, error: e } = await db.from("payment_events").select("id,event_type,buyer_email,received_at,processed_at,error").ilike("payload", `%${tx}%`);
    if (e) { console.log(`\n(busca ${tx}: ${e.message})`); continue; }
    console.log(`\n=== transacao ${tx} no payment_events: ${r.length} linha(s) ===`);
    for (const x of r) console.log("  ", JSON.stringify(x));
  }

  // creditos de qualquer natureza
  const { data: ct, error: e3 } = await db.from("credit_transactions").select("*").in("user_id",[UID_G,UID_I]).limit(30);
  if (e3) console.log(`\n(credit_transactions: ${e3.message})`);
  else { console.log(`\n=== CREDIT_TRANSACTIONS: ${ct.length} ===`); for (const x of ct) console.log("  ", JSON.stringify(x).slice(0,260)); }
})();
