const { supa } = require("../ferramentas/_comum.cjs");
const { REF_TYPES_ESTORNO } = require("../ferramentas/_estornos.cjs");
(async () => {
  const db = supa();
  const GEN = "67f28d0f-2049-4ee6-aed4-cb46773c2198";
  const UID = "4fbe87ff-32a1-4a87-a2a2-8672e380a592";
  const { data: prof } = await db.from("profiles").select("id,email,credits_extra,access_until").eq("id",UID);
  console.log("PERFIL:", JSON.stringify(prof));
  // todas as transacoes que citam esta geracao
  const { data: tx, error } = await db.from("credit_transactions")
    .select("id,user_id,amount,kind,ref_type,ref_id,created_at")
    .eq("ref_id", GEN);
  if (error) { console.log("ERRO tx:", error.message); process.exit(1); }
  console.log(`\nTRANSACOES com ref_id = ${GEN.slice(0,8)}: ${tx.length}`);
  let soma = 0;
  for (const t of tx) {
    soma += Number(t.amount);
    const eh = REF_TYPES_ESTORNO.includes(t.ref_type) ? "ESTORNO" : "debito/outro";
    console.log(`  ${t.created_at} · ${String(t.amount).padStart(8)} · kind=${t.kind} · ref_type=${t.ref_type} · ${eh}`);
  }
  console.log(`\nSOMA DO SINAL (0 = quitado): ${soma}`);
  const { data: g } = await db.from("generations").select("id,audio_path,duration_seconds,name,created_at").eq("id",GEN);
  console.log("\nGERACAO:", JSON.stringify(g));
})();
