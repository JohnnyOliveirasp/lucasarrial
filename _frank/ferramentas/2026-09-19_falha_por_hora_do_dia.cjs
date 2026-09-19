const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");
const CORTE = "2026-09-08T15:22:32Z";
(async () => {
  const cli = supa(); let todos = [], from = 0;
  for (;;) {
    const { data, error } = await cli.from("generations")
      .select("id,user_id,status,error_message,created_at,text_raw,elapsed_seconds")
      .gte("created_at", "2026-08-25T00:00:00Z").order("created_at",{ascending:true}).range(from, from+999);
    if (error) { console.log("ERRO CRU:", JSON.stringify(error)); process.exit(1); }
    todos = todos.concat(data||[]); if (!data || data.length < 1000) break; from += 1000;
  }
  const falhou = g => (g.status||"").toLowerCase()==="failed" || (g.error_message||"").length>0;
  const reg = todos.filter(x => x.created_at >= CORTE);

  console.log(`\n=== HORA DO DIA (UTC) na REGUA NOVA -- n=${reg.length} ===`);
  console.log("hora | total | falhas | taxa");
  const H = {};
  for (const g of reg) { const h = +g.created_at.slice(11,13); H[h]=H[h]||{t:0,f:0}; H[h].t++; if(falhou(g)) H[h].f++; }
  let antes=0, antesF=0, depois=0, depoisF=0;
  for (let h=0; h<24; h++) {
    const o = H[h]||{t:0,f:0};
    const mark = o.f>0 ? "  <<<" : "";
    console.log(`${String(h).padStart(2,"0")}h  | ${String(o.t).padStart(5)} | ${String(o.f).padStart(6)} | ${o.t?((o.f/o.t)*100).toFixed(1)+"%":"-"}${mark}`);
    if (h < 15) { antes+=o.t; antesF+=o.f; } else { depois+=o.t; depoisF+=o.f; }
  }
  console.log(`\n  00:00-14:59Z : ${antesF}/${antes} = ${((antesF/antes)*100).toFixed(2)}%`);
  console.log(`  15:00-23:59Z : ${depoisF}/${depois} = ${((depoisF/depois)*100).toFixed(2)}%`);
  console.log(`  >>> a ronda roda ~15:20Z. Ela ve a primeira metade; as falhas moram na segunda.`);

  // a ronda de HOJE ja viu que fracao do risco diario?
  const porDia = {};
  for (const g of reg) { const d=g.created_at.slice(0,10); porDia[d]=porDia[d]||{t:0,f:0,ate:0,ateF:0};
    porDia[d].t++; if(falhou(g)) porDia[d].f++;
    if (g.created_at.slice(11,19) <= "15:21:24") { porDia[d].ate++; if(falhou(g)) porDia[d].ateF++; } }
  console.log(`\n=== por dia: falhas ANTES vs DEPOIS de 15:21Z (regua nova) ===`);
  for (const d of Object.keys(porDia).sort()) { const o=porDia[d];
    console.log(`${d} | ate 15:21Z ${String(o.ateF).padStart(2)}/${String(o.ate).padStart(3)} | depois ${String(o.f-o.ateF).padStart(2)}/${String(o.t-o.ate).padStart(3)} | dia ${o.f}/${o.t}`); }

  // 16/09: qual linha sumiu? era falha ou sucesso?
  const d16 = reg.filter(x => x.created_at.slice(0,10)==="2026-09-16");
  console.log(`\n=== 16/09 hoje: total=${d16.length} falhas=${d16.filter(falhou).length} (vespera registrou 78 total / 4 falhas) ===`);
  console.log(`  => a linha que sumiu era ${d16.filter(falhou).length===4 ? "SUCESSO (falhas intactas: 4). A taxa PIOROU de 4/78=5,13% p/ 4/77=5,19%, nao melhorou." : "FALHA <<< ALERTA"}`);
})();
