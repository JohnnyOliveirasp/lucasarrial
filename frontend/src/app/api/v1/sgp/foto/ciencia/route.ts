/**
 * POST /api/v1/sgp/foto/ciencia — RASCUNHO dos 5 checkboxes da tela 2.
 *
 * Por que existe: o estado dos checkboxes vivia só no React
 * (`useState(new Set())`), nascia vazio a cada carga e não era lido de lugar
 * nenhum. Quem marcava os cinco e atualizava a página perdia tudo em
 * silêncio — e "atualize a página" é justamente o conselho que o suporte dá.
 * Foi o que aconteceu com amanda.rosaleal@gmail.com em 13/09.
 *
 * Isto NÃO é o registro de ciência. Quem grava o consentimento continua sendo
 * o /concluir, o único que escreve `ciencia_foto_at` — a leitura de auditoria
 * ("o aluno confirmou?") é `ciencia_foto_at is not null`, nunca o tamanho de
 * `ciencia_foto`. Aqui só guardamos o que já foi marcado pra devolver na
 * próxima carga, e apenas enquanto o pedido está em "foto" e ninguém
 * confirmou ainda, pra uma volta à tela 2 não sujar o registro.
 *
 * Não afrouxa nada: o /concluir revalida os 5 itens do corpo do request.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { cienciaValida, podeGuardarRascunhoCiencia } from "@/lib/sgp/passo-foto-pure";
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
    // Já confirmou, ou já passou da tela 2: o registro vale mais que o rascunho.
    if (!podeGuardarRascunhoCiencia(pedido)) return jsonOk({ ok: true, guardado: false });
    await atualizarSessao(pedido.sessao, { ciencia_foto: ciencia });
    return jsonOk({ ok: true, guardado: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao guardar as confirmações");
  }
}
