#!/usr/bin/env node
/**
 * Régua do #15: quanto do teto de execução as gerações REAIS estão usando.
 *
 * POR QUE ESTA FERRAMENTA EXISTE (11/09): três rondas seguidas mediram a régua
 * por consulta ad-hoc e três vezes o número publicado envelheceu ou saiu errado.
 * O erro de 10/09 foi de POPULAÇÃO: contar `status='ready'` puro trata as linhas
 * `name = "Amostra automática"` como geração. Elas são gravadas direto por
 * `frontend/src/lib/voices/finalize-training.ts:519-531` no fim do treino,
 * têm `runpod_job_id` NULL, texto fixo de ~103 chars e `elapsed_seconds` nulo —
 * nunca passaram pela inferência. Eram ~25% do denominador, e foi daí que saiu a
 * conclusão falsa de que "1 em 4 não grava setup_s, o viés puxa pro lado
 * inseguro". Cortando a população certa a cobertura é 99,3% (100% desde 06/09).
 *
 * ⚠️ ARMADILHA HERDADA: `elapsed_seconds` significa duas coisas. No SUCESSO é o
 * `elapsed_s` do worker (SEM setup); na FALHA é o `executionTime` do RunPod (COM
 * setup). Por isso aqui só se mede SUCESSO, somando `qa.setup_s + elapsed_s`.
 *
 * ⚠️ As duas constantes abaixo espelham `frontend/src/lib/generations/execucao.ts`.
 * São cópia, não import (o .cjs não carrega TS). Elas são IMPRESSAS no cabeçalho
 * justamente pra divergência aparecer a olho nu — se não baterem com o arquivo
 * de produção, o número desta ferramenta é lixo.
 *
 *   uso: node _frank/ferramentas/medir_regua_15.cjs [desde=2026-09-05]
 */
const { supa } = require("./_comum.cjs");

const RESERVA_SETUP_S = 360;
const SEGUNDOS_POR_CHUNK = 40;
const PISO_S = 8 * 60;
const CHUNK_CHARS = 160;

const teto = (len) =>
  Math.max(PISO_S, RESERVA_SETUP_S + Math.max(1, Math.ceil(len / CHUNK_CHARS)) * SEGUNDOS_POR_CHUNK);

const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

(async () => {
  const desde = process.argv[2] || "2026-09-05";
  const db = supa();

  // PAGINADO: o Supabase corta em 1000 linhas em silêncio.
  let todas = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("generations")
      .select("id,created_at,status,qa,elapsed_seconds,runpod_job_id,text_normalized,text_raw,name")
      .gte("created_at", `${desde}T00:00:00Z`)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    todas = todas.concat(data);
    if (data.length < 1000) break;
  }

  const prontas = todas.filter((g) => g.status === "ready");
  const amostras = prontas.filter((g) => !g.runpod_job_id);
  const reais = prontas.filter((g) => g.runpod_job_id);
  const comSetup = reais.filter((g) => g.qa && g.qa.setup_s !== undefined && g.qa.setup_s !== null);

  console.log("=".repeat(78));
  console.log(`RÉGUA DO #15 — desde ${desde} — medido em ${new Date().toISOString()}`);
  console.log(`régua espelhada: reserva ${RESERVA_SETUP_S}s + ${SEGUNDOS_POR_CHUNK}s/chunk de ${CHUNK_CHARS} chars, piso ${PISO_S}s`);
  console.log("=".repeat(78));
  console.log(`prontas ................: ${prontas.length}`);
  console.log(`  Amostra automática ...: ${amostras.length}  (runpod_job_id NULL — NÃO são geração, fora da conta)`);
  console.log(`  reais (foram ao RunPod): ${reais.length}`);
  console.log(`  dessas, com setup_s ..: ${comSetup.length} (${((100 * comSetup.length) / (reais.length || 1)).toFixed(1)}%)`);

  const semSetup = reais.filter((g) => !(g.qa && g.qa.setup_s != null));
  if (semSetup.length) {
    console.log(`  ⚠️ reais SEM setup_s: ${semSetup.length} — se for fora de 05/09, a telemetria regrediu:`);
    for (const g of semSetup.slice(0, 10)) console.log(`      ${g.created_at.slice(0, 19)} ${g.id.slice(0, 8)}`);
  }

  const S = comSetup.map((g) => g.qa.setup_s);
  console.log(`\nsetup_s: p50=${pct(S, 0.5)?.toFixed(1)} p95=${pct(S, 0.95)?.toFixed(1)} máx=${Math.max(...S).toFixed(1)}`);
  const estouram = comSetup.filter((g) => g.qa.setup_s > RESERVA_SETUP_S);
  if (estouram.length) {
    console.log(`⛔ ${estouram.length} geração(ões) com setup ACIMA da reserva de ${RESERVA_SETUP_S}s:`);
    for (const g of estouram) console.log(`     ${g.created_at.slice(0, 19)} ${g.id.slice(0, 8)} setup=${g.qa.setup_s.toFixed(1)}s`);
  }

  const uso = comSetup.map((g) => {
    const len = (g.text_normalized || g.text_raw || "").length;
    const t = teto(len);
    return { u: (100 * (g.qa.setup_s + (g.elapsed_seconds || 0))) / t, id: g.id, len, t, at: g.created_at };
  });
  const U = uso.map((x) => x.u);
  console.log(`\nuso do teto: p50=${pct(U, 0.5)?.toFixed(1)}% p95=${pct(U, 0.95)?.toFixed(1)}% pior=${Math.max(...U).toFixed(1)}%`);
  console.log(`acima de 80% do teto: ${U.filter((x) => x > 80).length}`);
  console.log("\npiores 5 (é daqui que sai a próxima ocorrência do #15):");
  for (const x of uso.sort((a, b) => b.u - a.u).slice(0, 5)) {
    console.log(`  ${x.at.slice(0, 19)} ${x.id.slice(0, 8)} ${String(x.len).padStart(5)}ch teto=${x.t}s -> ${x.u.toFixed(1)}%`);
  }

  // Critério (a) do handoff de 10/09: a próxima falha de executionTimeout.
  const timeouts = todas.filter((g) => (g.error_message || "").toLowerCase().includes("executiontimeout"));
  console.log(`\nexecutionTimeout desde ${desde}: ${timeouts.length}`);
  for (const g of timeouts) console.log(`  ${g.created_at.slice(0, 19)} ${g.id.slice(0, 8)} ${(g.error_message || "").slice(0, 70)}`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
