"use client";

/**
 * Bloco "Retiradas dos sócios" do /admin — fica LOGO ABAIXO do Lucro (caixa).
 *
 * REGRA CONTÁBIL (Johnny, 11/09): retirada de sócio NÃO É DESPESA. Este
 * componente não altera receita, custo, "Saiu (gastos)" nem "Lucro (caixa)" —
 * ele só mostra, separado, quanto do lucro já foi distribuído e fecha com o
 * número que o Johnny quer ver:
 *
 *     Em caixa = Lucro (caixa) − retiradas do período
 *
 * O painel busca a própria lista (GET /api/v1/admin/retiradas com a MESMA
 * gran/key do dashboard) em vez de receber por prop: assim o poll de 30s da
 * visão geral não sobrescreve uma retirada recém-gravada, e o "Em caixa"
 * recalcula na hora do OK, sem recarregar a página.
 */
import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import type { Gran } from "@/components/admin/period-filter";
import { SOCIOS, emCaixa, totalRetiradas, type RetiradaLinha } from "@/lib/admin/retiradas-calc";

// Mesma régua do resto do financeiro (pedido Johnny 01/08: "$", não "R$").
const brl2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).replace("R$", "$");

const dia = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
};

type Resposta = { retiradas: RetiradaLinha[]; tabelaAusente: boolean };

export function RetiradasPanel({
  gran,
  periodKey,
  periodLabel,
  lucro,
}: {
  gran: Gran;
  periodKey: string;
  periodLabel: string;
  /** "Lucro (caixa)" do período, já calculado pelo backend. Só é lido aqui. */
  lucro: number;
}) {
  const [linhas, setLinhas] = useState<RetiradaLinha[]>([]);
  const [tabelaAusente, setTabelaAusente] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [valor, setValor] = useState("");
  const [socio, setSocio] = useState<string>(SOCIOS[0]);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/retiradas?gran=${gran}&key=${periodKey}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao carregar retiradas");
      const data = json as Resposta;
      setLinhas(data.retiradas ?? []);
      setTabelaAusente(!!data.tabelaAusente);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar retiradas");
    } finally {
      setCarregando(false);
    }
  }, [gran, periodKey]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/v1/admin/retiradas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor, socio }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao registrar a retirada");
      // Recalcula NA HORA (sem esperar o refetch): a linha criada entra na
      // lista e o "Em caixa" abaixo já sai atualizado.
      const criada = json.retirada as RetiradaLinha;
      setLinhas((prev) => [criada, ...prev.filter((l) => l.id !== criada.id)]);
      setValor("");
      // E confirma contra o servidor (pega a ordenação/o período corretos).
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar a retirada");
    } finally {
      setSalvando(false);
    }
  }

  const total = totalRetiradas(linhas);
  const restante = emCaixa(lucro, linhas);
  const negativo = restante < 0;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ash)]">
          Retiradas dos sócios · {periodLabel}
        </h3>
        <Wallet className="size-4 text-[var(--ash)]" />
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-[var(--ash)]">
        Retirada não é despesa: não entra em &quot;Saiu (gastos)&quot; e não muda o &quot;Lucro (caixa)&quot; —
        é lucro sendo distribuído. O que ela muda é só o &quot;Em caixa&quot; aqui embaixo.
      </p>

      {tabelaAusente && (
        <p className="rounded-[var(--radius)] border border-[var(--status-warn)]/40 px-3 py-2 font-mono text-[11px] text-[var(--status-warn)]">
          ⚠ A tabela de retiradas ainda não existe no banco — rode
          {" "}<code>scripts/108_retiradas_socios.sql</code>. Até lá esta lista fica vazia (nenhum outro
          número do painel é afetado).
        </p>
      )}

      {/* Lista do período */}
      {carregando ? (
        <div className="h-10 animate-pulse rounded-[var(--radius)] bg-[var(--hairline-strong)]/40" />
      ) : linhas.length === 0 ? (
        <p className="font-mono text-[12px] text-[var(--ash)]">nenhuma retirada no período</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--hairline-strong)]">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <span className="text-[13px] text-[var(--body)]">{l.socio}</span>
              <span className="font-mono text-[11px] text-[var(--ash)]">
                {dia(l.retirada_em)} · {l.origem}
                {l.registrado_por ? ` · ${l.registrado_por}` : ""}
              </span>
              <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                {brl2(Number(l.valor) || 0)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Total retirado + Em caixa */}
      <div className="flex flex-col gap-2 border-t border-[var(--hairline-strong)] pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
            Total retirado ({linhas.length})
          </span>
          <span className="font-mono text-[14px] font-semibold tabular-nums text-[var(--ink)]">{brl2(total)}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">Em caixa</span>
            <span className="font-mono text-[11px] text-[var(--ash)]">
              lucro {brl2(lucro)} − retiradas {brl2(total)}
            </span>
          </div>
          <span
            className={`font-sans text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${
              negativo ? "text-[var(--status-error)]" : "text-[var(--status-online)]"
            }`}
          >
            {brl2(restante)}
          </span>
        </div>
      </div>

      {/* Registrar retirada */}
      <form onSubmit={registrar} className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline-strong)] pt-4">
        <label className="sr-only" htmlFor="retirada-valor">Valor da retirada</label>
        <input
          id="retirada-valor"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          placeholder="2.947,00"
          disabled={salvando}
          className="w-36 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-transparent px-3 py-2 font-mono text-[13px] tabular-nums text-[var(--ink)] outline-none placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)]"
        />
        <label className="sr-only" htmlFor="retirada-socio">Sócio</label>
        <select
          id="retirada-socio"
          value={socio}
          onChange={(e) => setSocio(e.target.value)}
          disabled={salvando}
          className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 font-mono text-[13px] text-[var(--ink)] outline-none focus:border-[var(--hairline-bright)]"
        >
          {SOCIOS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={salvando || !valor.trim()}
          className="rounded-[var(--radius)] border border-[var(--hairline-bright)] px-4 py-2 font-mono text-[12px] uppercase tracking-wider text-[var(--ink)] transition-colors hover:bg-[var(--hairline-strong)]/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando ? "salvando…" : "OK"}
        </button>
        <span className="font-mono text-[11px] text-[var(--ash)]">origem: Hotmart</span>
      </form>

      {erro && (
        <p className="font-mono text-[11px] text-[var(--status-error)]">{erro}</p>
      )}
    </div>
  );
}
