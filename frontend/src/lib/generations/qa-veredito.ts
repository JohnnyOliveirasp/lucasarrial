/**
 * Veredito legível do QA de uma geração de áudio (incidente 702cc916).
 *
 * O QUE ESTE ARQUIVO RESOLVE. O laço de QA do worker
 * (`runpod-worker/tts_qa/loop.py:562`), quando esgota as tentativas de
 * regeneração de um chunk, NÃO falha o job: loga `inference.qa.exhausted`, dá
 * `break` e entrega o `best_seg` — que por definição ainda está reprovado pelo
 * próprio critério (score > 0). A geração vai pro banco com `status = 'ready'`
 * e `error_message = null`. Medido em 12/09: 593 gerações com `exhausted > 0`,
 * 580 delas `ready`.
 *
 * O efeito no atendimento é o que abriu o incidente: o aluno reclama que a voz
 * saiu errada, a Fast abre o contexto da conta e vê uma geração PERFEITA — daí
 * o atendimento cair em culpar o aluno. O dado JÁ existia na coluna jsonb
 * `generations.qa`; o que faltava era alguém LER. A string "exhausted" aparecia
 * zero vezes em `frontend/src` antes deste arquivo.
 *
 * ⚠️ ESTE ARQUIVO NÃO MUDA COMPORTAMENTO DE ENTREGA. Não falha geração, não
 * estorna, não toca em crédito. A decisão de produto (falhar sem cobrar ×
 * entregar avisando × manter como está) é do Johnny e não está aqui. Isto é
 * SÓ a parte visível: fazer o suporte enxergar quem recebeu chunk reprovado
 * antes do aluno reclamar.
 *
 * ⚠️ AUSÊNCIA DE RESSALVA NÃO É PROVA DE ÁUDIO FIEL, e por isso o texto daqui
 * nunca diz "áudio conferido". A cobertura é medida por presença de palavra em
 * ordem: ela é CEGA para SUBSTITUIÇÃO. Medido em 10/09 na própria fila: a
 * geração 1425ca2f entregou "faz falar" onde o texto dizia "fácil falar", com
 * `coverage_min_visto = 1` e zero faltantes. Na direção oposta, o texto também
 * nunca diz "áudio ruim": o que se afirma é o FATO do worker (esgotou as
 * tentativas e entregou assim mesmo), não um julgamento do áudio.
 */

/** Quantas palavras faltantes cabem na linha antes de virar ruído no prompt. */
const MAX_FALTANTES = 6;

export type QaVeredito = {
  /** Quantos chunks esgotaram as tentativas e foram entregues mesmo assim. */
  chunks: number;
  /** Pior cobertura vista no áudio ENTREGUE (0..1), ou null se não medida. */
  coberturaMinima: number | null;
  /** Amostra das palavras que sumiram na medição (pode vir vazia). */
  faltantes: string[];
  /** Linha curta, pronta pro contexto da Fast. */
  linha: string;
};

/**
 * Aviso que acompanha QUALQUER lista que contenha ressalva — existe para a
 * leitura não escorregar de "esta tem ressalva" para "as outras estão boas".
 */
export const AVISO_QA_NAO_PROVA =
  "Sobre a ressalva de QA acima: ela é o registro do worker (esgotou as tentativas de refazer o " +
  "trecho e entregou assim mesmo), NÃO um julgamento de que o áudio está ruim. E o contrário " +
  "também não vale: geração SEM ressalva não é áudio conferido — a medição enxerga palavra que " +
  "SUMIU, e é cega para palavra TROCADA. Use isto para levar a queixa do aluno a sério, nunca " +
  "para afirmar que o áudio está certo.";

/** Number finito de verdade (descarta NaN, Infinity, booleano, string). */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Lê o jsonb `generations.qa` e devolve o veredito, ou `null` quando não há
 * ressalva nenhuma a fazer.
 *
 * Devolve null para: jsonb ausente, null, tipo errado (string/array/número),
 * objeto sem a chave `exhausted`, `exhausted` não-numérico e `exhausted <= 0`.
 * Nunca inventa veredito a partir de dado que não existe — ressalva falsa faz a
 * Fast acusar defeito onde não houve, que é a regressão que mais importa aqui.
 */
export function qaVeredito(qa: unknown): QaVeredito | null {
  // `typeof null === "object"`, e array é objeto: os dois precisam cair fora
  // explicitamente ou `qa["exhausted"]` explode / devolve undefined em silêncio.
  if (typeof qa !== "object" || qa === null || Array.isArray(qa)) return null;

  const bruto = qa as Record<string, unknown>;
  const chunks = num(bruto.exhausted);
  if (chunks === null || chunks <= 0) return null;

  // `coverage_min_visto` é a PIOR cobertura entre os chunks que viraram entrega
  // (não a da última tentativa — ver `registrar_cobertura` no worker). Fora de
  // 0..1 é dado corrompido: melhor omitir do que reportar "cobertura 4200%".
  const cobBruta = num(bruto.coverage_min_visto);
  const coberturaMinima = cobBruta !== null && cobBruta >= 0 && cobBruta <= 1 ? cobBruta : null;

  const faltantes = Array.isArray(bruto.faltantes_amostra)
    ? bruto.faltantes_amostra.filter((w): w is string => typeof w === "string" && w.trim() !== "").slice(0, MAX_FALTANTES)
    : [];

  const detalhes: string[] = [];
  if (coberturaMinima !== null) {
    detalhes.push(`menor cobertura medida no áudio entregue: ${(coberturaMinima * 100).toFixed(1).replace(".", ",")}%`);
  }
  if (faltantes.length) {
    detalhes.push(`palavras que a medição não ouviu: ${faltantes.map((w) => `"${w}"`).join(", ")}`);
  }

  // FRASEADO É REQUISITO, NÃO ESTILO (ver cabeçalho). Diz o fato do worker.
  // Não diz "áudio ruim" e não diz "áudio conferido".
  const linha =
    `⚠️ QA: o worker esgotou as tentativas de refazer ${chunks} trecho${chunks === 1 ? "" : "s"} ` +
    `e o áudio foi entregue assim mesmo` +
    (detalhes.length ? ` (${detalhes.join("; ")})` : "");

  return { chunks, coberturaMinima, faltantes, linha };
}
