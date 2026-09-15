const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const ids = ["c726c5ae-2ddd-48c1-b490-61fba2369229","2d0509b4-9db6-4de0-8a98-fb419cb20fc5"];
  for (const id of ids) {
    const { data, error } = await db.from("incidents").select("*").eq("id", id).single();
    if (error) { console.log("ERRO", error.message); continue; }
    console.log("=".repeat(90));
    console.log("#"+data.id, "|", data.status, "|", data.occurrences+"x", "| first:", data.first_seen_at, "| last:", data.last_seen_at);
    console.log("TITLE:", data.title);
    for (const k of Object.keys(data)) {
      if (["id","status","occurrences","first_seen_at","last_seen_at","title"].includes(k)) continue;
      const v = data[k]; if (v == null) continue;
      const s = typeof v === "string" ? v : JSON.stringify(v);
      if (s.length < 3) continue;
      console.log(`--- ${k} ---\n${s.slice(0,3000)}`);
    }
  }
})();
