/**
 * Rodada 08/09 — ARMADILHA 2 (classificar por PESSOA, nao por assinatura).
 *
 * VINICIUS JULIO CAMARGO cancelou em 07/09 (assinatura BFF94E2S, e-mail da
 * Hotmart viniciusjc1903@gmail.com) e "nao tem conta". Mas a busca por NOME
 * achou `plastiassist@gmail.com` — display_name "Vinicius Camargo", conta
 * criada em 06/09 (o MESMO dia da adesao) e com 90.000 creditos.
 *
 * ⚠️ Nome batendo NAO e prova (regra do #239: nao adivinhar por nome nem por
 * comeco de e-mail). O que este script faz e so juntar os FATOS: de onde veio
 * o credito dessa conta, se ela tem entitlement proprio e se existe compra
 * propria dela na Hotmart. Se a conta tiver assinatura propria, sao duas
 * pessoas (ou duas compras) e o caso morre aqui.
 *
 * SOMENTE LEITURA — nada e vinculado, nada e debitado.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CONTA = "plastiassist@gmail.com";
const HOTMART = "viniciusjc1903@gmail.com";

(async () => {
  const db = supa();

  const { data: p, error } = await db.from("profiles")
    .select("id,email,display_name,plan,access_until,access_source,credits_subscription,credits_extra,created_at,whatsapp")
    .ilike("email", CONTA).maybeSingle();
  if (error) { console.error("ERRO profiles:", error.message); process.exit(1); }
  if (!p) { console.log(`${CONTA} nao existe`); return; }
  console.log(`CONTA ${p.email} | ${p.display_name} | criada ${p.created_at?.slice(0, 19)}`);
  console.log(`  plano=${p.plan} acesso_ate=${p.access_until?.slice(0, 10) ?? "-"} origem=${p.access_source ?? "-"}`);
  console.log(`  saldo: mensalidade ${p.credits_subscription} | extra ${p.credits_extra}`);
  console.log(`  whatsapp=${p.whatsapp ?? "-"}`);

  console.log(`\n### de onde veio o credito dela`);
  const { data: tx, error: e2 } = await db.from("credit_transactions")
    .select("created_at,kind,amount,ref_type,ref_id,note").eq("user_id", p.id)
    .order("created_at", { ascending: true });
  if (e2) console.log("  ERRO:", e2.message);
  console.log(`  ${(tx || []).length} lancamento(s)`);
  for (const t of tx || []) {
    console.log(`   ${t.created_at?.slice(0, 19)} ${String(t.amount).padStart(8)} ${String(t.kind).padEnd(22)} ${t.ref_type ?? "-"} ref=${t.ref_id ?? "-"} ${t.note ?? ""}`);
  }

  console.log(`\n### entitlement proprio dessa conta?`);
  const { data: ent, error: e3 } = await db.from("entitlements")
    .select("external_id,status,buyer_email,user_id,access_until,created_at")
    .or(`buyer_email.ilike.${CONTA},user_id.eq.${p.id}`);
  if (e3) console.log("  ERRO:", e3.message);
  console.log(`  ${(ent || []).length} linha(s)`);
  for (const x of ent || []) {
    console.log(`   ${x.external_id} status=${x.status} buyer=${x.buyer_email} user_id=${x.user_id ?? "NULO"} acesso_ate=${x.access_until?.slice(0, 10) ?? "-"} criado=${x.created_at?.slice(0, 19)}`);
  }

  console.log(`\n### compra propria na Hotmart com esse e-mail?`);
  const { data: evs, error: e4 } = await db.from("payment_events")
    .select("received_at,event_type,payload").ilike("buyer_email", CONTA)
    .order("received_at", { ascending: true });
  if (e4) console.log("  ERRO:", e4.message);
  console.log(`  ${(evs || []).length} evento(s)`);
  for (const e of evs || []) {
    const d = e.payload?.data ?? {};
    console.log(`   ${e.received_at?.slice(0, 19)} ${e.event_type} sub=${d.subscriber?.code ?? "-"} valor=${d.purchase?.price?.value ?? "-"}`);
  }

  console.log(`\n### e o entitlement orfao do cancelamento (BFF94E2S / ${HOTMART})`);
  const { data: orf } = await db.from("entitlements")
    .select("external_id,status,buyer_email,user_id,access_until").eq("external_id", "BFF94E2S");
  for (const x of orf || []) console.log(`   ${x.external_id} status=${x.status} buyer=${x.buyer_email} user_id=${x.user_id ?? "NULO"} acesso_ate=${x.access_until?.slice(0, 10)}`);
})();
