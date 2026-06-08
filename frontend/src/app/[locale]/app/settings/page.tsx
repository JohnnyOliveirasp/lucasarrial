import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ApiKeysManager } from "@/components/app/api-keys-manager";
import { ApiDocs } from "@/components/app/api-docs";
import { CancelSubscription } from "@/components/app/cancel-subscription";
import { bypassesBilling } from "@/lib/credits/access";

export default async function SettingsPage({
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
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Configurações
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          API
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">
          Gere chaves para usar a sua voz por fora do site — em scripts, n8n ou
          qualquer ferramenta que faça requisições HTTP.
        </p>
      </header>

      <ApiKeysManager />
      <ApiDocs />

      {!bypassesBilling(user.email) && (
        <section className="flex flex-col gap-3 border-t border-border pt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-fg">
            Assinatura
          </h2>
          <CancelSubscription />
        </section>
      )}
    </div>
  );
}
