import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Clock } from "lucide-react";
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <header className="flex flex-col gap-4">
        <Eyebrow className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--silver)]" />
          Pagamento em processamento
        </Eyebrow>
        <h1 className="font-display text-6xl leading-[0.95] tracking-[-0.03em] text-[var(--ink)]">
          Quase lá!
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Recebemos o seu pedido. Assim que o pagamento for confirmado, o seu
          acesso é liberado{" "}
          <strong className="font-medium text-[var(--ink)]">automaticamente</strong>{" "}
          e você recebe um e-mail de confirmação.
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ash)]">
          Quanto tempo leva?
        </h2>
        <ul className="flex flex-col gap-3 text-sm text-[var(--ink)]">
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 font-mono text-[var(--silver)]">Pix</span>
            <span>confirmação costuma sair em alguns minutos.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 font-mono text-[var(--silver)]">
              Boleto
            </span>
            <span>pode levar até alguns dias úteis após o pagamento.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-14 shrink-0 font-mono text-[var(--silver)]">
              Cartão
            </span>
            <span>em análise antifraude — normalmente sai em minutos.</span>
          </li>
        </ul>
      </Card>

      <p className="text-center font-mono text-[11px] text-[var(--ash)]">
        Já recebeu a confirmação?{" "}
        <Link
          href={`/${locale}/login`}
          className="text-[var(--silver)] underline-offset-2 hover:underline"
        >
          Entrar
        </Link>
        {" · "}Dúvidas:{" "}
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
