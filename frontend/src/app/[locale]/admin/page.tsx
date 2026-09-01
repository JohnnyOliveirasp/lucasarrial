import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/admin/dashboard-client";
import { getAdminContext } from "@/lib/admin/guard";
import { homeFor } from "@/lib/admin/nav";

export const dynamic = "force-dynamic";

/**
 * Visão geral = dinheiro (caixa, lucro, faturamento). Papel `suporte` não vê
 * isso (mig 95): manda direto pra tela onde ele trabalha, sem piscar o painel.
 */
export default async function AdminOverviewPage() {
  const ctx = await getAdminContext();
  if (ctx && ctx.role !== "admin") redirect(homeFor(ctx.role));
  return <DashboardClient />;
}
