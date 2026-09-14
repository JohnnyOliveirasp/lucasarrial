/**
 * POST   /api/v1/admin/sgp/[id]/erro → "este pedido deu erro" (marcação do time)
 * DELETE /api/v1/admin/sgp/[id]/erro → desfazer (marquei a linha errada)
 *
 * Pedido do Lucas (10/09, reenviado 14/09): o time descobre POR FORA que um
 * pedido deu errado — o aluno avisou no WhatsApp, o material veio errado — e não
 * tem onde registrar. O sistema acha que está tudo bem, e a tela concorda com o
 * sistema.
 *
 * ⚠️ ISTO NÃO ESCREVE NA COLUNA `erro`. Aquela é do SISTEMA: `lib/sgp/etapas.ts`
 * carimba a falha técnica ali sob o cadeado `!pedido.erro` ("nunca sobrescreve um
 * erro que já foi escrito por outro caminho"). Um atendente escrevendo lá antes
 * do robô faria o robô CALAR e a falha técnica real sumir. Por isso colunas
 * próprias (migration 109), que carregam autor e data de quebra.
 *
 * ⚠️ E NÃO MEXE NO `status`. Tentador marcar `falhou`, mas `status` é a máquina de
 * estados da produção (`lib/sgp/fracasso.ts` dispara e-mail pro aluno e chama o
 * grupo na transição pra `falhou`). Anotação de suporte não pode disparar e-mail
 * pro aluno nem escalar incidente. A tela lê as duas coisas e mostra ERRO; o
 * pipeline segue sem saber que alguém anotou.
 *
 * `SUPORTE_OK`: quem descobre o erro é o time de suporte, que tem papel `suporte`
 * e não é admin cheio. Sem isso o botão aparece e dá 403 na cara do atendente —
 * é a regra que a rota de cobrança já segue e que o pedido repete em caixa alta.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonError, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { colunaErroManualAusente } from "@/lib/sgp/cobranca";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

/**
 * A migration 109 ainda não entrou. Mensagem escrita PRO ATENDENTE, não pro
 * programador: ele não tem acesso ao código e não sabe o que é uma migration.
 * Precisa saber (a) não adiantou clicar, (b) o caso existe mesmo assim, (c) não
 * é culpa dele nem coisa que ele possa consertar.
 */
const SEM_COLUNA =
  "Ainda não dá pra marcar erro aqui: falta uma atualização do sistema, que já está com o time técnico. " +
  "Avise o time pelo canal de sempre — o pedido continua na tela do mesmo jeito.";

/** O atendente escreve livre; o banco não precisa de um textão. */
const MOTIVO_MAX = 500;

/** Aceita `{ motivo }` no corpo, e aceita corpo vazio (motivo é opcional). */
async function lerMotivo(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") return null;
    const bruto = (body as { motivo?: unknown }).motivo;
    if (typeof bruto !== "string") return null;
    const limpo = bruto.trim().slice(0, MOTIVO_MAX);
    return limpo || null;
  } catch {
    return null;
  }
}

async function gravar(request: NextRequest, id: string, marcar: boolean) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const quem = g.auth.email ?? g.auth.user_id;
  const update = marcar
    ? {
        erro_manual_em: new Date().toISOString(),
        erro_manual_por: quem,
        erro_manual_motivo: await lerMotivo(request),
      }
    : { erro_manual_em: null, erro_manual_por: null, erro_manual_motivo: null };

  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .update(update as never)
      .eq("id", id)
      .select("id");

    if (error) {
      if (colunaErroManualAusente(error)) {
        logger.info("audit", "sgp.erro_manual_indisponivel", { by: g.auth.email, pedido: id });
        return jsonError("migration_pendente", SEM_COLUNA, 503);
      }
      return serverError(error.message);
    }
    // `.eq` em id inexistente não é erro no PostgREST, volta lista vazia. Sem
    // isto o atendente veria "ok" para um pedido que não existe.
    if (!data || (data as unknown[]).length === 0) return notFound("Pedido");

    logger.info("audit", marcar ? "sgp.erro_manual_marcado" : "sgp.erro_manual_desfeito", {
      by: g.auth.email,
      pedido: id,
    });
    return jsonOk({ ok: true, ...update });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao marcar o erro");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, true);
}

/**
 * Desfazer. Pela mesma razão do "desfazer" da cobrança: um clique errado numa
 * linha de aluno que pagou não pode ser irreversível. E, diferente da cobrança,
 * a marca de erro NÃO vence sozinha — sem o desfazer ela ficaria pra sempre.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, false);
}
