import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { VoiceGenerator } from "@/components/voice/voice-generator";

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
    .eq("user_id", user.id)
    .maybeSingle();

  if (!voice) notFound();
  if (voice.status !== "ready" || !voice.lora_path) {
    redirect(`/${locale}/app/voice-cloning/${voice.id}`);
  }

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Gerar áudio · {voice.name}
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          Síntese
        </h1>
        <p className="text-sm text-muted-fg">
          Digite o texto, suba uma referência (≥60s) com sua transcrição.
          Tudo é validado no servidor antes da inferência.
        </p>
      </header>

      <VoiceGenerator voiceId={voice.id} />
    </div>
  );
}
