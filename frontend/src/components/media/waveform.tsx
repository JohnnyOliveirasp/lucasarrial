"use client";

import { useMemo } from "react";

/**
 * Waveform — output do clone de voz. Barras prata, UM canal violeta ativo
 * (a única cor saturada, acoplada à feature de voz). Estático em produção.
 */
export function Waveform({ bars = 56 }: { bars?: number }) {
  const heights = useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        const base = Math.sin(i * 0.5) * 0.5 + 0.5;
        const noise = ((i * 73) % 11) / 11;
        return 0.18 + (base * 0.55 + noise * 0.35) * 0.82;
      }),
    [bars],
  );
  const active = Math.round(bars * 0.46);

  return (
    <div
      aria-hidden
      className="flex h-24 w-full items-center gap-[3px] rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-[18px]"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.round(h * 64)}px`,
            background:
              i === active ? "var(--hue-violet)" : "var(--silver)",
            opacity: i === active ? 1 : i < active ? 0.78 : 0.34,
          }}
        />
      ))}
    </div>
  );
}
