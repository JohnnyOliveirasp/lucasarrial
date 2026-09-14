const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  // qualquer geracao perto de 12/09 15:41Z
  const { data: g } = await db.from("generations")
    .select("id,user_id,status,created_at,error_message")
    .gte("created_at","2026-09-12T14:00:00Z").lte("created_at","2026-09-12T17:00:00Z")
    .order("created_at");
  console.log(`geracoes 12/09 14h-17hZ: ${g?.length||0}`);
  for (const x of (g||[])) console.log(`  ${x.created_at} · ${x.id.slice(0,8)} · ${x.status} · ${String(x.error_message||"").slice(0,90)}`);

  // o incidente cita 32 ocorrencias; quais tabelas registram ocorrencia?
  const { data: inc } = await db.from("incidents").select("id,occurrences,first_seen_at,last_seen_at,signature").eq("id","37bacb68-afb9-42a9-9936-9214906fb4bb");
  console.log("\nINCIDENTE:", JSON.stringify(inc));

  // failed com qa_coverage: datas exatas, todas
  let all=[],from=0;
  for(;;){const {data}=await db.from("generations").select("id,created_at,error_message,status").eq("status","failed").order("created_at").range(from,from+999);all=all.concat(data);if(data.length<1000)break;from+=1000;}
  const cov=all.filter(x=>String(x.error_message||"").includes("qa_coverage"));
  console.log(`\nfailed+qa_coverage: ${cov.length} (incidente diz 32)`);
  console.log("primeira:",cov[0]?.created_at," ultima:",cov[cov.length-1]?.created_at);
})();
