import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { RoteiroWorkspace } from "@/components/roteiro/roteiro-workspace";
import { roteiroAllowedEmail } from "@/lib/roteiro/access";
import { Eyebrow } from "@/components/ui";

/**
 * Gerador de Roteiro — o aluno dá a ideia, a LLM escreve o roteiro pronto pra
 * ler gravando. O gate de crédito acontece na ação, no 402 da rota, como nas
 * outras telas.
 *
 * 🚧 PRÉ-PRODUÇÃO: só admin até o Lucas ler roteiro e dar o veredito. Ver
 * `lib/roteiro/access.ts` — graduar é uma linha.
 */
export const dynamic = "force-dynamic";

export default async function RoteiroPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "roteiro" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, access_until")
    .eq("id", user.id)
    .single();

  const email = profile?.email ?? user.email ?? null;
  if (!(await roteiroAllowedEmail(email))) {
    redirect({ href: "/app/dashboard", locale });
  }
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  // Johnny 13/08: sem assinatura não acessa (ex.: contas da planilha sem plano).
  if (!team && !subscribed) redirect({ href: "/app/dashboard", locale });

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">{t("description")}</p>
      </header>

      <RoteiroWorkspace subscribed={subscribed} unlimited={team} />
    </div>
  );
}
