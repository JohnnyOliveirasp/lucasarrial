import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerPedido } from "@/lib/sgp/pedido";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepAudioForm } from "@/components/sgp/step-audio-form";

/** /sgp/audio — Tela 3 (Áudio para clonagem de voz). Exige sessão. */
export const dynamic = "force-dynamic";

export default async function SgpAudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/sgp", locale });
  const pedido = await lerPedido(user!.id);
  if (!pedido) redirect({ href: "/sgp", locale });
  const t = await getTranslations({ locale, namespace: "sgp.audio" });

  return (
    <SgpShell passo="audio" titulo={t("titulo")} descricao={t("descricao")}>
      <StepAudioForm iniciais={pedido!.audios ?? []} />
    </SgpShell>
  );
}
