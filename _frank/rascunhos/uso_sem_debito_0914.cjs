/**
 * SOMENTE LEITURA. Quantas pessoas produziram conteudo (voz/audio/imagem)
 * sem NENHUM lancamento em credit_transactions? Achado a partir do
 * allan-zequini (cancelamento de 13/09): conta sem acesso, 0 credito,
 * voz pronta + audios + imagens, e o razao vazio.
 * Nao altera nada. Zero de consulta NAO e prova: imprime o cru se vier vazio.
 */
const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const desde = "2026-09-01T00:00:00Z";
  const { data: vozes, error: e1 } = await db.from("voices")
    .select("user_id,status,created_at").gte("created_at", desde).eq("status", "ready");
  if (e1) { console.error("ERRO voices:", JSON.stringify(e1)); process.exit(1); }
  console.log(`vozes ready desde ${desde}: ${vozes.length}`);
  if (!vozes.length) { console.log("CRU:", JSON.stringify(vozes)); return; }

  const ids = [...new Set(vozes.map(v => v.user_id).filter(Boolean))];
  console.log(`donos distintos: ${ids.length}`);
  const semDebito = [];
  for (const id of ids) {
    const { data: tx, error } = await db.from("credit_transactions")
      .select("id,amount,kind").eq("user_id", id).lt("amount", 0).limit(1);
    if (error) { console.error(`ERRO tx ${id}:`, error.message); continue; }
    if (!tx.length) {
      const { data: p } = await db.from("profiles")
        .select("email,credits_subscription,credits_extra,access_until,created_at").eq("id", id).maybeSingle();
      semDebito.push({ id, ...(p || {}) });
    }
  }
  console.log(`\n=== VOZ PRONTA E NENHUM DEBITO NO RAZAO: ${semDebito.length} pessoa(s) ===`);
  for (const p of semDebito) {
    console.log(`  ${p.email ?? "(sem profile)"} | sub ${p.credits_subscription ?? "-"} | extra ${p.credits_extra ?? "-"}`
      + ` | acesso ${p.access_until?.slice(0,10) ?? "SEM"} | conta ${p.created_at?.slice(0,10) ?? "-"}`);
  }
})();
