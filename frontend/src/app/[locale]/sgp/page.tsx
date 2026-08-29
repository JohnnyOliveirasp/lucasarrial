import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/db/admin";
import { SgpShell } from "@/components/sgp/sgp-shell";
import { StepDadosForm } from "@/components/sgp/step-dados-form";
import type { SgpStatus } from "@/lib/sgp/types";

/**
 * /sgp — entrada do Sistema de Geração Pronto (link genérico, decisão 29/08).
 * Página PÚBLICA: o aluno chega sem conta; o código por e-mail cria a sessão.
 * Quem já passou da tela 1 é levado direto pro passo em que parou.
 */
export const dynamic = "force-dynamic";

const PROXIMA_TELA: Partial<Record<SgpStatus, string>> = {
  foto: "/sgp/foto",
  audio: "/sgp/audio",
  revisao: "/sgp/revisao",
  enviado: "/app/sgp",
  processando: "/app/sgp",
  pronto: "/app/sgp",
  falhou: "/app/sgp",
};

export default async function SgpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "sgp.dados" });

  let nomeInicial = "";
  let emailInicial = "";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    emailInicial = user.email ?? "";
    const { data } = await getAdmin()
      .from("sgp_pedidos" as never)
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    const status = (data as { status: SgpStatus } | null)?.status;
    const destino = status ? PROXIMA_TELA[status] : undefined;
    if (destino) redirect({ href: destino, locale });
    const meta = user.user_metadata as { full_name?: string } | undefined;
    nomeInicial = meta?.full_name ?? "";
  }

  return (
    <SgpShell passo="dados" titulo={t("titulo")} descricao={t("descricao")}>
      <StepDadosForm nomeInicial={nomeInicial} emailInicial={emailInicial} />
    </SgpShell>
  );
}
