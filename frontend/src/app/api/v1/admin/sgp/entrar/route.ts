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
 * GRUPO FECHADO: abre conta de quem TEM PEDIDO no SGP **ou** COMPROU o SGP na
 * Hotmart e nunca começou (18/09: o botão tinha que aparecer na grid inteira,
 * e 236 das linhas são exatamente essas — conta criada pelo webhook da compra,
 * sem pedido nenhum). E-mail fora dos dois casos devolve 404: este atalho não
 * é uma porta pra base inteira.
 *
 * `SUPORTE_OK` porque quem faz esse trabalho é o suporte (Karen), além de
 * admin (Johnny, Rayanne). Todo uso vai pro log de auditoria com QUEM entrou,
 * em QUAL conta e QUANDO.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { logger } from "@/lib/logger/server";
import { DESTINO_PADRAO, montarLinkDeEntrada } from "@/lib/sgp/link-entrada-pure";
import { SGP_PRODUCT_ID_PADRAO } from "@/lib/payments/sgp-boas-vindas";

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

    // Portão do grupo fechado, porta 1: tem pedido no SGP?
    const { data: pedido, error: erroPedido } = await admin
      .from("sgp_pedidos")
      .select("id, email, user_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (erroPedido) return serverError(erroPedido.message);

    // Porta 2: comprou o SGP na Hotmart e nunca abriu o portal. O id do produto
    // mora dentro do JSON e vem como número — por isso o `->>`, que devolve
    // texto (medido: 355 de 355 compras do SGP casam por este caminho).
    let compraSgp = false;
    if (!pedido) {
      const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO;
      const { data: compra, error: erroCompra } = await admin
        .from("payment_events")
        .select("id")
        .eq("event_type", "PURCHASE_APPROVED")
        .eq("payload->data->product->>id", produtoSgp)
        .ilike("payload->data->buyer->>email", email)
        .limit(1)
        .maybeSingle();
      if (erroCompra) return serverError(erroCompra.message);
      compraSgp = !!compra;
    }

    // 404 escrito à mão: o `notFound()` cola " not found" no fim e o atendente
    // leria "não é comprador do SGP not found".
    if (!pedido && !compraSgp) {
      return jsonError("not_found", "Este e-mail não é comprador do SGP", 404);
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${site}/auth/callback?next=${encodeURIComponent(DESTINO_PADRAO)}`,
      },
    });
    if (error) {
      // Conta ainda não existe (comprou e o webhook não criou, ou parou antes
      // do "Confirmar e Enviar"). O atendente precisa ler isso em português —
      // "User not found" faria ele achar que o botão está quebrado.
      const msg = /not found|no user/i.test(error.message)
        ? "Este aluno ainda não tem conta na plataforma — não há conta pra abrir."
        : error.message;
      return badRequest(msg);
    }

    // O link entregue é montado com `token_hash` na QUERY, NUNCA o
    // `action_link` — ele entrega a sessão no fragmento (`#access_token=…`),
    // que o callback não lê, e o token de uso único morre no caminho.
    // MEDIDO 20/09 com `magiclink` — ver o docblock de `link-entrada-pure.ts`.
    const montado = montarLinkDeEntrada(data.properties, site, DESTINO_PADRAO);
    if (!montado.ok) return serverError(montado.erro);
    const link = montado.link;

    logger.info("audit", "admin.sgp.entrar_como_aluno", {
      admin: g.auth.email,
      role: g.role,
      target: email,
      pedido: pedido ? (pedido as { id: string }).id : null,
      porta: pedido ? "pedido" : "compra",
    });

    return jsonOk({ link });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao gerar o acesso");
  }
}
