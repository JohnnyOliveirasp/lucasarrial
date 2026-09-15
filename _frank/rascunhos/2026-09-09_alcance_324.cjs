#!/usr/bin/env node
/**
 * READ-ONLY. Qual o alcance REAL do #324?
 *
 * A trava de idempotencia (`agent_state["sgp_boas_vindas"]`) grava a transacao
 * como tratada mesmo quando NENHUM canal entregou (`canais: []`). Quem cair
 * nesse estado nunca mais e procurado por caminho automatico nenhum.
 *
 * Isto conta TODOS os que estao assim, nao so os 2 do chamado.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CHAVE_ESTADO = "sgp_boas_vindas";

(async () => {
  const db = supa();
  const { data: est } = await db
    .from("agent_state")
    .select("value")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  const valor = est?.value ?? {};
  const entradas = Object.entries(valor);

  const semCanal = [];
  const comCanal = [];
  const outros = [];
  for (const [tx, v] of entradas) {
    if (!v || typeof v !== "object") {
      outros.push([tx, v]);
      continue;
    }
    const canais = Array.isArray(v.canais) ? v.canais : null;
    if (canais && canais.length === 0) semCanal.push([tx, v]);
    else if (canais && canais.length > 0) comCanal.push([tx, v]);
    else outros.push([tx, v]);
  }

  console.log(`total de transacoes marcadas: ${entradas.length}`);
  console.log(`  ENTREGOU (canais nao-vazio): ${comCanal.length}`);
  console.log(`  NAO ENTREGOU (canais: []):   ${semCanal.length}   <-- vitimas silenciosas`);
  console.log(`  formato inesperado:          ${outros.length}`);
  console.log();

  semCanal.sort((a, b) => String(a[1].at).localeCompare(String(b[1].at)));
  console.log("AS VITIMAS (transacao | quando | conta | e-mail):");
  for (const [tx, v] of semCanal) {
    console.log(`  ${tx}  ${v.at}  conta=${v.conta}  ${v.buyerEmail}`);
  }
  console.log();

  // Essas pessoas chegaram a logar? tem pedido no SGP?
  const emails = semCanal.map(([, v]) => v.buyerEmail).filter(Boolean);
  if (emails.length) {
    console.log("ESTADO DE CADA VITIMA:");
    for (const email of [...new Set(emails)]) {
      const { data: perfis } = await db
        .from("profiles")
        .select("id,last_sign_in_at,plan,created_at")
        .ilike("email", email);
      const { data: peds } = await db
        .from("sgp_pedidos")
        .select("id,status")
        .ilike("email", email);
      const p = perfis?.[0];
      console.log(
        `  ${email.padEnd(38)} conta=${p ? "sim" : "NAO"} login=${p?.last_sign_in_at ?? "NUNCA"} pedido_sgp=${peds?.length ?? 0}`,
      );
    }
  }
  if (outros.length) {
    console.log();
    console.log("FORMATO INESPERADO (amostra):");
    for (const [tx, v] of outros.slice(0, 10)) {
      console.log(`  ${tx} = ${JSON.stringify(v).slice(0, 200)}`);
    }
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
