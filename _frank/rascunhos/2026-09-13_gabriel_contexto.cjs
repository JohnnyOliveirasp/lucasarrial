const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const E = "gabriel.reis2212.pt@gmail.com";
  let all=[],from=0;
  for(;;){const {data}=await db.from("incidents").select("id,numero,status,title,affected_emails,last_seen_at,categoria").range(from,from+999);all=all.concat(data);if(data.length<1000)break;from+=1000;}
  const meus = all.filter(i => (i.affected_emails||[]).some(x=>String(x).toLowerCase()===E));
  console.log(`incidentes que citam ${E}: ${meus.length}`);
  for (const i of meus) console.log(`  #${i.numero} ${i.id.slice(0,8)} [${i.status}] ${i.categoria} · ${String(i.title).slice(0,80)}`);
  const { data: p } = await db.from("profiles").select("id,email,created_at,credits_extra,access_until,last_seen_at").eq("email",E);
  console.log("\nPERFIL:", JSON.stringify(p));
})();
