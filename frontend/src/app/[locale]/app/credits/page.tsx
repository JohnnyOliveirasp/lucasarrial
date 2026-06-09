import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BuyCredits } from "@/components/app/buy-credits";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";

/**
 * Página de créditos: saldo + compra de pacotes avulsos (Stripe).
 * A entrada na plataforma é livre, então NÃO-assinantes também chegam aqui:
 * nesse caso mostramos o convite pra assinar (avulso é complemento do plano,
 * não porta de entrada — regra travada com o Lucas). Os pacotes só aparecem
 * pra quem tem assinatura ativa (a rota de checkout também barra com 403).
 */
export default async function CreditsPage({
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
  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, credits_subscription, credits_extra, access_until")
    .eq("id", user.id)
    .single();

  const subscription = profile?.credits_subscription ?? 0;
  const extra = profile?.credits_extra ?? 0;
  const email = profile?.email ?? user.email ?? null;
  const unlimited = bypassesBilling(email);
  // Assinatura ativa (equipe/allowlist conta como ativa). Só assinante compra avulso.
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          Seus créditos
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Créditos são a sua moeda dentro da plataforma: você usa para clonar
          vozes, gerar áudio e, em breve, criar vídeos e posts automáticos.
        </p>
      </header>

      {/* Saldo: só faz sentido pra assinante/equipe. Não-assinante (0/0) só vê
          o convite pra assinar abaixo. */}
      {(unlimited || subscribed) && (
      <section className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
        <div className="flex flex-col gap-1 bg-bg p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-fg">
            Do plano (recarrega no ciclo)
          </span>
          <span className="font-display text-4xl tracking-tight text-fg">
            {unlimited ? "∞" : subscription.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-bg p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-fg">
            Avulsos (não expiram)
          </span>
          <span className="font-display text-4xl tracking-tight text-fg">
            {unlimited ? "∞" : extra.toLocaleString("pt-BR")}
          </span>
        </div>
      </section>
      )}

      {/* Sem assinatura: avulso é complemento do plano → convida a assinar. */}
      {!unlimited && !subscribed && (
        <section className="flex flex-col gap-4 border border-accent bg-accent/5 p-6">
          <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
            Assine para liberar seus créditos
          </h2>
          <p className="max-w-xl text-sm text-muted-fg">
            Neste caso de geração de áudio, cada caractere usa 1 crédito. Com o
            plano você recebe 180.000 créditos todo mês para treinar vozes e
            gerar áudio.
          </p>
          <Link
            href={`/${locale}/planos`}
            className="flex w-fit items-center gap-2 bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            Assinar agora →
          </Link>
        </section>
      )}

      {/* Assinante: compra de pacotes avulsos (Stripe). */}
      {!unlimited && subscribed && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
            Comprar créditos
          </h2>
          <BuyCredits />
        </section>
      )}
    </div>
  );
}
