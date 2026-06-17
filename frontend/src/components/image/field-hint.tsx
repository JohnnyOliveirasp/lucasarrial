"use client";

import { HelpCircle } from "lucide-react";

/**
 * Pequeno "?" ao lado do rótulo do campo. No hover/foco mostra uma explicação
 * (bolha com quebra de linha — diferente do Tooltip global, que é nowrap).
 * CSS puro (group-hover/focus-within), acessível por teclado.
 */
export function FieldHint({ text, side = "top" }: { text: string; side?: "top" | "bottom" }) {
  return (
    <span className="group relative inline-flex align-middle" tabIndex={0}>
      <HelpCircle className="h-3.5 w-3.5 cursor-help text-[var(--ash)] transition-colors hover:text-[var(--silver)]" />
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-1/2 z-50 hidden w-56 -translate-x-1/2 whitespace-normal rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] font-normal leading-snug text-[var(--body)] [box-shadow:var(--elevation-popover)] group-hover:block group-focus-within:block",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}
