const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data } = await db.from("incidents").select("numero,status,agent_notes").eq("id","c726c5ae-2ddd-48c1-b490-61fba2369229").single();
  console.log("#"+data.numero, "status:", data.status, "| notas:", (data.agent_notes||[]).length);
  for (const n of (data.agent_notes||[])) console.log(`  ${n.at} · ${n.by} · ${String(n.note).replace(/\s+/g," ").slice(0,150)}`);
})();
