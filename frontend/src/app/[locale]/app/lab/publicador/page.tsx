import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { SocialPublisher } from "@/components/lab/social-publisher";

/**
 * 🧪 Lab · Publicador ("nosso Blotato", 05/08). O aluno conecta o Instagram
 * Profissional dele (login do próprio Instagram, sem Facebook) e publica/agenda
 * Reels, fotos e stories daqui — a Máquina de vídeo vai postar sozinha por
 * esta mesma API (/api/v1/social/publish).
 *
 * 🚧 PRÉ-PRODUÇÃO: só admin até o App Review da Meta liberar pros alunos
 * (em In development publica só pra contas com papel de tester no app).
 */
export const dynamic = "force-dynamic";

export default async function PublicadorPage({
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
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ash)]">🧪 Lab · teste interno</span>
        <h1 className="mt-1 font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Publicador
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Conecte seu Instagram profissional e publique ou agende Reels, fotos e stories sem sair
          do FastCloner. Em breve os vídeos gerados aqui dentro vão direto pro seu perfil.
        </p>
      </div>
      <SocialPublisher />
    </div>
  );
}
