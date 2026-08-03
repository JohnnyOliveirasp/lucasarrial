/**
 * GET — sessão do "gravar pelo celular" pro usuário LOGADO (graduação do
 * Lab 03/08): devolve o token do dia + a URL que vira QR. Client components
 * (Gravador oficial e criação de voz) usam pra listar/importar os takes.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { signRecorderToken } from "@/lib/recorder-test/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const token = signRecorderToken(auth.user_id);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fastcloner.com";
  return jsonOk({ token, phoneUrl: `${origin}/gravar/${token}` });
}
