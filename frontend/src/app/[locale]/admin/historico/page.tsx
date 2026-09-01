import { Search } from "lucide-react";
import { notFound } from "next/navigation";
import { getHistory } from "@/lib/admin/queries";
import { getAdminContext } from "@/lib/admin/guard";
import { HistoryTabs } from "@/components/admin/history-tabs";

export const dynamic = "force-dynamic";

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Esta página lê o banco DIRETO (não passa por /api/v1/admin/*), então a
  // trava de papel precisa estar aqui — o gate da API não a cobre (mig 95).
  const ctx = await getAdminContext();
  if (ctx?.role !== "admin") notFound();

  // Filtro por e-mail (mig 57, pedido Johnny 02/08): ?q=parte-do-email —
  // acha a voz/geração/pagamento de uma pessoa sem rolar os "últimos 40".
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const data = await getHistory(40, query || undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">Históricos</h1>
          <p className="mt-1 text-[14px] text-[var(--mute)]">
            {query
              ? `Eventos de "${query}" — clonagem, geração e pagamentos.`
              : "Últimos eventos de clonagem, geração e pagamentos."}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ash)]" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Filtrar por e-mail…"
              className="h-10 w-64 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] pl-9 pr-3 font-sans text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 font-sans text-[13px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)]"
          >
            Buscar
          </button>
          {query && (
            <a
              href="?"
              className="font-mono text-[11px] uppercase tracking-wide text-[var(--mute)] hover:text-[var(--ink)]"
            >
              limpar
            </a>
          )}
        </form>
      </div>
      <HistoryTabs data={data} />
    </div>
  );
}
