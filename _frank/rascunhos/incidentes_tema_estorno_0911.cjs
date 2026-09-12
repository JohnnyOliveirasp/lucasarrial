const { supa } = require("/home/johnny/Projects/lucasarrial/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  let all=[],from=0;
  for(;;){ const {data,error}=await db.from("incidents").select("id,status,title,created_at").order("created_at",{ascending:false}).range(from,from+999);
    if(error){console.log("ERRO:",error.message);process.exit(1);} all=all.concat(data); if(data.length<1000)break; from+=1000; }
  console.log("total incidents:", all.length);
  const rx=/credits_subscription|nao zer|não zer|revokeAccess|expire_trial_credits|mensalidade.*estorn|estorn.*mensalidade|chargeback/i;
  const hit=all.filter(i=>rx.test(i.title));
  console.log("casando com o tema (titulo):", hit.length);
  for(const i of hit) console.log(` ${i.id.slice(0,8)} ${String(i.status).padEnd(16)} ${i.created_at.slice(0,10)} ${i.title.slice(0,160)}`);
})();
