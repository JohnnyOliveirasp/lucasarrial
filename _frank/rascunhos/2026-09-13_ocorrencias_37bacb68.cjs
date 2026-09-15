const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const INC = "37bacb68-afb9-42a9-9936-9214906fb4bb";
  const { data: occ, error } = await db.from("incident_occurrences")
    .select("*").eq("incident_id", INC).order("at");
  if (error) { console.log("ERRO:", error.message); process.exit(1); }
  console.log(`incident_occurrences para 37bacb68: ${occ.length}  (incidents.occurrences diz 32)`);
  console.log("colunas:", Object.keys(occ[0]||{}).join(", "));
  for (const o of occ) console.log(`  ${o.at} · kind=${o.kind} · ref=${String(o.ref_id).slice(0,8)}`);

  // cada ref_id e mesmo uma geracao failed com qa_coverage?
  const ids = occ.map(o=>o.ref_id);
  const { data: gens } = await db.from("generations").select("id,status,created_at,error_message").in("id", ids);
  const byId = new Map((gens||[]).map(g=>[g.id,g]));
  console.log("\n=== CONFERENCIA ref_id -> generations ===");
  let ok=0, fantasma=0, naoCov=0;
  for (const o of occ) {
    const g = byId.get(o.ref_id);
    if (!g) { console.log(`  FANTASMA (sem linha em generations): ${o.ref_id}`); fantasma++; continue; }
    const cov = String(g.error_message||"").includes("qa_coverage");
    if (g.status==="failed" && cov) ok++;
    else { console.log(`  DIVERGENTE ${o.ref_id.slice(0,8)} status=${g.status} cov=${cov} err=${String(g.error_message||"").slice(0,70)}`); naoCov++; }
  }
  console.log(`\nOK=${ok}  FANTASMA=${fantasma}  DIVERGENTE=${naoCov}`);
})();
