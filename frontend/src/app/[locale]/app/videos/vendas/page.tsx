import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { VideoBoard } from "@/components/video/video-board";
import { Eyebrow } from "@/components/ui";

/**
 * Vídeo Vendas TikTok (board) — projetos de vídeo de VENDA de produto.
 * Mesmo pipeline do Vídeo História (kind='sales'): produto → pessoa → análise
 * → roteiro → voz → cenas → imagens (com o produto) → vídeos → final.
 */
export default async function VideoSalesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sales.board");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale: locale as Locale });

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("description")}
        </p>
      </header>

      <VideoBoard locale={locale} kind="sales" />
    </div>
  );
}
