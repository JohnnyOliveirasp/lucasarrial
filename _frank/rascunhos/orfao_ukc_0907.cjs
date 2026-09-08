/**
 * Rodada 08/09 — o aviso de compra orfa (#239) disparou para UKC2COC2
 * (rodrigo.limas.1978@gmail.com, que PAGOU R$97 em 06/09 sem ter conta)?
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

(async () => {
  const db = supa();
  const { data: st, error } = await db.from("agent_state").select("*");
  if (error) { console.error("ERRO agent_state:", error.message); process.exit(1); }

  const chaves = st.map((s) => s.key ?? s.id);
  console.log(`contraprova: ${chaves.length} chaves em agent_state`);

  const orfa = chaves.filter((k) => String(k).startsWith("para_frank_orfa_"));
  console.log(`\navisos de orfa existentes: ${orfa.length}`);
  for (const k of orfa.sort()) console.log(`  ${k}`);

  for (const alvo of ["UKC2COC2", "BFF94E2S"]) {
    const k = `para_frank_orfa_${alvo}`;
    console.log(`\n${k} -> ${chaves.includes(k) ? "EXISTE (avisado)" : "NAO EXISTE (ninguem foi avisado)"}`);
  }

  // quando cada aviso saiu, e por quais canais
  console.log(`\ndetalhe dos avisos (data / canais):`);
  for (const s of st) {
    const k = String(s.key ?? s.id);
    if (!k.startsWith("para_frank_orfa_")) continue;
    let v = s.value ?? s.data ?? s.state;
    if (typeof v === "string") { try { v = JSON.parse(v); } catch { /* cru */ } }
    console.log(`  ${k.replace("para_frank_orfa_", "").padEnd(10)} ${String(v?.at).slice(0, 19)}`
      + ` ${v?.compra?.buyerEmail ?? "-"} canais=${JSON.stringify(v?.canais ?? v?.entregue ?? "?")}`);
  }
})();
