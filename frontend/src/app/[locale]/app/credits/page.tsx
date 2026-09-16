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
    .select("email, credits_subscription, credits_extra, access_until, access_source")
    .eq("id", user.id)
    .single();

  const subscription = profile?.credits_subscription ?? 0;
  const extra = profile?.credits_extra ?? 0;
  const email = profile?.email ?? user.email ?? null;
  const unlimited = bypassesBilling(email);
  // Assinatura ativa (equipe/allowlist conta como ativa). Só assinante compra avulso.
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null, profile?.access_source ?? null);
  /** O que a pessoa TEM. É isto que decide o que a tela mostra — não a assinatura. */
  const total = subscription + extra;

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

      {/* Saldo aparece pra QUEM TEM SALDO, com assinatura ativa ou sem.
          A premissa antiga ("não-assinante é 0/0") era falsa. Medido em 16/09:
          417 contas sem assinatura vigente somam 37.230.222 créditos, e 102
          delas são de gente que PAGOU. A tela escondia o saldo dessas pessoas e
          ainda dizia "Assine para liberar seus créditos" — o oposto da regra da
          casa (REGRA_FINAL_CREDITO, fechada pelo Johnny): quem pagou usa o que
          tem ATÉ ACABAR, sem trava e sem confisco.
          O motor sempre esteve certo: o portão real é SALDO, não assinatura
          (voice-cloning/page.tsx: creditsTotal >= COST). Quem mentia era a TELA. */}
      {(unlimited || subscribed || total > 0) && (
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

      {/* Sem assinatura E SEM SALDO: aí sim, o convite de assinar é honesto. */}
      {!unlimited && !subscribed && total === 0 && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Assine para liberar seus créditos
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            Neste caso de geração de áudio, cada caractere usa 1 crédito. Com o
            plano você recebe 100.000 créditos todo mês para treinar vozes e
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

      {/* SEM assinatura vigente, MAS COM SALDO. Este caso não existia na tela, e
          é o mais numeroso: 417 contas, 37.230.222 créditos (medido 16/09).
          O que estas pessoas liam era "Assine para liberar seus créditos", como
          se o saldo estivesse preso. Não está: o portão é saldo, e elas podem
          gerar normalmente. Aqui o convite é pra RECEBER MAIS, nunca pra
          destravar o que já é delas. */}
      {!unlimited && !subscribed && total > 0 && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Seus créditos continuam valendo
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            Você pode usar o saldo que já tem até acabar — ele não expira e não
            depende de assinatura. Com o plano ativo, você volta a receber
            100.000 créditos novos todo mês.
          </p>
          <Link
            href={`/${locale}/planos`}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            Ver planos
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
