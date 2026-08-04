"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AArrowDown, AArrowUp, GripHorizontal, Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const BASE_PX_PER_S = 28; // 1x — ritmo de leitura calmo (calibrado pelo Johnny 04/08: -30%)
const FONT_SIZES = [20, 24, 28, 34, 40];
const MIN_H = 240;

const CONTROL =
  "inline-flex size-9 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40";

/**
 * Teleprompter INLINE: painel escuro que substitui o bloco do roteiro no
 * próprio lugar da página — o gravador continua visível e acessível (a pessoa
 * pausa a gravação a qualquer momento). Sticky no topo enquanto a página rola.
 * Redimensionável pela alça de baixo (pointer events = mouse E touch).
 */
export function Teleprompter({
  paragraphs,
  onClose,
}: {
  paragraphs: string[];
  onClose: () => void;
}) {
  const t = useTranslations("voiceCreate.script.prompter");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2); // 1x
  const [fontIdx, setFontIdx] = useState(2);
  const [height, setHeight] = useState(420);

  // altura inicial = metade da tela (só no cliente)
  useEffect(() => {
    setHeight(Math.max(MIN_H, Math.round(window.innerHeight * 0.5)));
  }, []);

  // rolagem automática via rAF, acumulando frações de pixel
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (now: number) => {
      const el = scrollRef.current;
      if (el) {
        acc += ((now - last) / 1000) * BASE_PX_PER_S * SPEEDS[speedIdx];
        const px = Math.floor(acc);
        if (px > 0) {
          el.scrollTop += px;
          acc -= px;
        }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          setPlaying(false);
          return;
        }
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedIdx]);

  const heightRef = useRef(height);
  heightRef.current = height;

  // alça de redimensionar: pointer events cobrem mouse e touch
  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = heightRef.current;
    const onMove = (ev: PointerEvent) => {
      const max = Math.round(window.innerHeight * 0.85);
      setHeight(Math.min(max, Math.max(MIN_H, startH + (ev.clientY - startY))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  function restart() {
    scrollRef.current?.scrollTo({ top: 0 });
    setPlaying(false);
  }

  const fontSize = FONT_SIZES[fontIdx];
  // padding vertical proporcional ao painel: o texto começa no meio e pode
  // rolar até sair todo antes de parar
  const pad = Math.round(height * 0.42);

  return (
    <section
      className="sticky top-2 z-30 flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-black shadow-[var(--elevation-popover)]"
      style={{ height }}
    >
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-5 md:px-8">
        <div
          className="mx-auto flex max-w-3xl flex-col gap-6 text-center"
          style={{ paddingTop: pad, paddingBottom: pad }}
        >
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="font-semibold leading-[1.5] tracking-[-0.01em] text-white"
              style={{ fontSize }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>

      {/* fade nas bordas pra guiar o olho pro centro do painel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-16 h-14 bg-gradient-to-t from-black to-transparent" />

      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className={`${CONTROL} absolute right-3 top-3`}
      >
        <X className="size-4" />
      </button>

      {/* barra de controles + alça de redimensionar */}
      <div className="flex flex-none flex-col border-t border-white/10 bg-black">
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2">
          <button type="button" onClick={restart} aria-label={t("restart")} className={CONTROL}>
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setSpeedIdx((i) => Math.max(0, i - 1))}
            disabled={speedIdx === 0}
            aria-label={t("slower")}
            className={CONTROL}
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("pause") : t("play")}
            className={`${CONTROL} size-11 bg-white/20`}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
          </button>
          <button
            type="button"
            onClick={() => setSpeedIdx((i) => Math.min(SPEEDS.length - 1, i + 1))}
            disabled={speedIdx === SPEEDS.length - 1}
            aria-label={t("faster")}
            className={CONTROL}
          >
            <Plus className="size-4" />
          </button>
          <span className="w-10 text-center font-mono text-[12px] text-white/70">
            {SPEEDS[speedIdx]}x
          </span>
          <button
            type="button"
            onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
            disabled={fontIdx === 0}
            aria-label={t("fontSmaller")}
            className={CONTROL}
          >
            <AArrowDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
            disabled={fontIdx === FONT_SIZES.length - 1}
            aria-label={t("fontBigger")}
            className={CONTROL}
          >
            <AArrowUp className="size-4" />
          </button>
        </div>
        <div
          onPointerDown={onResizeStart}
          role="separator"
          aria-label={t("resize")}
          className="flex h-5 cursor-ns-resize touch-none items-center justify-center text-white/40 hover:text-white/70"
        >
          <GripHorizontal className="size-4" />
        </div>
      </div>
    </section>
  );
}
