/**
 * POST /api/v1/admin/sgp/[id]/retomada — gera o LINK DE RETOMADA de um pedido.
 *
 * Pra que serve: o aluno perdeu o cookie da sessão (trocou de navegador, limpou
 * os dados, abriu no celular) e ficou sem caminho de volta pro próprio pedido.
 * O time cola este link no e-mail e ele volta exatamente de onde parou.
 *
 * POR QUE POST NUMA ROTA QUE SÓ LÊ: gerar o link é **entregar a chave do
 * pedido**. Ficar acessível por GET faria qualquer prefetch/histórico/log de
 * proxy carregar a chave junto. Nada é gravado aqui.
 *
 * O `sessao` continua FORA da listagem do /admin/sgp de propósito (ver o
 * cabeçalho de ../../route.ts): a chave sai por esta porta, uma de cada vez e
 * por clique de gente, não numa lista de 500 linhas que atualiza sozinha.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { linkDeRetomada, RETOMADA_VALIDADE_MS } from "@/lib/sgp/retomada";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id ?? "")) return badRequest("Pedido inválido");

  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .select("sessao, email, nome, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(error.message);
    const pedido = data as { sessao: string; email: string | null; nome: string | null; status: string } | null;
    if (!pedido) return notFound("Pedido");

    const link = linkDeRetomada(pedido.sessao);
    if (!link) return serverError("Falta configurar NEXT_PUBLIC_SITE_URL para montar o link.");

    return jsonOk({
      link,
      email: pedido.email,
      nome: pedido.nome,
      status: pedido.status,
      validade_dias: Math.round(RETOMADA_VALIDADE_MS / (24 * 60 * 60 * 1000)),
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao gerar o link de retomada");
  }
}
