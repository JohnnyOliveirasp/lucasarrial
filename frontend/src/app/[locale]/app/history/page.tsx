import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { GenerationsHistory } from "@/components/voice/generations-history";

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
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Histórico
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          Áudios gerados
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Tudo que você gerou. Toque pra ouvir, baixe, ou apague — um por um ou em lote.
        </p>
      </header>

      <GenerationsHistory />
    </div>
  );
}
