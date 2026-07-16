import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { VoiceGenerator } from "@/components/voice/voice-generator";
import { Eyebrow } from "@/components/ui";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: voice } = await supabase
    .from("voices")
    .select("id, name, status, lora_path")
    .eq("id", id)
    // Dono OU voz do catálogo (is_stock — RLS libera a leitura).
    .or(`user_id.eq.${user.id},is_stock.eq.true`)
    .maybeSingle();

  if (!voice) notFound();
  if (voice.status !== "ready" || !voice.lora_path) {
    redirect(`/${locale}/app/voice-cloning/${voice.id}`);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Gerar áudio · {voice.name}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Síntese
        </h1>
        <p className="text-sm text-[var(--mute)]">
          Digite o texto e gere. A referência de voz é definida automaticamente
          a partir do seu treino.
        </p>
      </header>

      <VoiceGenerator voiceId={voice.id} />
    </div>
  );
}
