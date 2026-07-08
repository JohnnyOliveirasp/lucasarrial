"use client";

/**
 * Painel "Animar imagem" do Gerador de Imagem: escolhe o tier (bronze/prata/
 * gold, mesmos preços do wizard), escreve o prompt de movimento em pt-BR
 * (Haiku traduz no servidor) e gera o vídeo via Kie. Poll no GET /images/[id]
 * (que sincroniza com o Kie) enquanto pending/generating; player quando pronto.
 * Custo em créditos SEMPRE visível antes de confirmar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Download, Film, Loader2, RefreshCw } from "lucide-react";
import { VIDEO_TIERS, VideoTierId, FALLBACK_MOVEMENT_PROMPT_PT, VIDEO_DURATION_SECONDS } from "@/lib/video/tiers";
import { PaywallModal } from "@/components/app/paywall-modal";
import { downloadFromUrl } from "./download-file";

export type AnimatableImage = {
  id: string;
  name: string | null;
  video_status: "pending" | "generating" | "ready" | "failed" | null;
  video_tier: string | null;
  video_prompt_pt: string | null;
  video_error: string | null;
  video_url: string | null;
};

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-5 font-sans text-[13px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";

export function ImageAnimatePanel({
  image,
  onChanged,
}: {
  image: AnimatableImage;
  onChanged: () => void;
}) {
  const [tier, setTier] = useState<VideoTierId | null>(
    (VIDEO_TIERS.find((t) => t.id === image.video_tier)?.id as VideoTierId) ?? null,
  );
  const [promptPt, setPromptPt] = useState(image.video_prompt_pt ?? FALLBACK_MOVEMENT_PROMPT_PT);
  const [status, setStatus] = useState(image.video_status);
  const [videoUrl, setVideoUrl] = useState(image.video_url);
  const [videoError, setVideoError] = useState(image.video_error);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ subscribed: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = VIDEO_TIERS.find((t) => t.id === tier) ?? null;
  const inflight = status === "pending" || status === "generating";

  // "A tela corre para baixo": ao abrir o painel, traz ele pra vista.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Poll enquanto gera — o GET sincroniza com o Kie (fallback do webhook).
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/images/${image.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const img = j.image ?? {};
      setStatus(img.video_status ?? null);
      setVideoUrl(img.video_url ?? null);
      setVideoError(img.video_error ?? null);
      if (img.video_status === "ready" || img.video_status === "failed") onChanged();
    } catch {
      /* melhor sorte no próximo tick */
    }
  }, [image.id, onChanged]);

  useEffect(() => {
    if (!inflight) return;
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [inflight, poll]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/images/${image.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selected.id, prompt_pt: promptPt }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao iniciar o vídeo");
      setStatus("pending");
      setVideoUrl(null);
      setVideoError(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadVideo() {
    if (!videoUrl) return;
    await downloadFromUrl(videoUrl, image.name || "video", "mp4");
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-4"
    >
      {/* Resultado pronto */}
      {status === "ready" && videoUrl && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <video
            src={videoUrl}
            controls
            loop
            playsInline
            preload="metadata"
            className="max-h-[420px] w-auto max-w-full rounded-[var(--radius)] border border-[var(--hairline-strong)]"
          />
          <div className="flex flex-col gap-2">
            <button type="button" onClick={downloadVideo} className={PILL}>
              <Download className="h-4 w-4" /> Baixar vídeo
            </button>
            <p className="max-w-xs font-mono text-[10px] tracking-wide text-[var(--ash)]">
              Quer outro movimento? Ajuste o prompt abaixo e gere de novo (novo custo em créditos).
            </p>
          </div>
        </div>
      )}

      {/* Gerando */}
      {inflight && (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
          <div className="flex flex-col">
            <span className="text-sm text-[var(--ink)]">Gerando vídeo…</span>
            <span className="flex items-center gap-1 font-mono text-[10px] tracking-wide text-[var(--ash)]">
              <Clock className="h-3 w-3" /> Pode levar alguns minutos. Você pode sair e voltar.
            </span>
          </div>
        </div>
      )}

      {/* Falha anterior */}
      {status === "failed" && videoError && (
        <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          {videoError}
        </p>
      )}

      {/* Escolha do modelo + prompt (escondidos enquanto gera) */}
      {!inflight && (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {VIDEO_TIERS.map((t) => {
              const active = tier === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTier(t.id)}
                    aria-pressed={active}
                    className={[
                      "flex w-full flex-col gap-1.5 rounded-[var(--radius)] border p-3 text-left transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                      active
                        ? "border-[var(--hairline-bright)] bg-[var(--surface-card)] shadow-[0_0_0_1px_var(--hairline-bright)]"
                        : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--hairline-bright)]",
                    ].join(" ")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[14px] font-semibold text-[var(--ink)]">
                        {t.medal} {t.label}
                      </span>
                      {active && <Check className="h-4 w-4 text-[var(--silver)]" />}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--silver)]">{t.creditsPerClip} créditos</span>
                    <span className="text-[12px] leading-snug text-[var(--mute)]">{t.blurb}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
              Movimento desejado (em português — traduzimos pra você)
            </span>
            <textarea
              value={promptPt}
              onChange={(e) => setPromptPt(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full resize-y rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--hairline-bright)]"
            />
          </label>

          {error && (
            <p role="alert" className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
              {selected
                ? `Custo: ${selected.creditsPerClip} créditos · clipe de ${VIDEO_DURATION_SECONDS}s · 720p`
                : "Selecione um modelo acima"}
            </span>
            <button type="button" disabled={!selected || submitting} onClick={submit} className={PILL}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status === "ready" || status === "failed" ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Film className="h-4 w-4" />
              )}
              {submitting
                ? "Enviando…"
                : selected
                  ? `${status === "ready" || status === "failed" ? "Gerar de novo" : "Animar"} · ${selected.creditsPerClip} cr`
                  : "Animar"}
            </button>
          </div>
        </>
      )}

      <PaywallModal
        open={!!paywall}
        onClose={() => setPaywall(null)}
        subscribed={paywall?.subscribed ?? false}
        action="animar esta imagem"
      />
    </div>
  );
}
