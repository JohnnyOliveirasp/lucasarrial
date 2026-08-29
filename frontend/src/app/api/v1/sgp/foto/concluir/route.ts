/**
 * POST /api/v1/sgp/foto/concluir — "Continuar" da tela 2.
 * Exige o mínimo do guia (4 aprovadas) com pelo menos uma de FRENTE e uma de
 * LADO, e grava a ciência dos 5 checkboxes com hora. A referência padrão é
 * escolhida no envio, quando a conta existe (Johnny 29/08).
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { atualizarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { CIENCIA_FOTO, SGP_FOTOS_MIN } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  let body: { ciencia?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const ciencia = Array.isArray(body.ciencia)
    ? body.ciencia.filter((c): c is string => typeof c === "string" && (CIENCIA_FOTO as readonly string[]).includes(c))
    : [];
  if (ciencia.length !== CIENCIA_FOTO.length) return badRequest("Marque os 5 itens da lista antes de continuar.");

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    const aprovadas = (pedido.fotos ?? []).filter((f) => f.status === "aprovada");
    if (aprovadas.length < SGP_FOTOS_MIN) {
      return badRequest(`Faltam ${SGP_FOTOS_MIN - aprovadas.length} foto(s) aprovada(s).`);
    }
    const comRosto = aprovadas.filter((f) => f.rosto_visivel !== false);
    if (comRosto.length === 0) return badRequest("Envie pelo menos uma foto em que dê pra ver o seu rosto.");
    if (!comRosto.some((f) => f.perfil === true)) {
      return badRequest("Falta uma foto de LADO (perfil ou 3/4) — o guia pede de frente e de lado.");
    }
    if (!comRosto.some((f) => f.perfil !== true)) {
      return badRequest("Falta uma foto de FRENTE, olhando para a câmera.");
    }

    await atualizarSessao(pedido.sessao, {
      ciencia_foto: ciencia,
      ciencia_foto_at: new Date().toISOString(),
      status: pedido.status === "foto" ? "audio" : pedido.status,
    });
    return jsonOk({ ok: true, proximo: "audio" });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao concluir as fotos");
  }
}
