#!/usr/bin/env node
/**
 * Drena da fila de recados os alertas "⚠️ Compra paga SEM conta" em que
 * NENHUM dinheiro entrou (incidente #333).
 *
 * NÃO confia na lista que eu escrevi à mão: re-mede cada e-mail contra
 * payment_events na hora, e só apaga a chave cujo MAIOR valor de compra é 0.
 * Se algum alerta tiver ganho valor entre a medição e agora, ele sobrevive.
 *
 * Também informa quem já tem perfil (o alerta envelheceu sozinho) — isso não
 * muda a decisão, só entra no log.
 *
 * Sem --confirmar, ensaia.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

async function main() {
  const { data: recados, error: e1 } = await db
    .from("agent_state")
    .select("key, updated_at, value")
    .like("key", "para_frank_orfa_%");
  if (e1) throw new Error("agent_state: " + JSON.stringify(e1));

  const alvos = recados.map((r) => ({
    key: r.key,
    em: r.updated_at,
    email: String(r.value?.subject || "").split(":").pop().trim().toLowerCase(),
  }));
  const emails = alvos.map((a) => a.email);

  // MAIOR valor de compra por e-mail, medido agora.
  const { data: evs, error: e2 } = await db
    .from("payment_events")
    .select("buyer_email, payload")
    .in("buyer_email", emails);
  if (e2) throw new Error("payment_events: " + JSON.stringify(e2));
  const maior = new Map();
  for (const ev of evs) {
    const em = String(ev.buyer_email || "").toLowerCase();
    const v = Number(ev.payload?.data?.purchase?.price?.value ?? 0);
    if (!Number.isFinite(v)) continue;
    maior.set(em, Math.max(maior.get(em) ?? 0, v));
  }

  const { data: perfis, error: e3 } = await db.from("profiles").select("email").in("email", emails);
  if (e3) throw new Error("profiles: " + JSON.stringify(e3));
  const temConta = new Set(perfis.map((p) => String(p.email).toLowerCase()));

  const apagar = [];
  const ficam = [];
  for (const a of alvos) {
    const v = maior.get(a.email);
    if (v === undefined) {
      ficam.push({ ...a, motivo: "SEM evento de pagamento medido — nao apago no escuro" });
    } else if (v > 0) {
      ficam.push({ ...a, motivo: `pagou de verdade (maior valor R$ ${v})` });
    } else {
      apagar.push({ ...a, conta: temConta.has(a.email) });
    }
  }

  console.log(`fila de recados de compra orfa: ${alvos.length}\n`);
  console.log(`FICAM (${ficam.length}) — tem dinheiro ou nao consigo medir:`);
  for (const f of ficam) console.log(`   ${f.email} · ${f.key} · ${f.motivo}`);
  console.log(`\nAPAGAR (${apagar.length}) — maior valor de compra = R$ 0, ninguem pagou nada:`);
  for (const a of apagar) {
    console.log(`   ${a.email} · ${a.key} · ${a.conta ? "JA TEM CONTA" : "sem conta (trial, sem dinheiro em jogo)"}`);
  }

  if (!CONFIRMAR) {
    console.log("\nENSAIO — nada apagado. Rode com --confirmar.");
    return;
  }

  let apagadas = 0;
  for (const a of apagar) {
    const { data, error } = await db.from("agent_state").delete().eq("key", a.key).select("key");
    if (error) throw new Error(`delete ${a.key}: ${JSON.stringify(error)}`);
    if (!data || data.length !== 1) throw new Error(`delete ${a.key} afetou ${data ? data.length : 0} linhas`);
    apagadas += 1;
  }

  // Prova depois de gravar: reconta a fila no banco, nao no meu contador.
  const { data: sobrou, error: e4 } = await db
    .from("agent_state")
    .select("key")
    .like("key", "para_frank_orfa_%");
  if (e4) throw new Error("recontagem: " + JSON.stringify(e4));
  const { count: totalFila, error: e5 } = await db
    .from("agent_state")
    .select("key", { count: "exact", head: true })
    .like("key", "para\\_frank\\_%");
  if (e5) throw new Error("recontagem total: " + JSON.stringify(e5));

  console.log(
    `\nAPAGADAS: ${apagadas}. Fila de compra orfa no banco AGORA: ${sobrou.length} ` +
      `(esperado ${ficam.length}). Fila para_frank_* inteira: ${totalFila}.`,
  );
  if (sobrou.length !== ficam.length) throw new Error("a recontagem nao bate com o esperado");
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
