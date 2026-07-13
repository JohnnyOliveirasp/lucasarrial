"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Clapperboard, Loader2, Download, AlertTriangle, RefreshCw, Type, AlignVerticalSpaceAround, CaseSensitive } from "lucide-react";
import {
  SUBTITLE_PRESETS,
  getSubtitlePreset,
  type SubtitlePosition,
  type SubtitleSize,
} from "@/lib/video/subtitle-presets";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";

/** @font-face das fontes de legenda (mesmos TTFs que o worker queima no vídeo). */
const FONT_FACES = `
@font-face { font-family: 'Montserrat Black'; src: url('/assets/subtitle-fonts/Montserrat-Black.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Luckiest Guy'; src: url('/assets/subtitle-fonts/LuckiestGuy-Regular.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Archivo Black'; src: url('/assets/subtitle-fonts/ArchivoBlack-Regular.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Anton'; src: url('/assets/subtitle-fonts/Anton-Regular.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Poppins SemiBold'; src: url('/assets/subtitle-fonts/Poppins-SemiBold.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Bangers'; src: url('/assets/subtitle-fonts/Bangers-Regular.ttf') format('truetype'); font-display: swap; }
`;

type RenderState = {
  status: "draft" | "scenes" | "images" | "videos" | "rendering" | "done" | "failed";
  error_message: string | null;
  subtitle_style: string | null;
  subtitle_position: SubtitlePosition | null;
  subtitle_size: SubtitleSize | null;
  final_video_url: string | null;
  job: { id: string; status: string; error: string | null } | null;
};

const POSITIONS: SubtitlePosition[] = ["bottom", "center", "top"];

