#!/usr/bin/env node
/**
 * anotar_incidente.cjs — a UNICA maneira segura de anotar/fechar incidente.
 *
 * POR QUE EXISTE: anotar incidente e a operacao que Vigia e Frank repetem toda
 * ronda, cada um com um script de uma linha em `_Bugs/`. Em menos de 24h isso
 * destruiu dado DUAS vezes, das duas maneiras possiveis:
 *
 *   1. 21/08 03h (Frank): `update({resolution_note})` direto APAGOU o historico
 *      de 4 incidentes. Recuperado do dump da propria ronda, por sorte.
 *   2. 21/08 (Vigia): concatenou STRING em cima do jsonb `agent_notes`, que e
 *      ARRAY. O array virou "[object Object],[object Object],..." e o conteudo
 *      de 21 notas em 3 incidentes (5c3f1f8b, ce6e157d, 100e7ace) foi perdido —
 *      esse nao teve dump, nao deu pra recuperar.
 *
 * As tres armadilhas medidas viram regra AQUI, pra ninguem mais tropecar:
 *
 *   - NOTA SE CONCATENA, NUNCA SE SOBRESCREVE. `resolution_note` recebe
 *     `historico + separador + nova`; `agent_notes` recebe um item NOVO no
 *     array (nunca string em cima do array).
 *   - UPDATE POR ID INEXISTENTE AFETA 0 LINHAS EM SILENCIO. Aqui o id e
 *     resolvido por prefixo ANTES, recusa se nao achar ou se for ambiguo, e a
 *     escrita confere o numero de linhas devolvidas pelo `.select()`.
 *   - ENSAIO NAO E ENTREGA. Sem `--confirmar` ele SIMULA e mostra o diff.
 *
 * USO:
 *   node _frank/ferramentas/anotar_incidente.cjs <id|prefixo> --nota "texto"
 *        [--por frank|vigia]        quem assina a nota (default: frank)
 *        [--status investigating|fixed|ignored|open]
 *        [--resolucao "texto"]      CONCATENA em resolution_note
 *        [--commit <sha>]           grava resolved_commit
 *        [--confirmar]              sem isso, so ensaia
 *
 * ⚠️ `--status fixed` sem ter resolvido de verdade viola a regra 14. A
 * ferramenta grava o que voce mandar; a honestidade da nota e sua.
 */
const { supa } = require("./_comum.cjs");

const STATUS_VALIDOS = ["open", "investigating", "fixed", "ignored", "fixing"];

function arg(nome) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tem = (nome) => process.argv.includes(nome);

/**
 * Resolve prefixo -> uuid completo. Recusa em vez de adivinhar: id que nao
 * existe faria o UPDATE afetar 0 linhas sem erro nenhum.
 */
async function resolverId(db, alvo) {
  const { data, error } = await db.from("incidents").select("id,title,status");
  if (error) throw new Error(`falha lendo incidents: ${JSON.stringify(error)}`);
  const hits = data.filter((i) => String(i.id).startsWith(alvo));
  if (hits.length === 0) {
    throw new Error(
      `nenhum incidente comeca com "${alvo}" — nao vou dar UPDATE em id que nao existe (afetaria 0 linhas em silencio)`,
    );
  }
  if (hits.length > 1) {
    throw new Error(
      `prefixo "${alvo}" e ambiguo (${hits.length}): ${hits.map((h) => h.id.slice(0, 12)).join(", ")}`,
    );
  }
  return hits[0];
}

/** agent_notes ja corrompido (string) vira UMA nota legada, sem perder o texto. */
function normalizarNotas(atual) {
  if (Array.isArray(atual)) return atual;
  if (atual === null || atual === undefined) return [];
  if (typeof atual === "string") {
    return [
      {
        at: null,
        by: "desconhecido",
        note:
          "[HISTORICO RECUPERADO DE STRING CORROMPIDA — o array jsonb foi " +
          "sobrescrito por concatenacao de string; os objetos originais ja " +
          "estavam perdidos neste ponto] " + atual,
        legado: true,
      },
    ];
  }
  return [atual];
}

