"use client";

/**
 * Gráfico de cancelamentos por dia (pedido Johnny 06/08, v3): a pessoa
 * SELECIONA O MÊS e o eixo X mostra TODOS os dias daquele mês (1..31,
 * fixos); cada torre é o total de cancelamentos do dia — vermelho =
 * pagantes, âmbar = trial ($0). Dia sem cancelamento fica vazio.
 *
 * v3: filtro Todos/Pagantes/Trial (o gráfico mostra só a série escolhida) +
 * popup "Ver quem cancelou" (tabela e-mail · tipo · dia · motivo — motivo da
 * pesquisa da plataforma; sem pesquisa = cancelou direto no Hotmart).
 * Dados do gráfico vêm esparsos do servidor; a lista de pessoas vem de
 * /api/v1/admin/churn só quando o popup abre.
 */
import { useEffect, useMemo, useState } from "react";
import { UserMinus, X } from "lucide-react";
import type { ChurnDay } from "@/lib/admin/totals";

type Kind = "all" | "paid" | "trial";
type Person = {
  email: string;
  day: string;
  kind: "paid" | "trial";
  reason: string | null;
  detail: string | null;
};

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

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChurnChart({ daily }: { daily: ChurnDay[] }) {
  // Meses disponíveis: do 1º cancelamento até o mês atual (sempre presente)
  const months = useMemo(() => {
    const set = new Set(daily.map((d) => d.day.slice(0, 7)));
    set.add(currentMonthKey());
    return [...set].sort().reverse();
  }, [daily]);
  const [month, setMonth] = useState(currentMonthKey);
  const [kind, setKind] = useState<Kind>("all");
  const [peopleOpen, setPeopleOpen] = useState(false);

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
    return {
      n: i + 1,
      paid: kind === "trial" ? 0 : (row?.paid ?? 0),
      trial: kind === "paid" ? 0 : (row?.trial ?? 0),
    };
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 font-mono text-[10.5px] text-[var(--mute)]">
            {kind !== "trial" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--status-error)]" />
                pagantes ({num(totalPaid)})
              </span>
            )}
            {kind !== "paid" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--status-warn)]" />
                trial ({num(totalTrial)})
              </span>
            )}
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-2 py-1 font-mono text-[11px] text-[var(--ink)]"
          >
            <option value="all">Todos</option>
            <option value="paid">Pagantes cancelados</option>
            <option value="trial">Trials cancelados</option>
          </select>
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
          <button
            type="button"
            onClick={() => setPeopleOpen(true)}
            className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink)] hover:bg-[var(--surface-deep)]"
          >
            Ver quem cancelou
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-[2px]" style={{ height: 130 }}>
        {days.map((d) => {
          const total = d.paid + d.trial;
          return (
            <div
              key={d.n}
              className="flex h-full flex-1 flex-col justify-end"
              title={`Dia ${d.n}: ${num(total)} cancelamento${total === 1 ? "" : "s"}${kind === "all" ? ` · ${num(d.paid)} pagante${d.paid === 1 ? "" : "s"} · ${num(d.trial)} trial` : ""}`}
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

      {peopleOpen && (
        <PeopleModal month={month} kind={kind} onClose={() => setPeopleOpen(false)} />
      )}
    </section>
  );
}

/** Popup com a tabela de quem cancelou no mês selecionado (+ filtro de tipo). */
function PeopleModal({ month, kind, onClose }: { month: string; kind: Kind; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/admin/churn", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error();
        if (alive) setPeople((j?.data?.people ?? j?.people ?? []) as Person[]);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const rows = (people ?? []).filter(
    (p) => p.day.startsWith(month) && (kind === "all" || p.kind === kind),
  );
  const [y, mo] = month.split("-");
  const title = `${MONTH_LABELS[Number(mo) - 1]} ${y}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-4">
          <h3 className="font-sans text-[15px] font-semibold text-[var(--ink)]">
            Quem cancelou · {title}
            {kind !== "all" && (
              <span className="ml-2 font-mono text-[11px] font-normal text-[var(--mute)]">
                (só {kind === "paid" ? "pagantes" : "trials"})
              </span>
            )}
          </h3>
          <button type="button" onClick={onClose} className="text-[var(--ash)] hover:text-[var(--ink)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3">
          {error ? (
            <p className="py-6 text-center text-[13px] text-[var(--status-error)]">
              Não foi possível carregar a lista.
            </p>
          ) : people === null ? (
            <p className="py-6 text-center text-[13px] text-[var(--mute)]">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--mute)]">
              Nenhum cancelamento nesse mês com esse filtro.
            </p>
          ) : (
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">
                  <th className="py-2 pr-3 font-normal">Dia</th>
                  <th className="py-2 pr-3 font-normal">E-mail</th>
                  <th className="py-2 pr-3 font-normal">Tipo</th>
                  <th className="py-2 font-normal">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.email} className="border-t border-[var(--hairline)] align-top">
                    <td className="py-2 pr-3 font-mono text-[11px] tabular-nums text-[var(--mute)]">
                      {fmtDay(p.day)}
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-[var(--ink)]" title={p.email}>
                      {p.email}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] ${
                          p.kind === "paid"
                            ? "bg-[var(--status-error)]/15 text-[var(--status-error)]"
                            : "bg-[var(--status-warn)]/15 text-[var(--status-warn)]"
                        }`}
                      >
                        {p.kind === "paid" ? "pagante" : "trial"}
                      </span>
                    </td>
                    <td className="py-2 text-[var(--body)]">
                      {p.reason ? (
                        <>
                          {p.reason}
                          {p.detail && (
                            <span className="block text-[11.5px] text-[var(--mute)]">“{p.detail}”</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[var(--ash)]">
                          Cancelou pelo Hotmart — motivo não disponível
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="border-t border-[var(--hairline)] px-5 py-2.5 text-[10.5px] text-[var(--ash)]">
          Motivo = pesquisa de cancelamento respondida na plataforma · quem cancelou direto no
          Hotmart não passa pela pesquisa
        </p>
      </div>
    </div>
  );
}
