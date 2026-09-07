"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AudioLines, Loader2, ArrowRight, Check } from "lucide-react";
import { MAX_AUDIO_SECONDS, sceneCountForDuration } from "@/lib/video/config";
import { acimaDoTeto, separarPorTeto } from "@/lib/video/audio-eligibility";
import { AudioUpload } from "@/components/video/audio-upload";

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

export function AudioPicker() {
  const t = useTranslations("videoWizard.audioPick");
  const tc = useTranslations("videoWizard.common");
  const router = useRouter();
  const [items, setItems] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/videos/audios", { cache: "no-store" });
      if (!res.ok) throw new Error(t("loadFailed"));
      const json = await res.json();
      setItems((json.audios ?? []) as Audio[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }, [t, tc]);

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
      if (!res.ok) throw new Error(json?.error?.message || t("createFailed"));
      router.push(`/app/videos/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">{t("loading")}</p>
      </section>
    );
  }

  // O teto (90s) continua valendo, mas quem passa dele aparece na lista
  // DESABILITADO com o motivo — antes a rota filtrava no SQL e o áudio longo
  // sumia calado, deixando o aluno na tela de vazio (chamado #adc3ed99).
  const { usaveis, longos, ordenados } = separarPorTeto(items, MAX_AUDIO_SECONDS);

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Falha de carga NÃO pode se passar por "você não tem áudios": o
            `error` só era renderizado no ramo COM itens, então quando a rota
            caía o aluno lia o texto de acervo vazio e não sabia de nada. */}
        {error && (
          <p
            role="alert"
            className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
          >
            {error}
          </p>
        )}
        <section className="flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
          <AudioLines className="h-10 w-10 text-[var(--ash)]" />
          <p className="max-w-sm text-sm text-[var(--mute)]">
            {error ? t("loadFailedHint") : t("empty", { s: MAX_AUDIO_SECONDS })}
          </p>
          <Link
            href="/app/voice-cloning/generate"
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98]"
          >
            {t("generateAudio")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
        <AudioUpload />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AudioUpload />
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      {/* Tem áudio, mas TODOS passam do teto: era este o aluno que lia
          "você ainda não tem áudios" com o acervo cheio e íntegro. */}
      {usaveis.length === 0 && (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--mute)]">
          {t("onlyLong", { n: longos.length, s: MAX_AUDIO_SECONDS })}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {ordenados.map((a) => {
          const tooLong = acimaDoTeto(a.duration_seconds, MAX_AUDIO_SECONDS);
          const isSel = selected === a.id && !tooLong;
          return (
            <li
              key={a.id}
              className={`flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--surface-card)] p-4 transition-colors ${
                tooLong
                  ? "border-dashed border-[var(--hairline)] opacity-60"
                  : isSel
                    ? "border-[var(--hairline-bright)]"
                    : "border-[var(--hairline-strong)]"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  disabled={tooLong}
                  onClick={() => setSelected(isSel ? null : a.id)}
                  title={tooLong ? t("tooLong", { s: MAX_AUDIO_SECONDS }) : undefined}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-not-allowed"
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
                      {!tooLong && (
                        <span>· {t("sceneCount", { n: sceneCountForDuration(a.duration_seconds ?? 0) })}</span>
                      )}
                    </span>
                    {/* Por que este não dá pra usar — dito na cara, no lugar
                        onde antes não havia nada porque a linha nem vinha. */}
                    {tooLong && (
                      <span className="font-mono text-[10px] leading-snug tracking-wide text-[var(--status-error)]">
                        {t("tooLong", { s: MAX_AUDIO_SECONDS })}
                      </span>
                    )}
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
                    <span className="font-mono text-[11px] text-[var(--ash)]">{tc("audioUnavailable")}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => createFromAudio(a.id)}
                    disabled={creating}
                    className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {creating ? t("creating") : t("useThis")}
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
