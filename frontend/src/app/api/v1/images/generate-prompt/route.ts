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
import { badRequest, jsonOk, unauthorized } from "@/lib/api/responses";
import { generateImagePrompt } from "@/lib/llm/generate-image-prompt";

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

  const prompt = await generateImagePrompt(idea);
  return jsonOk({ prompt });
}
