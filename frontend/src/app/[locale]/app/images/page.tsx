import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling } from "@/lib/credits/access";
import { ImageWorkspace } from "@/components/image/image-workspace";
import { Eyebrow } from "@/components/ui";

/**
 * Gerador de Imagem (clone) — image-to-image via Kie. Tela única: o gerador no
 * topo e o histórico de imagens logo abaixo (ver, renomear, baixar, apagar).
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
    .select("email, credits_subscription, credits_extra")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? null;
  const unlimited = bypassesBilling(email);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);

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

      <ImageWorkspace creditsTotal={creditsTotal} unlimited={unlimited} />
    </div>
  );
}
