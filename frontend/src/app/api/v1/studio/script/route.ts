/**
 * POST /api/v1/studio/script — Vídeo Estúdio F5: roteirista documentário
 * viral. Body: { idea, seconds? (30|45|60) } → { script, cost }.
 * Stateless (o roteiro é teleprompter; a edição ancora no que for FALADO).
 * Cobra STUDIO_SCRIPT_COST só no sucesso (padrão das varinhas).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { isAdmin } from "@/lib/admin/guard";
import { debitCredits } from "@/lib/credits/service";
import { gateStudioCredits } from "@/lib/studio/billing";
import { STUDIO_SCRIPT_COST } from "@/lib/studio/pricing";
import {
  generateStudioScript,
  SCRIPT_DURATIONS,
  type ScriptDuration,
} from "@/lib/studio/script-writer";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  // 🚧 PRÉ-PRODUÇÃO: só admin até validar (remover junto com o guard da página).
  if (!(await isAdmin(auth.email))) return jsonError("forbidden", "Ferramenta em teste (pré-produção).", 403);

  let body: { idea?: unknown; seconds?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  if (idea.length < 5) return badRequest("Descreva a ideia do vídeo (pelo menos algumas palavras).");
  const seconds = (SCRIPT_DURATIONS as readonly number[]).includes(Number(body.seconds))
    ? (Number(body.seconds) as ScriptDuration)
    : 45;

  const gate = await gateStudioCredits({
    userId: auth.user_id,
    email: auth.email,
    cost: STUDIO_SCRIPT_COST,
    action: "gerar o roteiro",
  });
  if (!gate.ok) return gate.deny;

  let script: string;
  try {
    script = await generateStudioScript(idea, seconds);
  } catch {
    // Falha ANTES da cobrança — nada a estornar.
    return serverError("Não consegui gerar o roteiro agora. Tente novamente.");
  }

  if (gate.billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: STUDIO_SCRIPT_COST,
      kind: "video",
      refType: "studio_script",
      refId: randomUUID(),
      note: "Vídeo Estúdio — roteiro documentário viral",
    });
  }

  return jsonOk({ script, cost: gate.billed ? STUDIO_SCRIPT_COST : 0 }, 201);
}
