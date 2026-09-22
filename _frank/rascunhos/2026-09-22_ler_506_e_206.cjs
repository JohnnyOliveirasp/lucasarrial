const { supa } = require("../ferramentas/_comum.cjs");
function exigir(r, e){ if(e){ console.error(`❌ FALHOU (${r}): ${e.message}`); process.exit(1);} }
(async () => {
  const db = supa();
  const { data, error } = await db.from("incidents")
    .select("id, numero, status, title, affected_emails, created_at, last_seen_at, occurrences, agent_notes")
    .in("numero", [506, 206, 223, 172]);
  exigir("incidents", error);
  for (const i of data.sort((a,b)=>a.numero-b.numero)) {
    console.log("=".repeat(70));
    console.log(`#${i.numero} [${i.status}] criado ${i.created_at} · visto ${i.last_seen_at} · ${i.occurrences}x`);
    console.log(`alunos: ${JSON.stringify(i.affected_emails)}`);
    console.log(`TITULO: ${i.title}`);
    const n = i.agent_notes;
    const txt = typeof n === "string" ? n : JSON.stringify(n, null, 1);
    console.log(`NOTAS (${(txt||"").length} chars):\n${(txt||"(vazio)").slice(-3500)}`);
  }
})();
