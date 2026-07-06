"use client";

/**
 * Donut SVG genérico (sem lib) — padrão dataviz: fatias com gap de 2px,
 * legenda sempre presente com valores escritos (nunca só ângulo/cor),
 * hover destaca fatia e mostra detalhe no centro.
 */
import { useState } from "react";

export type DonutSlice = {
  key: string;
  label: string;
  brl: number;
  detail?: string;
  color: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutPath(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0 = polar(cx, cy, rOut, a0);
  const p1 = polar(cx, cy, rOut, a1);
  const p2 = polar(cx, cy, rIn, a1);
  const p3 = polar(cx, cy, rIn, a0);
  return `M ${p0.x} ${p0.y} A ${rOut} ${rOut} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${rIn} ${rIn} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
}

type Props = {
  slices: DonutSlice[];
  centerLabel: string;
  /** Valor exibido no centro quando nada está em hover (default: soma). */
  centerValue?: number;
  centerSub?: string;
  emptyText?: string;
};

export function Donut({ slices, centerLabel, centerValue, centerSub, emptyText }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const visible = slices.filter((s) => s.brl > 0.005);
  const total = visible.reduce((s, x) => s + x.brl, 0);

  if (total <= 0) {
    return (
      <div className="flex h-[200px] items-center justify-center font-mono text-[12px] text-[var(--ash)]">
        {emptyText ?? "sem movimento no período"}
      </div>
    );
  }

  const gapDeg = visible.length > 1 ? 1.4 : 0;
  let angle = 0;
  const arcs = visible.map((s) => {
    const sweep = (s.brl / total) * 360;
    const a0 = angle + gapDeg / 2;
    const a1 = Math.max(angle + sweep - gapDeg / 2, a0 + 0.6);
    angle += sweep;
    return { ...s, pct: (s.brl / total) * 100, path: donutPath(105, 105, 96, 60, a0, Math.min(a1, a0 + 359.4)) };
  });

  const active = arcs.find((a) => a.key === hover) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative flex-none">
        <svg width={210} height={210} viewBox="0 0 210 210" role="img" aria-label={centerLabel}>
          {arcs.map((a) => (
            <path
              key={a.key}
              d={a.path}
              fill={a.color}
              opacity={hover === null || hover === a.key ? 0.85 : 0.28}
              onMouseEnter={() => setHover(a.key)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: "opacity 0.15s ease", cursor: "default" }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          {active ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">{active.label}</span>
              <span className="font-sans text-[19px] font-semibold tabular-nums text-[var(--ink)]">{brl(active.brl)}</span>
              <span className="font-mono text-[10px] text-[var(--mute)]">{active.pct.toFixed(1)}%</span>
            </>
          ) : (
            <>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">{centerLabel}</span>
              <span className="font-sans text-[20px] font-semibold tabular-nums text-[var(--ink)]">
                {brl(centerValue ?? total)}
              </span>
              {centerSub ? <span className="font-mono text-[10px] text-[var(--mute)]">{centerSub}</span> : null}
            </>
          )}
        </div>
      </div>

      <ul className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        {arcs.map((a) => (
          <li
            key={a.key}
            onMouseEnter={() => setHover(a.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center justify-between gap-3 rounded-[var(--radius)] border px-3 py-2 transition-colors ${
              hover === a.key ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]" : "border-transparent"
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="size-2.5 flex-none rounded-full" style={{ background: a.color }} />
              <span className="truncate text-[13px] text-[var(--body)]">{a.label}</span>
              {a.detail ? <span className="truncate font-mono text-[10px] text-[var(--ash)]">{a.detail}</span> : null}
            </span>
            <span className="flex-none font-mono text-[12px] tabular-nums text-[var(--ink)]">
              {brl(a.brl)} <span className="text-[var(--ash)]">· {a.pct.toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
