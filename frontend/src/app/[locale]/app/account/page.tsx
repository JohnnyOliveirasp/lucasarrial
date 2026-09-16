import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CancelSubscription } from "@/components/app/cancel-subscription";
import { ChangePassword } from "@/components/app/change-password";
import { DeleteAccount } from "@/components/app/delete-account";
import { Eyebrow } from "@/components/ui";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";

/**
 * Tela da CONTA do usuário (acessada pelo menu do perfil, no topo).
 * É aqui que mora a gestão da ASSINATURA (status do plano + cancelar) — separado
 * da tela de Configurações/API. Padrão ElevenLabs/HeyGen ("Minha conta").
 */
export default async function AccountPage({
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
    .select(
      "email, display_name, avatar_url, access_until, access_source, plan, credits_subscription, credits_extra",
    )
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? "";
  const displayName = profile?.display_name ?? email.split("@")[0];
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null, profile?.access_source ?? null);
  /** O que a pessoa TEM. Mesma conta de voice-cloning/page.tsx e credits/page.tsx. */
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const accessUntil = profile?.access_until
    ? new Date(profile.access_until).toLocaleDateString("pt-BR")
    : null;

  // Só quem entrou com e-mail+senha tem senha NOSSA pra trocar. Conta de Google
  // não tem — mostrar o campo pra ela só criaria chamado novo. O Supabase
  // guarda a lista de provedores em app_metadata.providers (e o último usado em
  // app_metadata.provider); quem vinculou os dois tem "email" na lista e cai
  // certo no true.
  const providers = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata.providers as string[])
    : user.app_metadata?.provider
      ? [user.app_metadata.provider as string]
      : [];
  const hasEmailPassword = providers.includes("email");

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <Eyebrow>Conta</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Minha conta
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Seus dados e a gestão da sua assinatura.
        </p>
      </header>

      {/* Conta */}
      <section className="flex flex-col gap-4">
        <Eyebrow className="text-[var(--ash)]">Conta</Eyebrow>
        <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar do provider OAuth (Google)
            <img
              src={profile.avatar_url}
              alt=""
              className="h-12 w-12 rounded-[var(--radius-full)] object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--surface-raised)] text-sm font-semibold text-[var(--silver)]">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium text-[var(--ink)]">
              {displayName}
            </span>
            <span className="break-all font-mono text-xs lowercase text-[var(--mute)]">
              {email}
            </span>
          </div>
        </div>
      </section>

      {/* Senha — só pra conta de e-mail (chamados #243/#244). */}
      {hasEmailPassword && <ChangePassword />}

      {/* Assinatura */}
      <section className="flex flex-col gap-4">
        <Eyebrow className="text-[var(--ash)]">Assinatura</Eyebrow>

        {team ? (
          <p className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 text-sm text-[var(--mute)]">
            Acesso de cortesia (equipe) — sem assinatura paga.
          </p>
        ) : subscribed ? (
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                Plano ativo
              </span>
              {accessUntil && (
                <span className="text-[13px] text-[var(--mute)]">
                  Acesso garantido até {accessUntil}
                </span>
              )}
            </div>
            <CancelSubscription />
          </div>
        ) : creditsTotal === 0 ? (
          /* Sem assinatura E SEM SALDO: aqui o convite de assinar é honesto,
             porque de fato não há o que usar. */
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
            <p className="text-sm text-[var(--mute)]">
              Você não tem uma assinatura ativa. Assine para liberar a plataforma
              e receber 100.000 créditos por mês.
            </p>
            <Link
              href={`/${locale}/planos`}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              Assinar agora
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          /* SEM assinatura vigente, MAS COM SALDO. Este caso não existia nesta
             tela, e ela era a última superfície que ainda mentia: dizia "Assine
             para liberar a plataforma" a quem já podia gerar. A plataforma NÃO
             está trancada — o portão do motor é SALDO, não assinatura
             (voice-cloning/page.tsx: canTrain = team || creditsTotal >= COST),
             e a regra da casa (REGRA_FINAL_CREDITO, fechada pelo Johnny em
             20/08) é: parou de pagar, não recebe créditos NOVOS e usa os que
             tem até acabar — sem trava e sem confisco.
             credits/page.tsx já foi corrigida assim (commit 1acf147); aqui
             reaproveitamos a mesma linguagem pra casa falar igual. O convite é
             pra RECEBER MAIS, nunca pra "liberar" o que já é da pessoa. */
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                Seus créditos continuam valendo
              </span>
              <span className="text-[13px] text-[var(--mute)]">
                Sem assinatura ativa no momento.
              </span>
            </div>
            <p className="text-sm text-[var(--mute)]">
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
          </div>
        )}
      </section>

      {/* Ponte pra API (aluno alfredo.sabocinski, 06/09): ele procurou a chave
          de API AQUI, em "Minha conta", que é onde a intuição manda olhar. Ela
          mora em /app/settings, e o rótulo daquele item no menu lateral
          ("Configurações") não diz "API" em nenhum dos 3 idiomas — por isso
          ninguém acha. Ponteiro, e não mudança de lugar: a API é liberada por
          CRÉDITO (settings/page.tsx) e esta tela abre pra qualquer logado, então
          trazer a seção pra cá arrastaria o gate junto e plantaria um segundo
          "Assine agora" encostado no da assinatura. */}
      <p className="text-[13px] text-[var(--mute)]">
        Procurando a API?{" "}
        <Link
          href={`/${locale}/app/settings`}
          className="text-[var(--silver)] underline-offset-4 transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:text-[var(--ink)] hover:underline"
        >
          Sua chave e a documentação ficam em Configurações
        </Link>
        .
      </p>

      {/* Zona perigosa — exclusão definitiva da conta. */}
      <DeleteAccount email={email} />
    </div>
  );
}
