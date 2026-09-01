/**
 * POST /api/v1/sgp/foto/slot — presigned PUT pra UMA foto da tela 2.
 * Sobe pra área da SESSÃO (`sgp/<sessao>/fotos/...`); no "Confirmar e Enviar"
 * as aprovadas são copiadas pras Imagens de Referência da conta criada.
 * Sem login: quem prova quem é o cookie da sessão + o e-mail confirmado.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedPut, isAllowedImageMime, normalizarNomeDeImagem } from "@/lib/r2/presigned";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SGP_FOTOS_MAX } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  let body: { filename?: unknown; content_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const contentType = typeof body.content_type === "string" ? body.content_type.trim() : "";
  if (!filename || !contentType) return badRequest("Arquivo sem nome ou tipo");
  if (!isAllowedImageMime(contentType)) return badRequest(`Formato não suportado: ${contentType}`);

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.email_verificado_at) return badRequest("Confirme o seu e-mail na primeira tela.");
    if ((pedido.fotos ?? []).length >= SGP_FOTOS_MAX) {
      return badRequest(`Máximo de ${SGP_FOTOS_MAX} fotos. Remova alguma.`);
    }
    const safe = normalizarNomeDeImagem(filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const key = `sgp/${pedido.sessao}/fotos/${randomUUID().slice(0, 8)}_${safe}`;
    const upload_url = await createPresignedPut(imagesBucket(), key, contentType, 3600);
    return jsonOk({ key, upload_url });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao preparar o upload");
  }
}
