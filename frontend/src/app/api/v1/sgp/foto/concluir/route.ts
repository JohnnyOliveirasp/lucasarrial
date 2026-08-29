/**
 * POST /api/v1/sgp/foto/concluir — "Continuar" da tela 2.
 * Exige os 4 slots do guia aprovados; grava a ciência dos checkboxes com hora
 * (decisão 29/08) e define a REFERÊNCIA PADRÃO do aluno (`profiles.image_ref_key`
 * = frente neutro, senão frente sorrindo) — o que a planilha fazia por visão.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";
import { CIENCIA_FOTO, type SgpFotoSlot } from "@/lib/sgp/types";

const OBRIGATORIOS: SgpFotoSlot[] = ["frente_sorrindo", "frente_neutro", "lado_sorrindo", "lado_neutro"];

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
    const faltam = OBRIGATORIOS.filter((s) => !aprovadas.some((f) => f.slot === s));
    if (faltam.length) return badRequest("Faltam fotos aprovadas.", { faltam });

    const padrao =
      aprovadas.find((f) => f.slot === "frente_neutro") ?? aprovadas.find((f) => f.slot === "frente_sorrindo");
    if (padrao) {
      const { error } = await getAdmin()
        .from("profiles" as never)
        .update({ image_ref_key: padrao.key } as never)
        .eq("id", auth.user_id);
      if (error) throw new Error(error.message);
    }
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
