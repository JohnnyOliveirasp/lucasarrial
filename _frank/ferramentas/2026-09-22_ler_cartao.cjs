// Leitor read-only de incidente. Uso: node 2026-09-22_ler_cartao.cjs <id-ou-prefixo> [--notas=N]
// So LE. Nao grava nada.
const { supa } = require("./_comum.cjs");

(async () => {
  const alvo = process.argv[2];
  if (!alvo) { console.log("uso: node 2026-09-22_ler_cartao.cjs <id-ou-prefixo> [--notas=N]"); process.exit(1); }
  const nNotas = Number((process.argv.find(a => a.startsWith("--notas=")) || "--notas=6").split("=")[1]);

  const db = supa();
  // id e uuid: nao aceita LIKE. Puxo a lista e filtro por prefixo no cliente.
  const { data: todos, error } = await db.from("incidents").select("*").limit(2000);
  if (error) { console.log("ERRO:", error.message); process.exit(1); }
  const data = (todos || []).filter(r => String(r.id).startsWith(alvo));
  if (!data.length) { console.log(`nenhum cartao casa "${alvo}" (varridos ${todos.length})`); process.exit(1); }

  for (const i of data) {
    const nasc = i.first_seen_at || i.created_at;
    const dias = ((new Date() - new Date(nasc)) / 86400000).toFixed(1);
    console.log("=".repeat(78));
    console.log(`#${i.id}  [${i.status}]  ${i.occurrences}x  nascido ha ${dias}d`);
    console.log(`titulo: ${i.title}`);
    console.log(`categoria: ${i.category ?? "-"} · signature: ${i.signature ?? "-"}`);
    console.log(`first_seen: ${i.first_seen_at} · last_seen: ${i.last_seen_at}`);
    const em = i.affected_emails || [];
    console.log(`affected_emails (${em.length}): ${em.slice(0, 30).join(", ")}${em.length > 30 ? " ..." : ""}`);
    if (i.resolution_note) console.log(`\nRESOLUTION_NOTE:\n${i.resolution_note}`);
    const notas = i.agent_notes || [];
    console.log(`\n--- agent_notes: ${notas.length} no total, mostrando as ultimas ${Math.min(nNotas, notas.length)} ---`);
    for (const n of notas.slice(-nNotas)) {
      console.log(`\n[${n.at ?? n.ts ?? "?"}] (${n.by ?? n.author ?? "?"})`);
      console.log(String(n.note ?? n.texto ?? JSON.stringify(n)));
    }
  }
})();
