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
import { SGP_AUDIO_MAX_SEGUNDOS, type SgpAudio } from "@/lib/sgp/types";

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

    // TETO POR ARQUIVO (Johnny 29/08: "não pode deixar subir áudios maiores
    // que 60 minutos"). Até aqui o teto só existia no "Continuar", e sobre a
    // SOMA da fala — então um único arquivo de 75 min era aprovado e depois
    // travava o aluno num beco: a mensagem mandava "remova algum arquivo" e
    // só existia aquele. Aqui a régua é a duração BRUTA medida pelo ffmpeg,
    // que é a única confiável (o header do MP3 mente — ver incidente do Xing).
    const brutoLimite = m.segundos > SGP_AUDIO_MAX_SEGUNDOS;
    const motivos = brutoLimite
      ? [
          `este arquivo tem ${Math.round(m.segundos / 60)} min — o limite é ` +
            `${SGP_AUDIO_MAX_SEGUNDOS / 60} min por arquivo. Corte em partes menores e envie de novo.`,
          ...m.motivos,
        ]
      : m.motivos;

    const audio: SgpAudio = {
      key,
      nome,
      segundos: Math.round(m.falaSegundos),
      status: m.aprovado && !brutoLimite ? "aprovado" : "reprovado",
      motivos,
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
