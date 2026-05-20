/**
 * Mede duração de arquivo de áudio no browser via Web Audio API.
 * Roda só no client. Falha graciosamente — retorna null em vez de throw.
 */

export async function measureAudioDuration(file: File): Promise<number | null> {
  if (typeof window === "undefined") return null;

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

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
