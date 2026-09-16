/**
 * POST   /api/v1/admin/sgp/[id]/aviso → "eu avisei o aluno que o clone ficou pronto"
 * DELETE /api/v1/admin/sgp/[id]/aviso → desfazer (registrei na linha errada)
 *
 * POR QUE ESTA ROTA EXISTE (recado 6, 15/09): o corte GERADO/ENTREGUE lê dois
 * carimbos, e um deles não tinha como ser escrito. `profiles.onboarding_ready_
 * email_at` responde sozinho pelo e-mail automático, mas o aviso que o time dá
 * POR FORA — WhatsApp, ligação — não tinha onde ser anotado. Sem isto, uma linha
 * que caiu em GERADO ficava presa em GERADO para sempre, e a frase da tela
 * ("registre aqui que avisou") mandava o atendente fazer algo que a tela não
 * oferecia. Prometer uma ação que não existe é o mesmo defeito do "Nada a fazer.
 * Já foi entregue" que este PR veio consertar, uma casa adiante.
 *
 * ⚠️ ISTO NÃO MEXE NO `status`, e é a mesma regra das rotas irmãs (cobrança,
 * erro manual, conclusão). `status` é a máquina de estados da PRODUÇÃO. Anotação
 * de suporte não pode disparar e-mail pro aluno nem escalar incidente.
 *
 * ⚠️ E ISTO NÃO MANDA MENSAGEM NENHUMA. É um REGISTRO de que alguém avisou, não
 * um envio: quem fala com o aluno é a pessoa, pelo canal dela. A regra vale pro
 * SGP inteiro (o sistema não contata aluno sozinho) e vale em dobro aqui, onde o
 * nome do botão poderia sugerir o contrário.
 *
 * `SUPORTE_OK`: quem avisa o aluno é o time de suporte, que tem papel `suporte`
 * e NÃO é admin cheio — sem isso o botão aparece e dá 403 na cara do atendente.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonError, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { colunaAvisoAusente } from "@/lib/sgp/cobranca";
import { canalValido, SGP_CANAIS_AVISO } from "@/lib/sgp/painel";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

/**
 * A migration 116 ainda não entrou. Mensagem escrita PRO ATENDENTE, não pro
 * programador: ele precisa saber (a) não adiantou clicar, (b) o caso continua
 * como estava, (c) não é culpa dele nem coisa que ele possa consertar.
 */
const SEM_COLUNA =
  "Ainda não dá pra registrar o aviso aqui: falta uma atualização do sistema, que já está com o time técnico. " +
  "Avise o aluno normalmente — o registro é que não fica gravado por enquanto.";

const CANAL_INVALIDO = `Diga por onde você avisou: ${SGP_CANAIS_AVISO.join(", ")}.`;

/** Aceita `{ canal }`. Corpo torto vira `null` e a rota recusa — nunca grava lixo. */
async function lerCanal(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") return null;
    return canalValido((body as { canal?: unknown }).canal);
  } catch {
    return null;
  }
}

async function gravar(request: NextRequest, id: string, marcar: boolean) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  let update: Record<string, string | null>;
  if (marcar) {
    const canal = await lerCanal(request);
    // O canal é OBRIGATÓRIO na marcação, ao contrário do `motivo` das rotas
    // irmãs (que é opcional). É ele que torna o carimbo auditável: "avisado"
    // sem dizer por onde é quase tão vago quanto o "Entregue" que este PR
    // aposentou — e o recado pediu "quando, POR QUAL CANAL" com todas as letras.
    if (!canal) return jsonError("canal_invalido", CANAL_INVALIDO, 400);
    update = {
      avisado_em: new Date().toISOString(),
      avisado_por: g.auth.email ?? g.auth.user_id,
      avisado_canal: canal,
    };
  } else {
    update = { avisado_em: null, avisado_por: null, avisado_canal: null };
  }

  try {
    const { data, error } = await getAdmin()
      .from("sgp_pedidos" as never)
      .update(update as never)
      .eq("id", id)
      .select("id");

    if (error) {
      if (colunaAvisoAusente(error)) {
        logger.info("audit", "sgp.aviso_indisponivel", { by: g.auth.email, pedido: id });
        return jsonError("migration_pendente", SEM_COLUNA, 503);
      }
      return serverError(error.message);
    }
    // `.eq` em id inexistente não é erro no PostgREST, volta lista vazia. Sem
    // isto o atendente veria "ok" para um pedido que não existe — e é o caso
    // REAL desta tela, que agora mostra linhas de quem nunca abriu um pedido.
    if (!data || (data as unknown[]).length === 0) return notFound("Pedido");

    logger.info("audit", marcar ? "sgp.aviso_registrado" : "sgp.aviso_desfeito", {
      by: g.auth.email,
      pedido: id,
      canal: update.avisado_canal,
    });
    return jsonOk({ ok: true, ...update });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao registrar o aviso");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, true);
}

/**
 * Desfazer. Obrigatório pelo mesmo motivo das rotas irmãs, e com um agravante
 * próprio: este carimbo tira a linha do banner de "clone pronto sem aviso", que
 * é o único alerta desta tela que o ALUNO nunca vai levantar sozinho — ele não
 * reclama do que não sabe que existe. Um registro errado some com o caso do
 * radar, então ele tem que ter volta.
 *
 * Desfazer ACRESCENTA rastro em vez de apagá-lo: a linha de auditoria
 * `sgp.aviso_desfeito` fica gravada com autor e pedido, como a de marcação.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return gravar(request, id, false);
}
