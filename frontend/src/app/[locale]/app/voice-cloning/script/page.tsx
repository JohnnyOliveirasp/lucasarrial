import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ScriptReader } from "@/components/voice/script-reader";
import { RecorderWithPhone } from "@/components/voice/recorder-with-phone";
import { Eyebrow } from "@/components/ui";

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
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Gravação de voz</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Roteiro
        </h1>
        <p className="text-sm text-[var(--mute)]">
          Grave lendo em voz alta e variando o tom — é assim que o modelo
          aprende o alcance da sua voz. Pode ler um texto seu ou, se preferir,
          gerar um roteiro de leitura com a IA.
        </p>
      </header>

      <ScriptReader />
      {/* Gravador do navegador + "gravar pelo celular" (graduação 03/08):
          as duas opções convivem e os takes do celular SOMAM na barra de
          fala acumulada — tudo alimenta o mesmo treino. */}
      <RecorderWithPhone />
    </div>
  );
}
