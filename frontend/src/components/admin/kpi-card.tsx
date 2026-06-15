"use client";

import { motion } from "motion/react";
import { ChevronRight, type LucideIcon } from "lucide-react";

type Tone = "default" | "good" | "warn" | "bad" | "revenue" | "cost" | "profit";

const TONE_VALUE: Record<Tone, string> = {
  default: "text-[var(--ink)]",
  good: "text-[var(--status-online)]",
  warn: "text-[var(--silver)]",
  bad: "text-[var(--status-error)]",
  revenue: "text-[var(--ink)]",
  cost: "text-[var(--status-error)]",
  profit: "text-[var(--status-online)]",
};

/**
 * Card de métrica do /admin — número grande + label + contexto (hint) + ícone.
 * Clicável (motion hover/tap) quando recebe onClick → drill-down.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <motion.div
      onClick={onClick}
      whileHover={clickable ? { y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={[
        "flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--surface-card)] p-5",
        active
          ? "border-[var(--hairline-bright)]"
          : "border-[var(--hairline-strong)]",
        clickable ? "cursor-pointer hover:border-[var(--hairline-bright)]" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
          {label}
        </span>
        {clickable ? (
          <ChevronRight className="size-4 text-[var(--ash)]" />
        ) : (
          Icon && <Icon className="size-4 text-[var(--ash)]" />
        )}
      </div>
      <span className={`font-sans text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${TONE_VALUE[tone]}`}>
        {value}
      </span>
      {hint && (
        <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">{hint}</span>
      )}
    </motion.div>
  );
}
