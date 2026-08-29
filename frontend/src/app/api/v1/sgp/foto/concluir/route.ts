/**
 * POST /api/v1/sgp/foto/concluir — "Continuar" da tela 2.
 * Exige o mínimo do guia (4 fotos aprovadas); grava a ciência dos checkboxes
 * com hora (decisão 29/08) e define a REFERÊNCIA PADRÃO do aluno
 * (`profiles.image_ref_key` = rosto de frente neutro > rosto de frente >
 * primeira aprovada) — o que a planilha fazia por visão.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";
import { CIENCIA_FOTO, SGP_FOTOS_MIN } from "@/lib/sgp/types";

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
    ? body.ciencia.filter((c): c is string => typeof c === "string" && (CIENCIA_FOTO as readonly string[]).includes(c))
    : [];
  if (ciencia.length !== CIENCIA_FOTO.length) return badRequest("Marque os 5 itens da lista antes de continuar.");

  try {
    const pedido = await lerPedido(auth.user_id);
    if (!pedido) return badRequest("Comece pela tela de dados.");
    const aprovadas = (pedido.fotos ?? []).filter((f) => f.status === "aprovada");
    if (aprovadas.length < SGP_FOTOS_MIN) {
      return badRequest(`Faltam ${SGP_FOTOS_MIN - aprovadas.length} foto(s) aprovada(s).`);
    }

    // A referência padrão precisa mostrar o rosto (é dela que sai o clone de
    // foto). As outras — corpo inteiro, de costas — continuam valendo como
    // referência extra: o modelo aprende o corpo (Johnny 29/08).
    const comRosto = aprovadas.filter((f) => f.rosto_visivel !== false);
    if (comRosto.length === 0) {
      return badRequest("Envie pelo menos uma foto em que dê pra ver o seu rosto.");
    }
    const padrao =
      comRosto.find((f) => f.tipo === "rosto_frente" && !f.sorrindo) ??
      comRosto.find((f) => f.tipo === "rosto_frente") ??
      comRosto.find((f) => f.tipo === "meio_corpo") ??
      comRosto[0];
    const { error } = await getAdmin()
      .from("profiles" as never)
      .update({ image_ref_key: padrao.key } as never)
      .eq("id", auth.user_id);
    if (error) throw new Error(error.message);

    await atualizarPedido(auth.user_id, {
      ciencia_foto: ciencia,
      ciencia_foto_at: new Date().toISOString(),
      status: pedido.status === "foto" ? "audio" : pedido.status,
    });
    return jsonOk({ ok: true, proximo: "audio" });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao concluir as fotos");
  }
}
