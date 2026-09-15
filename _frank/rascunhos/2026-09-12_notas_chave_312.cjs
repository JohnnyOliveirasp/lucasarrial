const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data } = await db.from("incidents").select("agent_notes").eq("id","c726c5ae-2ddd-48c1-b490-61fba2369229").single();
  for (const n of (data.agent_notes||[])) {
    if (n.at.startsWith("2026-09-11T01:51") || n.at.startsWith("2026-09-12T10:49")) {
      console.log("=".repeat(88)); console.log(n.at, "·", n.by); console.log(n.note);
    }
  }
})();
