/**
 * Sincronização dos clipes do Gravador com o SERVIDOR (caso Allan/Alana 02/09).
 *
 * O IndexedDB (clip-store) continua sendo a rede anti-crash: o clipe é salvo
 * lá PRIMEIRO, sobe pro servidor em seguida e, confirmado o upload, sai do
 * IndexedDB — a partir daí a fonte de verdade é o R2 e a gravação sobrevive a
 * troca de navegador, de aparelho e limpeza de dados. Se o upload falhar, o
 * clipe fica local e a tela oferece "salvar de novo" (nunca perde em silêncio).
 */

export type ServerClip = {
  key: string;
  name: string;
  seconds: number;
  size: number;
  at: string | null;
  url: string;
};

/** Sobe um clipe aceito. Devolve a key no servidor, ou null se falhou. */
export async function uploadClipToServer(blob: Blob, seconds: number): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", blob, "clip.wav");
    form.append("seconds", String(Math.round(seconds)));
    const r = await fetch("/api/v1/voice-clips", { method: "POST", body: form });
    if (!r.ok) return null;
    const j = (await r.json()) as { key?: string };
    return j?.key ?? null;
  } catch {
    return null;
  }
}

/** Lista as gravações guardadas no servidor (qualquer aparelho). */
export async function listServerClips(): Promise<ServerClip[]> {
  try {
    const r = await fetch("/api/v1/voice-clips", { cache: "no-store" });
    if (!r.ok) return [];
    const j = (await r.json()) as { clips?: ServerClip[] };
    return j?.clips ?? [];
  } catch {
    return [];
  }
}

/** Apaga uma gravação do servidor (best-effort; devolve se conseguiu). */
export async function deleteServerClip(key: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/v1/voice-clips?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    return r.ok;
  } catch {
    return false;
  }
}
