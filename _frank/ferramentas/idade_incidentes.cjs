const { supa } = require("./_comum.cjs");
(async () => {
  const db = supa();
  const agora = new Date();
  const dias = d => ((agora - new Date(d)) / 86400000);

  // 1) incidentes abertos com idade
  const { data: inc, error: e1 } = await db.from("incidents")
    .select("id,status,title,occurrences,created_at,first_seen_at,last_seen_at")
    .in("status", ["open", "investigating"]);
  if (e1) { console.log("ERRO incidents:", e1.message); process.exit(1); }
  console.log("TOTAL ABERTOS:", inc.length);

  const nasc = i => i.first_seen_at || i.created_at;
  inc.sort((a, b) => new Date(nasc(a)) - new Date(nasc(b)));

  const faixa = { "30d+": 0, "15-30d": 0, "7-15d": 0, "3-7d": 0, "<3d": 0 };
  for (const i of inc) {
    const d = dias(nasc(i));
    if (d >= 30) faixa["30d+"]++; else if (d >= 15) faixa["15-30d"]++;
    else if (d >= 7) faixa["7-15d"]++; else if (d >= 3) faixa["3-7d"]++; else faixa["<3d"]++;
  }
  console.log("\n=== POR IDADE ===");
  for (const [k, v] of Object.entries(faixa)) console.log(`  ${k}: ${v}`);

  console.log("\n=== OS 25 MAIS VELHOS ===");
  for (const i of inc.slice(0, 25)) {
    console.log(`  ${dias(nasc(i)).toFixed(1).padStart(6)}d · #${i.id} [${i.status}] (${i.occurrences}x) ${String(i.title).slice(0, 95)}`);
  }

  // 2) agent_state: patches e recados do vigia/executor
  const { data: st, error: e2 } = await db.from("agent_state")
    .select("key,updated_at,value");
  if (e2) { console.log("\nERRO agent_state:", e2.message); return; }
  const patches = st.filter(s => s.key.startsWith("patch_"));
  const recados = st.filter(s => s.key.startsWith("para_frank_"));
  console.log(`\n=== AGENT_STATE === total ${st.length} chaves`);
  console.log(`PATCHES DO VIGIA esperando: ${patches.length}`);
  for (const p of patches) console.log(`  ${p.key} · ${p.updated_at} · ${String(p.value?.assunto ?? "").slice(0,80)}`);
  console.log(`RECADOS (para_frank_*): ${recados.length}`);
  for (const r of recados.sort((a,b)=>new Date(a.updated_at)-new Date(b.updated_at)))
    console.log(`  ${dias(r.updated_at).toFixed(1)}d · ${r.key} · ${String(r.value?.subject ?? "").slice(0,80)}`);
})();
