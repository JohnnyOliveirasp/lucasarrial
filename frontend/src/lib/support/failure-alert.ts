/**
 * Contingência compartilhada de falha TÉCNICA (TTS, Vídeo Clone, etc.):
 * estorna o débito original (se houver e ainda não estornado) e avisa o
 * suporte por e-mail na hora. Best-effort: NUNCA lança — jamais pode travar
 * o fluxo do usuário. Server-only.
 *
 * O treino de voz tem contingência própria em lib/voices/finalize-training.ts
 * (regras extras: dataset vs técnico, bypassesBilling, custo fixo).
 */
import { getAdmin } from "@/lib/db/admin";
import { addExtraCredits } from "@/lib/credits/service";
import { sendEmail, escapeHtml } from "@/lib/email/resend";

export const SUPPORT_EMAIL = "suporte@fastcloner.com";

export type TechFailureArgs = {
  /** Nome da ferramenta pro assunto do e-mail (ex.: "Geração de áudio (TTS)"). */
  feature: string;
  userId: string;
  /** Id da row afetada (generations.id, video_clones.id, ...). */
  refId: string;
  jobId?: string | null;
  rawError: string;
  /** ref_type do débito original no extrato; junto com refundRefType liga o estorno. */
  debitRefType?: string;
  /** ref_type do estorno (aparece no extrato; também é a chave de idempotência). */
  refundRefType?: string;
};

/**
 * Estorna o débito original 1x. Idempotente: se já existe transação com
 * (refundRefType, refId), não devolve de novo. Quem não foi cobrado
 * (equipe/admin) não tem débito no extrato → nada a devolver.
 */
async function refundOriginalDebit(args: {
  userId: string;
  refId: string;
  debitRefType: string;
  refundRefType: string;
}): Promise<string> {
  const admin = getAdmin();

  const { data: debits } = await admin
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", args.userId)
    .eq("ref_type", args.debitRefType)
    .eq("ref_id", args.refId)
    .lt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1);
  const debit = (debits as { amount: number }[] | null)?.[0];
  if (!debit) return "nada cobrado (sem débito no extrato)";

  const { data: prior } = await admin
    .from("credit_transactions")
    .select("id")
    .eq("user_id", args.userId)
    .eq("ref_type", args.refundRefType)
    .eq("ref_id", args.refId)
    .limit(1);
  if (prior && prior.length > 0) return "estorno já aplicado anteriormente";

  const amount = Math.abs(debit.amount);
  const r = await addExtraCredits({
    userId: args.userId,
    amount,
    refType: args.refundRefType,
    refId: args.refId,
  });
  return r.ok
    ? `estorno de ${amount.toLocaleString("pt-BR")} créditos aplicado automaticamente`
    : "ESTORNO FALHOU — aplicar manualmente!";
}

/**
 * Chamar SEMPRE que uma operação falhar por motivo técnico, logo após a
 * transição idempotente da row pra "failed" (pra não duplicar em corrida
 * webhook×poll). Estorna (se configurado) + e-mail pro suporte.
 */
export async function handleTechFailure(a: TechFailureArgs): Promise<void> {
  try {
    const admin = getAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", a.userId)
      .maybeSingle();
    const userEmail = (profile as { email?: string } | null)?.email ?? "(sem e-mail)";

    let refundNote = "sem estorno automático configurado pra esta operação";
    if (a.debitRefType && a.refundRefType) {
      refundNote = await refundOriginalDebit({
        userId: a.userId,
        refId: a.refId,
        debitRefType: a.debitRefType,
        refundRefType: a.refundRefType,
      });
    }

    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `⚠️ Falha técnica — ${a.feature} — ${userEmail}`,
      html:
        `<p>Uma operação falhou por erro <strong>técnico</strong>.</p>` +
        `<ul>` +
        `<li><strong>Ferramenta:</strong> ${escapeHtml(a.feature)}</li>` +
        `<li><strong>Usuário:</strong> ${escapeHtml(userEmail)} (${a.userId})</li>` +
        `<li><strong>Registro:</strong> ${a.refId}</li>` +
        (a.jobId ? `<li><strong>Job:</strong> ${escapeHtml(a.jobId)}</li>` : "") +
        `<li><strong>Erro:</strong> <code>${escapeHtml(a.rawError.slice(0, 500))}</code></li>` +
        `<li><strong>Créditos:</strong> ${escapeHtml(refundNote)}</li>` +
        `</ul>` +
        `<p>Detalhes completos no /admin.</p>`,
    });
  } catch {
    // contingência é best-effort: nunca propaga erro pro fluxo principal
  }
}
