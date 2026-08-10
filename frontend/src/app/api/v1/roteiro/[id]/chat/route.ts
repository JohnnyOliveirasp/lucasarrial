/**
 * Chat de ajuste de UM roteiro (Fase 5).
 *
 * GET  → a conversa inteira (o histórico vive no banco; F5 não perde nada).
 * POST → body { message } → { reply, script, cost }. Cobra ROTEIRO_CHAT_COST
 *        só no sucesso.
 *
 * O client NUNCA manda o histórico: quem paga por mensagem não é fonte
 * confiável do próprio contexto. O servidor lê do banco e corta na janela.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, forbidden, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { roteiroAllowedEmail } from "@/lib/roteiro/access";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { getAdmin } from "@/lib/db/admin";
import {
  isRoteiroDuration,
  ROTEIRO_CHAT_COST,
  ROTEIRO_CHAT_MAX,
  ROTEIRO_CHAT_WINDOW,
  type RoteiroDuration,
} from "@/lib/roteiro/config";
import { chatRoteiro, type ChatTurn } from "@/lib/roteiro/chat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await roteiroAllowedEmail(auth.email))) return forbidden("Recurso em pré-produção.");
  const { id } = await params;

  const { data, error } = await getAdmin()
    .from("script_messages")
    .select("id, role, content, script_after, credits_charged, created_at")
    .eq("script_id", id)
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: true });

  if (error) return serverError("Não consegui carregar a conversa.");
  return jsonOk({ items: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await roteiroAllowedEmail(auth.email))) return forbidden("Recurso em pré-produção.");
  const { id } = await params;

  let body: { message?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 2) return badRequest("Escreva o que você quer ajustar.");
  if (message.length > ROTEIRO_CHAT_MAX) {
    return badRequest(`A mensagem pode ter no máximo ${ROTEIRO_CHAT_MAX} caracteres.`);
  }

  const admin = getAdmin();

  // O filtro por user_id é o que impede conversar no roteiro de outro.
  const { data: row } = await admin
    .from("scripts")
    .select("id, idea, seconds, script")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!row) return notFound("Roteiro");

  const seconds: RoteiroDuration = isRoteiroDuration(row.seconds)
    ? (Number(row.seconds) as RoteiroDuration)
    : 45;

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: ROTEIRO_CHAT_COST,
    action: "cada mensagem do chat",
  });
  if (!gate.ok) return gate.deny;

  // Janela: só as últimas N mensagens voltam pro modelo. Trava o custo e
  // mantém o fio da conversa.
  const { data: hist } = await admin
    .from("script_messages")
    .select("role, content")
    .eq("script_id", id)
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(ROTEIRO_CHAT_WINDOW);

  const history: ChatTurn[] = ((hist ?? []) as ChatTurn[]).slice().reverse();

  let reply: string;
  let newScript: string | null;
  try {
    const out = await chatRoteiro({
      idea: row.idea,
      seconds,
      script: row.script,
      history,
      message,
    });
    reply = out.reply;
    newScript = out.script;
  } catch (e) {
    // Falhou ANTES da cobrança — nada a estornar.
    console.error("[roteiro/chat] falha:", (e as Error).message);
    return serverError("Não consegui responder agora. Tente de novo em instantes.");
  }

  if (gate.billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: ROTEIRO_CHAT_COST,
      kind: "generation",
      refType: "roteiro_chat",
      refId: randomUUID(),
      note: "Gerador de Roteiro — mensagem de ajuste",
    });
  }
  const charged = gate.billed ? ROTEIRO_CHAT_COST : 0;

  await admin.from("script_messages").insert([
    { script_id: id, user_id: auth.user_id, role: "user", content: message, credits_charged: charged },
    {
      script_id: id,
      user_id: auth.user_id,
      role: "assistant",
      content: reply,
      script_after: newScript,
      credits_charged: 0,
    },
  ]);

  // O roteiro do histórico passa a ser a versão nova: é ela que o aluno vai
  // gravar, e é ela que precisa estar lá quando ele voltar amanhã.
  if (newScript) {
    await admin.from("scripts").update({ script: newScript }).eq("id", id).eq("user_id", auth.user_id);
  }

  return jsonOk({ reply, script: newScript, cost: charged });
}
