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
import { hasActiveAccess } from "@/lib/credits/access";
import { ONBOARDING_VOICE_NAME } from "./import";
import { desfechoOnboarding } from "./desfecho-pure";
import { avisoOkMasAssine } from "./avisos";
import { registrarAviso } from "./registrar-aviso";

type Admin = SupabaseClient<Database>;

const EMAIL_ASSUNTO = "Sua plataforma está pronta! 🎉";
// Texto do Johnny 13/08 ("mandamos uma mensagem como está") + link de acesso.
const EMAIL_TEXTO = `Sua plataforma está pronta! 🎉

Já configuramos sua imagem e sua voz na FastCloner e testamos: está funcionando. Agora você pode entrar na plataforma e gerar quantos vídeos e cenários quiser, a partir da sua imagem e da sua voz treinada.

Se preferir, volte às aulas da Fábrica de Conteúdo Invisível — a Aula 7 mostra o passo a passo de como gerar seus próprios vídeos, e a Aula 8 te dá o mapa do que postar toda semana.

Acesse: https://fastcloner.com/login

— Equipe FastCloner`;

// #189: assinante ativo cuja voz ficou pronta mas NENHUMA imagem entrou. Dizer
// "sua imagem está configurada" aqui era mentira com prova na caixa Sent.
const EMAIL_ASSUNTO_SEM_IMAGEM = "Sua voz está pronta! 🎙️ (falta só a foto)";
const EMAIL_TEXTO_SEM_IMAGEM = `Sua voz está pronta! 🎙️

Já configuramos a sua voz na FastCloner e testamos: está funcionando. Você já pode entrar e gerar áudios com a sua voz treinada.

A parte de IMAGEM ainda não foi feita: as suas fotos não chegaram até nós. É só responder este e-mail com as fotos que a gente termina a configuração — você não precisa refazer mais nada.

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
  /**
   * 22/08: acabou de vez — não adianta a planilha continuar esperando.
   * Sem isto, uma linha cuja voz JÁ falhou ficava "Em Andamento" segurando a
   * fila até bater o prazo de 45min (caso 47, csitya100: voz `failed` às
   * 15:08, linha presa até ~15:53). O prazo existe pra travamento, não pra
   * caso já resolvido.
   *
   * 12/09 (#364): vale para as DUAS pernas. Até aqui só a voz tinha desfecho
   * terminal; avatar `failed` com voz `ready` não era nem pronto nem falhou e
   * ficava "em andamento" pra sempre (pedido fe00d4e2, 18h em silêncio).
   */
  falhou: boolean;
  /** Por que falhou de vez — vai direto pra nota da planilha. */
  motivo: string | null;
};

/** Estado consolidado do onboarding de um usuário (usado também pela planilha). */
export async function statusOnboarding(admin: Admin, userId: string): Promise<ProntoStatus> {
  const { data: avatares } = await admin
    .from("image_generations")
    .select("status")
    .eq("user_id", userId)
    .eq("idea", "onboarding_avatar");
  const lista = avatares ?? [];

  // 22/08: amarrar a voz do onboarding pelo NOME é frágil — o aluno renomeia,
  // ou treina outra por conta e a linha fica presa em "Em Andamento" PRA
  // SEMPRE, mesmo com ele já usando a plataforma. Casos reais:
  //   lucianodepinho — só tem "Luciano 1" (ready): não existe "Minha Voz"
  //   kessulyl       — "Minha Voz" failed + "Voz Kess" (ready), feita por ela
  // Os dois estavam prontos, assinantes ativos, e nunca receberam o e-mail.
  // Agora: vale a voz do onboarding OU qualquer voz do aluno que esteja
  // pronta — o que importa é ele TER voz funcionando, não o nome dela.
  const { data: vozes } = await admin
    .from("voices")
    .select("status, raw_audio_paths, name, error_message")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const lista_vozes = vozes ?? [];

  // A marca confiável é o CAMINHO do áudio (`onboarding_...`), que o aluno não
  // muda — não o nome, que ele muda à vontade. O nome só entra como reserva
  // pra voz que ainda não tem áudio gravado.
  const daImportacao =
    lista_vozes.find((v) => JSON.stringify(v.raw_audio_paths ?? []).includes("onboarding_")) ??
    lista_vozes.find((v) => v.name === ONBOARDING_VOICE_NAME) ??
    null;

  // Se a voz do onboarding falhou e o aluno treinou outra por conta, o que
  // vale é ele TER voz pronta. Mas isto só conta pra quem realmente passou
  // pelo onboarding (tem avatar ou voz de importação) — senão o e-mail
  // "plataforma pronta" cairia em cima de aluno que nunca veio da planilha.
  const veioDoOnboarding = lista.length > 0 || daImportacao !== null;
  const qualquerPronta = veioDoOnboarding
    ? lista_vozes.find((v) => v.status === "ready")
    : undefined;

  const vozOnboarding =
    daImportacao?.status === "ready" ? daImportacao : (qualquerPronta ?? daImportacao ?? null);

  const { data: prof } = await admin
    .from("profiles")
    .select("onboarding_ready_email_at")
    .eq("id", userId)
    .maybeSingle();

  const prontos = lista.filter((a) => a.status === "ready").length;
  const pendentes = lista.filter((a) => a.status === "pending" || a.status === "generating").length;
  const onboarding = lista.length > 0 || vozOnboarding !== null;
  // 22/08: exigir avatar pronto SEM NUNCA ter tentado gerar um trancava a
  // linha pra sempre. Casos reais: fernao82, dmaggioni, namaiimoveis e
  // thiagoabadio — voz treinada e funcionando, zero foto importada (o link de
  // imagens falhou), zero avatar. A entrega principal — a VOZ — estava de pé,
  // e a planilha dizia "Em Andamento" havia dias.
  // Agora: se houve avatar, ele precisa ficar pronto; se nunca houve, a voz
  // pronta basta pra fechar a linha.
  const houveAvatar = lista.length > 0;
  // A régua (22/08 + a perna da foto de 12/09) mora em `desfecho-pure.ts`,
  // sem banco, pra poder ser testada por `node --test`. Aqui fica só a busca.
  const { pronto, falhou, motivo } = desfechoOnboarding({
    onboarding,
    houveAvatar,
    prontos,
    pendentes,
    vozStatus: (vozOnboarding?.status as string | null) ?? null,
    vozTreinando: lista_vozes.some((v) => v.status === "validating"),
    vozErro:
      vozOnboarding && "error_message" in vozOnboarding
        ? ((vozOnboarding.error_message as string | null) ?? null)
        : null,
  });

  return {
    onboarding,
    pronto,
    voz: (vozOnboarding?.status as string | null) ?? null,
    avatares_prontos: prontos,
    avatares_total: lista.length,
    email_enviado: Boolean(prof?.onboarding_ready_email_at),
    falhou,
    motivo,
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
      .select("email, access_until, access_source");
    const email = claimed?.[0]?.email as string | undefined;
    if (!email) return; // outro webhook levou

    // Johnny 21/08: a mensagem final depende de o aluno estar ATIVO. Com
    // assinatura vigente → "tudo pronto". Sem assinatura (ou nunca entrou) →
    // "seus arquivos estão ok, assine pra acessar". Nenhuma das duas fala de
    // saldo — decisão dele.
    const ativo = hasActiveAccess(
      email,
      claimed?.[0]?.access_until as string | null,
      claimed?.[0]?.access_source as string | null,
    );

    // #189 (29/08): `pronto` fica true com ZERO avatar de propósito (decisão de
    // 22/08 — a voz de pé basta pra fechar a linha, senão quem perdeu as
    // imagens ficava preso pra sempre). O erro não era fechar; era o E-MAIL
    // afirmar "suas imagens estão ok" pra quem tinha zero imagem — 336s depois
    // de outro e-mail dizendo que as imagens tinham falhado (marcosvidal2013).
    // A régua continua a mesma; o texto passa a dizer a verdade. Vale também
    // pro SGP, que usa este mesmo statusOnboarding.
    const semImagem = st.avatares_prontos === 0;

    // 03/09: o gatilho, em texto curto, pra tabela `avisos_enviados` — é o que
    // explica POR QUE o e-mail saiu neste instante. No caso do Celso Slompo
    // isto teria gravado "voz ready, avatares 5/5", e a pergunta "ele foi
    // avisado?" viraria uma consulta em vez de um chute.
    const referencia = `voz ${st.voz}, avatares ${st.avatares_prontos}/${st.avatares_total}`;
    const assunto = semImagem ? EMAIL_ASSUNTO_SEM_IMAGEM : EMAIL_ASSUNTO;

    try {
      if (ativo) {
        try {
          await sendSupportMail({
            to: email,
            subject: assunto,
            text: semImagem ? EMAIL_TEXTO_SEM_IMAGEM : EMAIL_TEXTO,
            bcc: BCC_ADMINS,
          });
        } catch (e) {
          // Registrar a FALHA antes de propagar: é justamente ela que nunca
          // ninguém enxergou (só existia como console de servidor, que o
          // FrontendServer.log do Hetzner nem captura).
          await registrarAviso(admin, {
            email,
            userId,
            aviso: semImagem ? "onboarding_pronto_sem_imagem" : "onboarding_pronto",
            assunto,
            referencia,
            ok: false,
            erro: e instanceof Error ? e.message : String(e),
          });
          throw e;
        }
        await registrarAviso(admin, {
          email,
          userId,
          aviso: semImagem ? "onboarding_pronto_sem_imagem" : "onboarding_pronto",
          assunto,
          referencia,
          ok: true,
        });
      } else {
        // Este caminho registra sozinho (passa pelo `mandar` de avisos.ts).
        await avisoOkMasAssine(email, semImagem, { userId, referencia });
      }
      console.log(
        `[onboarding/pronto] e-mail enviado (${ativo ? "pronto" : "assine"}${semImagem ? ", sem imagem" : ""}): ${email}`,
      );
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
