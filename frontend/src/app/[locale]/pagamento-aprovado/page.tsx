import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, Eyebrow } from "@/components/ui";

/**
 * Tela de PÓS-VENDA (redirect da Hotmart em "compras aprovadas").
 * Pública — o comprador cai aqui logo após pagar, normalmente AINDA não logado.
 *
 * ⚠️ Esta página é só UX. Quem LIBERA o acesso de verdade é o webhook
 * (/api/v1/webhooks/hotmart), que a Hotmart chama servidor-pra-servidor e que
 * grava em entitlements + recarrega os créditos. Aqui só recebemos o navegador
 * e mandamos a pessoa logar com o MESMO e-mail da compra.
 */
export default async function PagamentoAprovadoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "misc.paymentApproved" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <div
        aria-hidden
        className="glow-stats pointer-events-none absolute inset-x-0 top-0 h-[420px]"
      />

      <header className="relative flex flex-col gap-4">
        <Eyebrow className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[var(--status-online)]" />
          {t("eyebrow")}
        </Eyebrow>
        <h1 className="font-display text-6xl leading-[0.95] tracking-[-0.03em] text-[var(--ink)]">
          {t("titleLine1")}
          <br />
          {t("titleLine2")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t.rich("intro", {
            strong: (chunks) => (
              <strong className="font-medium text-[var(--ink)]">{chunks}</strong>
            ),
          })}
        </p>
      </header>

      <Card elevated className="flex flex-col gap-6">
        <ol className="flex flex-col gap-4 text-sm text-[var(--ink)]">
          <li className="flex items-start gap-3">
            <span className="font-mono text-[var(--silver)]">1.</span>
            <span>{t("step1")}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-[var(--silver)]">2.</span>
            <span>
              {t.rich("step2", {
                strong: (chunks) => (
                  <strong className="font-medium">{chunks}</strong>
                ),
              })}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-[var(--silver)]">3.</span>
            <span>{t("step3")}</span>
          </li>
        </ol>

        <Link
          href={
            user
              ? "/app/dashboard"
              : {
                  pathname: "/login",
                  query: { redirectTo: `/${locale}/app/dashboard` },
                }
          }
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
        >
          {user ? t("ctaDashboard") : t("ctaLogin")}
        </Link>
      </Card>

      <p className="text-center font-mono text-[11px] text-[var(--ash)]">
        {t("supportHint")}{" "}
        <a
          href="mailto:suporte@fastcloner.com"
          className="text-[var(--silver)] underline-offset-2 hover:underline"
        >
          suporte@fastcloner.com
        </a>
        .
      </p>
    </main>
  );
}
