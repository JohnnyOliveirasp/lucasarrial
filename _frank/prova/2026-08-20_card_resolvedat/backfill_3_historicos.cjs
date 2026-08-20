/**
 * BACKFILL dos incidentes fechados sem resolved_at (card 20/08).
 *
 * O vigia mediu 5 às 20:25 UTC; às 20:31:59 o "claude" já tinha corrigido os 2
 * de hoje (ef6e08a4 e bea487b7 — conferido ao vivo, resolved_by='claude').
 * Sobram 3, e a regra do card é: data SÓ de evidência real, nunca de chute.
 *
 *  · 9b7cc261 (fixed 18/08) — TEM evidência: a própria agent_note de
 *    fechamento, by=agent, at=2026-08-18T12:27:30.204Z, escrita junto com a
 *    resolution_note ("ruido de limpeza, nao e incidente novo"; created_at da
 *    linha é 12:26:36 do mesmo dia — a nota veio 54s depois, no ato).
 *    → resolved_at = 2026-08-18T12:27:30.204Z, resolved_by = 'agent'.
 *  · 72055f75 (ignored, criado 21/07) e bee2fb8b (ignored, criado 21/07) —
 *    SEM evidência: nenhuma agent_note, resolution_note nula, sem updated_at
 *    na tabela, nada nos _frank/prova da época. → resolved_at FICA NULO e a
 *    linha ganha nota explícita "data de fechamento desconhecida" (o trigger
 *    da migration 85 não carimba linha já fechada, de propósito).
 *
 * Sem --confirmar, SIMULA. Releitura após gravar; conta linhas afetadas.
 */
const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");
const CONFIRMA = process.argv.includes("--confirmar");
const AGORA = new Date().toISOString();

const COM_EVIDENCIA = {
  id: "9b7cc261-c9b0-4b9b-a7db-b858627209ef",
  patch: {
    resolved_at: "2026-08-18T12:27:30.204Z",
    resolved_by: "agent",
  },
  nota:
    "FRANK 20/08 (card resolved_at nulo) — BACKFILL COM EVIDÊNCIA: resolved_at=2026-08-18T12:27:30.204Z " +
    "derivado da própria agent_note de fechamento (by=agent), gravada 54s depois do created_at da linha " +
    "(18/08 12:26:36), no ato da análise que virou a resolution_note. resolved_by='agent' pela autoria da nota. " +
    "Não mexi em status nem no mérito do fechamento.",
};

const SEM_EVIDENCIA = [
  { id: "72055f75-2240-4f6c-bffa-8a785f10ee61", rotulo: "generation:unknown:tensor size mismatch" },
  { id: "bee2fb8b-e35d-4951-9ae2-40bf1d9061d1", rotulo: "training:user_dataset:insufficient_audio" },
];
const NOTA_DESCONHECIDA =
  "FRANK 20/08 (card resolved_at nulo) — DATA DE FECHAMENTO DESCONHECIDA, deixada NULA de propósito: " +
  "sem agent_notes, sem resolution_note, tabela não tem updated_at e nada nos registros da época indica " +
  "quando (nem por quem) o status virou 'ignored'. Data inventada é pior que campo vazio. " +
  "CONSEQUÊNCIA: este incidente segue INVISÍVEL pro detector de zumbi por last_seen_at>resolved_at — " +
  "o detector deve tratar fechado com resolved_at nulo como 'sempre suspeito' em vez de pular (recomendação no card).";

(async () => {
  const db = supa();
  let gravadas = 0;

  // 1) o que tem evidência
  {
    const { data: antes, error: e0 } = await db
      .from("incidents")
      .select("id, status, resolved_at, resolved_by, agent_notes")
      .eq("id", COM_EVIDENCIA.id)
      .single();
    if (e0) { console.error("ERRO lendo 9b7cc261:", JSON.stringify(e0)); process.exit(1); }
    console.log(`9b7cc261 ANTES: status=${antes.status} resolved_at=${antes.resolved_at} resolved_by=${antes.resolved_by}`);
    if (antes.resolved_at) {
      console.log("  → já tem resolved_at (alguém corrigiu antes) — NÃO TOCO.");
    } else if (!CONFIRMA) {
      console.log("  [ENSAIO] gravaria:", JSON.stringify(COM_EVIDENCIA.patch));
    } else {
      const notas = Array.isArray(antes.agent_notes) ? antes.agent_notes : [];
      notas.push({ at: AGORA, by: "frank", note: COM_EVIDENCIA.nota });
      const { data: g, error: e1 } = await db
        .from("incidents")
        .update({ ...COM_EVIDENCIA.patch, agent_notes: notas })
        .eq("id", COM_EVIDENCIA.id)
        .is("resolved_at", null) // idempotente: nunca sobrescreve
        .select("id, status, resolved_at, resolved_by");
      if (e1) { console.error("ERRO gravando:", JSON.stringify(e1)); process.exit(1); }
      console.log(`  linhas afetadas: ${g.length}`, JSON.stringify(g[0] ?? null));
      gravadas += g.length;
    }
  }

  // 2) os sem evidência: só a nota-marcador, resolved_* fica nulo
  for (const alvo of SEM_EVIDENCIA) {
    const { data: antes, error: e0 } = await db
      .from("incidents")
      .select("id, status, resolved_at, resolved_by, agent_notes")
      .eq("id", alvo.id)
      .single();
    if (e0) { console.error(`ERRO lendo ${alvo.id}:`, JSON.stringify(e0)); process.exit(1); }
    console.log(`${alvo.id.slice(0, 8)} (${alvo.rotulo}) ANTES: status=${antes.status} resolved_at=${antes.resolved_at}`);
    const jaTem = (Array.isArray(antes.agent_notes) ? antes.agent_notes : []).some((n) =>
      String(n.note).includes("DATA DE FECHAMENTO DESCONHECIDA"),
    );
    if (jaTem) { console.log("  → nota-marcador já existe — NÃO duplico."); continue; }
    if (!CONFIRMA) { console.log("  [ENSAIO] adicionaria a nota 'data desconhecida' (resolved_* fica nulo)"); continue; }
    const notas = Array.isArray(antes.agent_notes) ? antes.agent_notes : [];
    notas.push({ at: AGORA, by: "frank", note: NOTA_DESCONHECIDA });
    const { data: g, error: e1 } = await db
      .from("incidents")
      .update({ agent_notes: notas })
      .eq("id", alvo.id)
      .select("id, resolved_at, resolved_by");
    if (e1) { console.error("ERRO gravando:", JSON.stringify(e1)); process.exit(1); }
    console.log(`  linhas afetadas: ${g.length} (resolved_at segue ${g[0]?.resolved_at ?? "?"} — de propósito)`);
    gravadas += g.length;
  }

  // 3) releitura final do conjunto: quantos fechados sem data restam
  const { data: cegos, error: e2 } = await db
    .from("incidents")
    .select("id, status, signature")
    .in("status", ["fixed", "ignored"])
    .is("resolved_at", null);
  const { count: totalFechados } = await db
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .in("status", ["fixed", "ignored"]);
  console.log(
    `\nFECHADOS SEM resolved_at AGORA: ${e2 ? "ERRO " + JSON.stringify(e2) : cegos.length} de ${totalFechados} fechados` +
      ` | linhas gravadas nesta execução: ${gravadas}${CONFIRMA ? "" : " (ENSAIO — nada gravado)"}`,
  );
  for (const c of cegos || []) console.log(`  ${String(c.id).slice(0, 8)} [${c.status}] ${c.signature.slice(0, 60)}`);
})();
