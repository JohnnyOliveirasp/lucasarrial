import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepDadosForm } from "@/components/sgp/step-dados-form";
import { createClient } from "@/lib/supabase/server";
import { destinoDoWizard, noWizardAberto } from "@/lib/sgp/destino";
import { lerPedido } from "@/lib/sgp/pedido";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

/**
 * /sgp — entrada do Sistema de Geração Pronto (link genérico).
 * Página PÚBLICA e SEM CONTA: o dono do pedido é o cookie da sessão; a conta
 * na plataforma só nasce no "Confirmar e Enviar" (Johnny 29/08).
 *
 * ESTA TELA NÃO PODE SER BECO SEM SAÍDA (09/09, caso welrisson@). Três saídas
 * novas, nesta ordem:
 *  1. cookie da sessão → segue de onde parou (`destinoDoWizard`, que agora tem
 *     entrada pra `dados` — sem ela, e-mail confirmado + status `dados` ficava
 *     preso na tela 1 pra sempre);
 *  2. sem cookie mas LOGADO com pedido já enviado → o acompanhamento da conta;
 *  3. sem nada → o formulário, que sabe retomar o pedido pelo e-mail
 *     (`POST /api/v1/sgp/inicio`).
 * E `?retomada=…` explica em português por que um link de retomada não abriu,
 * em vez de largar a pessoa numa tela muda.
 */
export const dynamic = "force-dynamic";

const AVISOS = ["vencido", "invalido", "confirme", "falhou"] as const;
type AvisoRetomada = (typeof AVISOS)[number];

function lerAviso(v: string | string[] | undefined): AvisoRetomada | null {
  const s = Array.isArray(v) ? v[0] : v;
  return (AVISOS as readonly string[]).includes(s ?? "") ? (s as AvisoRetomada) : null;
}

export default async function SgpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "sgp.dados" });
  const aviso = lerAviso((await searchParams)?.retomada);

  const pedido = await pedidoDaSessaoOuNull();
  if (pedido?.email_verificado_at) {
    redirect({ href: destinoDoWizard(pedido.status), locale });
  }

  // Sem cookie e sem pedido: se ele está LOGADO e já mandou o pedido, o lugar
  // dele é o acompanhamento da conta — não a tela 1 pedindo tudo de novo.
  // (Só quando o pedido já saiu do wizard: `/app/sgp` devolve pra cá quem ainda
  // está preenchendo, e mandar todo mundo pra lá seria um laço de redirect.)
  if (!pedido) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const daConta = await lerPedido(user.id);
      if (daConta && !noWizardAberto(daConta.status)) redirect({ href: "/app/sgp", locale });
    }
  }

  return (
    <SgpShell passo="dados" titulo={t("titulo")} descricao={t("descricao")}>
      <StepDadosForm
        nomeInicial={pedido?.nome ?? ""}
        emailInicial={pedido?.email ?? ""}
        whatsappInicial={pedido?.whatsapp ? `+${pedido.whatsapp}` : ""}
        avisoInicial={aviso ? t(`retomada.${aviso}`) : null}
      />
    </SgpShell>
  );
}