(async () => {
  const alvo = process.argv[2];
  const nota = arg("--nota");
  const status = arg("--status");
  const resolucao = arg("--resolucao");
  const commit = arg("--commit");
  const por = arg("--por") || "frank";
  const confirmar = tem("--confirmar");

  if (!alvo || alvo.startsWith("--") || (!nota && !status && !resolucao)) {
    console.log(require("node:fs").readFileSync(__filename, "utf8").split("*/")[0]);
    process.exit(1);
  }
  if (status && !STATUS_VALIDOS.includes(status)) {
    console.error(`ERRO: status "${status}" invalido. Validos: ${STATUS_VALIDOS.join(", ")}`);
    process.exit(1);
  }

  const db = supa();
  const alvoInc = await resolverId(db, alvo);
  const { data: antes, error: e0 } = await db
    .from("incidents")
    .select("id,title,status,resolution_note,agent_notes,resolved_at,resolved_commit,occurrences,last_seen_at")
    .eq("id", alvoInc.id)
    .single();
  if (e0) {
    console.error("ERRO CRU na leitura:", JSON.stringify(e0, null, 2));
    process.exit(1);
  }

  const agora = new Date().toISOString();
  const patch = {};

  const notasAntes = normalizarNotas(antes.agent_notes);
  if (nota) patch.agent_notes = [...notasAntes, { at: agora, by: por, note: nota }];

  if (resolucao) {
    const hist = antes.resolution_note || "";
    // CONCATENA. A ronda das 03h perdeu 4 historicos fazendo isto direto.
    patch.resolution_note = hist
      ? `${hist}\n\n--- ${agora} (${por}) ---\n${resolucao}`
      : `--- ${agora} (${por}) ---\n${resolucao}`;
  }
  if (status) {
    patch.status = status;
    if (["fixed", "ignored"].includes(status) && !antes.resolved_at) {
      patch.resolved_at = agora;
      patch.resolved_by = por;
    }
  }
  if (commit) patch.resolved_commit = commit;

  console.log(`INCIDENTE ${antes.id}`);
  console.log(`  titulo: ${antes.title.slice(0, 90)}`);
  console.log(`  status: ${antes.status}${status ? ` -> ${status}` : " (sem mudanca)"}`);
  console.log(`  occurrences=${antes.occurrences} last_seen_at=${antes.last_seen_at}`);
  if (nota) {
    console.log(`  agent_notes: ${notasAntes.length} -> ${patch.agent_notes.length} notas`);
    if (!Array.isArray(antes.agent_notes)) {
      console.log(`  ⚠️  agent_notes estava CORROMPIDO (${typeof antes.agent_notes}); preservado como nota legada`);
    }
  }
  if (resolucao) {
    console.log(
      `  resolution_note: ${(antes.resolution_note || "").length} -> ${patch.resolution_note.length} chars (concatenado)`,
    );
  }

  if (!confirmar) {
    console.log("\n🔎 ENSAIO — nada gravado. Repita com --confirmar.");
    return;
  }

  const { data: depois, error: e1 } = await db
    .from("incidents")
    .update(patch)
    .eq("id", antes.id)
    .select("id,status,resolution_note,agent_notes,resolved_at,resolved_commit");
  if (e1) {
    console.error("ERRO CRU na escrita:", JSON.stringify(e1, null, 2));
    process.exit(1);
  }
  // O ponto do `.select()`: UPDATE por id inexistente devolve [] SEM erro.
  if (!depois || depois.length !== 1) {
    console.error(`FALHOU: o UPDATE afetou ${depois ? depois.length : 0} linhas, esperava 1. NADA foi confirmado.`);
    process.exit(1);
  }

  const d = depois[0];
  console.log("\n✅ GRAVADO (conferido na releitura, 1 linha afetada):");
  console.log(`  status = ${d.status}`);
  console.log(`  agent_notes = ${Array.isArray(d.agent_notes) ? d.agent_notes.length + " notas (array)" : "⚠️ NAO E ARRAY"}`);
  console.log(`  resolution_note = ${(d.resolution_note || "").length} chars`);
  if (d.resolved_at) console.log(`  resolved_at = ${d.resolved_at}`);
  if (d.resolved_commit) console.log(`  resolved_commit = ${d.resolved_commit}`);
})().catch((e) => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
