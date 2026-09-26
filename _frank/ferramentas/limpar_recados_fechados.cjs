/**
 * Apaga os recados `para_frank_*` cujo incidente JÁ ESTÁ FECHADO.
 *
 * Base: 03_ROTINA §1-C ("Tratou? Apague a chave com DELETE") + o cartão
 * "A FILA DE TRABALHO DO FRANK NAO ESVAZIA QUANDO O CARTAO FECHA". Incidente
 * fechado = recado tratado; o que sobra ali é lixo que entope a fila e esconde
 * o trabalho de verdade (medido nesta ronda: 144 na fila, 111 vivos).
 *
 * SEGURANÇA: só apaga quando o incidente citado existe E está num status de
 * fechado. Recado sem incident_id, de incidente vivo, ou de incidente que não
 * achei, NÃO é tocado. Passe --seco pra só listar.
 *
 * Usa DELETE, nunca `set_state` com value null (agent_state.value é NOT NULL —
 * o UPDATE volta 23502 e a chave FICA; foi assim que 28 recados empilharam).
 */
const { supa } = require("./_comum.cjs");

const FECHADO = ["fixed", "ignored", "resolved", "closed", "duplicate"];
const SECO = process.argv.includes("--seco");

(async () => {
  const db = supa();

  const { data: recados, error: er } = await db
    .from("agent_state")
    .select("key, updated_at, value")
    .like("key", "para_frank_%");
  if (er) throw new Error("agent_state: " + er.message);

  const ids = [
    ...new Set(
      (recados ?? [])
        .map((r) => r.value?.incident_id)
        .filter((x) => typeof x === "string" && x.length > 20),
    ),
  ];

  const statusPorId = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("incidents")
      .select("id, status")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error("incidents: " + error.message);
    for (const r of data ?? []) statusPorId.set(r.id, r.status);
  }

  const alvos = (recados ?? []).filter((r) => {
    const st = statusPorId.get(r.value?.incident_id);
    return st !== undefined && FECHADO.includes(st);
  });

  console.log(`fila: ${recados?.length ?? 0} recado(s) · alvo (incidente fechado): ${alvos.length}`);
  for (const a of alvos)
    console.log(`  ${SECO ? "[seco]" : "apagar"} ${a.key} · [${statusPorId.get(a.value?.incident_id)}] ${String(a.value?.subject ?? "").slice(0, 80)}`);

  if (SECO) return console.log("\n--seco: nada apagado.");

  let ok = 0;
  for (const a of alvos) {
    const { data, error } = await db
      .from("agent_state")
      .delete()
      .eq("key", a.key)
      .select("key");
    if (error) { console.error(`  ERRO ${a.key}: ${error.message}`); continue; }
    if (data?.length) ok++;
    else console.error(`  ⚠️  ${a.key}: DELETE não removeu linha (0 afetadas)`);
  }

  const { data: sobra, error: es } = await db
    .from("agent_state")
    .select("key")
    .like("key", "para_frank_%");
  if (es) throw new Error("reconferencia: " + es.message);
  console.log(`\napagados: ${ok}/${alvos.length} · fila agora: ${sobra?.length ?? "?"} recado(s)`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
