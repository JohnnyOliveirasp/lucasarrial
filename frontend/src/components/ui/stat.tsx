import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  label: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * FastPost Stat — número grande prata + caption. Usado em bandas de
 * sucesso/stats. O valor usa peso display; o label é caption ash.
 */
export function Stat({
  className,
  value,
  label,
  size = "md",
  ...props
}: StatProps) {
  const valueSize = {
    sm: "text-[28px]",
    md: "text-[44px]",
    lg: "text-[56px]",
  } as const;
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <span
        className={cn(
          "font-semibold leading-none tracking-[-0.03em] text-[var(--silver)]",
          valueSize[size],
        )}
      >
        {value}
      </span>
      <span className="text-[13px] text-[var(--ash)]">{label}</span>
    </div>
  );
}
