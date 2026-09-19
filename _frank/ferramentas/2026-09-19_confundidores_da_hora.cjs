const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");
const CORTE = "2026-09-08T15:22:32Z";
const lg = n => { let s=0; for(let i=2;i<=n;i++) s+=Math.log(i); return s; };
const lch = (n,k) => (k<0||k>n) ? -Infinity : lg(n)-lg(k)-lg(n-k);
function fisher(a,b,c,d){const n=a+b+c+d,r1=a+b,c1=a+c;const lp0=lch(c1,a)+lch(n-c1,r1-a)-lch(n,r1);let p=0;
 for(let x=Math.max(0,r1-(n-c1));x<=Math.min(r1,c1);x++){const lp=lch(c1,x)+lch(n-c1,r1-x)-lch(n,r1);if(lp<=lp0+1e-9)p+=Math.exp(lp);}return Math.min(1,p);}
(async () => {
  const cli = supa(); let todos=[], from=0;
  for(;;){const {data,error}=await cli.from("generations")
    .select("id,user_id,status,error_message,created_at,text_raw,elapsed_seconds")
    .gte("created_at","2026-08-25T00:00:00Z").order("created_at",{ascending:true}).range(from,from+999);
   if(error){console.log("ERRO CRU:",JSON.stringify(error));process.exit(1);} todos=todos.concat(data||[]);
   if(!data||data.length<1000)break; from+=1000;}
  const falhou = g => (g.status||"").toLowerCase()==="failed" || (g.error_message||"").length>0;
  const nch = g => (g.text_raw||"").length;
  const reg = todos.filter(x => x.created_at >= CORTE);
  const noite = g => +g.created_at.slice(11,13) >= 15;

  const A = reg.filter(g=>!noite(g)), B = reg.filter(noite);
  const aF=A.filter(falhou).length, bF=B.filter(falhou).length;
  console.log(`=== H-HORA: 00-14:59Z vs 15-23:59Z (regua nova) ===`);
  console.log(`  dia   : ${aF}/${A.length} = ${((aF/A.length)*100).toFixed(2)}%`);
  console.log(`  noite : ${bF}/${B.length} = ${((bF/B.length)*100).toFixed(2)}%`);
  console.log(`  Fisher bilateral p = ${fisher(aF, A.length-aF, bF, B.length-bF).toExponential(2)}`);
  console.log(`  P(ver 0 falha em ${A.length} se a taxa fosse a global ${((aF+bF)/reg.length*100).toFixed(2)}%) = ${(Math.pow(1-(aF+bF)/reg.length, A.length)*100).toFixed(3)}%`);

  console.log(`\n=== CONFUNDIDOR 1: o texto da noite e MAIOR? (as falhas moram em 1500-2500ch) ===`);
  const md = v => { if(!v.length) return "-"; const s=[...v].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
  console.log(`  mediana ch  dia=${md(A.map(nch))}  noite=${md(B.map(nch))}`);
  for (const [lo,hi,rot] of [[0,1000,"<1000ch"],[1000,1500,"1000-1500"],[1500,2500,"1500-2500"],[2500,1e9,">2500"]]) {
    const a=A.filter(g=>nch(g)>=lo&&nch(g)<hi), b=B.filter(g=>nch(g)>=lo&&nch(g)<hi);
    const af=a.filter(falhou).length, bf=b.filter(falhou).length;
    console.log(`  ${rot.padEnd(10)} | dia ${String(af).padStart(2)}/${String(a.length).padStart(3)} = ${a.length?((af/a.length)*100).toFixed(1):"-"}%  | noite ${String(bf).padStart(2)}/${String(b.length).padStart(3)} = ${b.length?((bf/b.length)*100).toFixed(1):"-"}%`);
  }
  console.log(`  >>> se a faixa 1500-2500 TAMBEM falha so a noite, a hora nao e disfarce do tamanho.`);

  console.log(`\n=== CONFUNDIDOR 2: sao sempre os MESMOS usuarios (que so usam a noite)? ===`);
  const uF = [...new Set(reg.filter(falhou).map(g=>g.user_id))];
  console.log(`  usuarios distintos com falha na regua nova: ${uF.length}`);
  for (const u of uF) {
    const g = reg.filter(x=>x.user_id===u);
    const dia = g.filter(x=>!noite(x)), noi = g.filter(noite);
    console.log(`  ${u} | total=${g.length} | de DIA ${dia.filter(falhou).length}/${dia.length} | de NOITE ${noi.filter(falhou).length}/${noi.length}`);
  }
  console.log(`  >>> usuario com geracao de DIA e zero falha de dia = a hora explica, nao a pessoa.`);

  console.log(`\n=== CONFUNDIDOR 3: e so concentracao em 16-17/09? tire esses dois dias ===`);
  const semBad = reg.filter(g => !["2026-09-16","2026-09-17"].includes(g.created_at.slice(0,10)));
  const a2=semBad.filter(g=>!noite(g)), b2=semBad.filter(noite);
  console.log(`  dia   : ${a2.filter(falhou).length}/${a2.length}`);
  console.log(`  noite : ${b2.filter(falhou).length}/${b2.length}`);
  console.log(`  >>> sobra so a de 11/09 20:53Z. Sem 16-17/09 o efeito e n=1: NAO CONCLUI sozinho.`);
  console.log(`      O que fica de pe SEM depender de significancia: a ronda roda as 15:21Z e`);
  console.log(`      NENHUMA das 17 falhas da regua nova aconteceu antes das 16:00Z.`);
})();
