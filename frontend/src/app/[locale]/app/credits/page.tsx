import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BuyCredits } from "@/components/app/buy-credits";
import { Eyebrow, Stat } from "@/components/ui";
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
        <Eyebrow>Créditos</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Seus créditos
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Créditos são a sua moeda dentro da plataforma: você usa para clonar
          vozes, gerar áudio e, em breve, criar vídeos e posts automáticos.
        </p>
      </header>

      {/* Saldo: só faz sentido pra assinante/equipe. Não-assinante (0/0) só vê
          o convite pra assinar abaixo. */}
      {(unlimited || subscribed) && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
            <Stat
              label="Do plano (recarrega no ciclo)"
              value={unlimited ? "∞" : subscription.toLocaleString("pt-BR")}
            />
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
            <Stat
              label="Avulsos (não expiram)"
              value={unlimited ? "∞" : extra.toLocaleString("pt-BR")}
            />
          </div>
        </section>
      )}

      {/* Sem assinatura: avulso é complemento do plano → convida a assinar. */}
      {!unlimited && !subscribed && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Assine para liberar seus créditos
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            Neste caso de geração de áudio, cada caractere usa 1 crédito. Com o
            plano você recebe 180.000 créditos todo mês para treinar vozes e
            gerar áudio.
          </p>
          <Link
            href={`/${locale}/planos`}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            Assinar agora
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}

      {/* Assinante: compra de pacotes avulsos (Stripe). */}
      {!unlimited && subscribed && (
        <section className="flex flex-col gap-4">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Comprar créditos
          </h2>
          <BuyCredits />
        </section>
      )}
    </div>
  );
}
