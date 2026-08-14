/**
 * Onboarding — "plataforma pronta" (Johnny 13/08).
 * Quando avatares + voz treinada ficam prontos, manda o e-mail de boas-vindas
 * (SMTP do suporte@ — pelo Resend sairia como "AI Clone Verse") e marca
 * profiles.onboarding_ready_email_at (claim atômico: nunca duplica).
 * Chamado fire-and-forget pelos webhooks do RunPod (treino) e do Kie
 * (avatares); a planilha consulta o mesmo estado via /onboarding/status.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import { ONBOARDING_VOICE_NAME } from "./import";

type Admin = SupabaseClient<Database>;

const EMAIL_ASSUNTO = "Sua plataforma está pronta! 🎉";
// Texto do Johnny 13/08 ("mandamos uma mensagem como está") + link de acesso.
const EMAIL_TEXTO = `Sua plataforma está pronta! 🎉

Já configuramos sua imagem e sua voz na FastCloner e testamos: está funcionando. Agora você pode entrar na plataforma e gerar quantos vídeos e cenários quiser, a partir da sua imagem e da sua voz treinada.

Se preferir, volte às aulas da Fábrica de Conteúdo Invisível — a Aula 7 mostra o passo a passo de como gerar seus próprios vídeos, e a Aula 8 te dá o mapa do que postar toda semana.

Acesse: https://fastcloner.com/login

— Equipe FastCloner`;

const BCC_ADMINS = ["johnny.oliveirasp@gmail.com"];

export type ProntoStatus = {
  onboarding: boolean;
  pronto: boolean;
  voz: string | null;
  avatares_prontos: number;
  avatares_total: number;
  email_enviado: boolean;
};

/** Estado consolidado do onboarding de um usuário (usado também pela planilha). */
export async function statusOnboarding(admin: Admin, userId: string): Promise<ProntoStatus> {
  const { data: avatares } = await admin
    .from("image_generations")
    .select("status")
    .eq("user_id", userId)
    .eq("idea", "onboarding_avatar");
  const lista = avatares ?? [];

  const { data: voz } = await admin
    .from("voices")
    .select("status, raw_audio_paths")
    .eq("user_id", userId)
    .eq("name", ONBOARDING_VOICE_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const vozOnboarding =
    voz && JSON.stringify(voz.raw_audio_paths ?? []).includes("onboarding_") ? voz : null;

  const { data: prof } = await admin
    .from("profiles")
    .select("onboarding_ready_email_at")
    .eq("id", userId)
    .maybeSingle();

  const prontos = lista.filter((a) => a.status === "ready").length;
  const pendentes = lista.filter((a) => a.status === "pending" || a.status === "generating").length;
  const onboarding = lista.length > 0 || vozOnboarding !== null;
  const pronto =
    onboarding &&
    prontos >= 1 &&
    pendentes === 0 &&
    vozOnboarding?.status === "ready";

  return {
    onboarding,
    pronto,
    voz: (vozOnboarding?.status as string | null) ?? null,
    avatares_prontos: prontos,
    avatares_total: lista.length,
    email_enviado: Boolean(prof?.onboarding_ready_email_at),
  };
}

/**
 * Se tudo pronto e e-mail ainda não foi, envia (claim atômico no banco —
 * webhooks concorrentes nunca duplicam). Nunca lança: erro só loga.
 */
export async function verificarOnboardingPronto(admin: Admin, userId: string): Promise<void> {
  try {
    const st = await statusOnboarding(admin, userId);
    if (!st.pronto || st.email_enviado) return;

    // Claim atômico: só o primeiro update leva o direito de enviar.
    const { data: claimed } = await admin
      .from("profiles")
      .update({ onboarding_ready_email_at: new Date().toISOString() })
      .eq("id", userId)
      .is("onboarding_ready_email_at", null)
      .select("email");
    const email = claimed?.[0]?.email as string | undefined;
    if (!email) return; // outro webhook levou

    try {
      await sendSupportMail({
        to: email,
        subject: EMAIL_ASSUNTO,
        text: EMAIL_TEXTO,
        bcc: BCC_ADMINS,
      });
      console.log(`[onboarding/pronto] e-mail enviado: ${email}`);
    } catch (e) {
      // Falhou o envio → devolve o claim pra retry no próximo webhook/sweep.
      await admin
        .from("profiles")
        .update({ onboarding_ready_email_at: null })
        .eq("id", userId);
      throw e;
    }
  } catch (e) {
    console.error("[onboarding/pronto]", e instanceof Error ? e.message : e);
  }
}
