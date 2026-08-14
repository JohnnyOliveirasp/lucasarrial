import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { MeusVirais } from "@/components/lab/meus-virais";

/**
 * 🧪 Lab · "Meus Virais" — a prateleira pessoal (mig 75).
 *
 * Guardar aqui NÃO baixa nada: é metadado + capa. O mp4 só desce quando a
 * pessoa vai produzir o Video React (decisão do Johnny 14/08).
 *
 * 🚧 PRÉ-PRODUÇÃO: admin-only até o React ficar de pé.
 */
export const dynamic = "force-dynamic";

export default async function MeusViraisPage({
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
          Meus Virais
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Os virais que você guardou pra usar. Guardar não baixa nada — o vídeo só é
          baixado quando você for fazer o React com ele.
        </p>
      </div>
      <MeusVirais />
    </div>
  );
}
