/**
 * /api/v1/sgp/pedido — o pedido do aluno no Sistema de Geração Pronto.
 *
 *   GET  → o pedido do aluno logado (ou null se ainda não começou).
 *   POST → tela 1 concluída: grava nome + WhatsApp no PERFIL do próprio aluno
 *          (decisão 29/08: "tudo nos dados do próprio aluno") e cria/avança o
 *          pedido pra `foto`. Idempotente — repetir a tela 1 só atualiza.
 *
 * O aluno já chega autenticado (o código por e-mail da tela 1 cria a sessão).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { normalizarWhatsapp, type SgpPedidoRow } from "@/lib/sgp/types";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .select("*")
      .eq("user_id", auth.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return jsonOk({ pedido: (data as SgpPedidoRow | null) ?? null });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao ler o pedido");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { nome?: unknown; whatsapp?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const whatsapp = typeof body.whatsapp === "string" ? normalizarWhatsapp(body.whatsapp) : null;
  if (nome.length < 3) return badRequest("Informe o nome completo.");
  if (!whatsapp) return badRequest("Informe um WhatsApp válido com DDD.");

  try {
    const admin = getAdmin();
    const { error: perfilErr } = await admin
      .from("profiles" as never)
      .update({ display_name: nome, whatsapp } as never)
      .eq("id", auth.user_id);
    if (perfilErr) throw new Error(perfilErr.message);

    // Pedido: cria em `foto`; se já existe e ainda está em `dados`, avança.
    const { data: atual } = await admin
      .from("sgp_pedidos" as never)
      .select("id, status")
      .eq("user_id", auth.user_id)
      .maybeSingle();
    const linha = atual as { id: string; status: string } | null;

    if (!linha) {
      const { error } = await admin
        .from("sgp_pedidos" as never)
        .insert({ user_id: auth.user_id, status: "foto" } as never);
      if (error) throw new Error(error.message);
    } else if (linha.status === "dados") {
      const { error } = await admin
        .from("sgp_pedidos" as never)
        .update({ status: "foto" } as never)
        .eq("id", linha.id);
      if (error) throw new Error(error.message);
    }

    return jsonOk({ ok: true, proximo: "foto" });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao salvar seus dados");
  }
}
