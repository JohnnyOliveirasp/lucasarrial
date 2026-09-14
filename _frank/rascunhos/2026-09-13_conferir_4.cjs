const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const CASOS = [
    ["dd4b98a3","6400fc05","2026-08-20T02:58:22Z"],
    ["db811e2f","d26a2f1f","2026-08-20T10:09:20Z"],
    ["678267fe","2d05c05d","2026-08-24T18:47:47Z"],
    ["e0de4212","2d05c05d","2026-08-24T18:53:04Z"],
  ];
  const vistos = new Set();
  for (const [ref, upref, quando] of CASOS) {
    const { data: g } = await db.from("generations").select("user_id").ilike("id", ref+"%");
    const uid = g?.[0]?.user_id;
    const { data: p, error: pe } = await db.from("profiles").select("email,credits_extra").eq("id", uid);
    console.log(`\n### ref ${ref} · ${quando}`);
    console.log(`  perfil: ${pe ? "ERRO:"+pe.message : JSON.stringify(p?.[0])}`);
    if (vistos.has(uid)) { console.log("  (extrato do mesmo usuario ja listado acima)"); continue; }
    vistos.add(uid);
    const t0 = new Date(new Date(quando).getTime()-3600e3).toISOString();
    const t1 = new Date(new Date(quando).getTime()+3600e3).toISOString();
    const { data: tx } = await db.from("credit_transactions")
      .select("amount,kind,ref_type,ref_id,created_at").eq("user_id", uid)
      .gte("created_at", t0).lte("created_at", t1).order("created_at");
    console.log(`  extrato do usuario na janela +-1h: ${tx?.length||0} linha(s)`);
    for (const t of tx||[]) console.log(`    ${t.created_at} · ${String(t.amount).padStart(7)} · kind=${t.kind} · ref_type=${t.ref_type} · ref=${String(t.ref_id).slice(0,8)}`);
  }
})();
