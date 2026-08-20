/**
 * BACKFILL V2 (card 261b295b) — os 3 fechados historicamente sem resolved_at.
 *
 * Decisão do card (derruba o "nulo de propósito" da v1): preencher com valor
 * defensável e NÃO inventado — last_seen_at/created_at da própria linha,
 * resolved_by='backfill'.
 *
 * Racional do critério — max(last_seen_at, created_at): o fechamento não
 * aconteceu ANTES da última ocorrência NEM antes de a linha existir; o maior
 * dos dois é o limite inferior honesto. (O ensaio mostrou que nas duas linhas
 * o last_seen_at é ANTERIOR ao created_at — import histórico de 21/07: falha
 * de maio, linha nascida em julho. last_seen_at puro diria que o incidente
 * fechou antes de existir.) Preenchido, a linha sai da invisibilidade
 * permanente do detector de zumbi (last_seen_at > resolved_at com resolved_at
 * nulo nunca é verdadeiro).
 *
 *  · 72055f75 (ignored, 21/07) → resolved_at = max(last_seen_at, created_at)
 *  · bee2fb8b (ignored, 21/07) → resolved_at = max(last_seen_at, created_at)
 *  · 9b7cc261 (fixed, 18/08)   → JÁ preenchido na v1 com evidência real
 *    (agent_note de fechamento) — evidência real vale mais que o critério
 *    genérico: se já tem resolved_at, NÃO TOCA (idempotência).
 *
 * Idempotente: .is('resolved_at', null) no update — nunca sobrescreve.
 * Sem --confirmar, SIMULA. Releitura das 3 linhas após gravar; conta linhas
 * afetadas (update por id inexistente afeta 0 linhas EM SILÊNCIO no Supabase).
 */
const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");
const CONFIRMA = process.argv.includes("--confirmar");
const AGORA = new Date().toISOString();

const ALVOS = [
  { id: "72055f75-2240-4f6c-bffa-8a785f10ee61", rotulo: "generation:unknown:tensor size mismatch" },
  { id: "bee2fb8b-e35d-4951-9ae2-40bf1d9061d1", rotulo: "training:user_dataset:insufficient_audio" },
  { id: "9b7cc261-c9b0-4b9b-a7db-b858627209ef", rotulo: "fixed 18/08 (backfill v1 com evidência)" },
];

const NOTA = (valor, origem) =>
  `FRANK 20/08 (card 261b295b, backfill v2) — resolved_at=${valor} preenchido pelo critério do card: ` +
  `${origem} da própria linha (o fechamento não é anterior à última ocorrência nem ao nascimento da linha). ` +
  `resolved_by='backfill'. A v1 tinha deixado nulo ('data desconhecida'); o card mandou preencher com valor ` +
  `defensável e não-inventado pra tirar a linha da invisibilidade permanente do detector de zumbi. ` +
  `Não mexi em status nem no mérito do fechamento.`;

(async () => {
  const db = supa();
  let gravadas = 0;

  for (const alvo of ALVOS) {
    const { data: antes, error: e0 } = await db
      .from("incidents")
      .select("id, status, resolved_at, resolved_by, last_seen_at, created_at, agent_notes")
      .eq("id", alvo.id)
      .single();
    if (e0) {
      console.error(`ERRO lendo ${alvo.id}:`, JSON.stringify(e0));
      process.exit(1);
    }
    console.log(
      `${alvo.id.slice(0, 8)} ANTES: status=${antes.status} resolved_at=${antes.resolved_at} ` +
        `resolved_by=${antes.resolved_by} last_seen_at=${antes.last_seen_at} created_at=${antes.created_at}`,
    );

    if (antes.resolved_at) {
      console.log("  → já tem resolved_at — NÃO TOCO (idempotente).");
      continue;
    }

    const candidatos = [antes.last_seen_at, antes.created_at].filter(Boolean);
    if (!candidatos.length) {
      console.error(`  ✗ ${alvo.id}: sem last_seen_at NEM created_at — nada defensável, pulando.`);
      continue;
    }
    const valor = candidatos.sort((a, b) => new Date(a) - new Date(b)).at(-1);
    const origem =
      candidatos.length === 1
        ? antes.last_seen_at
          ? "last_seen_at (created_at nulo)"
          : "created_at (last_seen_at nulo)"
        : valor === antes.created_at
          ? "max(last_seen_at, created_at) = created_at"
          : "max(last_seen_at, created_at) = last_seen_at";
    if (!CONFIRMA) {
      console.log(`  [ENSAIO] gravaria: resolved_at=${valor} (${origem}), resolved_by='backfill'`);
      continue;
    }

    const notas = Array.isArray(antes.agent_notes) ? antes.agent_notes : [];
    notas.push({ at: AGORA, by: "frank", note: NOTA(valor, origem) });
    const { data: g, error: e1 } = await db
      .from("incidents")
      .update({ resolved_at: valor, resolved_by: "backfill", agent_notes: notas })
      .eq("id", alvo.id)
      .is("resolved_at", null) // idempotente: nunca sobrescreve
      .select("id, status, resolved_at, resolved_by");
    if (e1) {
      console.error(`ERRO gravando ${alvo.id}:`, JSON.stringify(e1));
      process.exit(1);
    }
    console.log(`  linhas afetadas: ${g.length}`, JSON.stringify(g[0] ?? null));
    gravadas += g.length;
  }

  // Releitura final: as 3 linhas como o BANCO as tem agora.
  console.log(`\n== RELEITURA FINAL (a prova é o que o banco devolve, não o que o script planejou) ==`);
  const { data: fim, error: eF } = await db
    .from("incidents")
    .select("id, status, resolved_at, resolved_by")
    .in("id", ALVOS.map((a) => a.id))
    .order("created_at");
  if (eF) {
    console.error("ERRO na releitura:", JSON.stringify(eF));
    process.exit(1);
  }
  for (const r of fim) console.log(JSON.stringify(r));
  console.log(`\nlinhas relidas: ${fim.length}/3 | gravadas nesta execução: ${gravadas}${CONFIRMA ? "" : " (ENSAIO — nada gravado)"}`);

  // Denominador: quantos fechados seguem sem resolved_at no banco inteiro.
  const { data: cegas, error: eC } = await db
    .from("incidents")
    .select("id, status")
    .in("status", ["fixed", "ignored"])
    .is("resolved_at", null);
  if (eC) {
    console.error("ERRO no denominador:", JSON.stringify(eC));
    process.exit(1);
  }
  const { count: totalFechadas, error: eT } = await db
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .in("status", ["fixed", "ignored"]);
  if (eT) {
    console.error("ERRO no total:", JSON.stringify(eT));
    process.exit(1);
  }
  console.log(`fechadas sem resolved_at no banco: ${cegas.length} de ${totalFechadas} fechadas${cegas.length ? " → " + cegas.map((c) => c.id.slice(0, 8)).join(", ") : ""}`);
})();
