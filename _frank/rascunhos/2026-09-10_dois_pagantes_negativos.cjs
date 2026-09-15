/**
 * Os 2 casos que a varredura do card não pegou: SGP + assinatura ATIVA e ainda
 * assim credits_extra = -10.525. Se o perdão de 30/08 existe, por que não
 * pegou estes? Hipótese: o perdão só roda em grantSubscriptionCredits, e nestes
 * o débito do onboarding veio DEPOIS do grant. SÓ LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const ALVOS = ["neilamagalhaes79@gmail.com", "carlaneavatar@gmail.com"];

(async () => {
  const db = supa();
  for (const email of ALVOS) {
    const { data: p } = await db
      .from("profiles")
      .select("id, email, credits_subscription, credits_extra, plan, access_until, created_at")
      .eq("email", email)
      .maybeSingle();
    if (!p) { console.log(`${email}: SEM PERFIL`); continue; }
    console.log(`\n===== ${email} =====`);
    console.log(`sub=${p.credits_subscription} extra=${p.credits_extra} plan=${p.plan} access_until=${p.access_until}`);

    const { data: tx } = await db
      .from("credit_transactions")
      .select("created_at, kind, amount, balance_after, ref_type, note")
      .eq("user_id", p.id)
      .order("created_at", { ascending: true });
    console.log(`extrato (${tx?.length ?? 0} linhas):`);
    for (const t of tx || []) {
      console.log(
        `  ${t.created_at}  ${String(t.kind).padEnd(12)} ${String(t.amount).padStart(8)} ` +
          `after=${String(t.balance_after).padStart(7)}  ${t.ref_type || "-"}  ${(t.note || "").slice(0, 60)}`,
      );
    }
    const { data: ped } = await db
      .from("sgp_pedidos")
      .select("status, criado_em, enviado_em, voz_pronta_em")
      .eq("user_id", p.id)
      .maybeSingle();
    console.log(`sgp_pedido: ${ped ? `${ped.status} criado=${ped.criado_em} enviado=${ped.enviado_em} voz=${ped.voz_pronta_em}` : "nenhum"}`);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
