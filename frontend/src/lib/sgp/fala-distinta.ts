/**
 * SGP tela 3 — a régua dos 20 min soma FALA DISTINTA, não arquivos (#501).
 *
 * O DEFEITO: quem reenviava o MESMO arquivo — típico de quem achou que o
 * upload não tinha pegado — fechava os 20 min (SGP_AUDIO_MIN_SEGUNDOS) com
 * uma fração de fala real. Medido em produção por HeadObject no R2 (ETag md5
 * + ContentLength idênticos): 16 pedidos com cópia, 12 abaixo de 1200s sem
 * ela, 11 já treinaram voz. Pior caso: 6m34 de fala real contados como 23m38.
 *
 * A ESTRATÉGIA (decidida no cartão, opção "entra mas não conta"): a cópia
 * idêntica ENTRA no pedido — o passo atômico do banco (sgp_anexar_audio)
 * segue aceitando, o aluno vê o arquivo listado e marcado como repetido —
 * mas a régua conta cada CONTEÚDO uma vez só. Por que isso fecha o buraco de
 * concorrência do #238 sem mexer no SQL: a decisão sai da hora da ESCRITA
 * (onde duas requisições simultâneas passam as duas) e vai pra hora da
 * CONTA, sobre o array de verdade lido do banco. Não importa em que ordem as
 * cópias entraram: a soma colapsa o conteúdo repetido do mesmo jeito.
 *
 * IDENTIDADE DE CONTEÚDO = ETag + ContentLength do R2 (nunca o nome: duas
 * gravações legítimas podem ter o mesmo nome — controle negativo dos testes).
 * Item sem etag/bytes (áudio anexado antes deste conserto, ou HeadObject que
 * falhou) conta INDIVIDUALMENTE, como sempre contou: falha aberta, na direção
 * do comportamento antigo — nunca derruba material bom por falta de metadado.
 *
 * Ressalva declarada: ETag de multipart upload não é md5 puro (sufixo "-N").
 * O upload da tela 3 é um PUT único (putToR2), então na prática é md5; se um
 * dia virar multipart e os etags divergirem, o efeito é contar as duas — de
 * novo, falha aberta.
 *
 * Módulo PURO de propósito: zero imports, decidível em teste sem banco/R2.
 * Rota e tela entram só como I/O.
 */

/** O pedaço de SgpAudio que a régua precisa (estrutural, sem importar types). */
export type AudioComConteudo = {
  key: string;
  segundos: number;
  etag?: string | null;
  bytes?: number | null;
};

/**
 * `"c:<etag>:<bytes>"` quando dá pra identificar o conteúdo;
 * `"k:<key>"` (única por item) quando não dá — item sem impressão conta sozinho.
 */
export function identidadeDoConteudo(a: AudioComConteudo): string {
  const etag = normalizarEtag(a.etag);
  const bytes = typeof a.bytes === "number" && Number.isFinite(a.bytes) && a.bytes > 0 ? a.bytes : null;
  if (etag && bytes) return `c:${etag}:${bytes}`;
  return `k:${a.key}`;
}

/** `"abc"` de `'"abc"'`, `'W/"abc"'`, `'ABC'`. Vazio/nulo → null. */
function normalizarEtag(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const limpo = raw.replace(/^W\//i, "").replace(/^"+|"+$/g, "").trim().toLowerCase();
  return limpo.length > 0 ? limpo : null;
}

/**
 * Mantém a PRIMEIRA ocorrência de cada conteúdo, na ordem em que vieram.
 * (O array do pedido já é único por `key` — o passo atômico substitui a key
 * repetida — então aqui só existe dedupe por conteúdo.)
 */
export function distintosPorConteudo<T extends AudioComConteudo>(itens: T[]): T[] {
  const vistos = new Set<string>();
  const unicos: T[] = [];
  for (const item of itens) {
    const id = identidadeDoConteudo(item);
    if (vistos.has(id)) continue;
    vistos.add(id);
    unicos.push(item);
  }
  return unicos;
}

/** A soma que a régua compara com SGP_AUDIO_MIN/MAX: cada conteúdo UMA vez. */
export function somaFalaDistinta(itens: AudioComConteudo[]): number {
  return distintosPorConteudo(itens).reduce((s, a) => s + (a.segundos ?? 0), 0);
}

/**
 * As keys dos itens que NÃO contam (cópias de um conteúdo que já apareceu
 * antes na lista) — é o que a tela usa pra marcar "repetido, não conta".
 */
export function chavesRepetidas(itens: AudioComConteudo[]): Set<string> {
  const vistos = new Set<string>();
  const repetidas = new Set<string>();
  for (const item of itens) {
    const id = identidadeDoConteudo(item);
    if (vistos.has(id)) repetidas.add(item.key);
    else vistos.add(id);
  }
  return repetidas;
}
