const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data } = await db.from("incidents").select("agent_notes").eq("id","d3d8d1b2-159d-427a-a754-2363fdb24392").single();
  for (const n of (data.agent_notes||[]).slice(-2)) { console.log("=".repeat(88)); console.log(n.at,"·",n.by); console.log(n.note); }
  const { data: rec } = await db.from("agent_state").select("*").eq("key","para_frank_d3d8d1b2").maybeSingle();
  console.log("\n########## RECADO ##########"); console.log(rec ? JSON.stringify(rec.value,null,1).slice(0,2000) : "(nenhum)");
})();
