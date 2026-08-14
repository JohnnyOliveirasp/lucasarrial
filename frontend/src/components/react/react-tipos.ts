/** Rascunho do Video React (localStorage, igual ao wizard de Edição). */

/** Os 7 passos combinados com o Johnny em 14/08. */
export const PASSOS = [
  "Vídeo",
  "Avatar",
  "Roteiro",
  "Ajuste + CTA",
  "Áudio",
  "Layout",
  "Saída",
] as const;

/** O viral escolhido — vem da prateleira (Meus Virais). */
export type ViralEscolhido = {
  id: string;
  url: string;
  autor: string | null;
  thumb_url: string | null;
  duracao_seg: number | null;
  likes: number;
  /** Estado do arquivo: o mp4 só existe depois do download sob demanda. */
  download_status: string;
};

/**
 * Quem reage. Gravar vídeo na hora ficou FORA (decisão do Johnny 14/08:
 * caro e cheio de variável). ⚠️ `upload` só serve pros layouts de tela
 * dividida — vídeo gravado na sala não tem como ser recortado.
 */
export type AvatarEscolhido =
  | { kind: "clone"; label: string }
  | { kind: "heygen"; label: string }
  | { kind: "upload"; label: string };

/** Layouts do R5. O de recorte é o formato do Lucas (chromakey provado). */
export type LayoutReact = "recorte" | "viral-em-cima" | "viral-embaixo";

export type ReactDraft = {
  passo: number;
  viral: ViralEscolhido | null;
  avatar: AvatarEscolhido | null;
  roteiro: string;
  /** CTA é sempre o FIM do vídeo e tem cena própria (senão a fala passa do
   *  tempo do viral — pergunta do Johnny que virou regra). */
  cta: string;
  layout: LayoutReact | null;
};

export const DRAFT_VAZIO: ReactDraft = {
  passo: 0,
  viral: null,
  avatar: null,
  roteiro: "",
  cta: "",
  layout: null,
};
