/**
 * Config do DESPACHO de treino — fonte única para os DOIS caminhos que
 * submetem treino à RunPod:
 *
 *   · POST /api/v1/voices/[id]/start-training  (o aluno clica "Treinar")
 *   · lib/voices/redespachar-treino.ts         (retentativa automática 1x)
 *
 * Nasceu junto com a retentativa (cartão bb4d4cd0): o redespacho precisa
 * treinar EXATAMENTE como o despacho original — mesmo max_steps, mesmo teto de
 * execução, mesma validade de URL — e constante copiada é constante que
 * diverge em silêncio (foi assim que a régua do upload e a do treino saíram de
 * sincronia no caso 07745f61). Módulo PURO, sem imports: os comentários das
 * decisões moram aqui, junto do número que elas travam.
 */

/** Validade das URLs presignadas do treino (GET dos áudios + PUTs de saída). */
export const TRAIN_EXPIRES_SECONDS = 2 * 60 * 60; // 2h

/**
 * 500 = config que funciona com este dataset/codebase + alpha=16 (Aluno2
 * prova). 1000 (default do desktop VoiceLoraStudio/core.py:683) causou overfit
 * no LoRA → EsposaLucas saiu embolada com 26s de mumble no meio. Dataset/setup
 * daqui responde melhor a 500 + alpha=16.
 */
export const DEFAULT_MAX_STEPS = 500;

/** Idiomas aceitos pro Whisper do treino (referência/amostra). Default pt —
 *  comportamento inalterado pro app; es/en usados pelas Vozes Prontas. */
export const TRAIN_LANGUAGES: ReadonlySet<string> = new Set(["pt", "es", "en"]);

/**
 * Teto de execução do job (policy.executionTimeout), como nos clones
 * (video-clone/config.ts). Medido em prod 21-22/07: treino de dataset
 * 20-80min roda 6-8min em GPU rápida, mas worker frio + GPU lenta passou de
 * 10min (default antigo do endpoint → "executionTimeout exceeded"). Base
 * 30min pro cold start (07/08: 2 treinos morreram em workers FRIOS
 * recém-criados no rebalance da quota — a carga inicial do modelo come o teto
 * antigo de 20) + 0,3s de GPU por segundo de áudio. Rede de segurança, não
 * meta.
 */
export function trainExecutionTimeoutMs(durationSeconds: number | null): number {
  const dur = Math.ceil(durationSeconds || 3600); // sem duração conhecida = pior caso
  return (30 * 60 + Math.ceil(dur * 0.3)) * 1000;
}

/** Chave da amostra automática no bucket de generations — o player do
 *  histórico sabe ler daqui (`finalize-training.ts` usa a MESMA chave). */
export function buildSampleKey(userId: string, voiceId: string): string {
  return `${userId}/${voiceId}/sample.wav`;
}
