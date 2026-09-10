/**
 * POST   /api/v1/admin/sgp/[id]/erro → "este aluno deu problema, e o problema é este"
 * DELETE /api/v1/admin/sgp/[id]/erro → desmarcar (resolveu, ou cliquei sem querer)
 *
 * Pedido do Lucas (10/09), com o print da tela na mão: *"mostrar em que pé está
 * cada aluno DO PONTO DE VISTA DO TIME — pronto, aguardando ou erro — igual como
 * era feito na planilha, para eles terem noção do que está sendo feito"*.
 *
 * A tela já mostrava onde o ALUNO está (etapa do wizard). O que ela não tinha
 * era o gesto do TIME: na planilha antiga havia Realizado / Em Andamento /
 * Verificação / Erro marcados na mão, mais a coluna Responsável — e 54 pessoas
 * estavam marcadas como Erro. Sem esse gesto aqui, esse tipo de caso volta a
 * ficar invisível.
 *
 * SEM MIGRATION: grava na coluna `erro`, que já existe (e hoje está vazia nos
 * 63 pedidos). A autoria (QUEM marcou e QUANDO) vai num carimbo no começo do
 * próprio texto — formato e leitura em lib/sgp/painel.ts, testados lá.
 *
 * `SUPORTE_OK`: quem atende o aluno é o time de suporte (victor@, luany@ e quem
 * o Lucas adicionar), que tem papel `suporte` e NÃO é admin cheio. Sem isto o
 * botão aparece e dá 403 na cara de quem precisa dele — que é o time inteiro.
 *
 * ⚠️ DUAS COISAS QUE ESTA ROTA PROTEGE, e são o motivo de ela ler antes de
 * escrever em vez de dar um update seco:
 *
 *  1. ERRO DO SISTEMA NÃO SE APAGA AQUI. A coluna `erro` também é escrita pelo
 *     robô (lib/sgp/processar.ts, quando o clone de foto ou o treino de voz
 *     falha). Um clique do atendente não pode destruir o diagnóstico técnico do
 *     pedido — então, quando o que está lá NÃO tem carimbo do time, a rota
 *     recusa e explica, em vez de sobrescrever em silêncio.
 *
 *  2. O RELÓGIO DO "PARADO HÁ". O gatilho `sgp_pedidos_touch` (migration 100, a
 *     que está aplicada) carimba `atualizado_em = now()` em TODO update. Ou
 *     seja: marcar erro zeraria o "parado há 5 dias" do aluno, tirando ele do
 *     vermelho e do contador PRA SEMPRE — o mesmo estrago que a migration 106
 *     conserta pra cobrança. Enquanto a 108 (escrita neste PR, não aplicada)
 *     não entra, a rota guarda o `atualizado_em` de antes DENTRO do carimbo, e
 *     o painel lê de lá. Com a 108 aplicada os dois valores viram o mesmo e
 *     nada muda.
 *
 * Escrita em COMPARE-AND-SWAP (`.eq("erro", valorLido)` / `.is("erro", null)`):
 * dois atendentes na mesma linha ao mesmo tempo é raro, mas o perdedor tem que
 * saber que perdeu em vez de apagar a anotação do colega sem ninguém ver.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  ERRO_TEXTO_MAX,
  formatarMarcaErro,
  lerMarcaErro,
  limparTextoErro,
} from "@/lib/sgp/painel";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

/** Mensagens escritas PRO ATENDENTE: ele não tem acesso ao código. */
const SEM_TEXTO = `Escreva em uma frase o que aconteceu com este aluno (até ${ERRO_TEXTO_MAX} caracteres). É esse texto que o próximo atendente vai ler.`;
const ERRO_DO_SISTEMA =
  "Este pedido já tem um erro registrado pelo próprio sistema. Ele não pode ser apagado nem substituído por aqui — é o diagnóstico que o time técnico usa. Avise o time técnico.";
const SEM_ERRO = "Este pedido não está marcado com erro — não há o que desmarcar.";
const MUDOU =
  "Alguém do time mexeu neste pedido enquanto você escrevia. Atualize a tela e confira antes de marcar de novo.";

type Linha = { erro: string | null; atualizado_em: string };

/** Lê a linha antes de escrever. `null` = pedido não existe. */
async function lerLinha(id: string): Promise<Linha | null | { erro_db: string }> {
  const { data, error } = await getAdmin()
    .from("sgp_pedidos" as never)
    .select("erro, atualizado_em")
    .eq("id", id)
    .maybeSingle();
  if (error) return { erro_db: error.message };
  if (!data) return null;
  return data as unknown as Linha;
}

/**
 * O update em compare-and-swap. Devolve quantas linhas mudaram: 0 significa que
 * o `erro` já não era mais o que a gente tinha lido.
 */
async function trocar(id: string, de: string | null, para: string | null) {
  const base = getAdmin()
    .from("sgp_pedidos" as never)
    .update({ erro: para } as never)
    .eq("id", id);
  const q = de === null ? base.is("erro", null) : base.eq("erro", de);
  const { data, error } = await q.select("id");
  return { n: (data as unknown[] | null)?.length ?? 0, error };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const body = (await request.json().catch(() => null)) as { texto?: unknown } | null;
  const texto = limparTextoErro(typeof body?.texto === "string" ? body.texto : "");
  if (!texto) return badRequest(SEM_TEXTO);

  try {
    const linha = await lerLinha(id);
    if (linha === null) return notFound("Pedido");
    if ("erro_db" in linha) return serverError(linha.erro_db);

    // Substituir a marca de um colega é permitido (o caso muda de mão o dia
    // inteiro); apagar o erro do SISTEMA não é.
    if (linha.erro?.trim() && !lerMarcaErro(linha.erro)) {
      return jsonError("erro_do_sistema", ERRO_DO_SISTEMA, 409);
    }

    // O relógio original: se já havia marca do time, o `desde` dela é o valor
    // bom (o `atualizado_em` de agora já foi carimbado na marcação anterior).
    const paradoDesde = lerMarcaErro(linha.erro)?.paradoDesde ?? linha.atualizado_em;
    const valor = formatarMarcaErro({
      texto,
      por: g.auth.email ?? g.auth.user_id,
      em: new Date().toISOString(),
      paradoDesde,
    });

    const { n, error } = await trocar(id, linha.erro, valor);
    if (error) return serverError(error.message);
    if (n === 0) return jsonError("conflito", MUDOU, 409);

    logger.info("audit", "sgp.erro_marcado", { by: g.auth.email, pedido: id, texto });
    return jsonOk({ ok: true, erro: valor });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao marcar o erro");
  }
}

/**
 * Desmarcar. Só apaga o que TEM carimbo do time — erro do sistema fica onde
 * está, pelo mesmo motivo do POST.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  try {
    const linha = await lerLinha(id);
    if (linha === null) return notFound("Pedido");
    if ("erro_db" in linha) return serverError(linha.erro_db);
    if (!linha.erro?.trim()) return jsonError("sem_erro", SEM_ERRO, 409);
    if (!lerMarcaErro(linha.erro)) return jsonError("erro_do_sistema", ERRO_DO_SISTEMA, 409);

    const { n, error } = await trocar(id, linha.erro, null);
    if (error) return serverError(error.message);
    if (n === 0) return jsonError("conflito", MUDOU, 409);

    logger.info("audit", "sgp.erro_desmarcado", { by: g.auth.email, pedido: id });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao desmarcar o erro");
  }
}
