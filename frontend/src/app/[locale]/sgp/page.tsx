import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepDadosForm } from "@/components/sgp/step-dados-form";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import type { SgpStatus } from "@/lib/sgp/types";

/**
 * /sgp — entrada do Sistema de Geração Pronto (link genérico).
 * Página PÚBLICA e SEM CONTA: o dono do pedido é o cookie da sessão; a conta
 * na plataforma só nasce no "Confirmar e Enviar" (Johnny 29/08).
 */
export const dynamic = "force-dynamic";

const PROXIMA: Partial<Record<SgpStatus, string>> = {
  foto: "/sgp/foto",
  audio: "/sgp/audio",
  revisao: "/sgp/revisao",
  processando: "/app/sgp",
  pronto: "/app/sgp",
  falhou: "/app/sgp",
};

export default async function SgpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "sgp.dados" });

  const pedido = await pedidoDaSessaoOuNull();
  if (pedido?.email_verificado_at) {
    const destino = PROXIMA[pedido.status];
    if (destino) redirect({ href: destino, locale });
  }

  return (
    <SgpShell passo="dados" titulo={t("titulo")} descricao={t("descricao")}>
      <StepDadosForm
        nomeInicial={pedido?.nome ?? ""}
        emailInicial={pedido?.email ?? ""}
        whatsappInicial={pedido?.whatsapp ? `+${pedido.whatsapp}` : ""}
      />
    </SgpShell>
  );
}
