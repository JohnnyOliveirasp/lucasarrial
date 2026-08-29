import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { estadoDasEtapas } from "@/lib/sgp/etapas";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { SgpAcompanhar } from "@/components/sgp/sgp-acompanhar";

/**
 * /sgp/acompanhar — tela 5: o pedido em construção, SEM login.
 * É a continuação natural do "Confirmar e Enviar" (Johnny 29/08); entrar na
 * plataforma é decisão do aluno, depois que o clone estiver pronto.
 */
export const dynamic = "force-dynamic";

export default async function SgpAcompanharPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pedido = await pedidoDaSessaoOuNull();
  if (!pedido?.enviado_em) redirect({ href: "/sgp", locale });

  const estado = await estadoDasEtapas(pedido!);
  const t = await getTranslations({ locale, namespace: "sgp.acompanhar" });

  return (
    <SgpShell passo="revisao" titulo={t("titulo")} descricao={estado.pronto ? t("descricaoPronto") : t("descricao")}>
      <SgpAcompanhar inicial={{ ...estado, email: pedido!.email }} />
    </SgpShell>
  );
}
