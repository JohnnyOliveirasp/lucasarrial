import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createPresignedGet } from "@/lib/r2/presigned";
import { R2_BUCKETS } from "@/lib/r2/client";
import { Eyebrow } from "@/components/ui";
import { VoicesTabs } from "@/components/voice/voices-tabs";

type VoiceRow = {
  id: string;
  user_id?: string;
  name: string;
  created_at: string;
  is_stock?: boolean | null;
  language?: string | null;
  accent?: string | null;
  description?: string | null;
};

/**
 * "Gerar Áudio" — landing do sub-menu Vozes. Lista as vozes PRONTAS do usuário;
 * clicar leva pra geração daquela voz (/voice-cloning/[id]/generate). Só faz
 * sentido com voz treinada — sem nenhuma, mostra estado vazio com atalho p/ treinar.
 */
export default async function GenerateAudioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "app" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Minhas vozes + Vozes Prontas do catálogo (is_stock; a RLS já libera SELECT).
  const { data: voices } = await supabase
    .from("voices")
    .select("id, user_id, name, created_at, is_stock, language, accent, description")
    .or(`user_id.eq.${user.id},is_stock.eq.true`)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  const all = (voices ?? []) as VoiceRow[];
  const list = all
    .filter((v) => !v.is_stock)
    .map((v) => ({ id: v.id, name: v.name, created_at: v.created_at }));
  // Catálogo (aba Explorar): amostra de ~15s de cada voz — presigned 1h.
  const stock = await Promise.all(
    all
      .filter((v) => v.is_stock)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (v) => ({
        id: v.id,
        name: v.name,
        language: v.language ?? "pt",
        accent: v.accent ?? null,
        description: v.description ?? null,
        sample_url: await createPresignedGet(
          R2_BUCKETS.generations,
          `${v.user_id}/${v.id}/sample.wav`,
          3600,
        ).catch(() => null),
      })),
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("nav.generateAudio")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("voiceCloning.generateAudioTitle")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("voiceCloning.generateAudioSubtitle")}
        </p>
      </header>

      {/* Abas estilo ElevenLabs: Minhas Vozes | Explorar (catálogo is_stock).
          Sem voz própria, abre direto no Explorar. */}
      <VoicesTabs myVoices={list} stock={stock} locale={locale} />
    </div>
  );
}
