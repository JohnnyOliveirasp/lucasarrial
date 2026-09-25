/**
 * POST /api/v1/sgp/audio/ciencia — RASCUNHO dos 4 checkboxes da tela 3.
 *
 * Por que existe: o estado dos checkboxes vivia só no React
 * (`useState(new Set())`), nascia vazio a cada carga e não era lido de lugar
 * nenhum. Quem marcava os quatro e atualizava a página perdia tudo em
 * silêncio — e "atualize a página" é justamente o conselho que o suporte dá.
 * É o espelho exato do conserto da tela de foto (c08da4b9, caso
 * amanda.rosaleal, 13/09), que nunca tinha chegado à tela de áudio (#492).
 *
 * Isto NÃO é o registro de ciência. Quem grava o consentimento continua sendo
 * o /concluir, o único que escreve `ciencia_audio_at` — a leitura de auditoria
 * ("o aluno confirmou?") é `ciencia_audio_at is not null`, nunca o tamanho de
 * `ciencia_audio`. Aqui só guardamos o que já foi marcado pra devolver na
 * próxima carga, e apenas enquanto o pedido está em "audio" e ninguém
 * confirmou ainda, pra uma volta à tela 3 não sujar o registro.
 *
 * Não afrouxa nada: o /concluir revalida os 4 itens do corpo do request.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { cienciaValida, podeGuardarRascunhoCienciaAudio } from "@/lib/sgp/passo-audio-pure";
import { atualizarSessao, pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";

export async function POST(request: NextRequest) {
  let body: { ciencia?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const ciencia = cienciaValida(body.ciencia);

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    // Já confirmou, ou já passou da tela 3: o registro vale mais que o rascunho.
    if (!podeGuardarRascunhoCienciaAudio(pedido)) return jsonOk({ ok: true, guardado: false });
    await atualizarSessao(pedido.sessao, { ciencia_audio: ciencia });
    return jsonOk({ ok: true, guardado: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao guardar as confirmações");
  }
}
