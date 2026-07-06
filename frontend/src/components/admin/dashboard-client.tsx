"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  BadgeDollarSign,
  TrendingUp,
  AudioLines,
  Mic2,
  Activity,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import type { AdminData, LiveCloning, Failure } from "@/lib/admin/queries";
import type { RunpodHealth } from "@/lib/admin/runpod";
import { PeriodFilter, currentKey, labelFor, type Gran } from "@/components/admin/period-filter";
import { FinanceSection } from "@/components/admin/finance-section";
import { RunpodStatus } from "@/components/admin/runpod-status";
import { LiveCloningPanel } from "@/components/admin/live-cloning";
import { KpiCard } from "@/components/admin/kpi-card";

type Payload = AdminData & { live: LiveCloning[]; runpod: RunpodHealth[] };

const brl0 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("pt-BR");

export function DashboardClient() {
  const [gran, setGran] = useState<Gran>("month");
  const [periodKey, setPeriodKey] = useState<string>(() => currentKey("month"));
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const [failures, setFailures] = useState<Failure[] | null>(null);

  const fetchData = useCallback(async (g: Gran, k: string) => {
    try {
      const res = await fetch(`/api/v1/admin/dashboard?gran=${g}&key=${k}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao carregar");
      setData(json as Payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    }
  }, []);

  useEffect(() => {
    fetchData(gran, periodKey);
    const id = setInterval(() => fetchData(gran, periodKey), 5000);
    return () => clearInterval(id);
  }, [gran, periodKey, fetchData]);

  const onPeriod = (g: Gran, k: string) => {
    setGran(g);
    setPeriodKey(k);
  };
  const periodLabel = `em ${labelFor(gran, periodKey)}`;

  const toggleFailures = async () => {
    const next = !failuresOpen;
    setFailuresOpen(next);
    if (next && failures === null) {
      const res = await fetch("/api/v1/admin/failures", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setFailures(res.ok ? json.failures ?? [] : []);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Header gran={gran} periodKey={periodKey} onPeriod={onPeriod} />
        {error ? (
          <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-4 py-3 font-mono text-[12px] text-[var(--status-error)]">
            {error}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]" />
            ))}
          </div>
        )}
      </div>
    );
  }

  const m = data.metrics;
  const money = data.money;
  const fin = data.finance;
  const failuresTotal = m.voices_failed + m.gens_failed + m.trainings_failed;

  return (
    <div className="flex flex-col gap-8">
      <Header gran={gran} periodKey={periodKey} onPeriod={onPeriod} />

      {/* Saúde ao vivo */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RunpodStatus health={data.runpod} />
        <LiveCloningPanel items={data.live} />
        <div className="flex flex-col justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
            <Wifi className="size-4 text-[var(--ash)]" />
            Online agora
          </div>
          <div className="flex items-end gap-2">
            <span className="font-sans text-[40px] font-semibold leading-none tabular-nums text-[var(--ink)]">
              {m.online_now}
            </span>
            <span className="mb-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--status-online)]">
              <span className="size-1.5 rounded-full bg-[var(--status-online)]" />
              ao vivo
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--ash)]">
            de {num(m.users_total)} usuários · {num(m.subs_active)} assinantes
          </span>
        </div>
      </div>

      {/* Financeiro (KPIs + compra×promoção + destino do bruto + gasto por ferramenta) */}
      <FinanceSection money={money} fin={fin} periodLabel={periodLabel} />

      {/* Contexto de assinaturas (projeção + testes fora da conta) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Pagaram (total)" value={num(fin.paidCount)} tone="good" icon={BadgeDollarSign} hint={`${brl2(fin.paidTotal)} desde o início`} />
        <KpiCard label="Oferta (total)" value={num(fin.offerCount)} tone={fin.offerCount > fin.paidCount ? "bad" : "default"} icon={Users} hint="assinatura ativa sem pagar (trial/cupom)" />
        <KpiCard label="MRR projetado" value={brl0(money.mrr)} icon={TrendingUp} hint={`${num(m.subs_active)} acessos ativos × R$97`} />
        <KpiCard label="Testes (fora)" value={num(fin.testCount)} icon={AlertTriangle} hint="compras de teste excluídas das contas" />
      </div>

      {/* Operação */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">Operação</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Usuários" value={num(m.users_total)} icon={Users} hint={`+${num(m.users_new)} ${periodLabel}`} />
          <KpiCard label="Assinantes" value={num(m.subs_active)} icon={BadgeDollarSign} hint="acesso ativo" />
          <KpiCard label="Gerações" value={num(m.gens_period)} icon={AudioLines} hint={`${num(m.gens_total)} no total`} />
          <KpiCard label="Vozes prontas" value={num(m.voices_ready)} icon={Mic2} tone="good" hint={`${num(m.voices_training)} clonando agora`} />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Clonando agora" value={num(m.voices_training)} icon={Activity} hint="ao vivo" />
          <KpiCard label="Treinos OK" value={num(m.trainings_done)} icon={Mic2} hint={`+${num(m.trainings_period)} ${periodLabel}`} />
          <KpiCard label="Créditos gastos" value={num(m.credits_consumed)} icon={TrendingUp} hint={periodLabel} />
          <KpiCard
            label="Falhas"
            value={num(failuresTotal)}
            tone={failuresTotal > 0 ? "bad" : "good"}
            onClick={toggleFailures}
            active={failuresOpen}
            hint={`${num(m.trainings_failed)} treino · ${num(m.gens_failed)} geração · ${num(m.voices_failed)} voz`}
          />
        </div>

        <AnimatePresence initial={false}>
          {failuresOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <FailuresList failures={failures} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

function Header({ gran, periodKey, onPeriod }: { gran: Gran; periodKey: string; onPeriod: (g: Gran, k: string) => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">Visão geral</h1>
        <p className="mt-1 inline-flex items-center gap-2 text-[14px] text-[var(--mute)]">
          <span className="inline-flex size-1.5 rounded-full bg-[var(--status-online)]" />
          tempo real · atualiza sozinho a cada 5s
        </p>
      </div>
      <PeriodFilter gran={gran} keyValue={periodKey} onChange={onPeriod} />
    </div>
  );
}

const KIND_LABEL: Record<Failure["kind"], string> = {
  training: "Treino",
  voice: "Voz",
  generation: "Geração",
};

function FailuresList({ failures }: { failures: Failure[] | null }) {
  if (failures === null) {
    return <div className="px-1 py-3 font-mono text-[12px] text-[var(--ash)]">carregando falhas…</div>;
  }
  if (failures.length === 0) {
    return <div className="px-1 py-3 font-mono text-[12px] text-[var(--ash)]">nenhuma falha registrada 🎉</div>;
  }
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
      <ul>
        {failures.map((f, i) => (
          <li key={`${f.kind}-${f.id}`} className={`flex items-start gap-3 bg-[var(--surface-card)] px-4 py-3 ${i > 0 ? "border-t border-[var(--hairline)]" : ""}`}>
            <span className="mt-0.5 inline-flex flex-none items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--status-error)]/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--status-error)]">
              <AlertTriangle className="size-3" />
              {KIND_LABEL[f.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-[var(--body)]">{f.error || "sem mensagem de erro"}</div>
              <div className="mt-0.5 font-mono text-[10px] text-[var(--ash)]">
                {f.email || "—"} · {new Date(f.at).toLocaleString("pt-BR")}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
