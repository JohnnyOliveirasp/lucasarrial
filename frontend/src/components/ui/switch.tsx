"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "type"
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * FastPost Switch — toggle monocromático. Track clareia de hairline para
 * quase-branco quando ligado; knob é prata→preto. Sem cor de acento.
 * Suporta uso controlado (`checked` + `onCheckedChange`) e não-controlado.
 */
export function Switch({
  checked,
  defaultChecked = false,
  disabled,
  onCheckedChange,
  className,
  ...rest
}: SwitchProps) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !on;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-6 w-10 flex-none items-center rounded-[var(--radius-full)] border border-[var(--hairline-strong)] p-0 transition-[background-color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        on ? "bg-[rgba(250,250,250,0.92)]" : "bg-[var(--surface-elevated)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "absolute top-0.5 h-[18px] w-[18px] rounded-[var(--radius-full)] transition-[left,background-color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
          on ? "left-[18px] bg-[var(--canvas)]" : "left-0.5 bg-[var(--silver)]",
        )}
      />
    </button>
  );
}
