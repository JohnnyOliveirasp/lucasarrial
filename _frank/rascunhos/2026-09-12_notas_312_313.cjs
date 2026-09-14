const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  for (const id of ["c726c5ae-2ddd-48c1-b490-61fba2369229","2d0509b4-9db6-4de0-8a98-fb419cb20fc5"]) {
    const { data } = await db.from("incidents").select("id,numero,agent_notes,description").eq("id", id).single();
    console.log("=".repeat(95));
    console.log("#"+data.numero, data.id);
    const notes = data.agent_notes || [];
    console.log("TOTAL NOTAS:", notes.length);
    // print the LAST 3 notes fully
    for (const n of notes.slice(-3)) {
      console.log("-".repeat(80));
      console.log(n.at, "by", n.by);
      console.log(n.note);
    }
    console.log("### FIM DA DESCRIPTION ###");
    console.log(String(data.description).slice(-1800));
  }
})();
