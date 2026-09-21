import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/guard";
import { ViraisComunidade } from "@/components/virais/virais-comunidade";

/**
 * Vídeos Virais 1.0 — o acervo que os ALUNOS alimentam (pedido do Johnny
 * 21/09). O aluno cola o link de um post do Instagram ou do TikTok, marca o
 * consentimento, e o vídeo fica disponível pra todo mundo — aparecendo também
 * em "Meus envios".
 *
 * Não confundir com `/app/lab/virais`: aquela é a tela de GARIMPO da casa
 * (busca paga no Apify, curadoria, reserva) e segue em pré-produção, só admin.
 * Esta aqui é de todo aluno logado e lê só o que foi enviado com consentimento.
 *
 * O admin ganha, nos cards, o botão de tirar do ar — é o único freio, já que
 * por decisão do Johnny não existe fila de aprovação.
 */
export const dynamic = "force-dynamic";

export default async function ViraisDaComunidadePage({
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

  const admin = await isAdmin(user.email ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Virais
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[var(--mute)]">
          Um acervo feito pela turma: cada um manda os virais que encontra, e todo mundo usa de
          inspiração. Cole o link do Instagram ou do TikTok e ele entra aqui.
        </p>
      </div>
      <ViraisComunidade isAdmin={admin} />
    </div>
  );
}
