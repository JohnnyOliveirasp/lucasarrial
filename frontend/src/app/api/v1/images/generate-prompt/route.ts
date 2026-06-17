/**
 * POST /api/v1/images/generate-prompt
 *
 * Botão "gerar prompt automático": a pessoa manda a IDEIA (pt-BR) e recebe um
 * prompt em inglês pronto pro gpt-image-2, preservando a identidade da foto.
 * Opcional — a pessoa pode escrever o próprio prompt e nem usar isso.
 *
 * Body: { idea: string } → { prompt: string }
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, unauthorized } from "@/lib/api/responses";
import { generateImagePrompt } from "@/lib/llm/generate-image-prompt";
import {
  moderateImagePrompt,
  CONTENT_BLOCKED_MESSAGE,
} from "@/lib/llm/moderate-image-prompt";

const IDEA_MAX = 1000;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { idea?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const idea = (body.idea ?? "").trim();
  if (!idea) return badRequest("Descreva sua ideia primeiro");
  if (idea.length > IDEA_MAX) return badRequest(`Ideia muito longa (máx ${IDEA_MAX}).`);

  // Segurança: barra a ideia antes de gastar a LLM com conteúdo proibido.
  const mod = await moderateImagePrompt(idea);
  if (!mod.allowed) return jsonError("content_blocked", CONTENT_BLOCKED_MESSAGE, 400);

  const prompt = await generateImagePrompt(idea);
  // Sentinela do system prompt (recusou conteúdo proibido).
  if (prompt.trim() === "__BLOCKED__") {
    return jsonError("content_blocked", CONTENT_BLOCKED_MESSAGE, 400);
  }
  return jsonOk({ prompt });
}
