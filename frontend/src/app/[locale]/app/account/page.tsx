import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CancelSubscription } from "@/components/app/cancel-subscription";
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
        ) : (
          <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
            <p className="text-sm text-[var(--mute)]">
              Você não tem uma assinatura ativa. Assine para liberar a plataforma
              e receber 180.000 créditos por mês.
            </p>
            <Link
              href={`/${locale}/planos`}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              Assinar agora
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
      </section>

      {/* Zona perigosa — exclusão definitiva da conta. */}
      <DeleteAccount email={email} />
    </div>
  );
}
