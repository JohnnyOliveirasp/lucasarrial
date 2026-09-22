/**
 * Tetos do envio de viral — um lugar só, porque a tela e o servidor precisam
 * dizer o MESMO número (tela que promete 100 MB e servidor que recusa em 80
 * vira "o site está com erro" no WhatsApp do suporte).
 *
 * Por que 100 MB e 3 minutos (proposta minha, 21/09): um vertical de 1 minuto
 * em 1080p dá ~15 MB; 100 MB cobre 3 a 5 minutos com folga. O teto existe
 * porque o acervo é coletivo e o R2 é pago por GB guardado — sem limite, um
 * único envio de 2 GB custa mais que mil envios normais.
 *
 * ⚠️ A duração é conferida no NAVEGADOR (o `<video>` sabe antes de subir).
 * O TAMANHO é conferido no servidor DEPOIS do upload, contra o objeto real no
 * R2: o navegador informa o que quiser, e um presigned PUT não sabe recusar
 * por tamanho.
 */
export const LIMITE_VIRAL = {
  mb: 100,
  bytes: 100 * 1024 * 1024,
  segundos: 180,
} as const;

export const TIPOS_ACEITOS = new Set(["video/mp4", "video/quicktime", "video/webm"]);

/** Frase única da recusa por tamanho — usada na tela e na API. */
export const recusaPorTamanho = (bytes: number) =>
  `Esse vídeo tem ${(bytes / 1024 / 1024).toFixed(0)} MB e o limite é ${LIMITE_VIRAL.mb} MB.`;

/** Frase única da recusa por duração. */
export const recusaPorDuracao = (segundos: number) =>
  `Esse vídeo tem ${Math.round(segundos)}s e o limite é ${LIMITE_VIRAL.segundos}s (${LIMITE_VIRAL.segundos / 60} minutos).`;
