/**
 * SGP — Sistema de Geração Pronto dentro do FastCloner.
 * Plano e decisões: _Bugs/SGP/PLANO_SGP.md (29/08).
 */

export const SGP_STATUS = [
  "dados",
  "foto",
  "audio",
  "revisao",
  "enviado",
  "processando",
  "pronto",
  "falhou",
] as const;
export type SgpStatus = (typeof SGP_STATUS)[number];

/** Ordem das telas do wizard (barra de passos). */
export const SGP_PASSOS = ["dados", "foto", "audio", "revisao"] as const;
export type SgpPasso = (typeof SGP_PASSOS)[number];

/** Slots de foto = o que o guia PDF pede (4 + 1 opcional). */
export const SGP_FOTO_SLOTS = [
  "frente_sorrindo",
  "frente_neutro",
  "lado_sorrindo",
  "lado_neutro",
  "extra",
] as const;
export type SgpFotoSlot = (typeof SGP_FOTO_SLOTS)[number];

/** Checkboxes da tela 2 (ciência do aluno, gravada com hora). */
export const CIENCIA_FOTO = ["luz", "fundo", "enquadramento", "nitida", "sem_acessorios"] as const;
/** Checkboxes da tela 3. */
export const CIENCIA_AUDIO = ["30min", "silencio", "mesmo_ambiente", "fala_natural"] as const;

export type SgpFoto = {
  slot: SgpFotoSlot;
  key: string;
  status: "processando" | "aprovada" | "reprovada";
  tipo?: string | null;
  motivos?: string[];
};

export type SgpAudio = {
  key: string;
  nome: string;
  segundos: number;
  status: "processando" | "aprovado" | "reprovado";
  motivos?: string[];
};

export type SgpPedidoRow = {
  id: string;
  user_id: string;
  criado_em: string;
  atualizado_em: string;
  status: SgpStatus;
  ciencia_foto: string[] | null;
  ciencia_foto_at: string | null;
  ciencia_audio: string[] | null;
  ciencia_audio_at: string | null;
  aceite_lgpd_at: string | null;
  fotos: SgpFoto[];
  audios: SgpAudio[];
  enviado_em: string | null;
  foto_pronta_em: string | null;
  voz_pronta_em: string | null;
  voice_id: string | null;
  erro: string | null;
};

/** Só dígitos, com DDI. "+55 (11) 99999-8888" → "5511999998888". */
export function normalizarWhatsapp(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  return d.startsWith("55") || d.length > 11 ? d : `55${d}`;
}
