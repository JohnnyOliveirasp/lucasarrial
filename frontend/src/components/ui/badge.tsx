import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-full)] px-2.5 text-[12px] font-medium tracking-[-0.005em]",
  {
    variants: {
      variant: {
        outline:
          "border border-[var(--hairline-strong)] bg-transparent text-[var(--silver)]",
        soft: "border border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--silver)]",
        solid:
          "border border-transparent bg-[var(--pill-bg)] text-[var(--pill-ink)]",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
}

/**
 * FastCloner Badge — label monocromático. Outline (hairline) por padrão, `soft`
 * ou `solid` (pill invertido raro). Dot de status opcional.
 */
export function Badge({
  className,
  variant,
  dot,
  dotColor = "var(--status-online)",
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 flex-none rounded-full"
          style={{ background: dotColor }}
        />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
