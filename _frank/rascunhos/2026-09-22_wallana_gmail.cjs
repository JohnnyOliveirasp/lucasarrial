/** #206: a compra esta em @gmail, a conta em @icloud. Existe conta no gmail? SOMENTE LEITURA. */
const { supa } = require("../ferramentas/_comum.cjs");
const G = "wallanadaphiny@gmail.com", I = "wallanadaphiny@icloud.com";
function exigir(r,e){ if(e){ console.error(`❌ FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();
  const { data: profs, error: e1 } = await db.from("profiles")
    .select("id,email,display_name,plan,credits_subscription,credits_extra,access_until,access_source,created_at,last_seen_at")
    .in("email", [G, I]);
  exigir("profiles", e1);
  console.log(`=== PERFIS com esses 2 enderecos: ${profs.length} ===`);
  for (const p of profs) console.log(" ", JSON.stringify(p));

  // qualquer perfil com prefixo wallana
  const { data: like, error: e2 } = await db.from("profiles")
    .select("id,email,display_name,plan,credits_subscription,credits_extra,created_at")
    .ilike("email", "%wallana%");
  exigir("profiles ilike", e2);
  console.log(`\n=== PERFIS com 'wallana' no e-mail: ${like.length} ===`);
  for (const p of like) console.log(" ", JSON.stringify(p));

  // entitlements / payment_events por qualquer chave
  for (const tab of ["entitlements", "payment_events"]) {
    const { data: r, error: e } = await db.from(tab).select("*").limit(1);
    if (e) { console.log(`\n(${tab}: ${e.message})`); continue; }
    console.log(`\n=== ${tab} colunas: ${Object.keys(r[0]||{}).join(", ")}`);
  }
})();
