/**
 * /api/v1/sgp/foto — uma foto da tela 2 do SGP.
 *
 *   POST   { key } → a foto já está no R2 (subiu pelo presigned de
 *          /images/upload-url). Aqui o sistema JULGA (visão) e, se aprovou,
 *          ADOTA como referência do aluno (`{user}/refs/` — o mesmo lugar em
 *          que a planilha jogava). Devolve a linha da foto pra tela.
 *   DELETE ?key= → tira a foto da lista (a referência adotada fica no acervo;
 *          apagar de lá é na aba Imagens de Referência).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { adotarReferencia, apagarStagingAdotado } from "@/lib/images/refs";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { julgarFoto } from "@/lib/sgp/julgar-foto";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";
import { SGP_FOTOS_MAX, type SgpFoto } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key.startsWith(`${auth.user_id}/`)) return badRequest("Essa foto não é sua");

  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    const atuais = (pedido.fotos ?? []).filter((f) => f.key !== key);
    if (atuais.length >= SGP_FOTOS_MAX) return badRequest(`Máximo de ${SGP_FOTOS_MAX} fotos. Remova alguma.`);

    const url = await createPresignedGet(imagesBucket(), key, 15 * 60);
    const v = await julgarFoto(url);
    if (v.indeciso) return jsonOk({ foto: null, indeciso: true }, 202);

    let refKey = key;
    if (v.aprovada) {
      refKey = await adotarReferencia(auth.user_id, key);
      await apagarStagingAdotado(getAdmin(), auth.user_id, key).catch(() => {});
    }
    const foto: SgpFoto = {
      key: refKey,
      status: v.aprovada ? "aprovada" : "reprovada",
      tipo: v.tipo,
      sorrindo: v.sorrindo,
      motivos: v.motivos,
    };
    await atualizarPedido(auth.user_id, { fotos: atuais.concat(foto) });
    return jsonOk({ foto });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao analisar a foto");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!key.startsWith(`${auth.user_id}/`)) return badRequest("Essa foto não é sua");
  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    await atualizarPedido(auth.user_id, { fotos: (pedido.fotos ?? []).filter((f) => f.key !== key) });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remover a foto");
  }
}
