const { supa } = require("/home/johnny/Projects/lucasarrial/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data: ents, error } = await db.from("entitlements")
    .select("external_id,status,buyer_email,user_id,updated_at").in("status",["refunded","chargeback"]);
  if (error) { console.log("ERRO:", JSON.stringify(error)); process.exit(1); }
  console.log(`${ents.length} entitlement(s) refunded/chargeback\n`);
  let totalPos = 0, gente = 0;
  for (const e of ents) {
    if (!e.user_id) { console.log(`${e.external_id} ${e.status} user_id NULO (${e.buyer_email}) — sem conta pra medir`); continue; }
    const { data: p } = await db.from("profiles").select("email,credits_subscription,credits_extra,access_until").eq("id", e.user_id).maybeSingle();
    const { data: tx, error: te } = await db.from("credit_transactions")
      .select("kind,amount,ref_type,note,created_at").eq("user_id", e.user_id)
      .gt("created_at", e.updated_at).order("created_at");
    if (te) { console.log(`${e.buyer_email}: ERRO credit_transactions: ${te.message}`); continue; }
    const gastos = (tx||[]).filter(t => t.amount < 0);
    const soma = gastos.reduce((s,t)=>s+t.amount,0);
    console.log(`${String(e.status).padEnd(10)} ${e.updated_at.slice(0,16)} ${p?.email ?? e.buyer_email}`);
    console.log(`   saldo hoje: ${p?.credits_subscription ?? "?"} mensalidade + ${p?.credits_extra ?? "?"} extra | acesso ate ${p?.access_until ?? "NULO"}`);
    console.log(`   DEPOIS do estorno: ${gastos.length} gasto(s) = ${soma} cr | ${(tx||[]).length} lancamento(s) no total`);
    for (const g of gastos) console.log(`      ${g.created_at.slice(0,16)} ${g.amount} ${g.ref_type} — ${g.note ?? ""}`);
    if (soma < 0) { totalPos += soma; gente++; }
  }
  console.log(`\n>>> gasto DEPOIS do estorno: ${gente} pessoa(s), ${totalPos} cr`);
})();
