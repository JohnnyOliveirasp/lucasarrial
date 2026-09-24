const { supa: mkSupa } = require("/home/johnny/Projects/_qa_worktrees/cancel-2026-09-24/_frank/ferramentas/_comum.cjs");
const supa = mkSupa();
(async()=>{
  console.log("=== eventos com error contendo 'zero_subscription_credits_on_refund' (assinatura do #446) ===");
  const {data:a,error:ea}=await supa.from("payment_events")
    .select("received_at,event_type,buyer_email,processed_at,error")
    .ilike("error","%zero_subscription_credits_on_refund%").order("received_at",{ascending:true});
  if(ea) console.log("ERRO:",JSON.stringify(ea));
  else{ console.log("total:",a.length); for(const e of a) console.log("  ",e.received_at,e.event_type,e.buyer_email,"| processed_at=",e.processed_at); }

  console.log("\n=== TODOS os eventos de estorno e seu error (ultimos 12) ===");
  const {data:b}=await supa.from("payment_events")
    .select("received_at,event_type,buyer_email,processed_at,error")
    .in("event_type",["PURCHASE_PROTEST","PURCHASE_REFUNDED","PURCHASE_CHARGEBACK"])
    .order("received_at",{ascending:false}).limit(12);
  for(const e of b) console.log("  ",e.received_at,e.event_type.padEnd(20),(e.buyer_email||"?").padEnd(32),"err=",(e.error||"NENHUM").slice(0,70));

  console.log("\n=== CONTRAPROVA do filtro de janela: estornos por dia, ultimos 10 dias ===");
  for(let i=0;i<10;i++){
    const d=new Date(Date.UTC(2026,8,24)-i*86400000);
    const ini=d.toISOString().slice(0,10), fim=new Date(d.getTime()+86400000).toISOString().slice(0,10);
    const {count}=await supa.from("payment_events").select("id",{count:"exact",head:true})
      .in("event_type",["PURCHASE_PROTEST","PURCHASE_REFUNDED","PURCHASE_CHARGEBACK"])
      .gte("received_at",ini+"T00:00:00Z").lt("received_at",fim+"T00:00:00Z");
    console.log(`  ${ini}: ${count} estorno(s)${ini==="2026-09-23"?"   <-- a janela de ontem":""}`);
  }
})();
