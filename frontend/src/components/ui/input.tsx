import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  iconLeft?: React.ReactNode;
  invalid?: boolean;
  /** Renomeado de `size` (que colide com o atributo nativo numérico). */
  inputSize?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

/**
 * FastCloner Input — campo escuro, borda hairline que clareia no foco.
 * Sem drop shadow; o brilho da borda carrega o sinal de foco.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      iconLeft,
      invalid,
      inputSize = "md",
      fullWidth = true,
      disabled,
      ...props
    },
    ref,
  ) => {
    const heights = { sm: "h-9", md: "h-10", lg: "h-12" } as const;
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2.5 rounded-[var(--radius)] border bg-[var(--surface-deep)] px-3.5 transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
          heights[inputSize],
          fullWidth && "w-full",
          invalid
            ? "border-[var(--status-error)]"
            : "border-[var(--hairline-strong)] focus-within:border-[var(--hairline-bright)]",
          disabled && "opacity-50",
          className,
        )}
      >
        {iconLeft && (
          <span className="inline-flex text-[var(--ash)]">{iconLeft}</span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            "min-w-0 flex-1 border-none bg-transparent tracking-[-0.01em] text-[var(--ink)] outline-none placeholder:text-[var(--ash)]",
            inputSize === "sm" ? "text-[13px]" : "text-[14px]",
          )}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";
