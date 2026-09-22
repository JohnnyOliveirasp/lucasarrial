const { supa } = require("../ferramentas/_comum.cjs");
function exigir(r, e){ if(e){ console.error(`❌ FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();
  const { data, error } = await db.from("agent_state")
    .select("key, updated_at, value")
    .gte("updated_at", "2026-09-22T11:00:00Z")
    .order("updated_at", { ascending: false });
  exigir("agent_state", error);
  console.log(`chaves atualizadas desde 22/09 11hZ: ${data.length}\n`);
  for (const r of data) {
    const v = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
    console.log(`── ${r.key} · ${r.updated_at}`);
    console.log(`   ${v.slice(0, 700)}\n`);
  }
})();
