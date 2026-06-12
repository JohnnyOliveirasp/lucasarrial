import * as React from "react";
import { cn } from "@/lib/utils";

export type EyebrowProps = React.HTMLAttributes<HTMLSpanElement>;

/** Eyebrow CAPS — marcador editorial de seção. 11px, tracking 0.16em, prata. */
export function Eyebrow({ className, children, ...props }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-block text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--silver)]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
