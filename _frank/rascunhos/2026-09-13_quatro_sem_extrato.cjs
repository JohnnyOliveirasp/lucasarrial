const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const INC = "37bacb68-afb9-42a9-9936-9214906fb4bb";
  const { data: occ } = await db.from("incident_occurrences").select("ref_id,at,email").eq("incident_id",INC).order("at");
  const semLinha = [];
  for (const x of occ) {
    const { data: tx } = await db.from("credit_transactions").select("amount,ref_type").eq("ref_id", x.ref_id);
    if (!tx || !tx.length) semLinha.push(x);
  }
  console.log(`OCORRENCIAS SEM NENHUMA LINHA NO EXTRATO: ${semLinha.length}`);
  for (const x of semLinha) {
    const { data: g } = await db.from("generations").select("id,user_id,status,created_at").eq("id",x.ref_id);
    let prof = null;
    if (g?.length) {
      const { data: p } = await db.from("profiles").select("email,is_admin,credits_extra").eq("id",g[0].user_id);
      prof = p?.[0];
    }
    console.log(`\n  ${x.at} · ref ${String(x.ref_id).slice(0,8)} · ledger_email=${x.email}`);
    console.log(`    generations: ${g?.length ? `status=${g[0].status} user=${String(g[0].user_id).slice(0,8)}` : "APAGADA"}`);
    console.log(`    perfil: ${prof ? `${prof.email} is_admin=${prof.is_admin} cr=${prof.credits_extra}` : "n/d"}`);
  }
})();
