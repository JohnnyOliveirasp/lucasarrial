const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  // Todas as geracoes failed com a assinatura do qa_coverage
  let todas = [], from = 0;
  for (;;) {
    const { data, error } = await db.from("generations")
      .select("id,user_id,voice_id,status,error_message,created_at,elapsed_seconds,qa,text_normalized,duration_seconds")
      .eq("status","failed").order("created_at",{ascending:false}).range(from, from+999);
    if (error) { console.log("ERRO:", error.message); process.exit(1); }
    todas = todas.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log("TOTAL failed (todas as causas):", todas.length);
  const cov = todas.filter(g => String(g.error_message||"").includes("qa_coverage"));
  console.log("FAILED com qa_coverage:", cov.length);
  console.log("\n=== LINHA DO TEMPO (por semana) ===");
  const sem = {};
  for (const g of cov) {
    const d = new Date(g.created_at);
    const k = d.toISOString().slice(0,10);
    sem[k] = (sem[k]||0)+1;
  }
  for (const k of Object.keys(sem).sort()) console.log(`  ${k}: ${sem[k]}`);
  console.log("\n=== AS 12 MAIS RECENTES ===");
  for (const g of cov.slice(0,12)) {
    console.log(`\n  ${g.created_at} · gen ${g.id.slice(0,8)} · voice ${String(g.voice_id).slice(0,8)} · ${g.elapsed_seconds}s · chars=${String(g.text_normalized||"").length}`);
    console.log(`    erro: ${String(g.error_message).slice(0,160)}`);
    console.log(`    qa: ${JSON.stringify(g.qa)}`);
  }
})();
