/**
 * POST /api/v1/sgp/audio/slot — presigned PUT pra UM áudio da tela 3.
 * Sobe pra área da SESSÃO (`sgp/<sessao>/audio/...`), no bucket de vozes; a
 * voz e a cópia pra `{user}/{voice}/raw/` nascem no "Confirmar e Enviar".
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedPut, isAllowedAudioMime } from "@/lib/r2/presigned";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SGP_AUDIO_MAX_SEGUNDOS } from "@/lib/sgp/types";

const MAX_ARQUIVOS = 20;

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
  if (!isAllowedAudioMime(contentType)) return badRequest(`Formato de áudio não suportado: ${contentType}`);

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.email_verificado_at) return badRequest("Confirme o seu e-mail na primeira tela.");
    if ((pedido.audios ?? []).length >= MAX_ARQUIVOS) return badRequest(`Máximo de ${MAX_ARQUIVOS} arquivos.`);

    // Teto já batido: não adianta gastar upload + ffmpeg + Whisper num arquivo
    // que o "Continuar" vai recusar de qualquer jeito (Johnny 29/08). Cada
    // análise custa dinheiro nosso e minutos do aluno.
    const falaAprovada = (pedido.audios ?? [])
      .filter((a) => a.status === "aprovado")
      .reduce((s, a) => s + (a.segundos ?? 0), 0);
    if (falaAprovada >= SGP_AUDIO_MAX_SEGUNDOS) {
      return badRequest(
        `Você já tem ${Math.round(falaAprovada / 60)} min de fala aprovada e o limite é ` +
          `${SGP_AUDIO_MAX_SEGUNDOS / 60} min. Remova um arquivo antes de enviar outro.`,
      );
    }

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const key = `sgp/${pedido.sessao}/audio/${randomUUID().slice(0, 8)}_${safe}`;
    // 6h: áudio de treino passa de centenas de MB em conexão lenta.
    const upload_url = await createPresignedPut(R2_BUCKETS.voices, key, contentType, 6 * 3600);
    return jsonOk({ key, upload_url });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao preparar o upload");
  }
}
