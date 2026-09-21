"use client";

/**
 * Paginação das tabelas do /admin/sgp (pedido do Johnny 21/09: "incluir
 * paginação, e scroll tanto para cima como para o lado").
 *
 * Por que existe: a fila renderizava as 598 linhas de uma vez, cada uma com 15
 * colunas e botões — a página ficava com metros de altura e o cabeçalho sumia
 * antes da terceira linha. Aqui a tabela ganha tamanho de tela e a navegação
 * vira explícita.
 *
 * O texto é "Mostrando X–Y de Z" de propósito: o time trabalha por contagem
 * ("faltam quantos?"), e só "página 3 de 12" esconderia esse número.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

export const TAMANHOS = [25, 50, 100, 200] as const;

export function Paginacao({
  total,
  pagina,
  porPagina,
  onPagina,
  onPorPagina,
}: {
  total: number;
  pagina: number;
  porPagina: number;
  onPagina: (p: number) => void;
  onPorPagina: (n: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const atual = Math.min(pagina, paginas);
  const primeiro = total === 0 ? 0 : (atual - 1) * porPagina + 1;
  const ultimo = Math.min(atual * porPagina, total);

  const botao =
    "inline-flex h-8 items-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 font-mono text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="font-mono text-[11px] text-[var(--ash)]">
        Mostrando {primeiro}–{ultimo} de {total}
      </span>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--ash)]">
          por página
          <select
            value={porPagina}
            onChange={(e) => {
              onPorPagina(Number(e.target.value));
              onPagina(1);
            }}
            className="h-8 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-2 font-mono text-[11px] text-[var(--ink)]"
          >
            {TAMANHOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className={botao} onClick={() => onPagina(atual - 1)} disabled={atual <= 1}>
          <ChevronLeft className="size-3.5" />
          anterior
        </button>
        <span className="font-mono text-[11px] tabular-nums text-[var(--mute)]">
          {atual} / {paginas}
        </span>
        <button type="button" className={botao} onClick={() => onPagina(atual + 1)} disabled={atual >= paginas}>
          próxima
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
