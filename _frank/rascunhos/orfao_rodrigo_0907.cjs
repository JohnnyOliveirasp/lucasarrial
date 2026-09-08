/**
 * Rodada 08/09 — os dois "SEM CONTA" de 07/09.
 *
 * rodrigo.limas.1978@gmail.com PAGOU R$97 (rec#2 APPROVED 06/09 na Hotmart) e
 * NAO tem conta na plataforma; cancelou em 07/09. Isso e o padrao da COMPRA
 * ORFA (incidente #239). viniciusjc1903@gmail.com e trial, sem conta tambem.
 *
 * ⚠️ A primeira versao disto varreu `payload` com limite e voltou 1000 linhas
 * truncadas — falso negativo esperando pra acontecer. Aqui se filtra pela
 * COLUNA `buyer_email`, que e indexada e nao depende de paginacao.
 *
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const ALVOS = [
  { email: "rodrigo.limas.1978@gmail.com", code: "UKC2COC2" },
  { email: "viniciusjc1903@gmail.com", code: "BFF94E2S" },
];

(async () => {
  const db = supa();

  for (const alvo of ALVOS) {
    console.log("=".repeat(72));
    console.log(`${alvo.email}  (assinatura ${alvo.code})`);

    // ── eventos, pela COLUNA buyer_email (nao pelo payload)
    const { data: evs, error } = await db.from("payment_events")
      .select("id,event_type,received_at,processed_at,error,payload")
      .ilike("buyer_email", alvo.email)
      .order("received_at", { ascending: true });
    if (error) { console.error("  ERRO payment_events:", JSON.stringify(error)); continue; }
    console.log(`\n  payment_events por buyer_email: ${evs.length}`);
    for (const e of evs) {
      const d = e.payload?.data ?? {};
      console.log(`   ${e.received_at?.slice(0, 19)} ${String(e.event_type).padEnd(26)}`
        + ` valor=${d.purchase?.price?.value ?? "-"} status=${d.purchase?.status ?? "-"}`
        + ` rec=${d.purchase?.recurrence_number ?? "-"}`
        + ` processado=${e.processed_at ? e.processed_at.slice(0, 19) : "NAO"}${e.error ? ` erro=${e.error}` : ""}`);
    }
    // contraprova: a coluna funciona?
    const { count: totalEv } = await db.from("payment_events").select("id", { count: "exact", head: true });
    console.log(`   contraprova: payment_events tem ${totalEv} linhas no total`);

    // ── entitlements (coluna certa e buyer_email)
    const { data: ent, error: e2 } = await db.from("entitlements")
      .select("id,external_id,status,buyer_email,user_id,access_until,created_at,updated_at")
      .or(`buyer_email.ilike.${alvo.email},external_id.eq.${alvo.code}`);
    if (e2) console.log(`  ERRO entitlements: ${e2.message}`);
    console.log(`\n  entitlements: ${(ent || []).length} linha(s)`);
    for (const x of ent || []) {
      console.log(`   external_id=${x.external_id} status=${x.status} user_id=${x.user_id ?? "NULO (orfao)"}`
        + ` acesso_ate=${x.access_until?.slice(0, 10) ?? "-"} criado=${x.created_at?.slice(0, 19)}`);
    }
  }

  // ── o aviso de compra orfa chegou em alguem?
  console.log("\n" + "=".repeat(72));
  console.log("AVISO DE COMPRA ORFA (agent_state, incidente #239)");
  const { data: st, error: e3 } = await db.from("agent_state").select("*");
  if (e3) { console.log("  ERRO agent_state:", e3.message); return; }
  console.log(`  contraprova: agent_state tem ${st.length} chave(s)`);
  const orfas = st.filter((s) => /orfa|orphan/i.test(JSON.stringify(s)));
  console.log(`  ${orfas.length} chave(s) de aviso de orfa`);
  for (const s of orfas) {
    const chave = s.key ?? s.id;
    let val = s.value ?? s.data ?? s.state;
    if (typeof val === "string") { try { val = JSON.parse(val); } catch { /* deixa cru */ } }
    console.log(`\n   chave=${chave}`);
    console.log(`   conteudo cru: ${JSON.stringify(val).slice(0, 600)}`);
  }
})();
