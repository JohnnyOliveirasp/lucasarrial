/** LEITURA PURA — estado vivo das DUAS assinaturas do Jackson (#247). Nao escreve. */
require("./../ferramentas/_comum.cjs");
const { assinaturasDe } = require("./../ferramentas/_hotmart.cjs");
(async () => {
  for (const e of ["jkakoalves@gmail.com", "jkakorio@hotmail.com"]) {
    const a = await assinaturasDe(e);
    console.log(`=== ${e} ===`);
    if (!a.ok) { console.log("  FALHOU:", a.erro, a.status); continue; }
    if (!a.assinaturas.length) console.log("  (nenhuma assinatura)");
    for (const s of a.assinaturas) {
      console.log(`  code=${s.subscriber_code || s.subscriber?.code} status=${s.status}` +
        ` dt_next=${s.date_next_charge ? new Date(s.date_next_charge).toISOString() : "-"}`);
    }
  }
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
