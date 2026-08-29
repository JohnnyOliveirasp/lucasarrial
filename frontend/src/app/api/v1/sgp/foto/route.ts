/**
 * /api/v1/sgp/foto — uma foto da tela 2 do SGP (sem conta: vale a sessão).
 *
 *   POST   { key } → a foto já está no R2; o sistema JULGA (visão) e guarda
 *          ✅/❌ com motivo no pedido. A cópia pras Imagens de Referência
 *          acontece só no "Confirmar e Enviar", quando a conta existe.
 *   DELETE ?key= → tira a foto da lista.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { ehRepetida, impressaoDaFoto } from "@/lib/sgp/impressao-foto";
import { julgarFoto } from "@/lib/sgp/julgar-foto";
import { atualizarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SGP_FOTOS_MAX, type SgpFoto } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.email_verificado_at) return badRequest("Confirme o seu e-mail na primeira tela.");
    if (!key.startsWith(`sgp/${pedido.sessao}/`)) return badRequest("Essa foto não é deste pedido");
    const atuais = (pedido.fotos ?? []).filter((f) => f.key !== key);
    if (atuais.length >= SGP_FOTOS_MAX) return badRequest(`Máximo de ${SGP_FOTOS_MAX} fotos.`);

    // Foto repetida não vira referência: o modelo aprenderia a mesma pose
    // duas vezes e o aluno acha que entregou 4 ângulos (Johnny 29/08).
    const impressao = await impressaoDaFoto(imagesBucket(), key);
    if (ehRepetida(impressao, atuais)) {
      return badRequest("Você já enviou esta foto. Escolha outra, de um ângulo diferente.");
    }

    const url = await createPresignedGet(imagesBucket(), key, 15 * 60);
    const v = await julgarFoto(url);
    if (v.indeciso) return jsonOk({ foto: null, indeciso: true }, 202);

    const foto: SgpFoto = {
      key,
      status: v.aprovada ? "aprovada" : "reprovada",
      tipo: v.tipo,
      sorrindo: v.sorrindo,
      rosto_visivel: v.rostoVisivel,
      perfil: v.perfil,
      sha256: impressao.sha256,
      dhash: impressao.dhash,
      motivos: v.motivos,
    };
    await atualizarSessao(pedido.sessao, { fotos: atuais.concat(foto) });
    return jsonOk({ foto });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao analisar a foto");
  }
}

export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    await atualizarSessao(pedido.sessao, { fotos: (pedido.fotos ?? []).filter((f) => f.key !== key) });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remover a foto");
  }
}
