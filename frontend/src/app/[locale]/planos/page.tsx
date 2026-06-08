import Link from "next/link";
import Script from "next/script";
import { setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buildHotmartCheckoutUrl } from "@/lib/payments/hotmart-checkout";

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

const PLAN = {
  name: "Acesso Completo",
  tagline: "Clonagem de voz com IA, ilimitada para o seu conteúdo.",
  price: "R$ 97",
  period: "/mês",
  features: [
    "Clone a sua voz com poucos minutos de áudio",
    "Geração de áudio ilimitada",
    "API para integrar nos seus fluxos",
    "Histórico e download dos áudios",
    "7 dias de garantia — cancele e peça reembolso",
    "Suporte por e-mail",
  ],
};

export default async function PlanosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
  const loginHref = `/${locale}/login?redirectTo=/${locale}/planos`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-12 px-6 py-20">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Planos
        </span>
        <h1 className="font-display text-6xl leading-[0.9] tracking-tight text-fg uppercase">
          Assine e libere
          <br />
          a sua voz
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">{PLAN.tagline}</p>
      </header>

      <section className="border border-border bg-bg">
        <div className="flex flex-col gap-2 border-b border-border p-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-fg">
            {PLAN.name}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-5xl tracking-tight text-fg">
              {PLAN.price}
            </span>
            <span className="font-mono text-sm text-muted-fg">{PLAN.period}</span>
          </div>
        </div>

        <ul className="flex flex-col gap-4 p-8">
          {PLAN.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-fg">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border p-8">
          {!user ? (
            <Link
              href={loginHref}
              className="flex w-full items-center justify-center bg-fg px-6 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-bg transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent"
            >
              Entrar para assinar →
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
                className="hotmart-fb hotmart__button-checkout flex w-full items-center justify-center bg-fg px-6 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-bg transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent"
              >
                Assinar agora →
              </a>
            </>
          ) : (
            <div className="flex w-full cursor-not-allowed items-center justify-center bg-border px-6 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-muted-fg">
              Checkout em breve
            </div>
          )}
          {user && (
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
              Compra vinculada a {user.email}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
