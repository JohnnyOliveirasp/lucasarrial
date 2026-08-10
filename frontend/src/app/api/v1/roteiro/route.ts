/**
 * Gerador de Roteiro.
 *
 * POST /api/v1/roteiro — body { idea, seconds } → { id, script, cost }.
 *   Cobra ROTEIRO_COST (100) SÓ no sucesso — padrão das varinhas: se a LLM
 *   falhar, ninguém paga e não há o que estornar.
 * GET  /api/v1/roteiro — últimos roteiros do usuário (histórico da tela).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, forbidden, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { roteiroAllowedEmail } from "@/lib/roteiro/access";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { getAdmin } from "@/lib/db/admin";
import {
  isRoteiroDuration,
  ROTEIRO_COST,
  ROTEIRO_HISTORY_LIMIT,
  ROTEIRO_IDEA_MAX,
  ROTEIRO_IDEA_MIN,
  type RoteiroDuration,
} from "@/lib/roteiro/config";
import { generateRoteiro, type LinkSourceInput } from "@/lib/roteiro/writer";
import { LinkError, transcribeFromLink } from "@/lib/roteiro/link";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 Pré-produção: a rota fecha junto com a tela. Sem isto, um POST direto
  // geraria roteiro (e cobraria crédito) de quem não deveria ter acesso ainda.
  if (!(await roteiroAllowedEmail(auth.email))) return forbidden("Recurso em pré-produção.");

  let body: { idea?: unknown; seconds?: unknown; link?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const link = typeof body.link === "string" ? body.link.trim() : "";

  // Com link, a ideia escrita é opcional (o assunto vem do vídeo).
  if (!link && idea.length < ROTEIRO_IDEA_MIN) {
    return badRequest("Descreva a ideia do vídeo (pelo menos algumas palavras).");
  }
  if (idea.length > ROTEIRO_IDEA_MAX) {
    return badRequest(`A ideia pode ter no máximo ${ROTEIRO_IDEA_MAX} caracteres.`);
  }
  const seconds: RoteiroDuration = isRoteiroDuration(body.seconds)
    ? (Number(body.seconds) as RoteiroDuration)
    : 45;

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: ROTEIRO_COST,
    action: "gerar o roteiro",
  });
  if (!gate.ok) return gate.deny;

  // Link: baixar + transcrever ANTES de qualquer cobrança. Se o Instagram
  // pedir login (o caso comum), o aluno recebe a explicação e não paga nada.
  let source: LinkSourceInput | undefined;
  if (link) {
    try {
      const got = await transcribeFromLink(link);
      source = { transcript: got.transcript, title: got.title };
    } catch (e) {
      if (e instanceof LinkError) return jsonError("link_failed", e.message, 422, { code: e.code });
      console.error("[roteiro] falha no link:", (e as Error).message);
      return serverError("Não consegui abrir esse vídeo. Tente outro link ou escreva a ideia.");
    }
  }

  let script: string;
  let model: string;
  try {
    const out = await generateRoteiro(idea, seconds, source);
    script = out.script;
    model = out.model;
  } catch (e) {
    // Falhou ANTES da cobrança — nada a estornar.
    console.error("[roteiro] falha ao gerar:", (e as Error).message);
    return serverError("Não consegui escrever o roteiro agora. Tente de novo em instantes.");
  }

  if (gate.billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: ROTEIRO_COST,
      kind: "generation",
      refType: "roteiro",
      refId: randomUUID(),
      note: "Gerador de Roteiro",
    });
  }

  const charged = gate.billed ? ROTEIRO_COST : 0;
  const { data: row } = await getAdmin()
    .from("scripts")
    .insert({
      user_id: auth.user_id,
      idea,
      seconds,
      script,
      model,
      credits_charged: charged,
    })
    .select("id, created_at")
    .single();

  return jsonOk(
    {
      id: (row as { id?: string } | null)?.id ?? null,
      created_at: (row as { created_at?: string } | null)?.created_at ?? null,
      script,
      seconds,
      cost: charged,
    },
    201,
  );
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await roteiroAllowedEmail(auth.email))) return forbidden("Recurso em pré-produção.");

  const { data, error } = await getAdmin()
    .from("scripts")
    .select("id, idea, seconds, script, credits_charged, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(ROTEIRO_HISTORY_LIMIT);

  if (error) return serverError("Não consegui carregar seus roteiros.");
  return jsonOk({ items: data ?? [] });
}
