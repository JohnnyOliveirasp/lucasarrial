"use client";

import { motion } from "motion/react";
import type { Period } from "@/lib/admin/cost";

const PERIODS: ReadonlyArray<[Period, string]> = [
  ["day", "Dia"],
  ["week", "Semana"],
  ["fortnight", "Quinzena"],
  ["month", "Mês"],
];

export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-1">
      {PERIODS.map(([key, label]) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="relative rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors"
          >
            {active && (
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] ring-1 ring-[var(--hairline-bright)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative z-10 ${active ? "text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--body)]"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
