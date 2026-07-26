"use client";

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Plus, Power } from "lucide-react";

type Courtesy = {
  id: string;
  name: string;
  credits_per_person: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at: string;
  people: number;
  granted_count: number;
  credits_granted: number;
  expired_count: number;
  credits_expired: number;
};

const INPUT =
  "h-10 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";
const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CortesiasPage() {
  const [campaigns, setCampaigns] = useState<Courtesy[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("100000");
  const [emailsText, setEmailsText] = useState("");
  const [startDate, setStartDate] = useState(todayDate());
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/admin/courtesy");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setCampaigns(json.campaigns ?? []);
    else setError(json?.error?.message || "Falha ao carregar");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const emails = emailsText
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/admin/courtesy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        credits_per_person: Number(credits),
        emails,
        // início 00:00 do dia escolhido; fim inclui o dia INTEIRO
        starts_at: new Date(`${startDate}T00:00:00`).toISOString(),
        ends_at: new Date(`${endDate}T23:59:59`).toISOString(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setName("");
      setCredits("100000");
      setEmailsText("");
      setStartDate(todayDate());
      setEndDate("");
      await load();
    } else {
      setError(json?.error?.message || "Falha ao criar cortesia");
    }
    setBusy(false);
  }

  async function endNow(c: Courtesy) {
    if (
      !confirm(
        `Encerrar "${c.name}" AGORA? O que sobrou da cortesia de cada pessoa é removido do saldo.`,
      )
    )
      return;
    setError(null);
    const res = await fetch(`/api/v1/admin/courtesy/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ end_now: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) await load();
    else setError(json?.error?.message || "Falha ao encerrar");
  }

  const now = Date.now();

  return (
    <div className="flex max-w-[860px] flex-col gap-8">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Cortesias
        </h1>
        <p className="mt-1 text-[14px] text-[var(--mute)]">
          Acesso de cortesia <strong className="text-[var(--silver)]">sem Hotmart</strong> (mentoria):
          cada e-mail da lista ganha os créditos no início da janela; quem ainda não tem conta recebe
          ao entrar. No fim, o que <strong className="text-[var(--silver)]">sobrou</strong> da cortesia
          expira.
        </p>
      </div>

      <form
        onSubmit={create}
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_150px_150px]">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">Nome</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mentoria Turma 3"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
              Créditos por pessoa
            </span>
            <input
              type="number"
              min={1}
              required
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className={`${INPUT} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">Início</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
              Fim (dia inteiro)
            </span>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
            E-mails (um por linha) — {emails.length} na lista
          </span>
          <textarea
            required
            rows={5}
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder={"aluno1@gmail.com\naluno2@gmail.com"}
            className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 font-mono text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
        </label>
        <p className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
          Referência: 100.000 = 1 mês do plano · 300.000 = 3 meses. Avise o aluno pra entrar com o
          MESMO e-mail da lista.
        </p>
        <div>
          <button type="submit" disabled={busy || !name.trim() || emails.length === 0} className={PILL}>
            <Plus className="size-4" />
            Criar cortesia
          </button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {loading ? (
          <div className="px-5 py-8 text-center font-mono text-[12px] text-[var(--ash)]">carregando…</div>
        ) : campaigns.length === 0 ? (
          <div className="px-5 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            nenhuma cortesia ainda
          </div>
        ) : (
          <ul>
            {campaigns.map((c, i) => {
              const started = Date.parse(c.starts_at) <= now;
              const ended = Date.parse(c.ends_at) < now;
              const live = c.active && started && !ended;
              const waiting = c.people - c.granted_count;
              return (
                <li
                  key={c.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--surface-card)] px-5 py-4 ${
                    i > 0 ? "border-t border-[var(--hairline)]" : ""
                  }`}
                >
                  <GraduationCap className="size-4 flex-none text-[var(--silver)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{c.name}</p>
                    <p className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
                      {fmt(c.credits_per_person)} cr/pessoa · {fmtDate(c.starts_at)}–{fmtDate(c.ends_at)} ·{" "}
                      {fmt(c.granted_count)}/{fmt(c.people)} creditados ({fmt(c.credits_granted)} cr)
                      {waiting > 0 && !ended ? ` · ${fmt(waiting)} aguardando conta` : ""}
                      {c.expired_count > 0 ? ` · ${fmt(c.credits_expired)} cr expirados` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-[var(--radius-full)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      live
                        ? "border border-[var(--status-success,#10b981)]/40 text-[var(--status-success,#10b981)]"
                        : "border border-[var(--hairline-strong)] text-[var(--ash)]"
                    }`}
                  >
                    {live ? "no ar" : ended || !c.active ? "encerrada" : "agendada"}
                  </span>
                  {!ended && c.active && (
                    <button
                      type="button"
                      onClick={() => endNow(c)}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
                    >
                      <Power className="size-3.5" />
                      Encerrar agora
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
