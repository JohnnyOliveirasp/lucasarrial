"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioLines, Loader2, ArrowRight, Check } from "lucide-react";
import { MAX_AUDIO_SECONDS, sceneCountForDuration } from "@/lib/video/config";

type Audio = {
  id: string;
  voice_name: string;
  name: string | null;
  text_raw: string;
  duration_seconds: number | null;
  created_at: string;
  audio_url: string | null;
};

function fallbackName(a: Audio): string {
  return a.name?.trim() || `${a.voice_name} · ${new Date(a.created_at).toLocaleDateString("pt-BR")}`;
}

function fmtDuration(secs: number | null): string {
  if (secs == null) return "—";
  const s = Math.round(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}min${r.toString().padStart(2, "0")}s` : `${r}s`;
}

export function AudioPicker({ locale }: { locale: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/videos/audios", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar seus áudios");
      const json = await res.json();
      setItems((json.audios ?? []) as Audio[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createFromAudio(id: string) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation_id: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao criar o vídeo");
      router.push(`/${locale}/app/videos/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando áudios…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <AudioLines className="h-10 w-10 text-[var(--ash)]" />
        <p className="max-w-sm text-sm text-[var(--mute)]">
          Você ainda não tem áudios de até {MAX_AUDIO_SECONDS}s. Gere um áudio com
          o seu roteiro primeiro e ele aparece aqui.
        </p>
        <Link
          href={`/${locale}/app/voice-cloning/generate`}
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98]"
        >
          Gerar Áudio
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((a) => {
          const isSel = selected === a.id;
          return (
            <li
              key={a.id}
              className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--surface-card)] p-4 transition-colors ${
                isSel ? "border-[var(--hairline-bright)]" : "border-[var(--hairline-strong)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  onClick={() => setSelected(isSel ? null : a.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSel
                        ? "border-[var(--silver)] bg-[var(--silver)] text-[var(--canvas)]"
                        : "border-[var(--hairline-strong)] text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-base font-semibold text-[var(--ink)]">
                      {fallbackName(a)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                      <span>{a.voice_name}</span>
                      <span>· {fmtDuration(a.duration_seconds)}</span>
                      <span>· ~{sceneCountForDuration(a.duration_seconds ?? 0)} cenas</span>
                    </span>
                    <span className="line-clamp-2 max-w-xl text-[13px] text-[var(--mute)]">
                      {a.text_raw}
                    </span>
                  </span>
                </button>
              </div>

              {isSel && (
                <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  {a.audio_url ? (
                    <audio controls preload="metadata" src={a.audio_url} className="h-9 w-full sm:max-w-sm" />
                  ) : (
                    <span className="font-mono text-[11px] text-[var(--ash)]">áudio indisponível</span>
                  )}
                  <button
                    type="button"
                    onClick={() => createFromAudio(a.id)}
                    disabled={creating}
                    className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {creating ? "Criando…" : "Usar este áudio"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
