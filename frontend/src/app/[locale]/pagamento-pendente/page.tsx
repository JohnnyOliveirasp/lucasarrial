import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Clock } from "lucide-react";

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <header className="flex flex-col gap-4">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          <Clock className="h-4 w-4" />
          Pagamento em processamento
        </span>
        <h1 className="font-display text-6xl leading-[0.9] tracking-tight text-fg uppercase">
          Quase lá!
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Recebemos o seu pedido. Assim que o pagamento for confirmado, o seu
          acesso é liberado <strong className="text-fg">automaticamente</strong> e
          você recebe um e-mail de confirmação.
        </p>
      </header>

      <section className="flex flex-col gap-4 border border-border bg-surface p-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-fg">
          Quanto tempo leva?
        </h2>
        <ul className="flex flex-col gap-3 text-sm text-fg">
          <li className="flex items-start gap-3">
            <span className="font-mono text-accent">Pix</span>
            <span>confirmação costuma sair em alguns minutos.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-accent">Boleto</span>
            <span>pode levar até alguns dias úteis após o pagamento.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-accent">Cartão</span>
            <span>em análise antifraude — normalmente sai em minutos.</span>
          </li>
        </ul>
      </section>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
        Já recebeu a confirmação?{" "}
        <Link href={`/${locale}/login`} className="text-accent">
          Entrar
        </Link>
        {" · "}Dúvidas:{" "}
        <a href="mailto:contact@jcsolutionsus.com" className="text-accent">
          contact@jcsolutionsus.com
        </a>
      </p>
    </main>
  );
}
