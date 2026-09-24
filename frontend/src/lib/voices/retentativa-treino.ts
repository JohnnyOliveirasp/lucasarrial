/**
 * RETENTATIVA AUTOMÁTICA DE TREINO — 1x, nunca mais (cartão bb4d4cd0, 24/09).
 *
 * Autorização do Johnny, nas palavras dele: "Retentativa automatica de treino:
 * autorizada, com limite de 1 retentativa por treino."
 *
 * Regra PURA, sem imports de runtime (só type): roda com `node --test` pelado
 * e cada combinação é testável sem montar meio Supabase de mentira — o mesmo
 * motivo de `falha-de-treino.ts` existir.
 *
 * ── Por que o teto de 1 importa (e é HARD, não meta) ──────────────────────
 * Retentativa gasta GPU inteira: um treino roda 14–30 min de GPU (média 22,
 * medida em 24/09). Sem teto, uma falha ESTRUTURAL — ex.: arquivo não-áudio
 * na lista de treino, que já aconteceu duas vezes nesta casa — entraria em
 * loop e queimaria GPU pra sempre sem nunca ter chance de dar certo.
 *
 * ── Onde mora o contador (e por que ele sobrevive a reinício) ─────────────
 * NÃO existe coluna nova nem contador em memória. Cada tentativa de treino já
 * vira uma linha em `training_jobs` (start-training e o redespacho inserem
 * uma), e cada falha marca essa linha `failed` DENTRO do gate idempotente de
 * `finalizeTraining` — antes de qualquer decisão daqui. Logo:
 *
 *   nº de falhas deste treino = COUNT(training_jobs failed desta voz)
 *
 * É contagem no banco, então reinício de worker/backend não zera nada — um
 * contador só em memória tornaria o teto decorativo. E é à prova de estado
 * podre: aconteça o que acontecer com statuses intermediários, a partir da 2ª
 * linha failed a voz nunca mais é retentada sozinha.
 *
 * ⚠️ Escopo do "por treino": no fluxo orgânico, voz `failed` é TERMINAL e o
 * recomeço do aluno é uma voz NOVA (ver `falha-de-treino.ts`) — então contar
 * por voice_id É contar por treino. A exceção é o resgate manual (a equipe
 * rearma a MESMA voz): essa voz já carrega ≥1 failed e portanto nunca ganha
 * retentativa automática. Deliberado e conservador: no resgate já tem humano
 * olhando, e GPU não se gasta por palpite.
 */
import type { IncidentCause } from "../incidents/classify.ts";

/** O teto do Johnny. Mudar isto é decisão de dono, não refactor. */
export const MAX_RETENTATIVAS_DE_TREINO = 1;

/**
 * A causa desta falha tem CHANCE REAL de sumir num segundo treino idêntico?
 *
 * Só entra aqui causa com transitoriedade provada ou plausível por mecanismo:
 *   infra_gpu     · CUDA OOM = GPU disputada com processo vizinho; o próprio
 *                   título do incidente diz "repetir costuma curar" (15/09).
 *   infra_disk    · disco LOCAL do worker cheio / checkpoint truncado; a
 *                   retentativa cai em outro pod com disco são.
 *   infra_storage · R2 tossiu (download/upload, 502, timeout) — flakiness de
 *                   rede, não propriedade do dataset.
 *   capacity      · executionTimeout: medido em 07-08, era worker FRIO + GPU
 *                   lenta; a retentativa tende a pegar worker quente.
 *
 * O que fica DE FORA, e por quê:
 *   user_dataset · material do aluno; o mesmo áudio produz a mesma reprovação
 *                  (e nem chega aqui: `falhaEhNossa` já barrou antes).
 *   bug          · estrutural NOSSO — inclui o chunk inválido em /dataset/
 *                  (#475, a "foto na lista de áudio"): o defeito se repete
 *                  identicamente e retentar é só queimar GPU.
 *   unknown      · falha CEGA (sem erro, sem stderr). Retentar o que não se
 *                  sabe diagnosticar é gastar por palpite.
 *   reported     · não é falha de treino; nunca chega aqui.
 */
export function causaEhRetentavel(cause: IncidentCause): boolean {
  return (
    cause === "infra_gpu" ||
    cause === "infra_disk" ||
    cause === "infra_storage" ||
    cause === "capacity"
  );
}

/**
 * A decisão inteira, num lugar só.
 *
 * `falhasDaVoz` INCLUI a falha que acabou de ser gravada (o gate idempotente
 * marcou a linha `failed` antes de perguntar aqui). Então:
 *   1ª falha → falhasDaVoz = 1 → retenta (1 ≤ teto)
 *   2ª falha → falhasDaVoz = 2 → PARA: falha de vez, humano fica sabendo
 *
 * `null` = a contagem no banco FALHOU. Sem contador provado não há teto
 * provado, e teto não provado é loop em potência — não retenta. O treino cai
 * no caminho normal de falha (estorno + chamado), que é o desfecho seguro.
 */
export function deveRetentarTreino(args: {
  /** `falhaEhNossa(...)`: técnica, não material do aluno. */
  falhaNossa: boolean;
  /** `classifyCause(rawError, diag)` — o MESMO árbitro do chamado. */
  cause: IncidentCause;
  /** COUNT de training_jobs `failed` desta voz, já incluindo esta falha.
   *  `null` quando a contagem não pôde ser feita. */
  falhasDaVoz: number | null;
}): boolean {
  if (!args.falhaNossa) return false;
  if (!causaEhRetentavel(args.cause)) return false;
  if (args.falhasDaVoz === null) return false;
  // ≥1 sempre (esta própria falha está na conta); <1 é estado impossível e
  // portanto suspeito — não retenta em cima de leitura quebrada.
  if (args.falhasDaVoz < 1) return false;
  return args.falhasDaVoz <= MAX_RETENTATIVAS_DE_TREINO;
}
