/**
 * POST /api/v1/admin/sgp/entrar → link de ENTRADA na conta do aluno do SGP.
 *
 * Por que existe (pedido do Johnny 18/09, herdando o serviço feito-pra-você da
 * planilha): o suporte precisa ENTRAR na conta do comprador do SGP pra mexer
 * nas fotos e no áudio dele — era o que as colunas "E-mail/Senha FastCloner"
 * da planilha serviam. Aqui a casa gera a própria chave de entrada, então
 * ninguém precisa guardar senha de aluno em lugar nenhum:
 *
 *  - NÃO toca na senha do aluno (`magiclink`, não `recovery`): ele não é
 *    deslogado, não recebe e-mail e continua entrando com a senha dele;
 *  - funciona pra quem entrou pelo Google ou nunca definiu senha — que era
 *    justamente o "parado por login/senha" da planilha;
 *  - o link é de uso único e expira sozinho.
 *
 * GRUPO FECHADO: só abre conta que tem pedido no SGP. E-mail de fora devolve
 * 404 — este atalho não é uma porta pra base inteira.
 *
 * `SUPORTE_OK` porque quem faz esse trabalho é o suporte (Karen), além de
 * admin (Johnny, Rayanne). Todo uso vai pro log de auditoria com QUEM entrou,
 * em QUAL conta e QUANDO.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return badRequest("Informe o e-mail do aluno");

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/+$/, "");

  try {
    const admin = getAdmin();

    // Portão do grupo fechado: tem pedido no SGP?
    const { data: pedido, error: erroPedido } = await admin
      .from("sgp_pedidos")
      .select("id, email, user_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (erroPedido) return serverError(erroPedido.message);
    if (!pedido) return notFound("Este e-mail não tem pedido no SGP");

    // Conta ainda não existe: o wizard só cria no "Confirmar e Enviar". Dizer
    // isso em português evita o atendente achar que o botão está quebrado.
    if (!(pedido as { user_id: string | null }).user_id) {
      return badRequest(
        "Este aluno ainda não tem conta — ele parou antes de concluir o envio no SGP.",
      );
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${site}/auth/callback?next=${encodeURIComponent("/app")}` },
    });
    if (error) return badRequest(error.message);

    const link = data.properties?.action_link ?? null;
    if (!link) return serverError("O Supabase não devolveu o link de entrada");

    logger.info("audit", "admin.sgp.entrar_como_aluno", {
      admin: g.auth.email,
      role: g.role,
      target: email,
      pedido: (pedido as { id: string }).id,
    });

    return jsonOk({ link });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao gerar o acesso");
  }
}
