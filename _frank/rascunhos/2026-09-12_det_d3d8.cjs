const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data } = await db.from("incidents").select("*").eq("id","d3d8d1b2-159d-427a-a754-2363fdb24392").single();
  console.log("#"+data.numero, data.status, data.occurrences+"x", "first:", data.first_seen_at, "last:", data.last_seen_at);
  console.log("TITLE:", data.title);
  console.log("--- description ---\n" + String(data.description).slice(0,3000));
  console.log("--- resolution_note ---\n" + String(data.resolution_note||"(vazia)").slice(0,1500));
  const notes = data.agent_notes||[];
  console.log("\n--- NOTAS:", notes.length, "---");
  for (const n of notes) console.log(`  ${n.at} · ${n.by} · ${String(n.note).replace(/\s+/g," ").slice(0,130)}`);
  const { data: rec } = await db.from("agent_state").select("key,updated_at,value").eq("key","para_frank_d3d8d1b2").maybeSingle();
  if (rec) { console.log("\n=== RECADO ===", rec.updated_at); console.log(JSON.stringify(rec.value).slice(0,2500)); }
})();
