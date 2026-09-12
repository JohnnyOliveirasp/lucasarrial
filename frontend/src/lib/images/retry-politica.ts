/**
 * Parte PURA da política de retry da geração de imagem — zero dependências,
 * para ser testável com `node --test` (mesmo padrão de refs-pure.ts).
 *
 * `isTransientKieError` e a escolha do modelo do retry moravam em sync.ts até
 * 12/09; mudaram pra cá para que a decisão "retenta ou falha de vez" tenha
 * teste. O que MUDA de comportamento nessa mudança é só um ponto, o incidente
 * abaixo.
 *
 * INCIDENTE 12/09 (gen e568b3cd, comprador SGP rafaelzan@me.com, R$894): o
 * modelo TITULAR recusou 4 retratos clínicos impecáveis com
 * "your prompt was flagged by website as violating content policies" — falso
 * positivo de moderação sobre o prompt AVATAR_SOCIAL da casa. A recusa não é
 * transiente, o aluno não estava no fallback, então a condição de retry dava
 * falso e a row morria com retry_count=0: NUNCA houve segunda chance.
 *
 * O retry cruzado já existia justamente porque os dois modelos têm moderação
 * DIFERENTE — o comentário de sync.ts registrava a direção Seedream→GPT (caso
 * 05/08). A direção espelho (GPT recusa por moderação → Seedream aceita) nunca
 * tinha sido ligada. É o que `isModerationKieError` liga aqui.
 *
 * NÃO vira laço: a recusa por moderação JÁ no fallback continua caindo em
 * `falhar`, e a segunda chance é uma só (`retryCount`, espelhando o cadeado
 * atômico retry_count 0→1 que vive em sync.ts).
 */

/** Erros do Kie que valem UMA nova tentativa antes de falhar de vez. */
export function isTransientKieError(raw: string): boolean {
  return /internal error|try again|timeout|temporar|fetch failed/i.test(raw);
}

/**
 * Recusa por MODERAÇÃO/política de conteúdo. Não é transiente (insistir no
 * MESMO modelo repetiria a recusa), mas vale a segunda chance no OUTRO modelo,
 * que tem outra moderação.
 */
export function isModerationKieError(raw: string): boolean {
  return /flagged|content polic|moderat/i.test(raw);
}

export type DecisaoFalhaImagem<T extends string> =
  | { acao: "falhar" }
  | { acao: "retry"; modelo: T };

/**
 * Decide o que fazer quando o Kie devolve `fail`.
 *
 * Retenta em: erro transiente (qualquer modelo), recusa por moderação no
 * TITULAR, ou QUALQUER erro já no fallback (o titular pode aceitar o que o
 * Seedream recusou — caso 05/08). Sempre no OUTRO modelo, quando o fallback
 * está ligado; com o fallback desligado a retentativa é no titular, como antes.
 *
 * `retryCount` > 0 = a segunda chance já foi usada: falha de vez. Isso espelha
 * o cadeado atômico (`retry_count` 0→1) de sync.ts, que continua sendo a
 * autoridade contra a corrida webhook×poll — aqui é só a pré-checagem que
 * evita a ida ao banco.
 */
export function decidirAposFalhaImagem<T extends string>(args: {
  raw: string;
  /** `kie_model` da row (o modelo que acabou de recusar). */
  modeloAtual: string;
  modeloTitular: T;
  modeloFallback: T;
  fallbackLigado: boolean;
  retryCount: number;
}): DecisaoFalhaImagem<T> {
  const { raw, modeloAtual, modeloTitular, modeloFallback, fallbackLigado, retryCount } = args;
  if (retryCount > 0) return { acao: "falhar" };

  const onFallback = modeloAtual === modeloFallback;
  const vale =
    isTransientKieError(raw) || isModerationKieError(raw) || onFallback;
  if (!vale) return { acao: "falhar" };

  if (!fallbackLigado) return { acao: "retry", modelo: modeloTitular };
  return { acao: "retry", modelo: onFallback ? modeloTitular : modeloFallback };
}
