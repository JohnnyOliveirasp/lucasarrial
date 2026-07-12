import { setRequestLocale } from "next-intl/server";
import { AgentPanel } from "@/components/admin/agent-panel";

/**
 * /admin/agente — Agente de suporte WhatsApp (F0: conexão + escuta).
 * O gate de admin está no layout do /admin (server-side, 404 pra não-admin).
 */
export default async function AdminAgentePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Agente — WhatsApp do suporte
        </h1>
        <p className="mt-1 text-sm text-[var(--mute)]">
          F0 (escuta): tudo que chega no número aparece aqui. A IA ainda não responde.
        </p>
      </div>
      <AgentPanel />
    </div>
  );
}
