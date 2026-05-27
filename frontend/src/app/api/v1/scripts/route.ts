/**
 * POST /api/v1/scripts
 *
 * Gera um roteiro de leitura novo (via Claude Haiku) pra pessoa ler em voz alta
 * durante a gravação de voz. Formato: história casual com blocos de direção
 * emocional (estilo ElevenLabs). Body opcional: { theme?: string }.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { generateVoiceScript } from "@/lib/llm/generate-script";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let theme: string | undefined;
  try {
    const body = (await request.json()) as { theme?: string };
    if (typeof body?.theme === "string" && body.theme.trim()) theme = body.theme.trim();
  } catch {
    /* sem body — tema aleatório */
  }

  const script = await generateVoiceScript(theme);
  if (!script) {
    return serverError("Não foi possível gerar o roteiro agora. Tente de novo.");
  }
  return jsonOk({ script });
}
