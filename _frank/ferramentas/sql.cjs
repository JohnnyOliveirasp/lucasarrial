// Roda SQL no projeto via Management API (DDL funciona aqui; PostgREST nao).
// uso: node sql_mgmt.cjs "<sql>"  |  node sql_mgmt.cjs --arquivo caminho.sql
require(require("node:path").join(__dirname, "..", "..", "frontend", "node_modules", "dotenv")).config({ path: require("node:path").join(__dirname, "..", "..", "frontend", ".env.local") });
const fs = require("node:fs");
const PROJECT = "yizerthyrgrajivlotcw";
(async () => {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente");
  const a = process.argv.slice(2);
  const query = a[0] === "--arquivo" ? fs.readFileSync(a[1], "utf8") : a[0];
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  console.log("HTTP", r.status);
  console.log(txt.slice(0, 2000));
  if (!r.ok) process.exit(1);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
