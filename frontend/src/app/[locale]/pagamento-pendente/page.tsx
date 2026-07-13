import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, Eyebrow } from "@/components/ui";

/**
 * Tela de PÓS-VENDA (redirect da Hotmart) para compras AGUARDANDO confirmação:
 * "aguardando pagamento" (boleto/Pix não pago) e "aguardando análise de crédito"
 * (cartão em análise). Pública.
 *
 * Aqui o pagamento ainda NÃO foi aprovado → não há acesso a liberar. Em vez de
 * jogar a pessoa no app (e bater no paywall), explicamos que está processando e
 * que o acesso é liberado sozinho pelo webhook quando a Hotmart aprovar.
 */
export default async function PagamentoPendentePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "misc.paymentPending" });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <header className="flex flex-col gap-4">
        <Eyebrow className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--silver)]" />
          {t("eyebrow")}
        </Eyebrow>
        <h1 className="font-display text-6xl leading-[0.95] tracking-[-0.03em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t.rich("intro", {
            strong: (chunks) => (
              <strong className="font-medium text-[var(--ink)]">{chunks}</strong>
            ),
          })}
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ash)]">
          {t("howLong")}
        </h2>
        <ul className="flex flex-col gap-3 text-sm text-[var(--ink)]">
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 font-mono text-[var(--silver)]">
              {t("pixLabel")}
            </span>
            <span>{t("pixDesc")}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 font-mono text-[var(--silver)]">
              {t("boletoLabel")}
            </span>
            <span>{t("boletoDesc")}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 font-mono text-[var(--silver)]">
              {t("cardLabel")}
            </span>
            <span>{t("cardDesc")}</span>
          </li>
        </ul>
      </Card>

      <p className="text-center font-mono text-[11px] text-[var(--ash)]">
        {t("confirmedQuestion")}{" "}
        <Link
          href="/login"
          className="text-[var(--silver)] underline-offset-2 hover:underline"
        >
          {t("loginLink")}
        </Link>
        {" · "}
        {t("questions")}{" "}
        <a
          href="mailto:suporte@fastcloner.com"
          className="text-[var(--silver)] underline-offset-2 hover:underline"
        >
          suporte@fastcloner.com
        </a>
      </p>
    </main>
  );
}
