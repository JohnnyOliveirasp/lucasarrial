const { supa } = require("../ferramentas/_comum.cjs");
const { REF_TYPES_ESTORNO } = require("../ferramentas/_estornos.cjs");
(async () => {
  const db = supa();
  const INC = "37bacb68-afb9-42a9-9936-9214906fb4bb";
  const FANT = ["5c1adcf6-2380-4660-83d0-469f550479b8","f44d84cd-a344-40e9-9553-ad08f1472406",
    "dd794da4-599c-4444-a094-f2d73e23f451","335bca7b-c5e4-4c6c-ab51-30989eacda0c",
    "9f8af111-9030-421a-b97e-d71c6b481b9d","b744e6da-c518-4cd7-ab1f-febc9e3f7c4e"];
  const { data: occ } = await db.from("incident_occurrences").select("*").eq("incident_id", INC).in("ref_id", FANT).order("at");
  console.log("=== AS 6 OCORRENCIAS FANTASMA (linha de generations apagada) ===");
  for (const o of occ) {
    console.log(`\n  ${o.at} · ref ${o.ref_id.slice(0,8)}`);
    console.log(`    email: ${o.email}`);
    console.log(`    erro : ${String(o.error||"").slice(0,140)}`);
  }
  console.log("\n=== DINHEIRO DE CADA FANTASMA (ref_id casado no extrato) ===");
  for (const o of occ) {
    const { data: tx } = await db.from("credit_transactions").select("amount,kind,ref_type,created_at").eq("ref_id", o.ref_id);
    const soma = (tx||[]).reduce((s,t)=>s+Number(t.amount),0);
    const est = (tx||[]).filter(t=>REF_TYPES_ESTORNO.includes(t.ref_type)).length;
    console.log(`  ${o.ref_id.slice(0,8)} · ${o.email} · ${(tx||[]).length} linhas · estornos=${est} · SOMA=${soma} ${soma===0?"(quitado)":"⚠️ NAO QUITADO"}`);
  }
})();
