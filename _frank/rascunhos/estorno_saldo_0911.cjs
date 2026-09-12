const { supa } = require("/home/johnny/Projects/lucasarrial/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  for (const email of ["miguelmoedas.propriedades@gmail.com","vazilg@gmail.com"]) {
    console.log("=".repeat(70));
    console.log(email);
    const { data: p, error: pe } = await db.from("profiles")
      .select("id,email,credits_subscription,credits_extra,access_until,created_at").ilike("email", email).maybeSingle();
    if (pe) { console.log("ERRO profiles:", JSON.stringify(pe)); continue; }
    console.log("profile:", JSON.stringify(p));
    const { data: ents, error: ee } = await db.from("entitlements")
      .select("external_id,status,access_until,buyer_email,updated_at").ilike("buyer_email", email);
    console.log("entitlements:", ee ? "ERRO "+JSON.stringify(ee) : JSON.stringify(ents));
    // eventos desse email no payment_events (qualquer tipo)
    const { data: evs, error: eve } = await db.from("payment_events")
      .select("id,event_type,received_at,handled,error").ilike("buyer_email", email).order("received_at");
    if (eve) {
      console.log("payment_events por buyer_email falhou (talvez coluna nao exista):", eve.message);
    } else {
      console.log("eventos:", JSON.stringify(evs));
    }
    if (p) {
      const { data: tx, error: te } = await db.from("credit_transactions")
        .select("kind,amount,ref_type,note,created_at").eq("user_id", p.id).order("created_at",{ascending:false}).limit(15);
      console.log("ultimas transacoes:", te ? "ERRO "+te.message : JSON.stringify(tx));
    }
  }
})();
