import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { ViraisBusca } from "@/components/lab/virais-busca";

/**
 * 🧪 Lab · Vídeos Virais — PARTE 1: achar o viral do nicho.
 *
 * Spec do Johnny (13/08): buscar virais de um nicho ordenados por likes, com
 * filtro de recência, no Instagram e no TikTok. O que vem daqui alimenta as
 * partes seguintes (analisar o viral → roteiro de reaction → voz clonada →
 * avatar em fundo verde por cima do viral).
 *
 * 🚧 PRÉ-PRODUÇÃO: só admin.
 */
export const dynamic = "force-dynamic";

export default async function ViraisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();
  if (!(await isAdmin(profile?.email ?? user.email ?? null))) {
    redirect({ href: "/app/dashboard", locale });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ash)]">
          🧪 Lab · teste interno
        </span>
        <h1 className="mt-1 font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Vídeos Virais
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          O acervo dos virais do nicho. Rode a busca no Apify, importe o resultado aqui,
          assista ao que interessa e <strong>marque só os que valem a pena baixar</strong> —
          nada vai pro nosso storage sem você mandar. O viral escolhido vira a base do
          seu vídeo de reação.
        </p>
      </div>
      <ViraisBusca />
    </div>
  );
}
