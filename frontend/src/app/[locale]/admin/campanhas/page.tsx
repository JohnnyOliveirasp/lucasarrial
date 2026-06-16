"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Plus, Power } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  bonus_credits: number;
  trigger: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at: string;
  grants_count: number;
  credits_granted: number;
};

const INPUT =
  "h-10 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";
const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// default: fim do mês de lançamento (29). Ajustável no input.
function defaultEndDate(): string {
  return "2026-06-29";
}

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("200000");
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/admin/campaigns");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setCampaigns(json.campaigns ?? []);
    else setError(json?.error?.message || "Falha ao carregar");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // a janela termina no FIM do dia escolhido (inclui o dia inteiro).
    const endsAt = new Date(`${endDate}T23:59:59`).toISOString();
    const res = await fetch("/api/v1/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), bonus_credits: Number(credits), ends_at: endsAt }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setName("");
      setCredits("200000");
      setEndDate(defaultEndDate());
      await load();
    } else {
      setError(json?.error?.message || "Falha ao criar campanha");
    }
    setBusy(false);
  }

  async function toggle(c: Campaign) {
    if (c.active && !confirm(`Encerrar a campanha "${c.name}"? Novas compras param de ganhar o bônus.`)) return;
    setError(null);
    const res = await fetch(`/api/v1/admin/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) await load();
    else setError(json?.error?.message || "Falha ao atualizar");
  }

  const now = Date.now();

  return (
    <div className="flex max-w-[860px] flex-col gap-8">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Campanhas de bônus
        </h1>
        <p className="mt-1 text-[14px] text-[var(--mute)]">
          Crédito extra de presente pra quem <strong className="text-[var(--silver)]">assinar</strong> dentro
          da janela. Vai pro saldo avulso (não expira); cada pessoa ganha 1× por campanha.
        </p>
      </div>

      <form
        onSubmit={create}
        className="grid grid-cols-1 gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 sm:grid-cols-[1fr_160px_170px_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lançamento da plataforma"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">Bônus (créditos)</span>
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
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">Vale até (fim do dia)</span>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={INPUT}
          />
        </label>
        <button type="submit" disabled={busy || !name.trim()} className={PILL}>
          <Plus className="size-4" />
          Criar
        </button>
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
            nenhuma campanha ainda
          </div>
        ) : (
          <ul>
            {campaigns.map((c, i) => {
              const live = c.active && Date.parse(c.starts_at) <= now && Date.parse(c.ends_at) >= now;
              const ended = Date.parse(c.ends_at) < now;
              return (
                <li
                  key={c.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--surface-card)] px-5 py-4 ${
                    i > 0 ? "border-t border-[var(--hairline)]" : ""
                  }`}
                >
                  <Gift className="size-4 flex-none text-[var(--silver)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{c.name}</p>
                    <p className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
                      +{fmt(c.bonus_credits)} créditos · até {fmtDate(c.ends_at)} ·{" "}
                      {fmt(c.grants_count)} resgates ({fmt(c.credits_granted)} concedidos)
                    </p>
                  </div>
                  <span
                    className={`rounded-[var(--radius-full)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                      live
                        ? "border border-[var(--status-success,#10b981)]/40 text-[var(--status-success,#10b981)]"
                        : "border border-[var(--hairline-strong)] text-[var(--ash)]"
                    }`}
                  >
                    {live ? "no ar" : c.active ? (ended ? "expirada" : "agendada") : "encerrada"}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
                  >
                    <Power className="size-3.5" />
                    {c.active ? "Encerrar" : "Reativar"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
