import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { signRecorderToken } from "@/lib/recorder-test/token";
import { PhoneRecorderDesktop } from "@/components/lab/phone-recorder-desktop";

/**
 * 🧪 Lab · Gravador pelo Celular (TESTE, pedido Johnny 03/08) — grava no
 * celular (mic de lapela, longe do ventilador) com o roteiro nesta tela.
 * Aprovando a qualidade, o fluxo vira parte do Gravador oficial.
 *
 * 🚧 PRÉ-PRODUÇÃO: só admin (mesmo padrão do Estúdio).
 */
export const dynamic = "force-dynamic";

export default async function GravadorCelularPage({
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

  const token = signRecorderToken(user.id);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fastcloner.com";
  const phoneUrl = `${origin}/gravar/${token}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ash)]">🧪 Lab · teste interno</span>
        <h1 className="mt-1 font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Gravador pelo Celular
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Grave com o microfone do celular (lapela) enquanto lê o roteiro nesta tela — longe do
          ventilador do notebook. Os takes chegam aqui com player pra julgar a qualidade.
        </p>
      </div>
      <PhoneRecorderDesktop token={token} phoneUrl={phoneUrl} />
    </div>
  );
}
