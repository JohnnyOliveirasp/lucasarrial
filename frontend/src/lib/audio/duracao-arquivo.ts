/**
 * Regra universal 13/08 (Johnny): áudio de vídeo tem teto de 120s em TODO
 * lugar (roteiro, gravar, subir arquivo) — "ninguém publica um Reels de 2
 * minutos; se publicar, a pessoa gera outro". O Gravador de treino de VOZ
 * fica FORA da regra (lá áudio longo é insumo do treino).
 */
export const AUDIO_VIDEO_MAX_S = 120;
export const AUDIO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

/** Duração de um arquivo de áudio no browser (metadata). Rejeita ilegível. */
export function medirDuracaoArquivo(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("audio ilegível"));
    };
    el.src = url;
  });
}
