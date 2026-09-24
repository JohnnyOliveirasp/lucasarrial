const { supa: mkSupa } = require("/home/johnny/Projects/_qa_worktrees/cancel-2026-09-24/_frank/ferramentas/_comum.cjs");
const supa = mkSupa();
const ALVOS=["paula@handelhomes.com","core@frentestudio.com.br","vazilg@gmail.com","mkt.drrigatti@gmail.com","contato@fotoatleta.com"];
(async()=>{
  // descobrir colunas de credito
  const {data:amostra}=await supa.from("profiles").select("*").limit(1);
  if(amostra&&amostra[0]) console.log("COLUNAS profiles:",Object.keys(amostra[0]).filter(k=>/credit|email|access|id/i.test(k)).join(", "));
  console.log("\n=== saldo ATUAL das vitimas do #446 (estorno deveria ter ZERADO) ===");
  for(const em of ALVOS){
    const {data,error}=await supa.from("profiles")
      .select("id,email,credits_subscription,credits_extra,access_until").eq("email",em);
    if(error){console.log(em,"ERRO:",JSON.stringify(error));continue;}
    if(!data.length){console.log(em,"NAO ENCONTRADO em profiles");continue;}
    for(const p of data){
      const zerado = (p.credits_subscription===0);
      console.log(`  ${em.padEnd(32)} sub=${String(p.credits_subscription).padStart(7)} extra=${String(p.credits_extra).padStart(6)} acesso_ate=${p.access_until} => ${zerado?"ZERADO OK":"### AINDA TEM CREDITO ###"}`);
    }
  }
})();
