/**
 * POST /api/v1/admin/sgp/[id]/refazer → remanda o TREINO DE VOZ deste pedido.
 *
 * A PRIMEIRA rota do /admin/sgp que AGE — as três irmãs (`cobranca`, `erro`,
 * `conclusao`) são anotação e dizem no próprio cabeçalho que não tocam em
 * `status`. Ela existe porque, conferido em código em 15/09, quando a entrega
 * do SGP morre por falha NOSSA não há caminho de volta por lugar nenhum: o
 * `/sgp/enviar` exige `revisao`, o `start-training` exige 10.000 créditos que o
 * comprador do SGP não tem por desenho, e o `/admin/sgp` só anota. O incidente
 * #420 ficou em "aguardando_aluno" esperando uma ação que o aluno não tinha
 * como executar — e não deveria ter de executar.
 *
 * A régua de QUANDO pode (e o texto que o atendente lê quando não pode) mora em
 * `lib/sgp/refazer.ts`, que tem teste. Aqui ficam os fios.
 *
 * ⚠️ NÃO COBRA. `origem: "sgp"` ⇒ `deveCobrarOnboarding` é `false` ⇒ zero
 * débito: o saldo do aluno não se move. A GPU é da casa porque a falha foi
 * nossa, e é isso que impede o defeito de 09/09 (12 perfis a -10.525) de voltar
 * por um caminho novo. Um `refazer` que cobrasse seria pior que não ter rota.
 *
 * ⚠️ NÃO MEXE NO `status` DO PEDIDO — só na voz. A máquina de estados do pedido
 * é da produção: `estadoDasEtapas` relê a voz na próxima carga e o pedido sai
 * de 'falhou' sozinho, pelo caminho que já manda e-mail e fecha o episódio no
 * livro-caixa. Escrever 'processando' daqui dispararia e-mail pro aluno a
 * partir de um clique de atendente, que é a linha que as irmãs não cruzam.
 *
 * `SUPORTE_OK`: quem descobre a entrega quebrada é o suporte, que tem papel
 * `suporte` e não é admin cheio. Sem isto o botão aparece e dá 403 na cara do
 * atendente — mesma regra das três irmãs.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { jsonError, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { dispararTreinoOnboarding } from "@/lib/onboarding/treino";
import { decidirRefazer, type PedidoParaRefazer } from "@/lib/sgp/refazer";
import { logger } from "@/lib/logger/server";
import type { VoiceStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";
/** Treino é despachado pro RunPod, não esperado aqui — mas o preflight (presigned
 *  URLs + estimativa de fala) leva alguns segundos. Mesma folga do /sgp/enviar. */
export const maxDuration = 300;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const { id } = await params;
  const admin = getAdmin();

  try {
    // Só as colunas que decidem. `sessao`/`codigo_hash` são segredo de sessão e
    // não têm o que fazer aqui (mesma régua das irmãs).
    const { data, error } = await admin
      .from("sgp_pedidos" as never)
      .select("id, user_id, voice_id, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(error.message);
    // `.eq` em id inexistente não é erro no PostgREST, volta vazio.
    if (!data) return notFound("Pedido");
    const pedido = data as unknown as PedidoParaRefazer;

    const { data: vozRow } = pedido.voice_id
      ? await admin.from("voices").select("status").eq("id", pedido.voice_id).maybeSingle()
      : { data: null };

    const decisao = decidirRefazer(pedido, (vozRow as { status: VoiceStatus } | null) ?? null);
    if (decisao.acao === "recusar") {
      logger.info("audit", "sgp.refazer_recusado", {
        by: g.auth.email,
        pedido: id,
        motivo: decisao.codigo,
      });
      return jsonError(decisao.codigo, decisao.mensagem, decisao.http);
    }

    // Voz `failed` volta pra fila antes do disparo — `dispararTreinoOnboarding`
    // só aceita `awaiting_training` (treino.ts:85). O `.eq("status","failed")`
    // é o cadeado: se outra chamada já devolveu, esta não casa e a corrida se
    // resolve no disparo (a segunda vê status != awaiting_training ou o próprio
    // RunPod já rodando).
    if (decisao.devolverPraFila) {
      const { error: eVolta } = await admin
        .from("voices")
        .update({ status: "awaiting_training", error_message: null })
        .eq("id", decisao.voiceId)
        .eq("status", "failed");
      if (eVolta) return serverError(`devolver voz pra fila: ${eVolta.message}`);
    }

    const r = await dispararTreinoOnboarding(admin, decisao.userId, decisao.voiceId, "sgp");

    if (!r.ok) {
      logger.info("audit", "sgp.refazer_falhou", { by: g.auth.email, pedido: id, motivo: r.reason });
      // O `reason` é técnico e o atendente não pode consertá-lo — mas esconder
      // dele o que aconteceu foi justamente o defeito do #420. Diz as duas
      // coisas: que não saiu, e o que o sistema devolveu.
      return jsonError(
        "treino_nao_disparou",
        `Não consegui remandar o treino agora. O sistema respondeu: ${r.reason}. ` +
          "Avise o time técnico pelo canal de sempre — o pedido continua na tela do mesmo jeito.",
        409,
      );
    }

    logger.info("audit", "sgp.refazer_disparado", {
      by: g.auth.email,
      pedido: id,
      voice: decisao.voiceId,
      runpod_job_id: r.runpod_job_id,
      // Sempre `undefined` no SGP (não há débito nenhum). Vai no log mesmo
      // assim: se um dia aparecer preenchido, é sinal de que alguém mudou a
      // regra de quem paga e o SGP voltou a cobrar do comprador.
      debito_falhou: r.debito_falhou,
    });

    return jsonOk({
      ok: true,
      runpod_job_id: r.runpod_job_id,
      cobrado: false,
      mensagem:
        "Treino remandado. A voz volta a aparecer como 'em treino' e o pedido se atualiza " +
        "sozinho quando ela ficar pronta. O aluno não foi cobrado por isso.",
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remandar o treino");
  }
}
