const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data } = await db.from("incidents").select("id,numero,status,occurrences,first_seen_at,last_seen_at,agent_notes").eq("id","f8587cef-543e-44e8-9c3c-cb9714960795");
  const i = data[0];
  console.log("#"+i.numero, i.id, i.status, "occ", i.occurrences);
  console.log("first", i.first_seen_at, "last", i.last_seen_at);
  const n = i.agent_notes || [];
  console.log("NOTAS:", n.length);
  for (const x of n.slice(-2)) { console.log("-".repeat(80)); console.log(x.at, "by", x.by); console.log(String(x.note).slice(0,2500)); }
})().catch(e => { console.error("ERRO", e.message); process.exit(1); });
