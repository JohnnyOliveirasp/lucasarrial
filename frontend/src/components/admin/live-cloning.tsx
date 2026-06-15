"use client";

import { motion, AnimatePresence } from "motion/react";
import { Mic2 } from "lucide-react";
import type { LiveCloning } from "@/lib/admin/queries";

function elapsed(since: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const m = Math.floor(s / 60);
  if (m < 1) return `${s}s`;
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

export function LiveCloningPanel({ items }: { items: LiveCloning[] }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
          <Mic2 className="size-4 text-[var(--ash)]" />
          Clonando agora
        </span>
        <span className="font-sans text-[18px] font-semibold tabular-nums text-[var(--ink)]">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-4 font-mono text-[12px] text-[var(--ash)]">
          ninguém clonando agora
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const who = it.display_name || it.email || "—";
              return (
                <motion.li
                  key={it.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] px-3 py-2.5"
                >
                  <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[var(--surface-elevated)] font-mono text-[11px] uppercase text-[var(--silver)]">
                    {who.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[var(--ink)]">{who}</div>
                    <div className="truncate font-mono text-[10px] text-[var(--ash)]">{it.name}</div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-[var(--status-online)]">
                    <span className="size-1.5 rounded-full bg-[var(--status-online)]" />
                    {elapsed(it.started_at)}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
