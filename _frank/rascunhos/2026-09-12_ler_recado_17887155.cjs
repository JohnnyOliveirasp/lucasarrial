const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data: st } = await db.from("agent_state").select("key,value,updated_at").eq("key","para_frank_17887155").single();
  console.log("RECADO", st.updated_at);
  console.log(JSON.stringify(st.value, null, 1).slice(0, 2500));
  const { data: inc } = await db.from("incidents").select("id,numero,title,status,occurrences,last_seen_at,agent_notes")
    .in("numero", [287, 253]);
  for (const i of inc || []) {
    console.log("=".repeat(70));
    console.log("#"+i.numero, i.id, i.status, "occ", i.occurrences, "last", i.last_seen_at);
    console.log(i.title);
    const n = i.agent_notes || [];
    console.log("notas:", n.length);
    for (const x of n.slice(-2)) console.log("  -", x.at, x.by, String(x.note).slice(0, 700));
  }
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
