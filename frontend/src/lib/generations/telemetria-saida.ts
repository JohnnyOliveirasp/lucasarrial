/**
 * O contrato de SAÍDA do worker de inferência e o que dele sobrevive até o
 * banco. Lógica pura, sem I/O — mora fora do `finalize.ts` de propósito: aquele
 * é server-only e importa R2/Supabase/ffmpeg, então não dá pra cobrir com
 * `node --test`. Este dá, e é justamente a parte que já quebrou calada.
 *
 * Incidente d3d8d1b2 (chamado #15).
 *
 * Rodar:
 *   cd frontend && node --test src/lib/generations/telemetria-saida.test.ts
 */

export type GenerationOutput = {
  sample_rate?: number;
  duration_s?: number;
  /**
   * Tempo só da GERAÇÃO dos chunks: no worker ele conta a partir do `t0`, que
   * começa DEPOIS do setup. Não é o tempo do job.
   */
  elapsed_s?: number;
  /**
   * #15: tempo de setup (LoRA + referência + carga do modelo) que o `elapsed_s`
   * NÃO conta. O worker passou a mandar isto em `2bd3c3f` (PR #183) pra régua
   * poder somar os dois — o teto do RunPod corre sobre o job INTEIRO, enquanto
   * o p99 que calibrou esse teto saiu do campo setup-cego.
   */
  setup_s?: number;
  /** Telemetria do QA do worker (mig 94, #52): echo/coverage/intrusion/regens/rescue. */
  qa?: Record<string, unknown>;
  coverage_failed_chunk?: number;
  coverage_best?: number;
  coverage_min?: number;
};

/**
 * O que vai pra `generations.qa` — o bloco `qa` do worker + os campos que o
 * worker manda como IRMÃOS de `qa` (não dentro dele).
 *
 * ⚠️ Isto é uma LISTA BRANCA, não um repasse. Campo que o worker mande e que
 * não esteja nomeado aqui é descartado EM SILÊNCIO, e o sintoma aparece longe:
 * a medição seguinte lê `null` no banco e conclui que "o worker não mandou".
 *
 * Foi exatamente o que aconteceu com o `setup_s`: o PR #183 (`2bd3c3f`) o
 * colocou na entrega do worker pra fechar a cegueira do #15, mas como ninguém
 * o nomeou aqui, ele morria neste ponto e nunca chegou ao banco. Quem
 * acrescentar campo novo no `_entregar()` do worker acrescenta aqui também.
 */
export function qaTelemetria(out: GenerationOutput): Record<string, unknown> | null {
  const extra: Record<string, unknown> = {};
  if (typeof out.coverage_failed_chunk === "number") extra.coverage_failed_chunk = out.coverage_failed_chunk;
  if (typeof out.coverage_best === "number") extra.coverage_best = out.coverage_best;
  if (typeof out.coverage_min === "number") extra.coverage_min = out.coverage_min;
  if (typeof out.setup_s === "number") extra.setup_s = out.setup_s;
  if (!out.qa && Object.keys(extra).length === 0) return null;
  return { ...(out.qa ?? {}), ...extra };
}
