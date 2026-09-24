/**
 * POST /api/v1/subscription/cancel
 *
 * Cancela a assinatura SEM burocracia. Sempre registra o motivo informado
 * (subscription_cancellations) — não bloqueia o cancelamento. Em seguida tenta
 * cancelar na Hotmart via API (se as credenciais estiverem configuradas).
 *
 * Body: { reason?: string, detail?: string }
 * Retorna: { status: "canceled" | "registered" }
 *
 * ── A ORDEM DOS PASSOS É A CORREÇÃO (#552, 24/09) ─────────────────────────
 * Até hoje este arquivo fazia, nesta ordem: (1) grava o pedido, (1b) manda ao
 * aluno "Sua assinatura foi cancelada", (2) tenta cancelar na Hotmart dentro
 * de um `catch {}` vazio. Três defeitos independentes saíam daí:
 *
 *   (a) a carta afirmava um fato que a casa ainda não tinha conferido;
 *   (b) a falha da API não deixava rastro nenhum — sem log, sem chamado, sem
 *       coluna — então não dá pra saber, hoje, quais dos 236 pedidos que já
 *       passaram por aqui viraram cancelamento de verdade;
 *   (c) o `.maybeSingle()` sobre `entitlements` devolve `null` quando o aluno
 *       tem DUAS assinaturas ativas (PostgREST recusa >1 linha, e o `error`
 *       era descartado no destructuring). Nesse caso o cancelamento era
 *       PULADO inteiro — e o aluno recebia a carta dizendo que foi cancelado.
 *       Medido em 24/09: 3 contas estão nessa situação, uma delas já pagando
 *       em dobro.
 *
 * Agora: tenta cancelar PRIMEIRO, cancela TODAS as assinaturas ativas, só
 * escreve "cancelada" quando a Hotmart confirmou, e quando falha abre chamado
 * técnico em vez de engolir.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { cancelSubscription, isConfigured } from "@/lib/hotmart/subscription";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { cartaDeCancelamento } from "@/lib/subscription/carta-de-cancelamento";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";

/** E-mails de aviso de cancelamento (best-effort — nunca trava o fluxo). */
async function notifyCancellation(
  userEmail: string | null,
  userId: string,
  reason: string | null,
  detail: string | null,
  confirmadoNaHotmart: boolean,
): Promise<void> {
  try {
    // Confirmação pro usuário — o TEXTO depende do que a Hotmart respondeu.
    if (userEmail) {
      const carta = cartaDeCancelamento(confirmadoNaHotmart);
      await sendEmail({ to: userEmail, subject: carta.subject, html: carta.html });
    }
    // Aviso pro time (com o motivo) — retenção/follow-up.
    const adminList = (
      process.env.CANCELLATION_NOTIFY_EMAIL ||
      process.env.ADMIN_EMAILS ||
      ""
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (adminList.length) {
      await sendEmail({
        to: adminList,
        subject: `Cancelamento de assinatura — ${userEmail ?? userId}`,
        html: `<div style="font-family:sans-serif;color:#111">
          <h3>Um usuário cancelou a assinatura</h3>
          <p><strong>Usuário:</strong> ${escapeHtml(userEmail ?? userId)}</p>
          <p><strong>Motivo:</strong> ${escapeHtml(reason ?? "(não informado)")}</p>
          <p><strong>Detalhe:</strong> ${escapeHtml(detail ?? "(vazio)")}</p>
          <p><strong>Cancelado na Hotmart:</strong> ${confirmadoNaHotmart ? "SIM" : "NÃO — pedido apenas registrado"}</p>
        </div>`,
      });
    }
  } catch {
    /* e-mail é best-effort; ignora qualquer falha */
  }
}

/**
 * O pedido chegou e a casa NÃO conseguiu cancelar. Isso não pode morrer num
 * `catch` vazio: vira chamado técnico, que é o que a ronda varre.
 *
 * Assinatura por usuário (e não por erro) de propósito: se a mesma pessoa
 * clicar três vezes, é UM caso, não três.
 */
async function registrarCancelamentoQueNaoSaiu(
  userId: string,
  email: string | null,
  codes: string[],
  motivo: string,
): Promise<void> {
  console.error(
    `[subscription/cancel] NÃO cancelei na Hotmart — user=${userId} codes=${codes.join(",") || "(nenhum)"} motivo=${motivo}`,
  );
  try {
    await abrirChamadoReportado({
      signature: `assinatura:cancelamento-no-app-nao-saiu:${userId}`,
      title:
        "PEDIDO DE CANCELAMENTO FEITO NO APP NAO FOI CONCLUIDO NA HOTMART: o aluno clicou em cancelar e a casa nao conseguiu cancelar a assinatura — a cobranca vai renovar se ninguem agir",
      description: `Rota POST /api/v1/subscription/cancel. Assinante(s): ${codes.join(", ") || "(nenhum código ativo encontrado)"}. Motivo: ${motivo}. O aluno recebeu a carta de "pedido recebido" (NAO a de "cancelada"), e a casa prometeu escrever de novo confirmando — essa promessa é dívida desta fila. Cancelar pela ferramenta: node _frank/ferramentas/cancelar_assinatura.cjs --aluno ${email ?? "<email>"} --confirmar`,
      reportedBy: "app-cancelamento",
      affectedEmails: email ? [email] : [],
      sampleError: motivo,
      categoria: "tecnico",
      kind: "sistema",
      cause: "code",
    });
  } catch (err) {
    // Última linha: nem o registro da falha pode derrubar a resposta ao aluno.
    console.error(
      "[subscription/cancel] não consegui nem abrir o chamado da falha:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { reason?: string; detail?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* corpo opcional */
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
  const detail = typeof body.detail === "string" ? body.detail.slice(0, 1000) : null;

  const admin = getAdmin();

  // 1. Registra o motivo SEMPRE (não trava o cancelamento).
  await admin
    .from("subscription_cancellations")
    .insert({ user_id: auth.user_id, reason, detail });

  // 2. Tenta cancelar na Hotmart ANTES de dizer qualquer coisa ao aluno.
  //    Sem `.maybeSingle()`: quem tem duas assinaturas ativas é justamente
  //    quem mais precisa que as duas parem de cobrar.
  const { data: ents, error: errEnts } = await admin
    .from("entitlements")
    .select("external_id")
    .eq("user_id", auth.user_id)
    .eq("provider", "hotmart")
    .eq("status", "active");

  const codes = (ents ?? [])
    .map((e) => (e as { external_id: string | null }).external_id)
    .filter((c): c is string => Boolean(c));

  let confirmado = false;
  let motivoDaFalha: string | null = null;

  if (errEnts) {
    motivoDaFalha = `não consegui ler os entitlements: ${errEnts.message}`;
  } else if (codes.length === 0) {
    motivoDaFalha = "nenhuma assinatura hotmart ativa com subscriber code neste usuário";
  } else if (!isConfigured()) {
    motivoDaFalha = "credenciais da Hotmart ausentes no ambiente (HOTMART_CLIENT_ID/_SECRET/_BASIC)";
  } else {
    const falhas: string[] = [];
    for (const code of codes) {
      try {
        await cancelSubscription(code);
      } catch (err) {
        falhas.push(`${code}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // Só é "cancelado" quando TODAS as assinaturas ativas pararam. Uma que
    // sobra é uma cobrança que continua chegando.
    if (falhas.length === 0) confirmado = true;
    else motivoDaFalha = falhas.join(" | ");
  }

  if (!confirmado) {
    await registrarCancelamentoQueNaoSaiu(
      auth.user_id,
      auth.email,
      codes,
      motivoDaFalha ?? "motivo desconhecido",
    );
  }

  // 3. Só agora escreve ao aluno — com o texto que corresponde ao que houve.
  await notifyCancellation(auth.email, auth.user_id, reason, detail, confirmado);

  return jsonOk({ status: confirmado ? "canceled" : "registered" });
}
