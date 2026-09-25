/**
 * Vídeo Edição 2.0 — decisão PURA de "o que sobra do rascunho quando o
 * roteiro muda" e de "quando o Começar um vídeo novo aparece".
 *
 * ⚠️ MÓDULO PURO DE PROPÓSITO: zero imports, zero I/O, zero React — o mesmo
 * contrato do vizinho `reaplicar.ts`. Quem guarda o rascunho no localStorage
 * é o wizard; aqui mora só a decisão, que é o que precisa de teste.
 *
 * ── POR QUE ISTO EXISTE (caso ycarlosk@gmail.com, 3 escalonamentos em 24/09) ──
 * O wizard guarda UM rascunho por navegador (fc-edicao-draft-v1) e tinha dois
 * defeitos irmãos:
 *
 * (a) Voltar pra estação do Roteiro e TROCAR o texto não invalidava nada:
 *     `draft.audio` e `draft.video` continuavam apontando pra rodada anterior
 *     e a Saída reexportava os arquivos velhos. Pro aluno parecia "gerou o
 *     vídeo antigo".
 * (b) O único escape ("Começar um vídeo novo?") só aparecia com
 *     `finalizado === true` — quem voltou no MEIO do fluxo, exatamente quem
 *     mais precisava dele, não tinha como zerar o rascunho pela interface.
 *
 * O roteiro é a origem de tudo: áudio e vídeo são DERIVADOS dele e deixam de
 * valer quando ele muda. Invalidar o rascunho NÃO apaga nada entregue — os
 * vídeos já montados ficam no servidor e continuam em "Vídeos gerados"; o
 * aviso na tela diz isso com todas as letras.
 */

/** Os campos do rascunho que DERIVAM do roteiro (mais o passo, pra recuar). */
export type RascunhoDerivado = {
  passo: number;
  roteiro: string;
  audio: unknown;
  video: unknown;
  cenasProjectId: string | null;
  captionJob: unknown;
  brollProjectId: string | null;
  brollJob: unknown;
  videoEditadoKey: string | null;
  finalizado: boolean;
};

/**
 * O que cai junto quando o roteiro muda. `passo: 0` recua pra estação do
 * Roteiro (hoje é onde a troca acontece, então é no-op — mas se algum caminho
 * futuro trocar o roteiro de outra estação, o recuo já está garantido).
 */
export const DERIVADOS_INVALIDADOS = {
  audio: null,
  video: null,
  cenasProjectId: null,
  captionJob: null,
  brollProjectId: null,
  brollJob: null,
  videoEditadoKey: null,
  finalizado: false,
  passo: 0,
} as const;

/** O patch traz um roteiro DIFERENTE do atual? (patch sem roteiro = não) */
export function roteiroVaiMudar(
  anterior: Pick<RascunhoDerivado, "roteiro">,
  patch: { roteiro?: string },
): boolean {
  return patch.roteiro !== undefined && patch.roteiro !== anterior.roteiro;
}

/** Existe algo derivado do roteiro pra perder? */
export function temDerivados(
  anterior: Pick<RascunhoDerivado, "audio" | "video" | "videoEditadoKey">,
): boolean {
  return (
    anterior.audio !== null ||
    anterior.video !== null ||
    anterior.videoEditadoKey !== null
  );
}

/**
 * Um patch que JÁ derruba áudio e vídeo por conta própria (ex.: o reset do
 * "Começar um vídeo novo", que espalha o rascunho vazio inteiro) assume a
 * responsabilidade pelos derivados — não precisa de invalidação nem de aviso.
 */
export function patchJaDerruba(patch: { audio?: unknown; video?: unknown }): boolean {
  return (
    "audio" in patch &&
    patch.audio === null &&
    "video" in patch &&
    patch.video === null
  );
}

/** A decisão composta: este patch vai derrubar os derivados? */
export function invalidaDerivados(
  anterior: Pick<RascunhoDerivado, "roteiro" | "audio" | "video" | "videoEditadoKey">,
  patch: { roteiro?: string; audio?: unknown; video?: unknown },
): boolean {
  return (
    !patchJaDerruba(patch) && roteiroVaiMudar(anterior, patch) && temDerivados(anterior)
  );
}

/**
 * Aplica a regra ao patch: se o roteiro mudou havendo derivados, o patch sai
 * com TODOS os derivados invalidados (e o passo recuado). Se não, o patch
 * volta intocado — digitar o primeiro roteiro de um rascunho vazio não pode
 * zerar nada nem virar aviso.
 */
export function comInvalidacaoDeRoteiro<
  P extends { roteiro?: string; passo?: number; audio?: unknown; video?: unknown },
>(
  anterior: Pick<RascunhoDerivado, "roteiro" | "audio" | "video" | "videoEditadoKey">,
  patch: P,
): P | (P & typeof DERIVADOS_INVALIDADOS) {
  if (!invalidaDerivados(anterior, patch)) return patch;
  return { ...patch, ...DERIVADOS_INVALIDADOS };
}

/**
 * O atalho "Começar um vídeo novo" aparece sempre que há QUALQUER coisa a
 * limpar — não só com `finalizado === true`. Rascunho zerado não ganha o
 * botão (não há o que recomeçar).
 */
export function temProgresso(
  d: Pick<RascunhoDerivado, "passo" | "roteiro" | "audio" | "video" | "videoEditadoKey">,
): boolean {
  return (
    d.passo > 0 ||
    d.roteiro.trim().length > 0 ||
    d.audio !== null ||
    d.video !== null ||
    d.videoEditadoKey !== null
  );
}
