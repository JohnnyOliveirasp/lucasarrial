"use client";

/**
 * Seção Financeiro do /admin — refeita no padrão de dashboard SaaS
 * (números primeiro, gráfico depois; todo valor escrito em R$, nunca só ângulo):
 *  KPIs:  Entrou (real) · Promoção (dado) · Gastou (ferramentas) · Lucro (+%)
 *  1) Onde está o dinheiro — barra dividida Compra × Promoção
 *  2) Pra onde foi o bruto — barra empilhada Taxa × Ferramentas × Lucro
 *  3) Gasto por ferramenta — donut (paleta categórica validada p/ dark + CVD)
 */
import { Wallet, Gift, BadgeDollarSign, TrendingUp } from "lucide-react";
import type { Finance, Money } from "@/lib/admin/queries";
import { PLAN_PRICE_BRL } from "@/lib/admin/cost";
import { KpiCard } from "@/components/admin/kpi-card";
import { Donut, type DonutSlice } from "@/components/admin/donut";

const brl2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("pt-BR");

/** Paleta categórica das ferramentas — validada (dataviz) contra #0a0a0c. */
const TOOL_COLORS: Record<string, string> = {
  voice: "#3b82f6",
  training: "#ea580c",
  image: "#0d9488",
  video: "#a855f7",
};

type Segment = { key: string; label: string; brl: number; detail: string; color: string };

