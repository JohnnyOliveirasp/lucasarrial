// Roda SQL no projeto via Management API (DDL funciona aqui; PostgREST nao).
// uso: node sql_mgmt.cjs "<sql>"  |  node sql_mgmt.cjs --arquivo caminho.sql
//      --completo  -> imprime a resposta INTEIRA (o padrao corta em 2000 chars)
// Por que o --completo existe: o corte em 2000 e SILENCIOSO. Lendo nota de
// incidente pela janela padrao, o texto chega cortado no meio e parece que
// acabou — foi assim que uma ronda quase decidiu em cima de meia nota. Quando
// o corte acontece, o rodape avisa quantos chars ficaram de fora.
require(require("node:path").join(__dirname, "..", "..", "frontend", "node_modules", "dotenv")).config({ path: require("node:path").join(__dirname, "..", "..", "frontend", ".env.local") });
const fs = require("node:fs");
const PROJECT = "yizerthyrgrajivlotcw";
(async () => {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente");
  const a = process.argv.slice(2).filter((x) => x !== "--completo");
  const completo = process.argv.includes("--completo");
  const query = a[0] === "--arquivo" ? fs.readFileSync(a[1], "utf8") : a[0];
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  console.log("HTTP", r.status);
  if (completo || txt.length <= 2000) {
    console.log(txt);
  } else {
    console.log(txt.slice(0, 2000));
    console.log(`\n[CORTADO: ${txt.length - 2000} chars a mais. Rode com --completo pra ver o resto — nao decida em cima do que aparece aqui.]`);
  }
  if (!r.ok) process.exit(1);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
