const { supa: mkSupa } = require("/home/johnny/Projects/_qa_worktrees/cancel-2026-09-24/_frank/ferramentas/_comum.cjs");
const supa = mkSupa();
(async()=>{
  const {data,error}=await supa.from("payment_events").select("*").limit(1);
  if(error) return console.log("ERRO:",JSON.stringify(error));
  console.log("COLUNAS:",Object.keys(data[0]||{}).join(", "));
  const TIPOS=["PURCHASE_PROTEST","PURCHASE_REFUNDED","PURCHASE_CHARGEBACK"];
  for(const t of TIPOS){
    const {count}=await supa.from("payment_events").select("id",{count:"exact",head:true}).eq("event_type",t);
    const {count:nulos}=await supa.from("payment_events").select("id",{count:"exact",head:true}).eq("event_type",t).is("processed_at",null);
    console.log(`${t}: historico=${count} | processed_at NULL=${nulos}`);
  }
  // o filtro processed_at IS NULL funciona de verdade? conta em TODOS os tipos
  const {count:totNull}=await supa.from("payment_events").select("id",{count:"exact",head:true}).is("processed_at",null);
  const {count:tot}=await supa.from("payment_events").select("id",{count:"exact",head:true});
  console.log(`\nTODOS os eventos: ${tot} | processed_at NULL (qualquer tipo): ${totNull}`);
  const {count:comErro}=await supa.from("payment_events").select("id",{count:"exact",head:true}).not("error","is",null);
  console.log(`eventos com error != null: ${comErro}`);
})();
