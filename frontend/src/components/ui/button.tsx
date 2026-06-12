import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * FastPost Button — monocromático, nunca tingido com cor de acento/glow.
 * - primary: o pill branco invertido (texto preto) — elemento mais brilhante
 *   da viewport. Use NO MÁXIMO um por tela.
 * - secondary: superfície elevada + hairline.
 * - ghost: transparente; ganha superfície no hover.
 * Press = scale(0.98). Foco = hairline bright, sem ring colorido.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-medium tracking-[-0.01em] leading-none rounded-[var(--radius)] whitespace-nowrap select-none transition-[background-color,border-color,opacity,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-[0.42] focus-visible:outline-1 focus-visible:outline-[var(--hairline-bright)] focus-visible:outline-offset-2 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--pill-bg)] text-[var(--pill-ink)] border border-transparent hover:bg-white",
        secondary:
          "bg-[var(--surface-elevated)] text-[var(--ink)] border border-[var(--hairline-strong)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]",
        ghost:
          "bg-transparent text-[var(--body)] border border-transparent hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]",
      },
      size: {
        sm: "h-8 px-[14px] text-[13px] [&_svg]:size-4",
        md: "h-10 px-[18px] text-[14px] [&_svg]:size-4",
        lg: "h-12 px-[22px] text-[15px] [&_svg]:size-5",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "fullWidth"> {
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      iconLeft,
      iconRight,
      type = "button",
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
