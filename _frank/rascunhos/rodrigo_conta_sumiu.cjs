/**
 * Rodada 08/09 — rodrigo.limas.1978@gmail.com.
 *
 * O que ja se sabe: pagou R$97 (PURCHASE_APPROVED rec#2, 06/09 14:13, produto
 * 7851642), o evento foi processado sem erro, NAO existe conta em `profiles`
 * hoje, o entitlement UKC2COC2 esta com user_id NULO — e o aviso de compra
 * orfa NAO disparou (nem em `orphan_alerts`, nem em `para_frank_orfa_*`),
 * embora a maquina do #239 tenha avisado outras pessoas as 12:10 e as 15:00
 * do MESMO dia.
 *
 * O webhook so avisa quando `resolveUserIdByEmail` devolve NULO, e essa funcao
 * le exatamente `profiles.email ILIKE`. Se ela tivesse devolvido nulo as
 * 14:13, teria avisado. Logo: as 14:13 EXISTIA conta, e ela sumiu depois.
 *
 * Este script procura a prova disso: o lancamento de credito do pagamento
 * (que so acontece com userId em maos) e o destino daquele user_id.
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const EMAIL = "rodrigo.limas.1978@gmail.com";

(async () => {
  const db = supa();

  // 1) a transacao do pagamento de 06/09
  const { data: evs } = await db.from("payment_events")
    .select("received_at,event_type,payload").ilike("buyer_email", EMAIL)
    .order("received_at", { ascending: true });
  const pago = (evs || []).find((e) => (e.payload?.data?.purchase?.price?.value ?? 0) > 0);
  const trans = pago?.payload?.data?.purchase?.transaction ?? null;
  console.log(`transacao do R$97: ${trans} (${pago?.received_at})`);

  // 2) o credito foi lancado? (grantSubscriptionCredits usa refId = transacao)
  const { data: tx, error } = await db.from("credit_transactions")
    .select("id,user_id,kind,amount,ref_type,ref_id,note,created_at")
    .eq("ref_id", trans);
  if (error) console.log("  erro credit_transactions:", error.message);
  console.log(`\ncredit_transactions com ref_id=${trans}: ${(tx || []).length}`);
  for (const t of tx || []) {
    console.log(`   ${t.created_at?.slice(0, 19)} user_id=${t.user_id} ${t.amount} ${t.kind}/${t.ref_type}`);
  }
  // contraprova: o ref_id de OUTRA pessoa acha algo? (prova que a coluna serve)
  const outra = (evs || []).find((e) => e.payload?.data?.purchase?.transaction && e.payload.data.purchase.transaction !== trans);
  if (outra) {
    const { data: tx2 } = await db.from("credit_transactions").select("id,user_id,amount").eq("ref_id", outra.payload.data.purchase.transaction);
    console.log(`   contraprova: ref_id=${outra.payload.data.purchase.transaction} (o trial dele) -> ${(tx2 || []).length} lancamento(s)`);
  }
  const { count: txTotal } = await db.from("credit_transactions").select("id", { count: "exact", head: true });
  console.log(`   contraprova: credit_transactions tem ${txTotal} linhas`);

  // 3) aquele user_id ainda existe em profiles?
  for (const t of tx || []) {
    const { data: p } = await db.from("profiles").select("id,email,full_name,created_at").eq("id", t.user_id).maybeSingle();
    console.log(`\n user_id ${t.user_id} em profiles hoje: ${p ? JSON.stringify(p) : "NAO EXISTE MAIS"}`);
  }

  // 4) e no auth (login)? profiles pode ter sumido e o login continuar
  console.log(`\n### auth.users`);
  let achou = null, pagina = 1, vistos = 0;
  while (pagina <= 6) {
    const { data, error: e } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (e) { console.log("  erro auth:", e.message); break; }
    const us = data?.users ?? [];
    vistos += us.length;
    const hit = us.find((u) => String(u.email || "").toLowerCase() === EMAIL);
    if (hit) { achou = hit; break; }
    if (us.length < 1000) break;
    pagina++;
  }
  console.log(`  contraprova: ${vistos} usuarios varridos no auth`);
  console.log(`  ${EMAIL} no auth: ${achou ? `SIM (id=${achou.id}, criado ${achou.created_at}, ultimo login ${achou.last_sign_in_at ?? "nunca"})` : "NAO"}`);
})();
