const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const { data } = await supa().from("credit_transactions")
    .select("amount,kind,ref_type,created_at").eq("ref_id","b744e6da-c518-4cd7-ab1f-febc9e3f7c4e").order("created_at");
  for (const t of data) console.log(`  ${t.created_at} · ${String(t.amount).padStart(7)} · kind=${t.kind} · ref_type=${t.ref_type}`);
})();
