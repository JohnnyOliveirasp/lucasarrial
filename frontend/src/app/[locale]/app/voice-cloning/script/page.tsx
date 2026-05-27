import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ScriptReader } from "@/components/voice/script-reader";
import { VoiceRecorder } from "@/components/voice/voice-recorder";

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Gravação de voz
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          Roteiro
        </h1>
        <p className="text-sm text-muted-fg">
          Leia este roteiro em voz alta enquanto grava, variando o tom em cada
          bloco — é assim que o modelo aprende o alcance da sua voz. Não gostou?
          Gere outro. Quer ler no papel? Baixe ou imprima.
        </p>
      </header>

      <ScriptReader />
      <VoiceRecorder />
    </div>
  );
}
