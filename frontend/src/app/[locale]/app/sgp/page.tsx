import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/db/admin";
import { statusOnboarding } from "@/lib/onboarding/pronto";
import { lerPedido } from "@/lib/sgp/pedido";

/**
 * /app/sgp — acompanhamento do pedido estilo iFood (decisão 29/08).
 * Lê o estado REAL (voz + clone de foto) pelo mesmo `statusOnboarding` da
 * planilha; o aluno pode esperar aqui ou fechar — o e-mail avisa quando
 * cada etapa termina. Versão inicial (PR 4); o PR 6 refina.
 */
export const dynamic = "force-dynamic";

type Etapa = { chave: string; estado: "feito" | "andamento" | "espera" | "falhou" };

export default async function AppSgpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login", locale });
  const pedido = await lerPedido(user!.id);
  if (!pedido) redirect({ href: "/sgp", locale });
  if (["dados", "foto", "audio", "revisao"].includes(pedido!.status)) redirect({ href: "/sgp", locale });

  const t = await getTranslations({ locale, namespace: "sgp.acompanhar" });
  const s = await statusOnboarding(getAdmin(), user!.id);

  const fotoPronta = s.avatares_total > 0 && s.avatares_prontos >= 1;
  const vozPronta = s.voz === "ready";
  const vozFalhou = s.voz === "failed" || s.voz === "rejected_too_short";
  const etapas: Etapa[] = [
    { chave: "recebido", estado: "feito" },
    { chave: "foto", estado: fotoPronta ? "feito" : s.avatares_total > 0 ? "andamento" : "espera" },
    { chave: "voz", estado: vozPronta ? "feito" : vozFalhou ? "falhou" : s.voz === "training" || s.voz === "awaiting_training" ? "andamento" : "espera" },
    { chave: "pronto", estado: s.pronto ? "feito" : s.falhou ? "falhou" : "espera" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--silver)]">{t("selo")}</span>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{t("titulo")}</h1>
        <p className="text-[14px] leading-[1.5] text-[var(--mute)]">{s.pronto ? t("descricaoPronto") : t("descricao")}</p>
      </header>

      <ol className="flex flex-col gap-3">
        {etapas.map((e, i) => (
          <li key={e.chave} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3.5">
            <span className={[
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
              e.estado === "feito" ? "bg-emerald-500/15 text-emerald-400" :
              e.estado === "andamento" ? "bg-[var(--pill-bg)] text-[var(--pill-ink)] animate-pulse" :
              e.estado === "falhou" ? "bg-red-500/15 text-red-400" : "border border-[var(--hairline-strong)] text-[var(--ash)]",
            ].join(" ")}>
              {e.estado === "feito" ? "✓" : e.estado === "falhou" ? "!" : i + 1}
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] font-medium text-[var(--ink)]">{t(`etapas.${e.chave}.titulo`)}</p>
              <p className="text-[12px] text-[var(--silver)]">{t(`etapas.${e.chave}.${e.estado}`)}</p>
            </div>
          </li>
        ))}
      </ol>

      {pedido!.erro ? (
        <p className="rounded-[var(--radius)] border border-[var(--status-error)] px-3.5 py-2.5 text-[13px] text-[var(--status-error)]">{t("erroTime")}</p>
      ) : null}

      <p className="text-[13px] text-[var(--mute)]">{t("podeFechar")}</p>
      {s.pronto ? (
        <Link href="/app/dashboard" className="inline-flex h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] text-[14px] font-medium text-[var(--pill-ink)]">{t("irParaPlataforma")}</Link>
      ) : null}
    </div>
  );
}
