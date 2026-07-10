import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { isAdmin } from "@/lib/admin/guard";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { Eyebrow } from "@/components/ui";

/**
 * Vídeo Estúdio — F0 (áudio impecável): grave errando à vontade; a plataforma
 * corta as tentativas repetidas, encolhe as pausas e devolve o áudio limpo com
 * transcrição. Fases seguintes montam o vídeo em cima deste áudio.
 *
 * GATE (crédito é o único gate): sem o mínimo, a ferramenta trava com CTA.
 */
export default async function VideoStudioPage({
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

  const email = profile?.email ?? user.email ?? null;

  // 🚧 PRÉ-PRODUÇÃO: só admin acessa até o Lucas validar. Liberar = remover
  // este guard + mover o item do menu pro grupo Vídeos (sidebar.tsx).
  if (!(await isAdmin(email))) redirect(`/${locale}/app/dashboard`);
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const canUse = team || creditsTotal >= STUDIO_CLEAN_COST;

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Vídeos</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Vídeo Estúdio
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Grave sua fala sem medo de errar — repita a frase quantas vezes quiser.
          A gente corta os erros, encolhe as pausas e devolve o áudio limpo,
          pronto pra virar vídeo.
        </p>
      </header>

      {canUse ? (
        <StudioWorkspace creditsTotal={creditsTotal} unlimited={team} />
      ) : (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            <Lock className="h-5 w-5 text-[var(--silver)]" />
            {subscribed
              ? "Créditos insuficientes para usar o Vídeo Estúdio"
              : "Assine para usar o Vídeo Estúdio"}
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            {subscribed
              ? `Preparar um áudio custa ${STUDIO_CLEAN_COST.toLocaleString("pt-BR")} créditos e você tem ${creditsTotal.toLocaleString("pt-BR")}. Compre um pacote para continuar.`
              : "Você não tem um plano vigente. O Vídeo Estúdio consome créditos do plano: assine para liberar seus créditos mensais."}
          </p>
          <Link
            href={subscribed ? `/${locale}/app/credits` : `/${locale}/planos`}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
          >
            {subscribed ? "Comprar créditos" : "Assinar agora"}
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}
    </div>
  );
}
