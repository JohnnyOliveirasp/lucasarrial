import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AudioLines } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Badge } from "@/components/ui";

type VoiceRow = { id: string; name: string; created_at: string; is_stock?: boolean | null };

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
    .select("id, name, created_at, is_stock")
    .or(`user_id.eq.${user.id},is_stock.eq.true`)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  const all = (voices ?? []) as VoiceRow[];
  const list = all.filter((v) => !v.is_stock);
  const stock = all.filter((v) => v.is_stock);

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

      {list.length === 0 && stock.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
          <AudioLines className="h-10 w-10 text-[var(--ash)]" />
          <p className="text-sm text-[var(--mute)]">{t("voiceCloning.generateAudioEmpty")}</p>
          <Link
            href="/app/voice-cloning"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            {t("voiceCloning.createButton")}
          </Link>
        </section>
      ) : (
        <>
          {list.length > 0 && <VoiceList voices={list} locale={locale} cta={t("voiceCloning.pickVoiceCta")} />}

          {/* Catálogo "Vozes Prontas" (is_stock): treinadas pela FastCloner a
              partir de acervos CC-BY — a seção só existe quando há estoque. */}
          {stock.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                  {t("voiceCloning.stockTitle")}
                </h2>
                <p className="text-xs text-[var(--ash)]">{t("voiceCloning.stockCredit")}</p>
              </div>
              <VoiceList voices={stock} locale={locale} cta={t("voiceCloning.pickVoiceCta")} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function VoiceList({ voices, locale, cta }: { voices: VoiceRow[]; locale: string; cta: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {voices.map((v) => (
        <li key={v.id}>
          <Link
            href={`/app/voice-cloning/${v.id}/generate`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-5 py-4 transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)]"
          >
            <div className="flex flex-col gap-1">
              <span className="font-sans text-base font-medium leading-tight text-[var(--ink)]">
                {v.name}
              </span>
              <span className="text-xs text-[var(--ash)]">
                {new Date(v.created_at).toLocaleDateString(locale)}
              </span>
            </div>
            <Badge variant="soft">{cta}</Badge>
            <span className="text-[var(--mute)]" aria-hidden>
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
