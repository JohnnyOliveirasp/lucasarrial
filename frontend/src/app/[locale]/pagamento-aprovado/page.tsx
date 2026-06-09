import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctaHref = user
    ? `/${locale}/app/dashboard`
    : `/${locale}/login?redirectTo=/${locale}/app/dashboard`;
  const ctaLabel = user ? "Ir para a plataforma →" : "Entrar para acessar →";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <header className="flex flex-col gap-4">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          <CheckCircle2 className="h-4 w-4" />
          Pagamento aprovado
        </span>
        <h1 className="font-display text-6xl leading-[0.9] tracking-tight text-fg uppercase">
          Tudo certo,
          <br />
          bem-vindo!
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Recebemos a confirmação da sua compra. O acesso é liberado
          automaticamente em instantes — basta entrar com o{" "}
          <strong className="text-fg">mesmo e-mail que você usou na compra</strong>.
        </p>
      </header>

      <section className="flex flex-col gap-6 border border-accent bg-accent/5 p-8">
        <ol className="flex flex-col gap-4 text-sm text-fg">
          <li className="flex items-start gap-3">
            <span className="font-mono text-accent">1.</span>
            <span>Clique no botão abaixo e entre com o Google.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-accent">2.</span>
            <span>
              Use o <strong>mesmo e-mail</strong> da compra — é por ele que
              liberamos o seu acesso e os seus créditos.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-accent">3.</span>
            <span>Pronto: clone a sua voz e comece a gerar áudio.</span>
          </li>
        </ol>

        <Link
          href={ctaHref}
          className="flex w-full items-center justify-center bg-fg px-6 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-bg transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent"
        >
          {ctaLabel}
        </Link>
      </section>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
        Acabou de pagar e ainda não liberou? Aguarde alguns instantes e atualize.
        Persistindo, fale com{" "}
        <a href="mailto:contact@jcsolutionsus.com" className="text-accent">
          contact@jcsolutionsus.com
        </a>
        .
      </p>
    </main>
  );
}
