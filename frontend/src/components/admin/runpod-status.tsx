"use client";

import { motion } from "motion/react";
import { Cpu } from "lucide-react";
import type { RunpodHealth, RunpodState } from "@/lib/admin/runpod";

const STATE: Record<RunpodState, { label: string; color: string; pulse: boolean }> = {
  running: { label: "Running", color: "var(--status-online)", pulse: true },
  idle: { label: "Idle", color: "var(--silver)", pulse: false },
  offline: { label: "Offline", color: "var(--status-error)", pulse: false },
};

export function RunpodStatus({ health }: { health: RunpodHealth[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
        <Cpu className="size-4 text-[var(--ash)]" />
        RunPod (GPU)
      </div>

      <div className="flex flex-col gap-3">
        {health.map((h) => {
          const s = STATE[h.state];
          return (
            <div key={h.endpoint} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    {s.pulse && (
                      <motion.span
                        className="absolute inline-flex size-full rounded-full"
                        style={{ backgroundColor: s.color }}
                        animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}
                    <span className="relative inline-flex size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  </span>
                  <span className="text-sm font-medium text-[var(--ink)]">{h.label}</span>
                  <span className="font-mono text-[11px]" style={{ color: s.color }}>
                    {s.label}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-[var(--ash)]">
                  {h.latencyMs != null ? `${h.latencyMs}ms` : "—"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Mini label="Na fila" value={h.jobs.inQueue} warn={h.jobs.inQueue > 0} />
                <Mini label="Rodando" value={h.workers.running + h.jobs.inProgress} />
                <Mini label="Workers" value={h.workers.idle + h.workers.running + h.workers.ready} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-deep)] px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--ash)]">{label}</div>
      <div className={`font-sans text-[18px] font-semibold tabular-nums ${warn ? "text-[var(--silver)]" : "text-[var(--ink)]"}`}>
        {value}
      </div>
    </div>
  );
}
