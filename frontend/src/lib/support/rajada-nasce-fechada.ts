/**
 * A decisão "esta rajada nasce fechada?" isolada do banco, PRA PODER SER
 * TESTADA — por isso mora aqui, e não dentro de `failure-alert.ts`: aquele
 * módulo é server-only e importa `@/lib/db/admin`, `@/lib/credits/service` e
 * `@/lib/email/resend`, aliases que o `node --test` não resolve. Teste que
 * importa de lá não roda na suíte (foi assim que a suíte da main ficou
 * vermelha).
 *
 * Regra: lógica pura que tem teste fica em módulo próprio, sem `@/`, e o
 * módulo server-only importa daqui.
 */

/**
 * Moderação bloqueando conteúdo = PRODUTO FUNCIONANDO, não falha. Regra do
 * Johnny (17/08): rajada de nsfw nasce fechada ("ignored") e reincidência não
 * reabre — registro fica pro histórico, mas não vira fila de ninguém.
 */
export function isModerationBlock(rawError: string): boolean {
  return /nsfw|moderation|moderaç|conteúdo impróprio|content policy|flagged/i.test(rawError || "");
}

/**
 * Esta linha errou duas vezes: primeiro descartando a classificação (chamado
 * #183), depois lendo o sinal errado (`alertSupport`, sobrecarregado — ver
 * `userInputError` no tipo de `openBurstIncident`).
 *
 * Duas válvulas, que NÃO são a mesma coisa:
 *  - moderação (regra do Johnny 17/08): nasce fechada SEMPRE;
 *  - erro de INPUT: nasce fechada SÓ SE o aluno não estiver travado — erro de
 *    input repetido em aluno sem nenhuma voz pronta é o sinal que o
 *    `escalateStuckUser` existe pra não perder (foi calando esse sinal que o
 *    bug do chunking rodou 18 dias).
 */
export function rajadaNasceFechada(a: {
  rawError: string;
  /** SÓ o classificador de input do aluno seta isto. Nunca `alertSupport`. */
  inputError: boolean;
  stuck: boolean;
}): boolean {
  return isModerationBlock(a.rawError) || (a.inputError && !a.stuck);
}
