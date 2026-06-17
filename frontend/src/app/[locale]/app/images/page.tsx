import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { IMAGE_MIN_CREDITS } from "@/lib/kie/config";
import { ImageWorkspace } from "@/components/image/image-workspace";
import { ImageHistory } from "@/components/image/image-history";
import { Eyebrow } from "@/components/ui";

/**
 * Gerador de Imagem (clone) — image-to-image via Kie. Tela única: o gerador no
 * topo e o histórico de imagens logo abaixo (ver, renomear, baixar, apagar).
 *
 * GATE (igual ao "Gerar Voz"): gerar imagem consome crédito. Sem o mínimo
 * (IMAGE_MIN_CREDITS = custo do 1K), a ferramenta TRAVA — mostra um card de
 * cadeado com CTA pra comprar créditos/assinar. O histórico segue visível.
 */
export default async function ImagesPage({
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
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const canGenerate = team || creditsTotal >= IMAGE_MIN_CREDITS;

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Imagens</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Gerar Imagem
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Envie sua foto, descreva a cena e gere uma imagem sua em qualquer
          cenário — mantendo o seu rosto. Baixe ou guarde pra usar depois.
        </p>
      </header>

      {canGenerate ? (
        <ImageWorkspace creditsTotal={creditsTotal} unlimited={team} />
      ) : (
        <div className="flex flex-col gap-12">
          <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
            <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              <Lock className="h-5 w-5 text-[var(--silver)]" />
              {subscribed
                ? "Créditos insuficientes para gerar imagem"
                : "Assine para gerar imagens"}
            </h2>
            <p className="max-w-xl text-sm text-[var(--mute)]">
              {subscribed
                ? `Gerar uma imagem custa a partir de ${IMAGE_MIN_CREDITS} créditos (1K) e você tem ${creditsTotal.toLocaleString("pt-BR")}. Compre um pacote para continuar.`
                : "Você não tem um plano vigente. Gerar imagens consome créditos do plano: assine para liberar 100.000 créditos por mês e criar suas imagens."}
            </p>
            <Link
              href={subscribed ? `/${locale}/app/credits` : `/${locale}/planos`}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
            >
              {subscribed ? "Comprar créditos" : "Assinar agora"}
              <span aria-hidden>→</span>
            </Link>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              Suas imagens
            </h2>
            <ImageHistory />
          </section>
        </div>
      )}
    </div>
  );
}
