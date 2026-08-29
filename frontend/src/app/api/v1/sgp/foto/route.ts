/**
 * /api/v1/sgp/foto — uma foto de um slot da tela 2 do SGP.
 *
 *   POST   { slot, key } → a foto já está no R2 (subiu pelo presigned de
 *          /images/upload-url). Aqui o sistema JULGA (visão) e, se aprovou,
 *          ADOTA como referência do aluno (`{user}/refs/` — o mesmo lugar em
 *          que a planilha jogava). Devolve a linha do slot pra tela.
 *   DELETE ?slot= → tira a foto do slot (a referência adotada fica no acervo;
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
import { SGP_FOTO_SLOTS, type SgpFoto, type SgpFotoSlot } from "@/lib/sgp/types";

function slotValido(s: unknown): s is SgpFotoSlot {
  return typeof s === "string" && (SGP_FOTO_SLOTS as readonly string[]).includes(s);
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  let body: { slot?: unknown; key?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (!slotValido(body.slot)) return badRequest("Slot inválido");
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key.startsWith(`${auth.user_id}/`)) return badRequest("Essa foto não é sua");

  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");

    const url = await createPresignedGet(imagesBucket(), key, 15 * 60);
    const v = await julgarFoto(url, body.slot);
    if (v.indeciso) {
      return jsonOk({ foto: null, indeciso: true }, 202);
    }

    let refKey = key;
    if (v.aprovada) {
      refKey = await adotarReferencia(auth.user_id, key);
      await apagarStagingAdotado(getAdmin(), auth.user_id, key).catch(() => {});
    }
    const foto: SgpFoto = {
      slot: body.slot,
      key: refKey,
      status: v.aprovada ? "aprovada" : "reprovada",
      tipo: v.tipo,
      motivos: v.motivos,
    };
    const fotos = (pedido.fotos ?? []).filter((f) => f.slot !== body.slot).concat(foto);
    await atualizarPedido(auth.user_id, { fotos });
    return jsonOk({ foto, url: await createPresignedGet(imagesBucket(), refKey, 60 * 60) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao analisar a foto");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const slot = request.nextUrl.searchParams.get("slot");
  if (!slotValido(slot)) return badRequest("Slot inválido");
  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    await atualizarPedido(auth.user_id, { fotos: (pedido.fotos ?? []).filter((f) => f.slot !== slot) });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remover a foto");
  }
}
