import Script from "next/script";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildHotmartCheckoutUrl } from "@/lib/payments/hotmart-checkout";
import { Card, Badge, Eyebrow } from "@/components/ui";

/**
 * Página de planos / checkout.
 *
 * O checkout em si é hospedado pela Hotmart — aqui mostramos a oferta e
 * mandamos o usuário pro checkout com e-mail/nome PRÉ-PREENCHIDOS (ver
 * buildHotmartCheckoutUrl). A URL base vem de NEXT_PUBLIC_HOTMART_CHECKOUT_URL
 * (o produtor passa o link da oferta). Enquanto o link não existir, o CTA
 * fica em estado "em breve" — a página já funciona, só falta o dado do produtor.
 *
 * TODO(conteúdo): preço e benefícios abaixo são placeholders — ajustar com os
 * valores reais do produto.
 */

export default async function PlanosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "misc.plans" });
  const tPro = await getTranslations({ locale, namespace: "pricing.tiers.pro" });
  const features = t.raw("features") as string[];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_URL ?? "";
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    null;

  // CTA tem 3 estados: comprar (logado + link pronto), logar (deslogado),
  // ou indisponível (produtor ainda não configurou o link).
  const checkoutUrl = base
    ? buildHotmartCheckoutUrl(base, { email: user?.email, name: displayName })
    : "";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-12 px-6 py-20">
      <div
        aria-hidden
        className="glow-voice pointer-events-none absolute inset-x-0 top-0 h-[420px]"
      />

      <header className="relative flex flex-col gap-3">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-display text-6xl leading-[0.95] tracking-[-0.03em] text-[var(--ink)]">
          {t("titleLine1")}
          <br />
          {t("titleLine2")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">{t("tagline")}</p>
      </header>

      <Card elevated className="relative border-[var(--hairline-bright)] p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--hairline)] p-8">
          <Badge variant="soft" className="w-fit">
            {t("planName")}
          </Badge>
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-5xl tracking-[-0.03em] text-[var(--ink)]">
              {tPro("price")}
            </span>
            <span className="font-mono text-sm text-[var(--ash)]">
              {tPro("cad")}
            </span>
          </div>
        </div>

        <ul className="flex flex-col gap-4 p-8">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-3 text-sm text-[var(--ink)]"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--silver)]" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-[var(--hairline)] p-8">
          {!user ? (
            <Link
              href={{
                pathname: "/login",
                query: { redirectTo: `/${locale}/planos` },
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              {t("loginCta")}
            </Link>
          ) : checkoutUrl ? (
            <>
              {/* Widget da Hotmart: abre o checkout em lightbox sem sair da página.
                  O script intercepta o clique no <a> via a classe hotmart__button-checkout;
                  se o script falhar, o href continua funcionando como fallback (redirect). */}
              <link
                rel="stylesheet"
                href="https://static.hotmart.com/css/hotmart-fb.min.css"
              />
              <Script
                src="https://static.hotmart.com/checkout/widget.min.js"
                strategy="afterInteractive"
              />
              <a
                href={checkoutUrl}
                className="hotmart-fb hotmart__button-checkout inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
              >
                {t("subscribeCta")}
              </a>
            </>
          ) : (
            <div className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[15px] font-medium text-[var(--ash)]">
              {t("comingSoon")}
            </div>
          )}
          {user && (
            <p className="mt-4 text-center font-mono text-[11px] text-[var(--ash)]">
              {t("linkedTo", { email: user.email ?? "" })}
            </p>
          )}
        </div>
      </Card>
    </main>
  );
}
