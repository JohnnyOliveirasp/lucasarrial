"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ImageIcon } from "lucide-react";
import { VideoTierId } from "@/lib/video/tiers";
import { VideoTierPicker } from "@/components/video/video-tier-picker";
import { VideoSceneGrid, type VideoScene } from "@/components/video/video-scene-grid";
import { VideoFinalStage } from "@/components/video/video-final-stage";

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";

/** Estágio 4 do wizard: geração dos clipes de vídeo (image-to-video via Kie). */
export function VideoStage({
  projectId,
  locale,
  onProjectChanged,
}: {
  projectId: string;
  locale: string;
  onProjectChanged: () => void;
}) {
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [tier, setTier] = useState<string | null>(null);
  const [allImagesReady, setAllImagesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [paywall, setPaywall] = useState<{ subscribed: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/videos`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar os vídeos");
      const j = await res.json();
      setScenes((j.scenes ?? []) as VideoScene[]);
      setTier(j.tier ?? null);
      setAllImagesReady(!!j.all_images_ready);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const inflight = scenes.some((s) => s.video_status === "pending" || s.video_status === "generating");
  useEffect(() => {
    if (!inflight) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [inflight, load]);

  // Enquanto o gate está fechado (imagens ainda gerando), fica de olho: sem
  // isso o estágio só destravava com F5 — o fetch inicial acontecia antes das
  // imagens ficarem prontas e nunca era refeito.
  useEffect(() => {
    if (loading || allImagesReady) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [loading, allImagesReady, load]);

  async function generateBatch(chosen: VideoTierId) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: chosen }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao gerar os vídeos");
      onProjectChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
        <span className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando…</span>
      </section>
    );
  }

  // Gate: precisa ter todas as imagens prontas antes de gerar vídeo.
  if (!allImagesReady) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <ImageIcon className="h-5 w-5 text-[var(--ash)]" />
        <p className="text-sm text-[var(--mute)]">
          Gere e finalize <strong className="text-[var(--ink)]">todas as imagens</strong> das cenas para
          liberar a geração dos vídeos.
        </p>
      </section>
    );
  }

  const errorBanner = error && (
    <p
      role="alert"
      className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
    >
      {error}
    </p>
  );

  const allVideosReady = scenes.length > 0 && scenes.every((s) => s.video_status === "ready");

  return (
    <div className="flex flex-col gap-4">
      {errorBanner}

      {tier == null ? (
        <VideoTierPicker sceneCount={scenes.length} generating={generating} onConfirm={generateBatch} />
      ) : (
        <>
          <VideoSceneGrid
            projectId={projectId}
            scenes={scenes}
            tierId={tier}
            generatingAll={generating}
            onReload={load}
            onPaywall={setPaywall}
            onGenerateAll={() => generateBatch(tier as VideoTierId)}
          />

          {/* Estágio 5 — montagem do vídeo final */}
          <VideoFinalStage projectId={projectId} allVideosReady={allVideosReady} />
        </>
      )}

      {paywall && (
        <PaywallInline locale={locale} subscribed={paywall.subscribed} onClose={() => setPaywall(null)} />
      )}
    </div>
  );
}

function PaywallInline({
  locale,
  subscribed,
  onClose,
}: {
  locale: string;
  subscribed: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {subscribed ? "Créditos insuficientes" : "Assine para gerar"}
        </h3>
        <p className="text-sm text-[var(--body)]">
          {subscribed
            ? "Compre um pacote de créditos para continuar."
            : "Assine o plano para liberar créditos e gerar os vídeos."}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
          >
            Fechar
          </button>
          <Link href={subscribed ? `/${locale}/app/credits` : `/${locale}/planos`} className={PILL}>
            {subscribed ? "Comprar créditos" : "Assinar agora"}
          </Link>
        </div>
      </div>
    </div>
  );
}
