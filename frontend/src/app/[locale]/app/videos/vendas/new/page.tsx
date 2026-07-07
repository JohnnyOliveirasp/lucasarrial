import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SalesSetup } from "@/components/video/sales-setup";
import { Eyebrow } from "@/components/ui";

/** Novo Vídeo Vendas TikTok — setup: produto → pessoa → análise → roteiro. */
export default async function NewSalesVideoPage({
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
        <Eyebrow>Vídeo Vendas TikTok</Eyebrow>
        <h1 className="font-sans text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Novo vídeo de venda
        </h1>
      </header>
      <SalesSetup locale={locale} />
    </div>
  );
}
