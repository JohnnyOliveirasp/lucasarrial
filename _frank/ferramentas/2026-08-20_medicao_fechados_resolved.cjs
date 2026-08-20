/* Medicao reproduzivel (read-only, so .select):
   dos incidentes FECHADOS (fixed|ignored), quantos estao
   (a) sem resolved_at e (b) com resolved_at mas sem resolved_by.
   Imprime denominadores e a lista crua dos ofensores. */
const { supa, STATUS_FECHADO } = require("./_comum.cjs");
(async () => {
  const db = supa();
  const { data: todos, error } = await db.from("incidents")
    .select("id,status,resolved_at,resolved_by,title");
  if (error) { console.error("ERRO CRU:", JSON.stringify(error)); process.exit(1); }
  const fechados = todos.filter((r) => STATUS_FECHADO.includes(r.status));
  const semAt = fechados.filter((r) => !r.resolved_at);
  const semBy = fechados.filter((r) => r.resolved_at && !r.resolved_by);
  console.log(`total incidentes: ${todos.length} | fechados (fixed|ignored): ${fechados.length}`);
  console.log(`(a) fechados SEM resolved_at: ${semAt.length}`);
  for (const r of semAt) console.log(`    ${r.id.slice(0,8)} [${r.status}] ${r.title.slice(0,70)}`);
  console.log(`(b) fechados COM resolved_at e SEM resolved_by: ${semBy.length}`);
  for (const r of semBy) console.log(`    ${r.id.slice(0,8)} [${r.status}] at=${r.resolved_at} | ${r.title.slice(0,70)}`);
})();
