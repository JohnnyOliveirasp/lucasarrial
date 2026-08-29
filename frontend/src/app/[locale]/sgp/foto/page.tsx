import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { lerPedido } from "@/lib/sgp/pedido";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepFotoForm } from "@/components/sgp/step-foto-form";

/** /sgp/foto — Tela 2 (Foto base do Clone). Exige sessão (a tela 1 cria). */
export const dynamic = "force-dynamic";

export default async function SgpFotoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/sgp", locale });

  const pedido = await lerPedido(user!.id);
  if (!pedido) redirect({ href: "/sgp", locale });

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