/** Barra horizontal dividida com valores escritos embaixo de cada trecho. */
function SplitBar({ segments }: { segments: Segment[] }) {
  const visible = segments.filter((s) => s.brl > 0.005);
  const total = visible.reduce((s, x) => s + x.brl, 0);
  if (total <= 0) {
    return <div className="py-6 text-center font-mono text-[12px] text-[var(--ash)]">sem movimento no período</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
        {visible.map((s) => (
          <div
            key={s.key}
            className="h-full rounded-[2px] first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.max((s.brl / total) * 100, 1.5)}%`, background: s.color, opacity: 0.85 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {visible.map((s) => (
          <div key={s.key} className="flex items-baseline gap-2">
            <span className="size-2.5 flex-none self-center rounded-full" style={{ background: s.color }} />
            <span className="text-[13px] text-[var(--body)]">{s.label}</span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--ink)]">{brl2(s.brl)}</span>
            <span className="font-mono text-[11px] text-[var(--ash)]">
              {((s.brl / total) * 100).toFixed(0)}% · {s.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">{title}</h3>
      {children}
    </div>
  );
}

export function FinanceSection({ money, fin, periodLabel }: { money: Money; fin: Finance; periodLabel: string }) {
  // Promoção valorizada: o que seria cobrado em valor de tabela.
  const promoValue = fin.offerValuePeriod;
  const tableValue = money.revenuePeriod + promoValue; // valor de tabela do período
  const promoPct = tableValue > 0 ? (promoValue / tableValue) * 100 : 0;
  const toolsCost = fin.slices.reduce((s, x) => s + x.brl, 0);
  const isLoss = money.profitPeriod < 0;
  // Opção B: caixa e "com promoção" sempre lado a lado.
  const combined = money.profitPeriod - promoValue;
  // Tudo que sai no período: ferramentas + infra fixa + taxa Hotmart.
  const totalOut = toolsCost + money.infraPeriod + money.feePeriod;

  const toolSlices: DonutSlice[] = fin.slices.map((s) => ({
    ...s,
    color: TOOL_COLORS[s.key] ?? "var(--silver)",
  }));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">
        Financeiro · {periodLabel}
      </h2>

      {/* KPIs — a verdade em 4 números */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Entrou (real)"
          value={brl2(money.revenuePeriod)}
          tone="revenue"
          icon={Wallet}
          hint={`${num(fin.paidCountPeriod)} venda(s) · desde o início ${brl2(fin.paidTotal)} (${num(fin.paidCount)})`}
        />
        <KpiCard
          label="Promoção (dado)"
          value={brl2(promoValue)}
          tone={promoValue > money.revenuePeriod ? "bad" : "default"}
          icon={Gift}
          hint={`${num(fin.offerCountPeriod)} oferta(s) R$0 · ${promoPct.toFixed(0)}% do valor de tabela`}
        />
        <KpiCard
          label="Saiu (gastos)"
          value={brl2(totalOut)}
          tone="cost"
          icon={BadgeDollarSign}
          hint={`ferramentas ${brl2(toolsCost)} + infra ${brl2(money.infraPeriod)} + taxa ${brl2(money.feePeriod)}`}
        />
        <KpiCard
          label={isLoss ? "Prejuízo (caixa)" : "Lucro (caixa)"}
          value={brl2(Math.abs(money.profitPeriod))}
          tone={isLoss ? "bad" : "profit"}
          icon={TrendingUp}
          hint={
            promoValue > 0
              ? `c/ promoção: ${brl2(combined)}${money.revenuePeriod > 0 ? ` · ${Math.abs(money.marginPct).toFixed(0)}% sobre o que entrou` : ""}`
              : money.revenuePeriod > 0
                ? `${Math.abs(money.marginPct).toFixed(0)}% sobre o que entrou · taxa ${brl2(money.feePeriod)}`
                : `sem receita no período · taxa ${brl2(money.feePeriod)}`
          }
        />
      </div>

      {/* 1) Compra × Promoção */}
      <ChartCard title="Onde está o dinheiro — compra × promoção (valor de tabela)">
        <SplitBar
          segments={[
            {
              key: "paid",
              label: "Compras (pago)",
              brl: money.revenuePeriod,
              detail: `${num(fin.paidCountPeriod)} venda(s)`,
              color: "var(--status-online)",
            },
            {
              key: "promo",
              label: "Promoção (R$0)",
              brl: promoValue,
              detail: `${num(fin.offerCountPeriod)} assinatura(s) × ${brl2(PLAN_PRICE_BRL)}`,
              color: "var(--status-warn)",
            },
          ]}
        />
      </ChartCard>

      {/* 2) Resumo geral em R$ — entrou, promoção, ferramentas, taxa; resultado no centro */}
      <ChartCard title="Resumo do período em R$ — resultado no centro">
        <Donut
          slices={[
            {
              key: "in",
              label: "Entrou (pago)",
              brl: money.revenuePeriod,
              detail: `${num(fin.paidCountPeriod)} venda(s)`,
              color: "var(--status-online)",
            },
            {
              key: "promo",
              label: "Promoção (dado)",
              brl: promoValue,
              detail: `${num(fin.offerCountPeriod)} oferta(s) R$0`,
              color: "var(--status-warn)",
            },
            { key: "tools", label: "Ferramentas", brl: toolsCost, detail: "custo Kie/RunPod", color: "var(--status-error)" },
            { key: "infra", label: "Infraestrutura", brl: money.infraPeriod, detail: "Hetzner US$25 + RunPod HD US$15/mês", color: "#94a3b8" },
            { key: "fee", label: "Taxa Hotmart", brl: money.feePeriod, detail: "9,9% + R$1/venda", color: "var(--ash)" },
          ]}
          centerLabel={isLoss ? "Prejuízo (caixa)" : "Lucro (caixa)"}
          centerValue={Math.abs(money.profitPeriod)}
          centerSub={
            promoValue > 0
              ? `c/ promoção: ${brl2(combined)}`
              : money.revenuePeriod > 0
                ? `${Math.abs(money.marginPct).toFixed(0)}% sobre o que entrou`
                : "sem receita no período"
          }
          emptyText="sem movimento no período"
        />
        {promoValue > 0 || isLoss ? (
          <p className={`font-mono text-[12px] ${isLoss ? "text-[var(--status-error)]" : "text-[var(--status-warn)]"}`}>
            {isLoss ? `⚠ caixa negativo em ${brl2(Math.abs(money.profitPeriod))} (saiu mais do que entrou)` : ""}
            {isLoss && promoValue > 0 ? " · " : ""}
            {promoValue > 0
              ? `${brl2(promoValue)} dados em promoção (${num(fin.offerCountPeriod)} conta(s)) → resultado c/ promoção: ${brl2(combined)}`
              : ""}
          </p>
        ) : null}
      </ChartCard>

      {/* 3) SAÍDAS — tudo que sai do bolso, detalhado */}
      <ChartCard title="Saídas — pra onde vai o dinheiro (ferramentas + infra + taxa)">
        <Donut
          slices={[
            ...toolSlices,
            { key: "infra", label: "Infraestrutura", brl: money.infraPeriod, detail: "Hetzner US$25 + RunPod HD US$15/mês", color: "#94a3b8" },
            { key: "fee", label: "Taxa Hotmart", brl: money.feePeriod, detail: "9,9% + R$1/venda", color: "var(--ash)" },
          ]}
          centerLabel="Saiu no total"
          centerSub={periodLabel}
          emptyText="nenhuma saída no período"
        />
      </ChartCard>
    </section>
  );
}
