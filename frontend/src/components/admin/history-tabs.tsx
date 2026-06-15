"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { AdminHistory } from "@/lib/admin/queries";

type Tab = "trainings" | "generations" | "payments";

const TABS: ReadonlyArray<[Tab, string]> = [
  ["trainings", "Clonagem"],
  ["generations", "Geração"],
  ["payments", "Pagamentos"],
];

const dt = (iso: string) => new Date(iso).toLocaleString("pt-BR");
const num = (n: number) => n.toLocaleString("pt-BR");

const STATUS_TONE: Record<string, string> = {
  completed: "text-[var(--status-online)]",
  ready: "text-[var(--status-online)]",
  failed: "text-[var(--status-error)]",
  running: "text-[var(--silver)]",
  generating: "text-[var(--silver)]",
  queued: "text-[var(--mute)]",
  pending: "text-[var(--mute)]",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`font-mono text-[11px] ${STATUS_TONE[status] ?? "text-[var(--mute)]"}`}>
      {status}
    </span>
  );
}

function Row({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <li className={`grid items-center gap-3 bg-[var(--surface-card)] px-4 py-3 ${i > 0 ? "border-t border-[var(--hairline)]" : ""}`} style={{ gridTemplateColumns: "1fr auto" }}>
      {children}
    </li>
  );
}

export function HistoryTabs({ data }: { data: AdminHistory }) {
  const [tab, setTab] = useState<Tab>("trainings");

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex items-center gap-1 self-start rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-1">
        {TABS.map(([key, label]) => {
          const active = tab === key;
          const count = data[key].length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="relative rounded-[var(--radius-sm)] px-3.5 py-1.5 text-[13px] font-medium"
            >
              {active && (
                <motion.span
                  layoutId="history-pill"
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] ring-1 ring-[var(--hairline-bright)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={`relative z-10 ${active ? "text-[var(--ink)]" : "text-[var(--mute)]"}`}>
                {label}
                <span className="ml-1.5 font-mono text-[10px] text-[var(--ash)]">{count}</span>
              </span>
            </button>
          );
        })}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]"
      >
        <ul>
          {tab === "trainings" &&
            (data.trainings.length === 0 ? (
              <Empty />
            ) : (
              data.trainings.map((t, i) => (
                <Row key={t.id} i={i}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-[var(--ink)]">{t.voice || "—"}</span>
                    <span className="block truncate font-mono text-[10px] text-[var(--ash)]">{t.email || "—"} · {dt(t.at)}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-mono text-[11px] text-[var(--ash)]">{t.elapsed_seconds ? `${t.elapsed_seconds}s` : "—"}</span>
                    <Badge status={t.status} />
                  </span>
                </Row>
              ))
            ))}

          {tab === "generations" &&
            (data.generations.length === 0 ? (
              <Empty />
            ) : (
              data.generations.map((g, i) => (
                <Row key={g.id} i={i}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-[var(--ink)]">{g.name || g.voice || "—"}</span>
                    <span className="block truncate font-mono text-[10px] text-[var(--ash)]">{g.email || "—"} · {dt(g.at)}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-mono text-[11px] text-[var(--ash)]">{num(g.chars)} car.</span>
                    <Badge status={g.status} />
                  </span>
                </Row>
              ))
            ))}

          {tab === "payments" &&
            (data.payments.length === 0 ? (
              <Empty />
            ) : (
              data.payments.map((p, i) => (
                <Row key={p.id} i={i}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-[var(--ink)]">{p.event_type || p.provider}</span>
                    <span className="block truncate font-mono text-[10px] text-[var(--ash)]">{p.email || "—"} · {dt(p.at)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{p.provider}</span>
                    <span className={`size-2 rounded-full ${p.error ? "bg-[var(--status-error)]" : p.processed_at ? "bg-[var(--status-online)]" : "bg-[var(--silver)]"}`} />
                  </span>
                </Row>
              ))
            ))}
        </ul>
      </motion.div>
    </div>
  );
}

function Empty() {
  return <li className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">nada por aqui ainda</li>;
}
