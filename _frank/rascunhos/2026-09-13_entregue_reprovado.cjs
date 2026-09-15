const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  let todas = [], from = 0;
  for (;;) {
    const { data, error } = await db.from("generations")
      .select("id,user_id,status,created_at,qa,text_normalized,audio_path")
      .gte("created_at","2026-08-01")
      .order("created_at",{ascending:true}).range(from, from+999);
    if (error) { console.log("ERRO:", error.message); process.exit(1); }
    todas = todas.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log("geracoes desde 01/08:", todas.length);
  const comQA = todas.filter(g => g.qa && typeof g.qa === "object");
  console.log("com telemetria qa:", comQA.length);

  // ENTREGUES (nao failed) que o proprio QA deu por esgotado na cobertura
  const ent = comQA.filter(g => g.status !== "failed" && Number(g.qa.coverage_exhausted||0) > 0);
  const fal = comQA.filter(g => g.status === "failed" && Number(g.qa.coverage_exhausted||0) > 0);
  console.log(`\nCOVERAGE ESGOTADO -> ENTREGUE ao aluno: ${ent.length}`);
  console.log(`COVERAGE ESGOTADO -> FALHOU (estorna):   ${fal.length}`);

  const semana = d => { const x=new Date(d); const o=new Date(x); o.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7)); return o.toISOString().slice(0,10); };
  const tab = {};
  for (const g of comQA) {
    if (!Number(g.qa.coverage_exhausted||0)) continue;
    const k = semana(g.created_at);
    tab[k] = tab[k] || { entregue:0, falhou:0 };
    if (g.status === "failed") tab[k].falhou++; else tab[k].entregue++;
  }
  console.log("\n=== POR SEMANA (segunda a domingo) — o fix de 27/08 migrou o modo de falha? ===");
  console.log("  semana        entregue  falhou");
  for (const k of Object.keys(tab).sort()) console.log(`  ${k}  ${String(tab[k].entregue).padStart(8)}  ${String(tab[k].falhou).padStart(6)}`);

  const alunos = new Set(ent.map(g=>g.user_id));
  console.log(`\nALUNOS que receberam audio com cobertura esgotada: ${alunos.size}`);
  console.log("\n=== AS 8 ENTREGUES MAIS RECENTES ===");
  for (const g of ent.slice(-8)) {
    const q=g.qa;
    console.log(`  ${g.created_at} · ${g.id.slice(0,8)} · status=${g.status} · cov_medio=${q.coverage_medio} · cov_best=${q.coverage_best} · faltantes=${JSON.stringify(q.faltantes_amostra||null)}`);
  }
})();
