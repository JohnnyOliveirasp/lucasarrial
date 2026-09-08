/** Rodada 08/09 — le uma linha recente de `incidents` so pra ver as colunas. SOMENTE LEITURA. */
const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data, error } = await db.from("incidents").select("*").order("created_at", { ascending: false }).limit(2);
  if (error) { console.error("ERRO:", error.message); process.exit(1); }
  console.log(`colunas: ${Object.keys(data[0] || {}).join(", ")}\n`);
  for (const r of data) console.log(JSON.stringify(r, null, 2).slice(0, 1600), "\n---");
  // ja existe chamado aberto sobre aviso de orfa?
  const { data: abertos } = await db.from("incidents").select("id,number,title,status,created_at")
    .not("status", "in", "(fixed,ignored)").order("created_at", { ascending: false }).limit(60);
  console.log(`\nabertos: ${(abertos || []).length}`);
  for (const i of abertos || []) {
    if (/orfa|órfã|orphan|aviso|239/i.test(i.title || "")) console.log(`  #${i.number} ${i.status} ${i.title}`);
  }
})();
