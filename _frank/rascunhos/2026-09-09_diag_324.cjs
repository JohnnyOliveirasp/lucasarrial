#!/usr/bin/env node
/**
 * Diagnostico READ-ONLY do #324: os dois compradores do SGP que pagaram em
 * 09/09, nao receberam o e-mail de boas-vindas e ficaram sem o link de senha.
 *
 * Nao escreve nada. So responde: o pedido do SGP existe? a trava de
 * idempotencia gravou os dois como avisados? existe prova de envio?
 */
const { supa } = require("../ferramentas/_comum.cjs");

const ALVOS = ["jcesaram@gmail.com", "patricia.bp170@gmail.com"];
const CHAVE_ESTADO = "sgp_boas_vindas";

(async () => {
  const db = supa();

  for (const email of ALVOS) {
    console.log("=".repeat(70));
    console.log(email);

    // 1. Pedido do SGP
    const { data: pedidos, error: ePed } = await db
      .from("sgp_pedidos")
      .select("*")
      .ilike("email", email);
    if (ePed) console.log("  ERRO sgp_pedidos:", ePed.message);
    console.log(`  sgp_pedidos: ${pedidos?.length ?? 0} linha(s)`);
    for (const p of pedidos ?? []) {
      console.log(
        `    id=${p.id} status=${p.status} etapa=${p.etapa ?? "-"} criado=${p.created_at}`,
      );
      for (const [k, v] of Object.entries(p)) {
        if (["id", "status", "etapa", "created_at", "email"].includes(k)) continue;
        if (v === null || v === "" ) continue;
        const s = typeof v === "object" ? JSON.stringify(v) : String(v);
        console.log(`       ${k}: ${s.slice(0, 160)}`);
      }
    }

    // 2. Perfil
    const { data: perfis } = await db
      .from("profiles")
      .select("id,email,created_at,last_sign_in_at,plan,access_until")
      .ilike("email", email);
    for (const p of perfis ?? []) {
      console.log(
        `  profile: id=${p.id} criado=${p.created_at} ultimo_login=${p.last_sign_in_at ?? "NUNCA"} plan=${p.plan} acesso_ate=${p.access_until ?? "-"}`,
      );
    }

    // 3. Entitlements (por e-mail de compra)
    const { data: ents } = await db
      .from("entitlements")
      .select("id,user_id,buyer_email,status,access_until,product_code,created_at")
      .ilike("buyer_email", email);
    console.log(`  entitlements: ${ents?.length ?? 0}`);
    for (const e of ents ?? []) {
      console.log(
        `    ${e.id} produto=${e.product_code} status=${e.status} dono=${e.user_id ?? "ORFA(NULL)"} ate=${e.access_until ?? "-"}`,
      );
    }

    // 4. Prova de aviso enviado
    const { data: avisos, error: eAv } = await db
      .from("avisos_enviados")
      .select("*")
      .ilike("email", email);
    if (eAv) console.log("  avisos_enviados: (tabela indisponivel)", eAv.message);
    else {
      console.log(`  avisos_enviados: ${avisos?.length ?? 0}`);
      for (const a of avisos ?? []) console.log(`    ${JSON.stringify(a).slice(0, 240)}`);
    }
  }

  // 5. A trava de idempotencia
  console.log("=".repeat(70));
  const { data: est } = await db
    .from("agent_state")
    .select("value,updated_at")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  const valor = est?.value ?? {};
  const chaves = Object.keys(valor);
  console.log(`agent_state["${CHAVE_ESTADO}"]: ${chaves.length} transacao(oes) marcadas`);
  console.log(`  atualizado em: ${est?.updated_at ?? "-"}`);
  for (const k of chaves) {
    const v = valor[k];
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (ALVOS.some((a) => s.toLowerCase().includes(a.toLowerCase()) || k.toLowerCase().includes(a.toLowerCase()))) {
      console.log(`  >>> ALVO ${k} = ${s.slice(0, 300)}`);
    }
  }
  console.log("  (ultimas 8 chaves, pra ver o formato)");
  for (const k of chaves.slice(-8)) {
    const v = valor[k];
    console.log(`    ${k} = ${(typeof v === "object" ? JSON.stringify(v) : String(v)).slice(0, 200)}`);
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
