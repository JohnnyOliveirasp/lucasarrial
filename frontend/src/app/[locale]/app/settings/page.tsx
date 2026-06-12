import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ApiKeysManager } from "@/components/app/api-keys-manager";
import { ApiDocs } from "@/components/app/api-docs";
import { Eyebrow } from "@/components/ui";
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
        <Eyebrow>Configurações</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          API
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
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
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Assine para liberar a API
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            O acesso por API faz parte do plano. Assine para gerar chaves e usar
            a sua voz em qualquer ferramenta externa.
          </p>
          <Link
            href={`/${locale}/planos`}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            Assinar agora
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}
    </div>
  );
}
