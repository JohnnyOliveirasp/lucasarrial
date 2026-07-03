"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Wand2, RefreshCw, AlertTriangle, Film, ServerCrash } from "lucide-react";
import { getTier } from "@/lib/video/tiers";

export type VideoScene = {
  id: string;
  idx: number;
  prompt_pt: string;
  image_status: string | null;
  video_status: "pending" | "generating" | "ready" | "failed" | null;
  video_prompt_pt: string | null;
  video_error: string | null;
  image_url: string | null;
  video_url: string | null;
};

type Paywall = { subscribed: boolean };

/**
 * Fase 4-B: grade dos clipes por cena. Player 9:16 em cima, prompt de movimento
 * (pt-BR) editável embaixo, e por cena: Regerar (preço do tier) ou ✨ Novo prompt
 * IA (varinha: Sonnet com visão = 15 cr + o clipe). Animação enquanto gera.
 */
export function VideoSceneGrid({
  projectId,
  scenes,
  tierId,
  generatingAll,
  onReload,
  onPaywall,
  onGenerateAll,
}: {
  projectId: string;
  scenes: VideoScene[];
  tierId: string | null;
  generatingAll: boolean;
  onReload: () => void;
  onPaywall: (p: Paywall) => void;
  onGenerateAll: () => void;
}) {
  const tier = getTier(tierId);
  const clipCost = tier?.creditsPerClip ?? 0;
  const generatingAny = scenes.some(
    (s) => s.video_status === "pending" || s.video_status === "generating",
  );
  const providerIssue = scenes.some(
    (s) => s.video_status === "failed" && (s.video_error ?? "").toLowerCase().includes("provedor"),
  );
  // Cenas ainda sem clipe pronto (falharam ou nunca geraram) → alvo do lote.
  const retry = scenes.filter((s) => s.video_status == null || s.video_status === "failed");

  return (
    <section className="flex flex-col gap-4">
      <style>{SHIMMER_CSS}</style>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <Film className="h-5 w-5 text-[var(--silver)]" /> Vídeos das cenas
          {tier && (
            <span className="font-mono text-[11px] font-normal text-[var(--ash)]">
              · {tier.medal} {tier.label} · {clipCost} cr/cena
            </span>
          )}
        </h2>
        {retry.length > 0 && (
          <button
            type="button"
            onClick={onGenerateAll}
            disabled={generatingAll || generatingAny}
            title={`Gerar/regerar as ${retry.length} cenas pendentes (${retry.length * clipCost} créditos)`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
          >
            {generatingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {generatingAll
              ? "Enviando…"
              : `Regerar ${retry.length} vídeo(s) · ${retry.length * clipCost} cr`}
          </button>
        )}
      </div>

      {providerIssue && !generatingAny && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-4 py-3">
          <ServerCrash className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
          <span className="text-[13px] text-[var(--body)]">
            O serviço de vídeo está temporariamente indisponível (limite do provedor). Já avisamos o
            suporte automaticamente. Assim que normalizar, é só clicar em <strong>Regerar</strong> —
            você não perde o prompt.
          </span>
        </div>
      )}

      {generatingAny && (
        <div className="flex items-center gap-3 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3">
          <span className="reel relative flex h-5 w-5 shrink-0 items-center justify-center">
            <Film className="h-5 w-5 text-[var(--silver)]" />
          </span>
          <span className="text-[13px] text-[var(--body)]">
            Gerando seus vídeos<span className="dots" /> — pode levar alguns minutos. Pode sair e voltar.
          </span>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((s) => (
          <SceneCard
            key={s.id}
            projectId={projectId}
            scene={s}
            clipCost={clipCost}
            onReload={onReload}
            onPaywall={onPaywall}
          />
        ))}
      </ul>
    </section>
  );
}

function SceneCard({
  projectId,
  scene,
  clipCost,
  onReload,
  onPaywall,
}: {
  projectId: string;
  scene: VideoScene;
  clipCost: number;
  onReload: () => void;
  onPaywall: (p: Paywall) => void;
}) {
  const serverPrompt = scene.video_prompt_pt ?? "";
  const [prompt, setPrompt] = useState(serverPrompt);
  const [busy, setBusy] = useState<"regen" | "wand" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Adota o prompt do servidor sempre que ELE mudar (ex.: o lote/varinha salvou
  // o prompt depois que o card já montou, ou o poll alcançou o resultado).
  // Não sobrescreve enquanto o usuário edita algo que o servidor não mudou.
  const lastServer = useRef(serverPrompt);
  useEffect(() => {
    if (serverPrompt !== lastServer.current) {
      setPrompt(serverPrompt);
      lastServer.current = serverPrompt;
    }
  }, [serverPrompt]);

  const inflight = scene.video_status === "pending" || scene.video_status === "generating";
  const dirty = prompt.trim() !== serverPrompt.trim();

  async function call(path: string, body?: Record<string, unknown>, tag?: "regen" | "wand") {
    setBusy(tag ?? "regen");
    setErr(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        onPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || "Falha na geração");
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  const regenerate = () =>
    call(
      `/api/v1/videos/${projectId}/videos/${scene.id}/regenerate`,
      dirty ? { prompt_pt: prompt.trim() } : {},
      "regen",
    );
  const wand = () => call(`/api/v1/videos/${projectId}/videos/${scene.id}/wand`, {}, "wand");

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
        {scene.video_status === "ready" && scene.video_url ? (
          <video
            src={scene.video_url}
            controls
            loop
            playsInline
            preload="metadata"
            poster={scene.image_url ?? undefined}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {/* Poster = imagem da cena (first frame) */}
            {scene.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={scene.image_url} alt={`Cena ${scene.idx}`} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[var(--ash)]">
                <Film className="h-6 w-6" />
              </span>
            )}
            {inflight && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--canvas)]/45">
                <span className="shimmer absolute inset-0" aria-hidden />
                <Loader2 className="relative h-6 w-6 animate-spin text-white" />
                <span className="relative font-mono text-[10px] uppercase tracking-wide text-white">
                  Gerando vídeo
                </span>
              </span>
            )}
            {scene.video_status === "failed" && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--canvas)]/60">
                <AlertTriangle className="h-6 w-6 text-[var(--status-error)]" />
                <span className="px-2 text-center font-mono text-[9px] text-white/80">
                  {scene.video_error?.slice(0, 60) || "falhou"}
                </span>
              </span>
            )}
          </>
        )}
        <span className="absolute left-1 top-1 rounded-full bg-[var(--canvas)]/70 px-1.5 font-mono text-[10px] text-white">
          {scene.idx}
        </span>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Prompt de movimento (pt-BR) — será gerado automaticamente"
        rows={3}
        disabled={inflight}
        className="w-full resize-none rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-2 text-[11px] leading-snug text-[var(--body)] outline-none focus:border-[var(--hairline-bright)] disabled:opacity-60"
      />

      {err && (
        <p role="alert" className="font-mono text-[10px] text-[var(--status-error)]">
          {err}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={regenerate}
          disabled={!!busy || inflight}
          title={`Regerar o vídeo (${clipCost} créditos)`}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] py-1.5 font-sans text-[11px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-50"
        >
          {busy === "regen" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 text-[var(--silver)]" />
          )}
          {dirty ? "Gerar com meu prompt" : "Regerar"}
        </button>
        <button
          type="button"
          onClick={wand}
          disabled={!!busy || inflight}
          title="Novo prompt com IA (Sonnet vê a imagem): 15 créditos + o vídeo"
          className="inline-flex items-center justify-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-2 py-1.5 font-sans text-[11px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-50"
        >
          {busy === "wand" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3 text-[var(--silver)]" />
          )}
          ✨
        </button>
      </div>
    </li>
  );
}

// Animações locais (sem dependência): shimmer diagonal + reel girando + dots.
const SHIMMER_CSS = `
@keyframes vs-shimmer { 0% { transform: translateX(-120%) skewX(-12deg); } 100% { transform: translateX(220%) skewX(-12deg); } }
.shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent); animation: vs-shimmer 1.8s ease-in-out infinite; }
@keyframes vs-reel { to { transform: rotate(360deg); } }
.reel svg { animation: vs-reel 3s linear infinite; }
@keyframes vs-dots { 0%,20%{content:'';} 40%{content:'.';} 60%{content:'..';} 80%,100%{content:'...';} }
.dots::after { content:''; animation: vs-dots 1.6s steps(1) infinite; }
`;
