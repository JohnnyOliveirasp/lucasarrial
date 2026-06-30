import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { VideoBoard } from "@/components/video/video-board";
import { Eyebrow } from "@/components/ui";

/**
 * Video History Board — o quadro que acompanha os projetos de vídeo do usuário.
 * Cada projeto caminha pelos estágios do wizard (Áudio → Cenas → Imagens →
 * Vídeos → Final). Daqui ele cria um novo vídeo ou reabre um em andamento.
 *
 * Entrada livre (ver o board não custa); o gate de créditos acontece dentro do
 * wizard, nos estágios que geram (imagens/vídeos).
 */
export default async function VideoHistoryPage({
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

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Vídeos</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Video History Board
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Transforme um áudio seu em um vídeo completo: o roteiro vira cenas,
          imagens e clipes, montados com legenda no final. Comece por um áudio
          de até 1min30s.
        </p>
      </header>

      <VideoBoard locale={locale} />
    </div>
  );
}