function StylePicker({
  value,
  onChange,
  position,
  onPosition,
  size,
  onSize,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  position: SubtitlePosition | null;
  onPosition: (p: SubtitlePosition) => void;
  size: SubtitleSize | null;
  onSize: (s: SubtitleSize) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("videoWizard.final");
  const preset = getSubtitlePreset(value);
  const effectivePosition = position ?? preset.defaultPosition;
  const effectiveSize: SubtitleSize = size ?? "normal";

  return (
    <div className="flex flex-col gap-4">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />

      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
          <Type className="h-3.5 w-3.5" /> {t("styleLabel")}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SUBTITLE_PRESETS.map((s) => {
            const active = value === s.id;
            const words = s.css.uppercase
              ? [t("previewA").toUpperCase(), t("previewB").toUpperCase()]
              : [t("previewA"), t("previewB")];
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(s.id)}
                aria-pressed={active}
                className={[
                  "flex flex-col gap-2 rounded-[var(--radius)] border p-3 text-left transition-colors disabled:opacity-50",
                  active
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--hairline-bright)]",
                ].join(" ")}
              >
                <span
                  className="flex h-14 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-sm)] px-1 text-[13px] leading-none"
                  style={{ background: "#141414" }}
                >
                  <span
                    style={{
                      fontFamily: s.css.fontFamily,
                      color: s.css.activeColor ?? s.css.color,
                      textShadow: s.css.textShadow,
                      background: s.css.background,
                      padding: s.css.background ? "2px 4px" : undefined,
                    }}
                  >
                    {words[0]}
                  </span>
                  <span
                    style={{
                      fontFamily: s.css.fontFamily,
                      color: s.css.color,
                      textShadow: s.css.textShadow,
                      background: s.css.background,
                      padding: s.css.background ? "2px 4px" : undefined,
                    }}
                  >
                    {words[1]}
                  </span>
                </span>
                <span className="font-sans text-[12px] font-medium leading-tight text-[var(--ink)]">{s.label}</span>
                <span className="text-[10px] leading-snug text-[var(--mute)]">{s.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
            <AlignVerticalSpaceAround className="h-3.5 w-3.5" /> {t("positionLabel")}
          </span>
          <div className="flex gap-1.5">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onPosition(p)}
                aria-pressed={effectivePosition === p}
                className={[
                  "h-9 rounded-[var(--radius)] border px-4 font-sans text-[13px] transition-colors disabled:opacity-50",
                  effectivePosition === p
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--mute)] hover:border-[var(--hairline-bright)]",
                ].join(" ")}
              >
                {t(`positions.${p}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
            <CaseSensitive className="h-3.5 w-3.5" /> {t("sizeLabel")}
          </span>
          <div className="flex gap-1.5">
            {(["normal", "large"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                disabled={disabled}
                onClick={() => onSize(sz)}
                aria-pressed={effectiveSize === sz}
                className={[
                  "h-9 rounded-[var(--radius)] border px-4 font-sans text-[13px] transition-colors disabled:opacity-50",
                  effectiveSize === sz
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--mute)] hover:border-[var(--hairline-bright)]",
                ].join(" ")}
              >
                {sz === "normal" ? t("sizeNormal") : t("sizeLarge")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Estágio 5: aprova os clipes e monta o vídeo final (áudio + clipes na ordem).
 * O Next.js só ENFILEIRA; o worker (ffmpeg) monta. Aqui a gente dispara e faz
 * poll até o mp4 final ficar pronto pra tocar/baixar.
 */
export function VideoFinalStage({
  projectId,
  allVideosReady,
}: {
  projectId: string;
  allVideosReady: boolean;
}) {
  const t = useTranslations("videoWizard.final");
  const tc = useTranslations("videoWizard.common");
  const [state, setState] = useState<RenderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState("karaoke");
  const [position, setPosition] = useState<SubtitlePosition | null>(null);
  const [size, setSize] = useState<SubtitleSize | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/render`, { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as RenderState;
      setState(j);
      if (j.subtitle_style) setStyle(j.subtitle_style);
      if (j.subtitle_position) setPosition(j.subtitle_position);
      if (j.subtitle_size) setSize(j.subtitle_size);
    } catch {
      /* silencioso; o botão ainda funciona */
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const rendering = state?.status === "rendering" || state?.job?.status === "processing" || state?.job?.status === "pending";
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [rendering, load]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, position, size }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || t("queueFailed"));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setBusy(false);
    }
  }

  // Vídeo final pronto.
  if (state?.status === "done" && state.final_video_url) {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <Clapperboard className="h-5 w-5 text-[var(--silver)]" /> {t("title")}
        </h2>
        <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
          <video src={state.final_video_url} controls playsInline className="aspect-[9/16] w-full" />
        </div>
        <StylePicker
          value={style}
          onChange={setStyle}
          position={position}
          onPosition={setPosition}
          size={size}
          onSize={setSize}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          <a href={state.final_video_url} download="video-final.mp4" className={PILL}>
            <Download className="h-4 w-4" /> {t("download")}
          </a>
          <button type="button" onClick={approve} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-6 font-sans text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("reassemble")}{" "}
            <span className="font-mono text-[11px] text-[var(--ash)]">{t("reassembleHint")}</span>
          </button>
        </div>
      </section>
    );
  }

  // Montando (job na fila / processando).
  if (rendering) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 text-center">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--silver)]/20" />
          <Clapperboard className="relative h-7 w-7 text-[var(--silver)]" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-sans text-[15px] font-medium text-[var(--ink)]">{t("renderingTitle")}</p>
          <p className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
            {t("renderingHint")}
          </p>
        </div>
      </section>
    );
  }

  // Falhou.
  if (state?.status === "failed") {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] p-6">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" /> {t("failedTitle")}
        </h2>
        <p className="font-mono text-[11px] text-[var(--status-error)]">
          {state.error_message || state.job?.error || t("failedFallback")}
        </p>
        <button type="button" onClick={approve} disabled={busy} className={`${PILL} w-fit`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("retry")}
        </button>
      </section>
    );
  }

  // Pronto pra aprovar (todos os clipes prontos) ou aguardando os clipes.
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
      <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
        <Clapperboard className="h-5 w-5 text-[var(--silver)]" /> {t("title")}
      </h2>
      <p className="max-w-xl text-sm text-[var(--mute)]">
        {t("intro")}
      </p>
      <StylePicker
        value={style}
        onChange={setStyle}
        position={position}
        onPosition={setPosition}
        size={size}
        onSize={setSize}
        disabled={!allVideosReady || busy}
      />
      {error && <p className="font-mono text-[11px] text-[var(--status-error)]">{error}</p>}
      <button type="button" onClick={approve} disabled={!allVideosReady || busy} className={`${PILL} w-fit`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
        {t("approve")}
      </button>
      {!allVideosReady && (
        <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
          {t("waitClips")}
        </span>
      )}
    </section>
  );
}
