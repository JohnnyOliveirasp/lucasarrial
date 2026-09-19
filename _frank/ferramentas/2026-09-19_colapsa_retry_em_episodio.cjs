// LICAO NOVA DE 19/09: o NUMERADOR tambem tem problema de denominador.
// 7 das 12 falhas de 17/09 sao a MESMA aluna reenviando o MESMO texto em 31 min.
// Isso e UM episodio, nao sete. Contar retry como evento independente INFLA o dia.
const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");
const CORTE = "2026-09-08T15:22:32Z";
(async () => {
  const cli = supa(); let todos=[], from=0;
  for(;;){const {data,error}=await cli.from("generations")
    .select("id,user_id,status,error_message,created_at,text_raw,elapsed_seconds")
    .gte("created_at","2026-08-25T00:00:00Z").order("created_at",{ascending:true}).range(from,from+999);
   if(error){console.log("ERRO CRU:",JSON.stringify(error));process.exit(1);} todos=todos.concat(data||[]);
   if(!data||data.length<1000)break; from+=1000;}
  const falhou = g => (g.status||"").toLowerCase()==="failed" || (g.error_message||"").length>0;
  const nch = g => (g.text_raw||"").length;
  const reg = todos.filter(x=>x.created_at>=CORTE);

  // episodio = mesmo user + mesmo tamanho de texto + intervalo < 45 min da falha anterior
  const colapsa = (fs) => {
    const eps = [];
    for (const g of fs) {
      const ant = eps.find(e => e.user===g.user_id && e.ch===nch(g)
        && (new Date(g.created_at) - new Date(e.fim)) < 45*60000);
      if (ant) { ant.n++; ant.fim = g.created_at; }
      else eps.push({ user:g.user_id, ch:nch(g), ini:g.created_at, fim:g.created_at, n:1 });
    }
    return eps;
  };

  console.log("=== FALHAS vs EPISODIOS por dia (regua nova) ===");
  console.log("dia        | total | falhas | taxa    | EPISODIOS | taxa-ep | maior retry");
  const dias = [...new Set(reg.map(g=>g.created_at.slice(0,10)))].sort();
  for (const d of dias) {
    const g = reg.filter(x=>x.created_at.slice(0,10)===d);
    const fs = g.filter(falhou), eps = colapsa(fs);
    const maior = eps.length ? Math.max(...eps.map(e=>e.n)) : 0;
    console.log(`${d} | ${String(g.length).padStart(5)} | ${String(fs.length).padStart(6)} | ${((fs.length/g.length)*100).toFixed(1).padStart(5)}%  | ${String(eps.length).padStart(9)} | ${((eps.length/g.length)*100).toFixed(1).padStart(5)}%  | ${maior>1?`${maior}x`:"-"}`);
  }
  const fsAll = reg.filter(falhou), epsAll = colapsa(fsAll);
  console.log(`\nREGUA NOVA inteira: ${fsAll.length} falhas -> ${epsAll.length} episodios | ${fsAll.length}/${reg.length}=${((fsAll.length/reg.length)*100).toFixed(2)}% vs ${epsAll.length}/${reg.length}=${((epsAll.length/reg.length)*100).toFixed(2)}%`);
  console.log(`\n=== episodios com retry (n>1) ===`);
  for (const e of epsAll.filter(x=>x.n>1)) console.log(`  ${e.ini} -> ${e.fim} | user=${e.user} | ${e.ch}ch | ${e.n} tentativas`);
  console.log(`\n=== 17/09 detalhado ===`);
  const d17 = reg.filter(x=>x.created_at.slice(0,10)==="2026-09-17");
  const e17 = colapsa(d17.filter(falhou));
  for (const e of e17) console.log(`  ${e.ini.slice(11,19)} | user=${e.user.slice(0,8)} | ${e.ch}ch | ${e.n} tentativa(s)`);
  console.log(`  >>> 12 falhas = ${e17.length} episodios em ${new Set(d17.filter(falhou).map(g=>g.user_id)).size} alunos.`);
  console.log(`      "15,8% do dia" e verdade aritmetica e exagero operacional ao mesmo tempo.`);
})();
