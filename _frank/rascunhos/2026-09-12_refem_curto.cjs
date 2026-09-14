const { supa } = require("../ferramentas/_comum.cjs");
const PISO=480, RES=360, PC=40;
(async () => {
  const db = supa();
  const out=[];
  for (let off=0;;off+=1000){ const {data,error}=await db.from("generations")
    .select("id,created_at,elapsed_seconds,qa,runpod_job_id,text_raw,status")
    .eq("status","ready").gte("created_at","2026-09-05T00:00:00Z").range(off,off+999);
    if(error) throw new Error(error.message); out.push(...data); if(data.length<1000) break; }
  const reais = out.filter(g=>g.runpod_job_id && typeof g.qa?.setup_s==="number" && typeof g.elapsed_seconds==="number");
  const cls={};
  for (const g of reais){ const chars=(g.text_raw||"").length, ch=Math.max(1,Math.ceil(chars/160));
    const teto=Math.max(PISO,RES+ch*PC); (cls[ch] ??= {teto,el:[]}).el.push(g.elapsed_seconds); }
  console.log("QUANTO SETUP CADA CLASSE AGUENTA  (teto - inferencia)  | setup MAXIMO ja observado = 376.3s\n");
  console.log("chunks  n   teto   inf_p50  inf_p95  inf_max | setup tolerado(p95)  setup tolerado(max)  VEREDITO");
  for (const [ch,v] of Object.entries(cls).sort((a,b)=>a-b)){
    v.el.sort((a,b)=>a-b); const p=q=>v.el[Math.min(v.el.length-1,Math.floor(q*v.el.length))];
    const tolP95=v.teto-p(.95), tolMax=v.teto-v.el[v.el.length-1];
    const risco = tolP95 < 376.3 ? "⛔ ESTOURA com setup de pico" : "ok";
    console.log(`${String(ch).padStart(4)} ${String(v.el.length).padStart(4)} ${String(v.teto).padStart(6)} ${p(.5).toFixed(1).padStart(8)} ${p(.95).toFixed(1).padStart(8)} ${v.el[v.el.length-1].toFixed(1).padStart(8)} | ${tolP95.toFixed(1).padStart(16)} ${tolMax.toFixed(1).padStart(20)}  ${risco}`);
  }
  // quantas geracoes reais teriam falhado SE tivessem pego o setup de pico de 376,3s
  let fail=0, tot=0;
  for (const g of reais){ const chars=(g.text_raw||"").length, ch=Math.max(1,Math.ceil(chars/160));
    const teto=Math.max(PISO,RES+ch*PC); tot++; if (376.3 + g.elapsed_seconds > teto) fail++; }
  console.log(`\nSE TODA GERACAO TIVESSE PEGO O SETUP DE PICO (376,3s): ${fail}/${tot} teriam FALHADO (${(100*fail/tot).toFixed(1)}%)`);
  let f2=0; for (const g of reais){ const chars=(g.text_raw||"").length, ch=Math.max(1,Math.ceil(chars/160));
    const teto=Math.max(PISO,RES+ch*PC); if (265.3 + g.elapsed_seconds > teto) f2++; }
  console.log(`Com o pico de HOJE (265,3s): ${f2}/${tot} teriam falhado (${(100*f2/tot).toFixed(1)}%)`);
})();
