"use client";

/**
 * Filtro de período CALENDÁRIO do /admin: Dia · Mês · Ano + setas ◀ ▶ pra
 * navegar (ex.: jun/2026 → jul/2026). Nada de "últimos X dias" — junho é
 * 01/06 a 30/06, em horário de Brasília (casado com a rota).
 */
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Gran = "day" | "month" | "year";

const GRANS: ReadonlyArray<[Gran, string]> = [
  ["day", "Dia"],
  ["month", "Mês"],
  ["year", "Ano"],
];

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Agora em Brasília (aprox. UTC-3, suficiente pra chave de calendário). */
function nowBrt(): Date {
  return new Date(Date.now() - 3 * 3600 * 1000);
}

export function currentKey(gran: Gran): string {
  const d = nowBrt();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (gran === "day") return `${y}-${m}-${day}`;
  if (gran === "month") return `${y}-${m}`;
  return `${y}`;
}

/** Anda a chave em ±1 unidade da granularidade. */
export function shiftKey(gran: Gran, key: string, delta: number): string {
  if (gran === "day") {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  if (gran === "month") {
    const [y, m] = key.split("-").map(Number);
    const total = y * 12 + (m - 1) + delta;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, "0")}`;
  }
  return String(Number(key) + delta);
}

/** Rótulo humano: 06/07/2026 · jul/2026 · 2026. */
export function labelFor(gran: Gran, key: string): string {
  if (gran === "day") {
    const [y, m, d] = key.split("-");
    return `${d}/${m}/${y}`;
  }
  if (gran === "month") {
    const [y, m] = key.split("-");
    return `${MONTHS_PT[Number(m) - 1]}/${y}`;
  }
  return key;
}

export function PeriodFilter({
  gran,
  keyValue,
  onChange,
}: {
  gran: Gran;
  keyValue: string;
  onChange: (gran: Gran, key: string) => void;
}) {
  const atCurrent = keyValue >= currentKey(gran); // chaves são ordenáveis lexicograficamente
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-1">
        {GRANS.map(([key, label]) => {
          const active = gran === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key, currentKey(key))}
              className="relative rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="period-pill"
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] ring-1 ring-[var(--hairline-bright)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={`relative z-10 ${active ? "text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--body)]"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-1">
        <button
          type="button"
          aria-label="Período anterior"
          onClick={() => onChange(gran, shiftKey(gran, keyValue, -1))}
          className="rounded-[var(--radius-sm)] p-1.5 text-[var(--mute)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-[86px] text-center font-mono text-[12px] tabular-nums text-[var(--ink)]">
          {labelFor(gran, keyValue)}
        </span>
        <button
          type="button"
          aria-label="Próximo período"
          disabled={atCurrent}
          onClick={() => onChange(gran, shiftKey(gran, keyValue, 1))}
          className="rounded-[var(--radius-sm)] p-1.5 text-[var(--mute)] transition-colors enabled:hover:bg-[var(--surface-elevated)] enabled:hover:text-[var(--ink)] disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
