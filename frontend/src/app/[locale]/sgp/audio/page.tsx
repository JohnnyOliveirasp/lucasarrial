import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepAudioForm } from "@/components/sgp/step-audio-form";

/** /sgp/audio — Tela 3 (Áudio para clonagem de voz). Sem conta. */
export const dynamic = "force-dynamic";

export default async function SgpAudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pedido = await pedidoDaSessaoOuNull();
  if (!pedido?.email_verificado_at) redirect({ href: "/sgp", locale });
  const t = await getTranslations({ locale, namespace: "sgp.audio" });

  return (
    <SgpShell passo="audio" titulo={t("titulo")} descricao={t("descricao")}>
      <StepAudioForm iniciais={pedido!.audios ?? []} />
    </SgpShell>
  );
}
