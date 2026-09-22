import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReactWizard } from "@/components/react/react-wizard";
import { ReactMeusVideos } from "@/components/react/react-meus-videos";

/**
 * Vídeo React — versão do ALUNO (ordem do Johnny 22/09).
 *
 * É o MESMO wizard da pré-produção (`/app/lab/react`), que continua existindo
 * intocado para a casa: "deixa uma cópia do React que está no pré-produção,
 * porque essa eu vou usar ainda para mim, que seria a busca de vídeos virais".
 *
 * A única diferença é a FONTE do vídeo do passo 1:
 *   • lá  → prateleira do garimpo pago (Apify, 560 vídeos, admin);
 *   • aqui→ acervo que a turma enviou + upload do próprio vídeo, que fica
 *           privado de quem subiu.
 *
 * Os passos pagos (roteiro, ajuste, foto, áudio, geração) cobram crédito como
 * em qualquer outro produto — quem não tem saldo é barrado no passo, não aqui.
 */
export const dynamic = "force-dynamic";

export default async function ReactDoAlunoPage({
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
  if (!user) return redirect({ href: "/login", locale });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          React
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Comente um vídeo viral com o seu clone: escolha o vídeo, a sua foto, o roteiro e a
          voz — a montagem é nossa.
        </p>
      </div>

      <ReactWizard fonte="comunidade" />
      <ReactMeusVideos />
    </div>
  );
}
