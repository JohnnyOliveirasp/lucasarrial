"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChartPoint } from "@/lib/admin/queries";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

type Serie = { key: string; label: string; color: string; get: (d: ChartPoint) => number };

const SERIES: Serie[] = [
  { key: "revenue", label: "Faturou", color: "var(--silver)", get: (d) => d.revenue },
  { key: "cost", label: "Gastou", color: "var(--status-error)", get: (d) => d.cost },
  { key: "profit", label: "Lucro", color: "var(--status-online)", get: (d) => d.profit },
];

const H = 240;
const PAD_X = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;

export function AreaChart({ data }: { data: ChartPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 720));
    setW(el.clientWidth || 720);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const n = data.length;
    const max = Math.max(1, ...data.flatMap((d) => SERIES.map((s) => s.get(d))));
    const innerW = w - PAD_X * 2;
    const innerH = H - PAD_TOP - PAD_BOTTOM;
    const x = (i: number) => PAD_X + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v: number) => PAD_TOP + innerH - (Math.max(0, v) / max) * innerH;
    const line = (s: Serie) =>
      data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s.get(d))}`).join(" ");
    const revLine = line(SERIES[0]);
    const area = `${revLine} L${x(n - 1)},${PAD_TOP + innerH} L${x(0)},${PAD_TOP + innerH} Z`;
    return { x, y, baseline: PAD_TOP + innerH, lines: SERIES.map(line), area };
  }, [data, w]);

  if (data.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] font-mono text-[12px] text-[var(--ash)]">
        sem dados suficientes no período
      </div>
    );
  }

  const onMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const rel = e.clientX - el.getBoundingClientRect().left;
    const n = data.length;
    const i = Math.round(((rel - PAD_X) / (w - PAD_X * 2)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hv = hover != null ? data[hover] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--mute)]">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative w-full select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg width={w} height={H} className="block overflow-visible">
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--silver)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--silver)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* gridlines sutis */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={PAD_X}
              x2={w - PAD_X}
              y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * g}
              y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * g}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
          ))}

          <motion.path
            d={geo.area}
            fill="url(#rev-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />

          {SERIES.map((s, idx) => (
            <motion.path
              key={s.key}
              d={geo.lines[idx]}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.08 }}
            />
          ))}

          {hover != null && (
            <>
              <line
                x1={geo.x(hover)}
                x2={geo.x(hover)}
                y1={PAD_TOP}
                y2={geo.baseline}
                stroke="var(--hairline-bright)"
                strokeWidth={1}
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={geo.x(hover)}
                  cy={geo.y(s.get(data[hover]))}
                  r={3.5}
                  fill="var(--canvas)"
                  stroke={s.color}
                  strokeWidth={2}
                />
              ))}
            </>
          )}
        </svg>

        {hv && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[var(--radius)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] px-3 py-2 shadow-lg"
            style={{ left: Math.min(Math.max(geo.x(hover ?? 0), 70), w - 70) }}
          >
            <div className="mb-1 font-mono text-[10px] tracking-wide text-[var(--ash)]">
              {new Date(hv.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-[var(--mute)]">
                  <span className="size-2 rounded-[2px]" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-mono tabular-nums text-[var(--ink)]">{brl(s.get(hv))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
