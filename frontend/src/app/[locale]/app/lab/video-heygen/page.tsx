import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeygenConnect } from "@/components/lab/heygen-connect";

/**
 * HeyGen (BYOK — "HeyGen dentro do FastCloner", 05/08).
 * O aluno conecta a PRÓPRIA API key do HeyGen uma única vez; a partir daí
 * a galeria dele (foto-avatares/looks) aparece aqui e os vídeos são gerados
 * sem sair da plataforma — consumindo os créditos DA CONTA DELE no HeyGen.
 *
 * ✅ GRADUOU 14/08 (ordem do Johnny): o Lucas rodou e aprovou, e o upload de
 * áudio que faltava subiu em 507ae4c. Saiu do gate de admin e entrou no
 * grupo Vídeos como "HeyGen". As rotas /api/v1/heygen nunca foram
 * admin-only — o gate vivia só aqui.
 */
export const dynamic = "force-dynamic";

export default async function VideoHeygenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect({ href: "/login", locale });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          HeyGen
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Conecte a sua conta do HeyGen uma única vez e use seus avatares daqui de dentro —
          com a sua voz clonada, sem ficar indo e voltando. Os vídeos consomem os créditos de
          API da <strong>sua conta HeyGen</strong>, não os créditos FastCloner.
        </p>
      </div>
      <HeygenConnect />
    </div>
  );
}
