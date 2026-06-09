import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ApiKeysManager } from "@/components/app/api-keys-manager";
import { ApiDocs } from "@/components/app/api-docs";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";

/**
 * Configurações = API do usuário (chaves + docs). Faz parte do pacote pago,
 * então fica LIBERADA só pra assinante ativo (ou equipe). A gestão da
 * assinatura (cancelar) NÃO mora aqui — está em /app/account (Minha conta).
 */
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, access_until")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? null;
  const unlocked =
    bypassesBilling(email) || hasActiveAccess(email, profile?.access_until ?? null);

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

      {unlocked ? (
        <>
          <ApiKeysManager />
          <ApiDocs />
        </>
      ) : (
        <section className="flex flex-col gap-4 border border-accent bg-accent/5 p-6">
          <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
            Assine para liberar a API
          </h2>
          <p className="max-w-xl text-sm text-muted-fg">
            O acesso por API faz parte do plano. Assine para gerar chaves e usar a
            sua voz em qualquer ferramenta externa.
          </p>
          <Link
            href={`/${locale}/planos`}
            className="flex w-fit items-center gap-2 bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            Assinar agora →
          </Link>
        </section>
      )}
    </div>
  );
}
