"use client";

/**
 * Gráfico de cancelamentos por dia (pedido Johnny 06/08): barras empilhadas,
 * eixo X = dia (últimos 30, fuso BRT), eixo Y = pessoas que cancelaram —
 * vermelho = pagantes, âmbar = trial (oferta R$0). Vive na seção "Desde o
 * início" do /admin, ao lado do KPI "Cancelaram"; mesmo padrão visual do
 * gráfico de coortes do TrialPanel (barras CSS, tooltip no title).
 */
import { UserMinus } from "lucide-react";
import type { ChurnDay } from "@/lib/admin/totals";

const num = (n: number) => n.toLocaleString("pt-BR");

export function ChurnChart({ daily }: { daily: ChurnDay[] }) {
  const max = Math.max(1, ...daily.map((d) => d.paid + d.trial));
  const totalPaid = daily.reduce((s, d) => s + d.paid, 0);
  const totalTrial = daily.reduce((s, d) => s + d.trial, 0);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">
          <UserMinus className="h-3.5 w-3.5" />
          Cancelamentos por dia · últimos 30 dias
        </h3>
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
      </div>

      <div className="mt-4 flex items-end gap-[3px]" style={{ height: 120 }}>
        {daily.map((d, i) => {
          const total = d.paid + d.trial;
          return (
            <div
              key={d.day}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${fmtDay(d.day)}: ${num(total)} cancelamento${total === 1 ? "" : "s"} · ${num(d.paid)} pagante${d.paid === 1 ? "" : "s"} · ${num(d.trial)} trial`}
            >
              {total > 0 && (
                <span className="mb-0.5 text-center font-mono text-[9px] tabular-nums text-[var(--ash)]">
                  {total}
                </span>
              )}
              <div
                className="flex w-full flex-col justify-end overflow-hidden rounded-t-[3px]"
                style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 4 : 1 }}
              >
                <div className="w-full bg-[var(--status-warn)]/75" style={{ height: `${total > 0 ? (d.trial / total) * 100 : 0}%` }} />
                <div className="w-full bg-[var(--status-error)]/85" style={{ height: `${total > 0 ? (d.paid / total) * 100 : 0}%` }} />
                {total === 0 && <div className="h-px w-full bg-[var(--surface-deep)]" />}
              </div>
              <span className="mt-1 h-[12px] truncate text-center font-mono text-[8.5px] text-[var(--ash)]">
                {i % 5 === 0 || i === daily.length - 1 ? fmtDay(d.day) : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-[var(--ash)]">
        Cada torre = pessoas que cancelaram naquele dia · vermelho = pagantes (&gt;$0) ·
        âmbar = trial/gratuidade ($0) · passe o mouse pra ver o detalhe
      </p>
    </section>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
