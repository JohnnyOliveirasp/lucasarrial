import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeygenConnect } from "@/components/lab/heygen-connect";
import { heygenLiberado } from "@/lib/heygen/gate";

/**
 * HeyGen (BYOK — "HeyGen dentro do FastCloner", 05/08).
 * O aluno conecta a PRÓPRIA API key do HeyGen uma única vez; a partir daí
 * a galeria dele (foto-avatares/looks) aparece aqui e os vídeos são gerados
 * sem sair da plataforma — consumindo os créditos DA CONTA DELE no HeyGen.
 *
 * ⛔ VOLTOU PRA PRÉ-PRODUÇÃO em 21/09 (ordem do Johnny): "não terá mais no
 * projeto, desabilita do menu e move para apenas a pré-produção". Tirar do
 * menu não bastava — quem tivesse a URL entraria igual —, então a página e as
 * 4 rotas passam pelo mesmo portão (`lib/heygen/gate.ts`).
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
  // Aluno que chegou pela URL volta pro painel, sem página de erro: o produto
  // não existe mais pra ele, e não é falha dele ter tentado.
  if (!(await heygenLiberado(user.email))) return redirect({ href: "/app/dashboard", locale });

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
