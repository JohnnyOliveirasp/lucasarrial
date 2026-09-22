const { supa } = require("../ferramentas/_comum.cjs");
function exigir(r,e){ if(e){ console.error(`❌ FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();
  const { data, error } = await db.from("incidents").select("id,numero,status,title,affected_emails,created_at,agent_notes").eq("numero", 312).single();
  exigir("incidents", error);
  console.log(`#${data.numero} [${data.status}] ${data.created_at}`);
  console.log(`TITULO: ${data.title}\n`);
  console.log(`AFETADOS (${(data.affected_emails||[]).length}): ${JSON.stringify(data.affected_emails)}\n`);
  const n = data.agent_notes;
  const txt = typeof n === "string" ? n : JSON.stringify(n, null, 1);
  console.log("NOTAS:\n" + (txt||"").slice(0, 4000));
})();
