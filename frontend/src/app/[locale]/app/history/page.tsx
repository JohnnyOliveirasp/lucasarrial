import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { GenerationsHistory } from "@/components/voice/generations-history";
import { Eyebrow } from "@/components/ui";

export default async function HistoryPage({
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
      <header className="flex flex-col gap-3">
        <Eyebrow>Histórico</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          Áudios gerados
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Tudo que você gerou. Toque pra ouvir, baixe, ou apague — um por um ou
          em lote.
        </p>
      </header>

      <GenerationsHistory />
    </div>
  );
}
