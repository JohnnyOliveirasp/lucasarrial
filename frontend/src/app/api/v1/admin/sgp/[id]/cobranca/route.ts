/**
 * POST   /api/v1/admin/sgp/[id]/cobranca → "já cobrei este aluno"
 * DELETE /api/v1/admin/sgp/[id]/cobranca → desfazer (cliquei sem querer)
 *
 * Pedido do Lucas (04/09): o time cobrou a aluna no WhatsApp e o painel continuou
 * gritando "parado há 4 dias, cobrar o aluno".
 *
 * ⚠️ ISTO NÃO É UM "RESOLVER". A linha continua na tabela e o aluno continua
 * parado — só o alerta vermelho cala, e por tempo limitado (a régua está em
 * lib/sgp/painel.ts). Sumir com a linha sumiria com o alerta, não com o
 * problema, e o problema é uma aluna que pagou.
 *
 * `SUPORTE_OK`: quem cobra o aluno é o time de suporte, então o papel `suporte`
 * precisa conseguir clicar — a rota de LEITURA já aceitava, a de escrita também
 * tem que aceitar, senão o botão aparece e dá 403 na cara do atendente.
 *
 * Autoria igual à de lib/incidents/closure.ts: `email` é `string | null` no
 * AuthResult, então cai pro `user_id` em vez de gravar null. Cobrança sem dono
 * identificável não serve pra nada — o time precisa saber com quem falar.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonError, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { colunaCobrancaAusente } from "@/lib/sgp/cobranca";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

/**
 * A migration 106 ainda não entrou. Mensagem escrita PRO ATENDENTE, não pro
 * programador: ele não tem acesso ao código e não sabe o que é uma migration.
 * O que ele precisa saber é (a) não adiantou clicar, (b) cobre assim mesmo,
 * (c) não é culpa dele nem coisa que ele possa consertar.
 */
const SEM_COLUNA =
  "Ainda não dá pra marcar a cobrança: falta uma atualização do sistema, que já está com o time técnico. " +
  "Pode cobrar o aluno normalmente pelo WhatsApp — só não vai ficar registrado aqui ainda.";

async function gravar(request: NextRequest, id: string, marcar: boolean) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const quem = g.auth.email ?? g.auth.user_id;
  const update = marcar
    ? { cobrado_em: new Date().toISOString(), cobrado_por: quem }
    : { cobrado_em: null, cobrado_por: null };

  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .update(update as never)
      .eq("id", id)
      .select("id");

    if (error) {
      if (colunaCobrancaAusente(error)) {
        logger.info("audit", "sgp.cobranca_indisponivel", { by: g.auth.email, pedido: id });
        return jsonError("migration_pendente", SEM_COLUNA, 503);
      }
      return serverError(error.message);
    }
    // `.eq` em id inexistente não é erro no PostgREST, volta lista vazia. Sem
    // isto o atendente veria "ok" para um pedido que não existe.
    if (!data || (data as unknown[]).length === 0) return notFound("Pedido");

    logger.info("audit", marcar ? "sgp.cobranca_marcada" : "sgp.cobranca_desfeita", {
      by: g.auth.email,
      pedido: id,
    });
    return jsonOk({ ok: true, cobrado_em: update.cobrado_em, cobrado_por: update.cobrado_por });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao registrar a cobrança");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, true);
}

/**
 * Desfazer. Não estava no pedido, mas o pedido diz que "um clique NÃO pode calar
 * pra sempre" — e um clique errado cala 48h de um aluno que pagou, sem ninguém
 * conseguir reverter. É a mesma regra, na escala de minutos.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, false);
}
