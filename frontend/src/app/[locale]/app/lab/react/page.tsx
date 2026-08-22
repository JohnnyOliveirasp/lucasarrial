import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { ReactWizard } from "@/components/react/react-wizard";
import { ReactMeusVideos } from "@/components/react/react-meus-videos";

/**
 * 🧪 Lab · **Video React** — você na frente comentando um viral.
 *
 * 🚧 PRÉ-PRODUÇÃO: admin-only até o wizard fechar de ponta a ponta.
 * Estado em 14/08: R0 (vídeo) e R1 (avatar) de pé; R2-R6 em construção.
 * O que já foi PROVADO na mão: download sem marca d'água e o recorte em
 * fundo verde por cima de outro vídeo.
 */
export const dynamic = "force-dynamic";

export default async function ReactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).single();
  if (!(await isAdmin(profile?.email ?? user.email ?? null))) redirect({ href: "/app/dashboard", locale });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ash)]">
          🧪 Lab · pré-produção
        </span>
        <h1 className="mt-1 font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Video React
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Escolha um viral da sua prateleira, escolha quem reage, e a plataforma monta o
          vídeo com você comentando por cima.
        </p>
      </div>
      <ReactWizard />
      {/* A lista do que já foi criado — pedido do Johnny 22/08. */}
      <ReactMeusVideos />
    </div>
  );
}
