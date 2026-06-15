import * as React from "react";
import { cn } from "@/lib/utils";

const SIDE: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export interface TooltipProps {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  className?: string;
}

/**
 * FastCloner Tooltip — superfície raised com hairline + um ambient ultra-suave.
 * Aparece no hover/focus do gatilho. Monocromático, sem acento. CSS puro
 * (group-hover/group-focus-within) — sem JS.
 */
export function Tooltip({
  label,
  side = "top",
  children,
  className,
}: TooltipProps) {
  return (
    <span
      className={cn("group relative inline-flex", className)}
      tabIndex={0}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink)] [box-shadow:var(--elevation-popover)] group-hover:block group-focus-within:block",
          SIDE[side],
        )}
      >
        {label}
      </span>
    </span>
  );
}
