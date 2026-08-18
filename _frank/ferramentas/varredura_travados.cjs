/**
 * VARREDURA DIÁRIA — acha tudo que está parado num estado intermediário,
 * do mais antigo pro mais novo. Só leitura: não muda nada.
 *
 *   node _frank/ferramentas/varredura_travados.cjs
 *   node _frank/ferramentas/varredura_travados.cjs --horas 2
 */
const { supa, listar, BUCKETS, minutos, idadeHoras } = require("./_comum.cjs");

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? Number(process.argv[i + 1]) : padrao;
};
const HORAS = arg("horas", 1);

/**
 * tabela, estados suspeitos, "demais" (horas), campo de nome, coluna de data.
 * ⚠️ `react_jobs` é a única em português: a data é `criado_em`.
 */
const ALVOS = [
  ["voices", ["uploading", "validating"], 0.5, "name", "created_at"],
  ["voices", ["training"], 1.5, "name", "created_at"],
  ["training_jobs", ["queued", "running"], 1.5, null, "created_at"],
  ["generations", ["pending", "processing"], 0.5, null, "created_at"],
  ["image_generations", ["pending"], 0.5, "name", "created_at"],
  ["video_clones", ["pending", "generating"], 1, null, "created_at"],
  ["react_jobs", ["fila", "baixando", "clonando", "montando"], 1, null, "criado_em"],
];

(async () => {
  const db = supa();
  const corte = new Date(Date.now() - HORAS * 3600000).toISOString();
  let total = 0;

  for (const [tabela, estados, limiteHoras, campoNome, colData] of ALVOS) {
    const cols = ["id", "user_id", "status", colData, campoNome].filter(Boolean).join(", ");
    const { data, error } = await db
      .from(tabela)
      .select(cols)
      .in("status", estados)
      .lt(colData, corte)
      .order(colData, { ascending: true })
      .limit(50);
    if (error) {
      console.log(`⚠️  ${tabela}: ${error.message}`);
      continue;
    }
    const presos = (data ?? []).filter((r) => idadeHoras(r[colData]) > limiteHoras);
    if (presos.length === 0) continue;

    console.log(`\n🔴 ${tabela} — ${presos.length} parado(s) [${estados.join("/")}]`);
    for (const r of presos.slice(0, 15)) {
      const { data: p } = await db
        .from("profiles")
        .select("email, access_until")
        .eq("id", r.user_id)
        .maybeSingle();
      const pagante = p?.access_until && new Date(p.access_until) > new Date();
      console.log(
        `   ${String(r[colData]).slice(0, 16)} (${idadeHoras(r[colData]).toFixed(1)}h) ` +
          `${p?.email ?? r.user_id} ${r[campoNome] ? `"${r[campoNome]}"` : ""} [${r.status}]` +
          (pagante ? " · PAGANTE" : ""),
      );
      total++;
    }
    if (presos.length > 15) console.log(`   … e mais ${presos.length - 15}`);
  }

  // Vozes paradas COM áudio no R2 = resgate na certa (o sweep resolve; se
  // aparecer aqui é porque o sweep não está rodando).
  const { data: uploads } = await db
    .from("voices")
    .select("id, user_id, name, created_at")
    .eq("status", "uploading")
    .lt("created_at", new Date(Date.now() - 1800000).toISOString())
    .limit(20);
  let comAudio = 0;
  for (const v of uploads ?? []) {
    const arquivos = await listar(BUCKETS.vozes(), `${v.user_id}/${v.id}/`);
    if (arquivos.length > 0) comAudio++;
  }
  if (comAudio > 0) {
    console.log(
      `\n🚨 ${comAudio} voz(es) com ÁUDIO no R2 esperando resgate — ` +
        `o sweep de 5min devia ter pego. Rode o sweep e investigue (playbook A).`,
    );
  }

  // Incidentes abertos
  const { data: inc } = await db
    .from("incidents")
    .select("status, title, occurrences, last_seen_at")
    .in("status", ["open", "investigating"])
    .order("last_seen_at", { ascending: false })
    .limit(15);
  if (inc?.length) {
    console.log(`\n📋 INCIDENTES ABERTOS: ${inc.length}`);
    for (const i of inc) {
      console.log(`   [${i.status}] ${i.title} (${i.occurrences}x, ${i.last_seen_at.slice(0, 16)})`);
    }
  }

  console.log(
    total === 0 && comAudio === 0 && !inc?.length
      ? "\n✅ Nada preso, nada aberto."
      : `\n➡️  ${total} item(ns) preso(s). Vá pelo mais antigo — playbooks em _frank/04.`,
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
