/**
 * Rodada 08/09 — le o mapa de idempotencia `orphan_alerts` (agent_state).
 * Hipotese: UKC2COC2 entrou no mapa em 30/08, quando o aviso ainda nao
 * chegava em ninguem (#239), e a idempotencia calou o aviso do R$97 de 06/09.
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

(async () => {
  const db = supa();
  const { data, error } = await db.from("agent_state").select("key,value,updated_at").eq("key", "orphan_alerts").maybeSingle();
  if (error) { console.error("ERRO:", error.message); process.exit(1); }
  if (!data) { console.log("chave orphan_alerts NAO EXISTE em agent_state"); return; }

  let v = data.value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* cru */ } }
  const chaves = Object.keys(v || {});
  console.log(`orphan_alerts: ${chaves.length} entitlement(s) marcados como avisados (updated_at=${data.updated_at})`);

  const linhas = chaves.map((k) => ({ k, ...(v[k] || {}) })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  for (const l of linhas) {
    console.log(`  ${String(l.k).padEnd(12)} ${String(l.at).slice(0, 19)} canais=${JSON.stringify(l.canais)} ${l.buyerEmail ?? ""}`);
  }

  for (const alvo of ["UKC2COC2", "BFF94E2S"]) {
    console.log(`\n${alvo} no mapa? ${chaves.includes(alvo) ? "SIM -> " + JSON.stringify(v[alvo]) : "NAO"}`);
  }
})();
