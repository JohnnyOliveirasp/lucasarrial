import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepFotoForm } from "@/components/sgp/step-foto-form";

/** /sgp/foto — Tela 2 (Foto base do Clone). Sem conta: exige e-mail confirmado. */
export const dynamic = "force-dynamic";

export default async function SgpFotoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pedido = await pedidoDaSessaoOuNull();
  if (!pedido?.email_verificado_at) redirect({ href: "/sgp", locale });

  const bucket = imagesBucket();
  const iniciais = await Promise.all(
    (pedido!.fotos ?? []).map(async (foto) => ({
      foto,
      url: await createPresignedGet(bucket, foto.key, 60 * 60),
    })),
  );
  const t = await getTranslations({ locale, namespace: "sgp.foto" });

  return (
    <SgpShell passo="foto" titulo={t("titulo")} descricao={t("descricao")}>
      <StepFotoForm iniciais={iniciais} />
    </SgpShell>
  );
}
