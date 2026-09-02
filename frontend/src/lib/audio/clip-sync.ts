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

/**
 * Desfecho da listagem, não só o resultado.
 *
 * ⚠️ Isto NÃO é preciosismo (merge do #235 com o fix de 02/09): devolver `[]`
 * tanto para "a conta não tem gravação" quanto para "não consegui perguntar"
 * fazia o Gravador APAGAR a marca de gravação (localStorage) num simples
 * soluço de rede — destruindo justamente a prova que permite a tela seguinte
 * dizer "você gravou e eu não achei". Lista vazia por falha nunca pode valer
 * como lista vazia de verdade.
 */
export type ListaDoServidor = { ok: boolean; clips: ServerClip[] };

/** Lista as gravações guardadas no servidor (qualquer aparelho). Nunca lança. */
export async function listServerClips(): Promise<ListaDoServidor> {
  try {
    const r = await fetch("/api/v1/voice-clips", { cache: "no-store" });
    if (!r.ok) return { ok: false, clips: [] };
    const j = (await r.json()) as { clips?: ServerClip[] };
    return { ok: true, clips: j?.clips ?? [] };
  } catch {
    return { ok: false, clips: [] };
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
