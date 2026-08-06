"use client";

/**
 * Gráfico de cancelamentos por dia (pedido Johnny 06/08, v2): a pessoa
 * SELECIONA O MÊS e o eixo X mostra TODOS os dias daquele mês (1..31,
 * fixos); cada torre é o total de cancelamentos do dia — vermelho =
 * pagantes, âmbar = trial ($0). Dia sem cancelamento fica vazio.
 * Dados vêm esparsos do servidor (só dias com evento, fuso BRT).
 */
import { useMemo, useState } from "react";
import { UserMinus } from "lucide-react";
import type { ChurnDay } from "@/lib/admin/totals";

const num = (n: number) => n.toLocaleString("pt-BR");
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-08" do relógio no fuso BRT (mesmo fuso da série do servidor). */
function currentMonthKey(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    .slice(0, 7);
}

export function ChurnChart({ daily }: { daily: ChurnDay[] }) {
  // Meses disponíveis: do 1º cancelamento até o mês atual (sempre presente)
  const months = useMemo(() => {
    const set = new Set(daily.map((d) => d.day.slice(0, 7)));
    set.add(currentMonthKey());
    return [...set].sort().reverse();
  }, [daily]);
  const [month, setMonth] = useState(currentMonthKey);

  const [yearStr, monthStr] = month.split("-");
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const byDay = useMemo(() => {
    const m = new Map<string, ChurnDay>();
    for (const d of daily) m.set(d.day, d);
    return m;
  }, [daily]);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    const row = byDay.get(day);
    return { n: i + 1, paid: row?.paid ?? 0, trial: row?.trial ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.paid + d.trial));
  const totalPaid = days.reduce((s, d) => s + d.paid, 0);
  const totalTrial = days.reduce((s, d) => s + d.trial, 0);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">
          <UserMinus className="h-3.5 w-3.5" />
          Cancelamentos por dia
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 font-mono text-[10.5px] text-[var(--mute)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--status-error)]" />
              pagantes ({num(totalPaid)})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--status-warn)]" />
              trial ({num(totalTrial)})
            </span>
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-2 py-1 font-mono text-[11px] text-[var(--ink)]"
          >
            {months.map((m) => {
              const [y, mo] = m.split("-");
              return (
                <option key={m} value={m}>
                  {MONTH_LABELS[Number(mo) - 1]} {y}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-[2px]" style={{ height: 130 }}>
        {days.map((d) => {
          const total = d.paid + d.trial;
          return (
            <div
              key={d.n}
              className="flex h-full flex-1 flex-col justify-end"
              title={`Dia ${d.n}: ${num(total)} cancelamento${total === 1 ? "" : "s"} · ${num(d.paid)} pagante${d.paid === 1 ? "" : "s"} · ${num(d.trial)} trial`}
            >
              {total > 0 ? (
                <>
                  <span className="mb-0.5 text-center font-mono text-[9px] tabular-nums text-[var(--ash)]">
                    {total}
                  </span>
                  <div
                    className="flex w-full flex-col justify-end overflow-hidden rounded-t-[3px]"
                    style={{ height: `${(total / max) * 100}%`, minHeight: 4 }}
                  >
                    <div className="w-full bg-[var(--status-warn)]/75" style={{ height: `${(d.trial / total) * 100}%` }} />
                    <div className="w-full bg-[var(--status-error)]/85" style={{ height: `${(d.paid / total) * 100}%` }} />
                  </div>
                </>
              ) : (
                // dia sem cancelamento: espaço vazio, só a marquinha da base
                <div className="h-px w-full bg-[var(--hairline)]" />
              )}
              <span className="mt-1 text-center font-mono text-[8.5px] tabular-nums text-[var(--ash)]">
                {d.n}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--ash)]">
        Eixo X = todos os dias do mês selecionado · torre = pessoas que cancelaram no dia
        (vermelho pagantes, âmbar trial) · dia vazio = zero cancelamentos · passe o mouse
        pra ver o detalhe
      </p>
    </section>
  );
}
