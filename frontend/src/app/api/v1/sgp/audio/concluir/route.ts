/**
 * POST /api/v1/sgp/audio/concluir — "Continuar" da tela 3.
 * Exige 20–60 min de FALA aprovada (régua do app) e grava a ciência dos 4
 * checkboxes com hora. A voz é criada no envio, quando a conta existe.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { atualizarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  let body: { ciencia?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const ciencia = Array.isArray(body.ciencia)
    ? body.ciencia.filter((c): c is string => typeof c === "string" && (CIENCIA_AUDIO as readonly string[]).includes(c))
    : [];
  if (ciencia.length !== CIENCIA_AUDIO.length) return badRequest("Marque os 4 itens da lista antes de continuar.");

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    const aprovados = (pedido.audios ?? []).filter((a) => a.status === "aprovado");
    const total = aprovados.reduce((s, a) => s + a.segundos, 0);
    if (total < SGP_AUDIO_MIN_SEGUNDOS) {
      return badRequest(`Faltam ${Math.ceil((SGP_AUDIO_MIN_SEGUNDOS - total) / 60)} min de fala aprovada.`);
    }
    if (total > SGP_AUDIO_MAX_SEGUNDOS) {
      return badRequest(`Passou de ${SGP_AUDIO_MAX_SEGUNDOS / 60} min — remova algum arquivo.`);
    }

    await atualizarSessao(pedido.sessao, {
      ciencia_audio: ciencia,
      ciencia_audio_at: new Date().toISOString(),
      status: pedido.status === "audio" ? "revisao" : pedido.status,
    });
    return jsonOk({ ok: true, proximo: "revisao" });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao concluir os áudios");
  }
}
