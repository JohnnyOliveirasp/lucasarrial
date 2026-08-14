/** Rascunho do Video React (localStorage, igual ao wizard de Edição). */
import type { SubtitlePosition, SubtitleSize } from "@/lib/video/subtitle-presets";

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
 * Quem reage: **só clone ou HeyGen** (correção do Johnny 14/08).
 *
 * Gravar na hora ficou fora por custo, e subir vídeo próprio também não
 * entra AQUI — esse upload é do vídeo VIRAL, no R0. Como os dois caminhos
 * nascem de uma FOTO, todo React pode usar qualquer layout, inclusive o
 * recorte por cima do viral.
 */
export type AvatarEscolhido =
  | { kind: "clone"; label: string }
  | { kind: "heygen"; label: string };

/** Layouts do R5. O de recorte é o formato do Lucas (chromakey provado). */
export type LayoutReact = "recorte" | "viral-em-cima" | "viral-embaixo";

/** O que aparece na tela durante o CTA (ele tem cena própria). */
export type CtaCena = "avatar" | "cena";

export type ReactDraft = {
  passo: number;
  viral: ViralEscolhido | null;
  avatar: AvatarEscolhido | null;
  /** Foto que o aluno escolheu na galeria (URL presignada). */
  fotoOriginal: string | null;
  /** Versão preparada: meio corpo pra cima + fundo verde (é ela que entra
   *  no clone quando o layout for o recorte por cima do viral). */
  fotoPronta: string | null;
  roteiro: string;
  /** CTA é sempre o FIM do vídeo e tem cena própria (senão a fala passa do
   *  tempo do viral — pergunta do Johnny que virou regra). */
  cta: string;
  ctaCena: CtaCena | null;
  /** R4: voz clonada (TTS) ou a pessoa grava com teleprompter. */
  modoAudio: "clone" | "gravar" | null;
  vozId: string | null;
  audioUrl: string | null;
  audioGenId: string | null;
  layout: LayoutReact | null;
  /** Legenda queimada — os MESMOS presets do editor de vídeo (pedido do Johnny
   *  14/08). "none" = vídeo limpo. */
  legendaEstilo: string;
  legendaPosicao: SubtitlePosition | null;
  legendaTamanho: SubtitleSize | null;
  /** Pedido em voo (react_jobs). Guardado pra tela reencontrar o job depois de
   *  um F5 — sem isso o vídeo só aparecia em "Vídeos gerados". */
  jobId: string | null;
};

export const DRAFT_VAZIO: ReactDraft = {
  passo: 0,
  viral: null,
  avatar: null,
  fotoOriginal: null,
  fotoPronta: null,
  roteiro: "",
  cta: "",
  ctaCena: null,
  modoAudio: null,
  vozId: null,
  audioUrl: null,
  audioGenId: null,
  layout: null,
  // Karaokê é o default do editor (getSubtitlePreset) — o React segue igual.
  legendaEstilo: "karaoke",
  legendaPosicao: null,
  legendaTamanho: null,
  jobId: null,
};
