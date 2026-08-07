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
  /** false = só estorna, sem e-mail (erro de INPUT do usuário, não falha nossa). */
  alertSupport?: boolean;
};

/**
 * Estorna o débito original 1x por falha. Idempotente POR CONTAGEM: devolve
 * enquanto houver mais débitos que estornos em (refId) — fluxos com refId
 * único por tentativa se comportam como antes, e fluxos que reusam o refId
 * entre tentativas (Animar Imagem: a row é a imagem) estornam cada tentativa
 * falha, não só a primeira. Quem não foi cobrado (equipe/admin) não tem
 * débito no extrato → nada a devolver.
 */
async function refundOriginalDebit(args: {
  userId: string;
  refId: string;
  debitRefType: string;
  refundRefType: string;
}): Promise<string> {
  const admin = getAdmin();

  const { data: debits, count: debitCount } = await admin
    .from("credit_transactions")
    .select("amount", { count: "exact" })
    .eq("user_id", args.userId)
    .eq("ref_type", args.debitRefType)
    .eq("ref_id", args.refId)
    .lt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1);
  const debit = (debits as { amount: number }[] | null)?.[0];
  if (!debit) return "nada cobrado (sem débito no extrato)";

  const { count: refundCount } = await admin
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .eq("ref_type", args.refundRefType)
    .eq("ref_id", args.refId);
  if ((refundCount ?? 0) >= (debitCount ?? 1)) return "estorno já aplicado anteriormente";

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

/** Rajada = 3+ falhas (estornos) do MESMO aluno na MESMA ferramenta em 15min. */
const BURST_WINDOW_MS = 15 * 60 * 1000;
const BURST_THRESHOLD = 3;

/**
 * Regra do Sentinela (caso 05/08: 7 falhas Seedream com estorno automático e
 * NENHUM incidente — "tratada" ≠ "saudável"): rajada de falhas do mesmo aluno
 * abre/reaquece incidente na aba Falhas do /admin, que é a fila que o
 * Sentinela varre. Dedupe por assinatura, mesmo padrão da Fast (mail-respond).
 */
async function openBurstIncident(a: {
  refundRefType: string;
  feature: string;
  userEmail: string;
  count: number;
  rawError: string;
}): Promise<void> {
  const admin = getAdmin();
  const signature = `fail-burst:${a.refundRefType}:${a.userEmail}`;
  const now = new Date().toISOString();
  const { data: existingRaw } = await admin
    .from("incidents" as never)
    .select("id, status, occurrences")
    .eq("signature", signature)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = existingRaw as unknown as {
    id: string;
    status: string;
    occurrences: number;
  } | null;

  if (existing) {
    const reopened = existing.status === "fixed" || existing.status === "ignored";
    await admin
      .from("incidents" as never)
      .update({
        status: reopened ? "open" : existing.status,
        occurrences: (existing.occurrences ?? 1) + 1,
        last_seen_at: now,
        sample_error: a.rawError.slice(0, 1000),
      } as never)
      .eq("id", existing.id);
    return;
  }
  await admin.from("incidents" as never).insert({
    kind: "reported",
    cause: "reported",
    status: "open",
    signature,
    title: `Rajada de falhas: ${a.feature} — ${a.userEmail} (${a.count} em 15min)`,
    occurrences: 1,
    affected_emails: [a.userEmail],
    sample_error: a.rawError.slice(0, 1000),
    description:
      `${a.count} falhas com estorno automático do mesmo aluno em 15 minutos na ` +
      `ferramenta "${a.feature}". Estorno em dia não significa experiência ok — ` +
      `investigar a causa raiz (erro cru na sample e, para imagens, na coluna kie_raw_error).`,
    reported_by: "burst-rule",
    first_seen_at: now,
    last_seen_at: now,
  } as never);
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

      // Regra de rajada: conta os estornos desta ferramenta na janela (1 estorno
      // idempotente por falha → contagem fiel) e abre incidente no limiar.
      const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
      const { count } = await admin
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", a.userId)
        .eq("ref_type", a.refundRefType)
        .gte("created_at", since);
      if ((count ?? 0) >= BURST_THRESHOLD) {
        await openBurstIncident({
          refundRefType: a.refundRefType,
          feature: a.feature,
          userEmail,
          count: count ?? 0,
          rawError: a.rawError,
        });
      }
    }
    if (a.alertSupport === false) return;

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
