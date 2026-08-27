"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, VolumeX, Captions, Settings } from "lucide-react";

/** mm:ss pro contador do chrome. */
function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "00:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * VideoPreview — a superfície de output protagonista (substitui a "code window"
 * do Resend). É a ÚNICA zona saturada da página: a pessoa/output do produto
 * dentro de um chrome de player monocromático. 16:9 horizontal ou 9:16 vertical.
 *
 * `poster` é o frame estático (sempre visível). `src` é opcional: quando um
 * .mp4 existir (gerado/animado no Veo), o player vira vídeo de verdade; sem ele,
 * mostra só o poster — nunca um mockup falso.
 */
export interface VideoPreviewProps {
  vertical?: boolean;
  caption?: string;
  /** Frame estático mostrado no player. */
  poster?: string;
  /** Vídeo opcional. Se ausente, mostra só o poster. */
  src?: string;
  /** Largura máx custom; default 760 (h) / 320 (v). */
  maxWidth?: number;
}

export function VideoPreview({
  vertical = false,
  caption,
  poster = "/assets/landing-1-hero.png",
  src,
  maxWidth,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Chrome HONESTO (#149, 27/08): o contador "00:11 / 00:28", a barra em 38% e o
  // ícone de volume eram decoração fixa — um aluno escreveu pro suporte que "o
  // vídeo de exemplo está sem áudio". O asset é mudo por concepção (clipe de 6s
  // sem faixa de áudio), então o chrome mostra o tempo REAL do vídeo e um
  // ícone de mudo, em vez de prometer som que não existe.
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    videoRef.current?.play().catch(() => {
      /* autoplay bloqueado em alguns mobiles — silencioso */
    });
  }, []);

  const maxW = maxWidth ?? (vertical ? 320 : 760);
  const pct = dur > 0 ? Math.min(100, (time / dur) * 100) : 0;

  return (
    <figure className="m-0 w-full" style={{ maxWidth: maxW }}>
      <div
        className="relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)]"
        style={{ aspectRatio: vertical ? "9 / 16" : "16 / 9" }}
      >
        {src ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={src}
            poster={poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* vinheta — escurece bordas pro chrome respirar */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 40%, transparent, rgba(0,0,0,0.55))",
          }}
        />

        {/* chrome topo */}
        <div className="absolute inset-x-3.5 top-3.5 flex items-center justify-between">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[var(--radius-full)] border border-[var(--hairline-strong)] bg-[rgba(10,10,12,0.6)] px-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--silver)] backdrop-blur-sm">
            <span className="size-1.5 flex-none rounded-full bg-[var(--status-online)]" />
            4K · 30 fps
          </span>
          <Maximize2 className="size-[15px] text-[var(--ash)]" />
        </div>

        {/* chrome inferior — barra de progresso + controles */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 bg-gradient-to-t from-black/70 to-transparent px-4 py-3.5">
          <div className="relative h-[3px] rounded-sm bg-[var(--hairline-strong)]">
            <div className="absolute inset-y-0 left-0 rounded-sm bg-[rgba(250,250,250,0.92)]" style={{ width: `${pct}%` }} />
            <div className="absolute -top-[3px] size-[9px] -translate-x-1/2 rounded-full bg-white" style={{ left: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-3.5 text-[var(--silver)]">
            <Pause className="size-4" />
            <VolumeX className="size-4" aria-label="sem som" />
            <span className="font-mono text-[12px] tracking-[0.02em] text-[var(--mute)]">
              {fmt(time)} / {fmt(dur)}
            </span>
            <span className="ml-auto inline-flex gap-3.5">
              <Captions className="size-4" />
              <Settings className="size-4" />
            </span>
          </div>
        </div>
      </div>
      {caption && (
        <figcaption className="mt-3.5 text-center text-[13px] text-[var(--ash)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
