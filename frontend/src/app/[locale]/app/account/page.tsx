import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CancelSubscription } from "@/components/app/cancel-subscription";
import { DeleteAccount } from "@/components/app/delete-account";
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
    .select("email, display_name, avatar_url, access_until, access_source, plan")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? "";
  const displayName = profile?.display_name ?? email.split("@")[0];
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const accessUntil = profile?.access_until
    ? new Date(profile.access_until).toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          Minha conta
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Seus dados e a gestão da sua assinatura.
        </p>
      </header>

      {/* Conta */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-fg">
          Conta
        </h2>
        <div className="flex items-center gap-4 border border-border bg-surface p-5">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar do provider OAuth (Google)
            <img src={profile.avatar_url} alt="" className="h-12 w-12 object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center bg-accent font-mono text-sm font-bold text-accent-fg">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">{displayName}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-fg">
              {email}
            </span>
          </div>
        </div>
      </section>

      {/* Assinatura */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-fg">
          Assinatura
        </h2>

        {team ? (
          <p className="border border-border bg-surface p-5 text-sm text-muted-fg">
            Acesso de cortesia (equipe) — sem assinatura paga.
          </p>
        ) : subscribed ? (
          <div className="flex flex-col gap-4 border border-border bg-surface p-5">
            <div className="flex flex-col gap-1">
              <span className="font-display text-2xl uppercase tracking-tight text-fg">
                Plano ativo
              </span>
              {accessUntil && (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-fg">
                  Acesso garantido até {accessUntil}
                </span>
              )}
            </div>
            <CancelSubscription />
          </div>
        ) : (
          <div className="flex flex-col gap-4 border border-accent bg-accent/5 p-5">
            <p className="text-sm text-muted-fg">
              Você não tem uma assinatura ativa. Assine para liberar a plataforma
              e receber 180.000 créditos por mês.
            </p>
            <Link
              href={`/${locale}/planos`}
              className="flex w-fit items-center gap-2 bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Assinar agora →
            </Link>
          </div>
        )}
      </section>

      {/* Zona perigosa — exclusão definitiva da conta. */}
      <DeleteAccount email={email} />
    </div>
  );
}
