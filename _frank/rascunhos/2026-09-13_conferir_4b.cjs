const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const INC = "37bacb68-afb9-42a9-9936-9214906fb4bb";
  const { data: occ } = await db.from("incident_occurrences").select("ref_id,at,email").eq("incident_id",INC).order("at");
  // as 4 sem extrato, achadas pelo mesmo criterio de antes
  const alvo = [];
  for (const x of occ) {
    const { data: tx } = await db.from("credit_transactions").select("amount").eq("ref_id", x.ref_id);
    if (!tx || !tx.length) alvo.push(x);
  }
  for (const x of alvo) {
    const { data: g } = await db.from("generations").select("id,user_id,status,created_at").eq("id", x.ref_id);
    const uid = g?.[0]?.user_id;
    console.log(`\n### ${x.at} · ref ${x.ref_id.slice(0,8)} · ledger=${x.email}`);
    if (!uid) { console.log("  generations: APAGADA — sem user_id para conferir"); continue; }
    const { data: p, error: pe } = await db.from("profiles").select("email,credits_extra,access_until").eq("id", uid);
    console.log(`  perfil: ${pe ? "ERRO "+pe.message : JSON.stringify(p?.[0])}`);
    const t0 = new Date(new Date(x.at).getTime()-3600e3).toISOString();
    const t1 = new Date(new Date(x.at).getTime()+3600e3).toISOString();
    const { data: tx2 } = await db.from("credit_transactions")
      .select("amount,kind,ref_type,ref_id,created_at").eq("user_id", uid)
      .gte("created_at", t0).lte("created_at", t1).order("created_at");
    console.log(`  extrato do usuario +-1h: ${tx2?.length||0} linha(s)`);
    for (const t of tx2||[]) console.log(`    ${t.created_at} · ${String(t.amount).padStart(7)} · kind=${t.kind} · ref_type=${t.ref_type} · ref=${String(t.ref_id).slice(0,8)}`);
  }
})();
