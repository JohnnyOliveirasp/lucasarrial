/**
 * POST /api/v1/sgp/audio/concluir — "Continuar" da tela 3.
 * Exige 20–60 min de FALA aprovada (régua do app), grava a ciência dos 4
 * checkboxes com hora e deixa a voz do onboarding pronta pro treino
 * (`awaiting_training`, só com os arquivos aprovados). O treino em si — e a
 * cobrança — disparam no "Confirmar e Enviar" da tela 4.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
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
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    if (!pedido.voice_id) return badRequest("Envie seus áudios antes de continuar.");
    const aprovados = (pedido.audios ?? []).filter((a) => a.status === "aprovado");
    const total = aprovados.reduce((s, a) => s + a.segundos, 0);
    if (total < SGP_AUDIO_MIN_SEGUNDOS) {
      return badRequest(`Faltam ${Math.ceil((SGP_AUDIO_MIN_SEGUNDOS - total) / 60)} min de fala aprovada.`);
    }
    if (total > SGP_AUDIO_MAX_SEGUNDOS) {
      return badRequest(`Passou de ${SGP_AUDIO_MAX_SEGUNDOS / 60} min — remova algum arquivo.`);
    }

    const { error } = await getAdmin()
      .from("voices")
      .update({
        raw_audio_paths: aprovados.map((a) => a.key),
        duration_seconds: total,
        status: "awaiting_training",
        error_message: null,
      })
      .eq("id", pedido.voice_id)
      .eq("user_id", auth.user_id);
    if (error) throw new Error(error.message);

    await atualizarPedido(auth.user_id, {
      ciencia_audio: ciencia,
      ciencia_audio_at: new Date().toISOString(),
      status: pedido.status === "audio" ? "revisao" : pedido.status,
    });
    return jsonOk({ ok: true, proximo: "revisao" });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao concluir os áudios");
  }
}
