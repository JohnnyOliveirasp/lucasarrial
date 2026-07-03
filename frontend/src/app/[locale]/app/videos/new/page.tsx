import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasActiveAccess } from "@/lib/credits/access";
import { AudioPicker } from "@/components/video/audio-picker";
import { Eyebrow } from "@/components/ui";

/**
 * Passo 1 do wizard de vídeo: escolher o áudio (TTS) que será a base.
 * Lista os áudios gerados do usuário com até 90s. Ao escolher, cria o projeto
 * e vai pro wizard (/app/videos/[id]).
 */
export default async function NewVideoPage({
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

  // Criar vídeo é recurso de assinante (equipe/admin passa). Sem assinatura,
  // volta pro board — lá o CTA é "Assinar" (e o servidor também bloqueia).
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, access_until")
    .eq("id", user.id)
    .single();
  if (!hasActiveAccess(profile?.email ?? user.email ?? null, profile?.access_until ?? null)) {
    redirect(`/${locale}/app/videos/history`);
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Novo vídeo · Passo 1 de 5</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Escolha o áudio
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Selecione um áudio que você já gerou (com o roteiro). Ele define as
          cenas do vídeo. Limite de 1min30s por enquanto.
        </p>
      </header>

      <AudioPicker locale={locale} />
    </div>
  );
}
