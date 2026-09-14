const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const out = [];
  for (let off=0;;off+=1000) {
    const { data, error } = await db.from("generations")
      .select("id,name,status,created_at,elapsed_seconds,qa,runpod_job_id,text_raw,request_attempts,user_id")
      .eq("status","ready").gte("created_at","2026-09-05T00:00:00Z").range(off,off+999);
    if (error) throw new Error(error.message);
    out.push(...data); if (data.length<1000) break;
  }
  const alvo = out.filter(g => g.id.startsWith("f23dd5e9") || g.id.startsWith("f7a0420c"));
  for (const g of alvo) {
    const chars=(g.text_raw||"").length, chunks=Math.max(1,Math.ceil(chars/160));
    const teto=Math.max(480,360+chunks*40), setup=g.qa?.setup_s, total=(setup||0)+(g.elapsed_seconds||0);
    console.log(`\n#${g.id.slice(0,8)} ${g.created_at} name="${g.name}" job=${g.runpod_job_id?"SIM":"NULL"} tentativas=${g.request_attempts}`);
    console.log(`  chars=${chars} chunks=${chunks} teto=${teto}s`);
    console.log(`  setup=${setup} + elapsed=${g.elapsed_seconds} = ${total.toFixed(1)}s -> ${(100*total/teto).toFixed(1)}% | folga ${(teto-total).toFixed(1)}s`);
    console.log(`  qa=${JSON.stringify(g.qa).slice(0,300)}`);
  }
  // distribuicao de setup HOJE vs dias anteriores
  console.log("\n=== SETUP POR DIA (reais, com setup_s) ===");
  const dia={};
  for (const g of out) { if(!g.runpod_job_id) continue; const s=g.qa?.setup_s; if(typeof s!=="number") continue;
    const d=g.created_at.slice(0,10); (dia[d] ??= []).push(s); }
  for (const [d,v] of Object.entries(dia).sort()) { v.sort((a,b)=>a-b);
    const p=q=>v[Math.min(v.length-1,Math.floor(q*v.length))];
    console.log(`  ${d} n=${String(v.length).padStart(3)} p50=${p(.5).toFixed(1)} p95=${p(.95).toFixed(1)} max=${v[v.length-1].toFixed(1)}`); }
})();
