/**
 * Mede duração de arquivo de áudio no browser. Roda só no client.
 * Falha graciosamente — retorna null em vez de throw.
 *
 * Ordem (caso duoclinicsalto 06/08): 1º metadados via <audio> — lê só o
 * cabeçalho, instantâneo e sem custo de memória. decodeAudioData ficava com
 * o arquivo INTEIRO decodificado em PCM na RAM (~300-600MB pra 30min de
 * m4a) e falhava/travava → total 00:00 e botão Treinar nunca habilitava.
 * O decode completo fica só de fallback (webm/opus do MediaRecorder não
 * informa duração no cabeçalho e reporta Infinity no <audio>).
 */

export async function measureAudioDuration(file: File): Promise<number | null> {
  if (typeof window === "undefined") return null;

  const viaMetadata = await metadataDuration(file);
  if (viaMetadata != null) return viaMetadata;

  try {
    const buffer = await file.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      return decoded.duration;
    } finally {
      // Best-effort close — Safari não suporta close em alguns casos
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  }
}

/** Duração pelos metadados (preload="metadata"): null se o formato não disser. */
function metadataDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let settled = false;
    const done = (n: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(n);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    audio.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    audio.src = url;
  });
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
