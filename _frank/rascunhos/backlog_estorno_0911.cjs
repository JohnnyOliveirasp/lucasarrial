const { supa } = require("/home/johnny/Projects/lucasarrial/_frank/ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  // PAGINA de proposito: PostgREST corta em 1000 em silencio
  let all = [], from = 0;
  for (;;) {
    const { data, error } = await db.from("entitlements")
      .select("external_id,status,buyer_email,user_id,updated_at")
      .in("status", ["refunded", "chargeback"])
      .order("updated_at", { ascending: true }).range(from, from + 999);
    if (error) { console.log("ERRO entitlements:", JSON.stringify(error)); process.exit(1); }
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  console.log(`entitlements refunded/chargeback: ${all.length}`);
  if (!all.length) { console.log("corpo cru: lista vazia — conferir se o status e gravado com outro nome"); 
    const { data: dist } = await db.from("entitlements").select("status");
    const c = {}; for (const r of (dist||[])) c[r.status]=(c[r.status]||0)+1;
    console.log("distribuicao de status:", JSON.stringify(c)); return; }

  const ids = [...new Set(all.map(e => e.user_id).filter(Boolean))];
  let profs = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("profiles")
      .select("id,email,credits_subscription,credits_extra,access_until").in("id", ids.slice(i, i+200));
    if (error) { console.log("ERRO profiles:", error.message); process.exit(1); }
    profs = profs.concat(data);
  }
  const byId = new Map(profs.map(p => [p.id, p]));
  const comSaldo = all.map(e => ({ e, p: byId.get(e.user_id) }))
    .filter(x => x.p && (x.p.credits_subscription ?? 0) > 0);
  const total = comSaldo.reduce((s, x) => s + x.p.credits_subscription, 0);
  console.log(`com credits_subscription > 0 (NAO zerado): ${comSaldo.length} pessoa(s), ${total.toLocaleString("pt-BR")} cr`);
  const distStatus = {}; for (const x of comSaldo) distStatus[x.e.status]=(distStatus[x.e.status]||0)+1;
  console.log("por status:", JSON.stringify(distStatus));
  console.log("\nmais antigos primeiro (ate 15):");
  for (const x of comSaldo.slice(0, 15))
    console.log(`  ${x.e.updated_at.slice(0,10)} ${x.e.status.padEnd(10)} ${String(x.p.credits_subscription).padStart(8)} cr  ${x.p.email}`);
})();
