import * as React from "react";
import { cn } from "@/lib/utils";

/** Glow atmosférico acoplado a cada feature (uso EXCLUSIVO como radial sutil). */
const GLOWS = {
  voice: "var(--glow-violet)",
  face: "var(--glow-amber)",
  edit: "var(--glow-blue)",
  output: "var(--glow-green)",
  stats: "var(--glow-magenta)",
} as const;

export type CardGlow = keyof typeof GLOWS;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pinta um único radial atmosférico no topo, acoplado a uma feature. Máx 1 por seção. */
  glow?: CardGlow;
  /** Usa surface-elevated em vez de surface-card. */
  elevated?: boolean;
  /** Hover clareia a hairline. */
  interactive?: boolean;
  radius?: "lg" | "md";
}

/**
 * FastCloner Card — a superfície de trabalho. Borda hairline, SEM drop shadow.
 * Profundidade vem da luminância da superfície + hairline.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { className, glow, elevated, interactive, radius = "lg", children, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden border border-[var(--hairline-strong)] p-6 transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        elevated ? "bg-[var(--surface-elevated)]" : "bg-[var(--surface-card)]",
        radius === "lg" ? "rounded-[var(--radius-lg)]" : "rounded-[var(--radius)]",
        interactive && "hover:border-[var(--hairline-bright)]",
        className,
      )}
      {...props}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 120% 70% at 50% 0%, ${GLOWS[glow]}, transparent 70%)`,
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  ),
);
Card.displayName = "Card";
