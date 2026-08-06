"use client";

/**
 * Painel "Trial 7 dias" (pedido Lucas/Johnny 06/08): conversão trial→assinante
 * em DESTAQUE + gráfico de coortes semanais. Atualiza em tempo real junto com
 * o dashboard (poll de 5s do dashboard-client).
 *
 * Leitura do gráfico: cada barra é a semana em que as pessoas INICIARAM o
 * trial; a parte verde é quem daquele grupo virou assinante. Semanas recentes
 * ainda têm gente dentro do trial (marcadas com ◌).
 */
import { UserCheck } from "lucide-react";
import type { TrialStats } from "@/lib/admin/queries";

const num = (n: number) => n.toLocaleString("pt-BR");

export function TrialPanel({ trial }: { trial: TrialStats }) {
  const maxStarted = Math.max(1, ...trial.weekly.map((w) => w.started));

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">
          <UserCheck className="h-3.5 w-3.5" />
          Trial 7 dias → assinante
        </h3>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ash)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--status-online)]" />
          tempo real
        </span>
      </div>

      {/* Destaque: a taxa em número grande + o funil por extenso */}
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <span className="font-sans text-[44px] font-semibold leading-none tracking-[-0.03em] text-[var(--status-online)]">
            {trial.ratePct.toFixed(1)}%
          </span>
          <p className="mt-1 text-[12.5px] text-[var(--mute)]">de conversão do trial</p>
        </div>
        <div className="flex flex-col gap-1 pb-1 text-[13.5px] text-[var(--body)]">
          <span>
            <strong className="text-[var(--ink)]">{num(trial.converted)}</strong> viraram assinante,
            de <strong className="text-[var(--ink)]">{num(trial.matured)}</strong> que completaram os 7 dias
          </span>
          <span className="text-[12.5px] text-[var(--mute)]">
            {num(trial.inTrial)} dentro do trial agora · {num(trial.started)} iniciados desde o começo
            · {num(trial.started30d)} nos últimos 30 dias
          </span>
        </div>
      </div>

      {/* Coortes semanais: barra = iniciados na semana; verde = os que converteram */}
      {trial.weekly.length > 0 && (
        <div className="mt-5">
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {trial.weekly.map((w) => {
              const rate = w.started > 0 ? (w.converted / w.started) * 100 : 0;
              const open = w.stillOpen > 0;
              return (
                <div
                  key={w.week}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  title={`Semana de ${fmtWeek(w.week)}: ${num(w.started)} trials · ${num(w.converted)} converteram${open ? ` · ${num(w.stillOpen)} ainda no trial` : ""}`}
                >
                  <span className="mb-1 text-center font-mono text-[9.5px] tabular-nums text-[var(--ash)]">
                    {open ? "◌ " : ""}{rate.toFixed(0)}%
                  </span>
                  <div
                    className="relative w-full overflow-hidden rounded-t-[3px] bg-[var(--surface-deep)]"
                    style={{ height: `${(w.started / maxStarted) * 100}%`, minHeight: 4 }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-[var(--status-online)]/80"
                      style={{ height: `${rate}%` }}
                    />
                  </div>
                  <span className="mt-1 truncate text-center font-mono text-[9px] text-[var(--ash)]">
                    {fmtWeek(w.week)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-[var(--ash)]">
            Cada barra = semana em que o trial começou · verde = quantos daquele grupo assinaram ·
            ◌ = semana ainda com gente dentro do trial (a taxa ainda vai subir)
          </p>
        </div>
      )}
    </section>
  );
}

function fmtWeek(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
