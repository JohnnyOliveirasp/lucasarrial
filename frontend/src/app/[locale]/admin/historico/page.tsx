import { getHistory } from "@/lib/admin/queries";
import { HistoryTabs } from "@/components/admin/history-tabs";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const data = await getHistory(40);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">Históricos</h1>
        <p className="mt-1 text-[14px] text-[var(--mute)]">
          Últimos eventos de clonagem, geração e pagamentos.
        </p>
      </div>
      <HistoryTabs data={data} />
    </div>
  );
}
