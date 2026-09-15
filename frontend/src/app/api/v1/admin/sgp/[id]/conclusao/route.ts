/**
 * POST   /api/v1/admin/sgp/[id]/conclusao → "concluí o atendimento desta linha"
 * DELETE /api/v1/admin/sgp/[id]/conclusao → desfazer (concluí a linha errada)
 *
 * Pedido do Lucas (14/09, olhando a tela): *"eu preciso de um botão de conclusão
 * aqui nessa tela, para que a equipe consiga concluir o atendimento"*. Hoje o
 * "concluído" da tela é DERIVADO de `status = 'pronto'` e ninguém consegue
 * declarar nada: o time trata o caso (reembolsa, resolve por fora, o aluno
 * desiste) e a linha continua na fila de trabalho como se nada tivesse sido
 * feito.
 *
 * ⚠️ ISTO NÃO MEXE NO `status`, e é a mesma regra da rota irmã de erro manual.
 * `status` é a máquina de estados da PRODUÇÃO (`lib/sgp/fracasso.ts` dispara
 * e-mail pro aluno e chama o grupo na transição pra `falhou`; `lib/sgp/etapas.ts`
 * carimba as etapas). Anotação de suporte não pode disparar e-mail pro aluno nem
 * escalar incidente. A tela lê as duas coisas; o pipeline segue sem saber que
 * alguém anotou.
 *
 * ⚠️ E ISTO NÃO ESCONDE A LINHA. Concluir o ATENDIMENTO não é o aluno ter
 * RECEBIDO o produto — a linha continua na tabela, o "parado há" continua
 * contando a verdade, e `situacaoPorBaixo` continua dizendo que ele não recebeu.
 * Sumir com a linha perderia de vista quem pagou e não recebeu, que é
 * exatamente o que o pedido proíbe.
 *
 * `SUPORTE_OK`: quem conclui o atendimento é o time de suporte, que tem papel
 * `suporte` e NÃO é admin cheio. Sem isso o botão aparece e dá 403 na cara do
 * atendente — é a regra que as rotas de cobrança e de erro já seguem e que o
 * pedido repete em caixa alta.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonError, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { colunaConclusaoAusente } from "@/lib/sgp/cobranca";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

/**
 * A migration 110 ainda não entrou. Mensagem escrita PRO ATENDENTE, não pro
 * programador: ele não tem acesso ao código e não sabe o que é uma migration.
 * Precisa saber (a) não adiantou clicar, (b) o caso existe mesmo assim, (c) não
 * é culpa dele nem coisa que ele possa consertar.
 */
const SEM_COLUNA =
  "Ainda não dá pra concluir o atendimento aqui: falta uma atualização do sistema, que já está com o time técnico. " +
  "Pode tratar o caso normalmente — o pedido continua na tela do mesmo jeito.";

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
        concluido_em: new Date().toISOString(),
        concluido_por: quem,
        concluido_motivo: await lerMotivo(request),
      }
    : { concluido_em: null, concluido_por: null, concluido_motivo: null };

  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .update(update as never)
      .eq("id", id)
      .select("id");

    if (error) {
      if (colunaConclusaoAusente(error)) {
        logger.info("audit", "sgp.conclusao_indisponivel", { by: g.auth.email, pedido: id });
        return jsonError("migration_pendente", SEM_COLUNA, 503);
      }
      return serverError(error.message);
    }
    // `.eq` em id inexistente não é erro no PostgREST, volta lista vazia. Sem
    // isto o atendente veria "ok" para um pedido que não existe.
    if (!data || (data as unknown[]).length === 0) return notFound("Pedido");

    logger.info("audit", marcar ? "sgp.conclusao_marcada" : "sgp.conclusao_desfeita", {
      by: g.auth.email,
      pedido: id,
    });
    return jsonOk({ ok: true, ...update });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao concluir o atendimento");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, true);
}

/**
 * Desfazer, e aqui ele é ainda mais obrigatório que nas rotas irmãs: concluir é
 * a marca que mais silencia (tira o vermelho, o contador de parados e a posição
 * no topo), e ela NÃO vence por tempo. Sem o desfazer, um clique errado numa
 * linha de aluno que pagou calaria aquele caso para sempre.
 *
 * Desfazer ACRESCENTA rastro em vez de apagá-lo: a linha de auditoria
 * `sgp.conclusao_desfeita` fica gravada com autor e pedido, como a de marcação.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, false);
}
