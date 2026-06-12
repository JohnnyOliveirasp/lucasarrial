"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  className?: string;
}

/**
 * FastPost Tabs — estilo underline. Tab ativa ganha texto ink + hairline bright
 * embaixo; inativas são mute. Uma hairline corre a largura toda.
 */
export function Tabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  className,
}: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? tabs[0]?.id);
  const current = value !== undefined ? value : internal;

  const select = (id: string) => {
    setInternal(id);
    onValueChange?.(id);
  };

  return (
    <div className={cn("flex gap-1 border-b border-[var(--hairline)]", className)}>
      {tabs.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            className={cn(
              "relative cursor-pointer border-none bg-transparent px-3 pb-3 text-[14px] font-medium tracking-[-0.01em] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)]",
              active
                ? "text-[var(--ink)]"
                : "text-[var(--mute)] hover:text-[var(--body)]",
            )}
          >
            {t.label}
            <span
              className={cn(
                "absolute inset-x-0 -bottom-px h-[1.5px] transition-colors duration-[var(--dur-base)]",
                active ? "bg-[var(--hairline-bright)]" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
