import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BuyCredits } from "@/components/app/buy-credits";
import { bypassesBilling } from "@/lib/credits/access";

/**
 * Página de créditos: saldo + compra de pacotes avulsos (Stripe).
 * Protegida pelo gate de assinatura no layout do /app — só assinante (ou
 * equipe) chega aqui, então a compra de avulso é sempre de quem já assina.
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
    .select("email, credits_subscription, credits_extra")
    .eq("id", user.id)
    .single();

  const subscription = profile?.credits_subscription ?? 0;
  const extra = profile?.credits_extra ?? 0;
  const unlimited = bypassesBilling(profile?.email ?? user.email);

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Créditos
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          Seus créditos
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Use créditos para clonar vozes e gerar áudio. Seu plano recarrega todo
          mês; se precisar de mais antes da virada, compre um pacote avulso.
        </p>
      </header>

      {/* Saldo */}
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

      {/* Comprar */}
      {!unlimited && (
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
