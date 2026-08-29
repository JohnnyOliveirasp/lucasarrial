/**
 * /api/v1/sgp/audio — um arquivo de áudio da tela 3 do SGP.
 *   POST   { key, nome } → o arquivo já está no R2; aqui o sistema MEDE
 *          (duração real, volume, silêncio, idioma) e guarda ✅/❌ com motivo.
 *   DELETE ?key= → tira da lista (o objeto fica; o treino só usa aprovados).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { medirAudio } from "@/lib/sgp/medir-audio";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";
import type { SgpAudio } from "@/lib/sgp/types";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  let body: { key?: unknown; nome?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "áudio";
  if (!key.startsWith(`${auth.user_id}/`)) return badRequest("Esse áudio não é seu");

  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    const m = await medirAudio(key);
    if (m.indeciso) return jsonOk({ audio: null, indeciso: true }, 202);

    const audio: SgpAudio = {
      key,
      nome,
      segundos: Math.round(m.falaSegundos),
      status: m.aprovado ? "aprovado" : "reprovado",
      motivos: m.motivos,
    };
    const audios = (pedido.audios ?? []).filter((a) => a.key !== key).concat(audio);
    await atualizarPedido(auth.user_id, { audios });
    return jsonOk({ audio, bruto_segundos: Math.round(m.segundos) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao analisar o áudio");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!key.startsWith(`${auth.user_id}/`)) return badRequest("Esse áudio não é seu");
  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    await atualizarPedido(auth.user_id, { audios: (pedido.audios ?? []).filter((a) => a.key !== key) });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remover o áudio");
  }
}
