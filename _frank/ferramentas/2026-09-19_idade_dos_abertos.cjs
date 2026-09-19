/**
 * IDADE DOS INCIDENTES ABERTOS + caixa de entrada do Vigia.
 *
 *   node _frank/ferramentas/2026-09-19_idade_dos_abertos.cjs
 *
 * Nasceu do passo (4) da varredura diaria ("liste incidentes abertos com a
 * idade de cada um"): o varredura_travados.cjs lista os abertos mas so imprime
 * idade para o balde "aguardando aluno". Sem idade nao da pra aplicar a regra 8
 * (pegue UM, o mais antigo com aluno afetado).
 *
 * Mora em _frank/ferramentas/ e nao em _Bugs/ por causa da regra 25-B: o
 * numero que ele produz vira linha de relatorio, e prova em pasta gitignorada
 * evapora (medido no #234).
 *
 * SO LEITURA. Nao escreve nada, nao fecha nada, nao manda e-mail.
 *
 * ARMADILHA 1 (03_ROTINA): consulta que erra volta VAZIA e o script imprime
 * "0" alegremente. Aqui todo `error` e checado e o script MORRE em vez de
 * reportar zero — zero de instrumento cego nao e zero medido.
 */
const { supa } = require("./_comum.cjs");

const AGORA = new Date();
const dias = (iso) => Math.floor((AGORA - new Date(iso)) / 86400000);

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

(async () => {
  const db = supa();

  // ── 1. Incidentes abertos, com idade ────────────────────────────────────
  const { data: inc, error: errInc } = await db
    .from("incidents")
    .select("id, status, title, occurrences, created_at, last_seen_at")
    .in("status", ["open", "investigating"])
    .order("created_at", { ascending: true });
  exigir("incidents", errInc);

  console.log(`\n📋 INCIDENTES ABERTOS: ${inc.length} (do mais VELHO pro mais novo)\n`);

  const velhos = inc.filter((i) => dias(i.created_at) >= 7);
  const novos = inc.filter((i) => dias(i.created_at) < 7);

  const linha = (i) => {
    const idade = String(dias(i.created_at)).padStart(3);
    const vis = String(dias(i.last_seen_at)).padStart(2);
    const st = i.status === "open" ? "open  " : "invest";
    return `   ${idade}d · visto há ${vis}d · [${st}] ${String(i.occurrences).padStart(4)}x · ${String(i.title).slice(0, 96)}`;
  };

  console.log(`── 🔴 ABERTOS HÁ 7 DIAS OU MAIS: ${velhos.length} ──`);
  velhos.forEach((i) => console.log(linha(i)));
  console.log(`\n── 🟡 ABERTOS HÁ MENOS DE 7 DIAS: ${novos.length} ──`);
  novos.forEach((i) => console.log(linha(i)));

  const idades = inc.map((i) => dias(i.created_at)).sort((a, b) => a - b);
  const mediana = idades.length ? idades[Math.floor(idades.length / 2)] : 0;
  console.log(
    `\n   idade: mais velho ${idades.at(-1) ?? 0}d · mediana ${mediana}d · ${velhos.length} de ${inc.length} passaram de 7d`,
  );

  // ── 2. Patch do Vigia esperando (rotina 1-B) ────────────────────────────
  const { data: patches, error: errP } = await db
    .from("agent_state")
    .select("key, updated_at, value")
    .like("key", "patch\\_%")
    .order("updated_at", { ascending: false });
  exigir("agent_state/patch", errP);

  console.log(`\n🩹 PATCH DO VIGIA ESPERANDO: ${patches.length}`);
  patches.forEach((p) =>
    console.log(
      `   ${p.key} · ${dias(p.updated_at)}d · ${p.value?.assunto ?? "(sem assunto)"} · inc ${p.value?.incident_id ?? "-"}`,
    ),
  );

  // ── 3. Recado tell_frank esperando (rotina 1-C) ─────────────────────────
  const { data: recados, error: errR } = await db
    .from("agent_state")
    .select("key, updated_at, value")
    .like("key", "para\\_frank\\_%")
    .order("updated_at", { ascending: false });
  exigir("agent_state/para_frank", errR);

  console.log(`\n📨 RECADO PRA MIM (tell_frank) ESPERANDO: ${recados.length}`);
  recados.forEach((r) =>
    console.log(
      `   ${r.key} · ${dias(r.updated_at)}d · ${r.value?.subject ?? "(sem assunto)"} · inc ${r.value?.incident_id ?? "-"}`,
    ),
  );
  if (recados.length) {
    console.log("\n   --- conteúdo dos recados ---");
    recados.forEach((r) =>
      console.log(`\n   [${r.key}]\n   ${String(r.value?.message ?? "").slice(0, 700)}`),
    );
  }

  console.log(
    `\n➡️  ${inc.length} aberto(s) · ${velhos.length} com 7d+ · ${patches.length} patch · ${recados.length} recado\n`,
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
