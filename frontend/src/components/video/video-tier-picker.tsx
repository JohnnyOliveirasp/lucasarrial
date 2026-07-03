"use client";

import { useState } from "react";
import { Film, Loader2, Check, Sparkles, Clock } from "lucide-react";
import { VIDEO_TIERS, VideoTierId, SAMPLE_VIDEO_PROMPT_PT, VIDEO_DURATION_SECONDS } from "@/lib/video/tiers";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";

/**
 * Fase 4-A: tela de comparação. Mostra os 3 vídeos de exemplo (mesmo prompt) +
 * o prompt usado; a pessoa escolhe o modelo que chegou mais perto e aprova o
 * custo (preço do tier × nº de cenas) antes de gastar créditos.
 */
export function VideoTierPicker({
  sceneCount,
  generating,
  onConfirm,
}: {
  sceneCount: number;
  generating: boolean;
  onConfirm: (tier: VideoTierId) => void;
}) {
  const [selected, setSelected] = useState<VideoTierId | null>(null);
  const tier = VIDEO_TIERS.find((t) => t.id === selected) ?? null;
  const total = tier ? tier.creditsPerClip * sceneCount : 0;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <Film className="h-5 w-5 text-[var(--silver)]" /> Escolha o modelo de vídeo
        </h2>
        <p className="max-w-2xl text-sm text-[var(--mute)]">
          Estes três exemplos foram gerados a partir da{" "}
          <strong className="text-[var(--ink)]">mesma imagem</strong> e do{" "}
          <strong className="text-[var(--ink)]">mesmo prompt</strong> abaixo — só muda o modelo.
          Veja qual chegou mais perto do que você quer e escolha. O custo é por cena.
        </p>
      </div>

      {/* Prompt usado nos exemplos */}
      <details className="group rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-3">
        <summary className="flex cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
          <Sparkles className="h-3.5 w-3.5" /> Prompt usado nos 3 exemplos
        </summary>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--mute)]">{SAMPLE_VIDEO_PROMPT_PT}</p>
      </details>

      {/* Cards dos 3 modelos */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {VIDEO_TIERS.map((t) => {
          const active = selected === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelected(t.id)}
                aria-pressed={active}
                className={[
                  "group flex w-full flex-col gap-3 rounded-[var(--radius-lg)] border p-3 text-left transition-[transform,border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                  active
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-card)] shadow-[0_0_0_1px_var(--hairline-bright),0_0_40px_-12px_var(--silver)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--hairline-bright)]",
                ].join(" ")}
              >
                <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
                  <video
                    src={t.sampleSrc}
                    controls
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  {active && (
                    <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--silver)] text-[var(--canvas)]">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-[15px] font-semibold text-[var(--ink)]">
                    {t.medal} {t.label}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--silver)]">
                    {t.creditsPerClip} cr/cena
                  </span>
                </div>
                <p className="text-[12px] leading-snug text-[var(--mute)]">{t.blurb}</p>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Resumo + aprovação */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-sans text-[14px] font-medium text-[var(--ink)]">
              {tier ? `${tier.medal} ${tier.label} · ${sceneCount} cenas` : "Selecione um modelo acima"}
            </span>
            <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
              {tier
                ? `${tier.creditsPerClip} × ${sceneCount} = ${total} créditos no total`
                : `${sceneCount} cenas de ${VIDEO_DURATION_SECONDS}s · 9:16 · 720p`}
            </span>
          </div>
          <button
            type="button"
            disabled={!tier || generating}
            onClick={() => tier && onConfirm(tier.id)}
            className={PILL}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {generating
              ? "Enviando…"
              : tier
                ? `Aprovar e gerar ${sceneCount} vídeos · ${total} cr`
                : "Aprovar e gerar"}
          </button>
        </div>
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-[var(--ash)]">
          <Clock className="h-3 w-3" /> A geração roda em segundo plano e pode levar alguns minutos. Você
          pode sair e voltar — o progresso fica salvo.
        </p>
      </div>
    </section>
  );
}
