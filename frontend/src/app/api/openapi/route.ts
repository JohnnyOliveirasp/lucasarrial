/**
 * GET /api/openapi → especificação OpenAPI 3.0 da API pública (TTS por voz +
 * publicador social). O `servers[0]` usa o host atual da requisição (funciona
 * em local e prod). Renderizada pelo Swagger UI em /api/docs.
 *
 * O CONTEÚDO mora em ./spec.ts (módulo sem next/server) pra guarda de
 * regressão openapi-doc.test.ts conferir doc × código no `node --test`.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildSpec } from "./spec.ts";

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Atrás do nginx (prod), o host real vem nos headers de proxy. Sem proxy
  // (local), cai no host da própria URL. Assim o Swagger mostra o domínio
  // público correto sem configuração manual.
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  return NextResponse.json(buildSpec(origin));
}
