/**
 * /api/v1/sgp/audio — um arquivo de áudio da tela 3 (sem conta: vale a sessão).
 *   POST   { key, nome } → mede (duração real, volume, silêncio, idioma) e
 *          guarda ✅/❌ com motivo. Só a FALA conta pros minutos.
 *   DELETE ?key= → tira da lista.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { medirAudio } from "@/lib/sgp/medir-audio";
import { atualizarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import type { SgpAudio } from "@/lib/sgp/types";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let body: { key?: unknown; nome?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "áudio";

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.email_verificado_at) return badRequest("Confirme o seu e-mail na primeira tela.");
    if (!key.startsWith(`sgp/${pedido.sessao}/`)) return badRequest("Esse áudio não é deste pedido");

    const m = await medirAudio(key);
    if (m.indeciso) return jsonOk({ audio: null, indeciso: true }, 202);

    const audio: SgpAudio = {
      key,
      nome,
      segundos: Math.round(m.falaSegundos),
      status: m.aprovado ? "aprovado" : "reprovado",
      motivos: m.motivos,
      avisos: m.avisos,
    };
    const audios = (pedido.audios ?? []).filter((a) => a.key !== key).concat(audio);
    await atualizarSessao(pedido.sessao, { audios });
    return jsonOk({ audio, bruto_segundos: Math.round(m.segundos) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao analisar o áudio");
  }
}

export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    await atualizarSessao(pedido.sessao, { audios: (pedido.audios ?? []).filter((a) => a.key !== key) });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remover o áudio");
  }
}
