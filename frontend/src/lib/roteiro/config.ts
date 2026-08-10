/**
 * Gerador de Roteiro — constantes client-safe (sem dep de servidor).
 *
 * Preço: 100 créditos por roteiro (decisão Johnny 10/08). É texto, e é a PORTA
 * do funil (roteiro 100 → áudio ~850 → vídeo ~5.985): cobrar caro na entrada
 * estrangula o consumo pesado que vem depois. Custo real por roteiro no
 * DeepSeek V4-Flash ≈ R$0,002 — margem ~98%.
 */

/** Durações oferecidas na UI, em segundos de vídeo falado. */
export const ROTEIRO_DURATIONS = [30, 45, 60, 90] as const;
export type RoteiroDuration = (typeof ROTEIRO_DURATIONS)[number];

/**
 * Alvo de palavras por duração (~2,5 palavras/s em pt-BR falado).
 * Sem isso a LLM escreve 400 palavras e o roteiro não cabe na gravação.
 */
export const ROTEIRO_WORD_TARGET: Record<RoteiroDuration, number> = {
  30: 75,
  45: 115,
  60: 150,
  90: 225,
};

/** Custo em créditos de UM roteiro. */
export const ROTEIRO_COST = 100;

/**
 * Custo de UMA mensagem no chat de ajuste (decisão Johnny 10/08).
 * Medido: a mensagem custa de 1,4 cr (a 1ª) a 8,2 cr (a 30ª, com o histórico
 * todo voltando pro modelo) — o empate fica em ~8 cr. A 10 cr sobra margem em
 * qualquer ponto da conversa E o aluno consegue refinar 10 vezes pelo preço de
 * gerar um roteiro novo; mais caro que isso e sai mais barato mandar gerar de
 * novo, o que mataria o chat.
 */
export const ROTEIRO_CHAT_COST = 10;

/**
 * Quantas mensagens do histórico voltam pro modelo. Trava o custo (deixa de
 * crescer a partir daqui) sem o aluno perder o fio da conversa.
 */
export const ROTEIRO_CHAT_WINDOW = 20;

/** Teto de caracteres de UMA mensagem do aluno no chat. */
export const ROTEIRO_CHAT_MAX = 800;

/** Limites da ideia enviada pelo aluno. */
export const ROTEIRO_IDEA_MIN = 5;
export const ROTEIRO_IDEA_MAX = 1_000;

/** Quantos roteiros o histórico mostra por padrão. */
export const ROTEIRO_HISTORY_LIMIT = 20;

export function isRoteiroDuration(v: unknown): v is RoteiroDuration {
  return (ROTEIRO_DURATIONS as readonly number[]).includes(Number(v));
}
