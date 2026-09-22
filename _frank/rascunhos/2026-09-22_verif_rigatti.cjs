/** Conferencia independente do estorno de 21/09 (mkt.drrigatti). SOMENTE LEITURA. */
const { supa } = require("/tmp/fc-main/_frank/ferramentas/_comum.cjs");
const EMAIL = "mkt.drrigatti@gmail.com";
const UID = "e7f6687c-e4c9-4ee3-a6b3-a37567ec0a37";
const ini = "2026-09-21T00:00:00.000Z", fim = "2026-09-22T00:00:00.000Z";

(async () => {
  const db = supa();

  // 1. TODOS os eventos dessa pessoa (qualquer tipo, qualquer data)
  const { data: evs, error: e1 } = await db.from("payment_events")
    .select("id,event_type,received_at,payload").order("received_at", { ascending: true }).limit(1000);
  if (e1) return console.error("ERRO payment_events:", JSON.stringify(e1));
  const meus = (evs||[]).filter(e => JSON.stringify(e.payload||{}).toLowerCase().includes("drrigatti"));
  console.log(`=== eventos de ${EMAIL}: ${meus.length} (de ${evs.length} lidos) ===`);
  for (const e of meus) console.log(`  ${e.received_at}  ${e.event_type}`);

  // 2. Eventos de disputa/estorno na janela de 21/09 (contraprova da armadilha 3)
  for (const t of ["PURCHASE_REFUNDED","PURCHASE_CHARGEBACK","PURCHASE_PROTEST","PURCHASE_APPROVED","PURCHASE_COMPLETE"]) {
    const { count } = await db.from("payment_events").select("id",{count:"exact",head:true})
      .eq("event_type", t).gte("received_at", ini).lt("received_at", fim);
    const { count: hist } = await db.from("payment_events").select("id",{count:"exact",head:true}).eq("event_type", t);
    console.log(`  ${t}: ${count} na janela 21/09 | ${hist} no historico (prova de que a consulta enxerga)`);
  }

  // 3. Razao completo da pessoa
  const { data: tx, error: e3 } = await db.from("credit_transactions")
    .select("created_at,kind,amount,ref_type,note").eq("user_id", UID).order("created_at",{ascending:true});
  if (e3) return console.error("ERRO credit_transactions:", JSON.stringify(e3));
  console.log(`\n=== razao de ${EMAIL}: ${tx.length} lancamento(s) ===`);
  for (const t of tx) console.log(`  ${t.created_at?.slice(0,19)}  ${String(t.amount).padStart(9)}  ${t.kind||"-"}  ${t.ref_type||"-"}  ${t.note||""}`);
  console.log("  soma:", tx.reduce((a,b)=>a+(b.amount||0),0));
})();
