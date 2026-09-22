/**
 * Falha do Vídeo React — gate idempotente + as chaves do estorno.
 *
 * POR QUE EXISTE (22/09): o React abriu aos alunos COM cobrança (300 fixos +
 * o segundo do clone, `preco.ts`) e SEM caminho de estorno — a rota debitava
 * com `refType "react_job"` e o comentário dela dizia "um estorno futuro sabe
 * exatamente qual React devolver". Este arquivo é esse futuro: se o job
 * falhar, o aluno recebe de volta exatamente o que pagou (um React de 30s no
 * Padrão são 3.450 cr — não é troco), e o extrato ganha uma linha
 * `react_refund` que a varredura conhece (`_frank/ferramentas/_estornos.cjs`).
 *
 * O DESENHO é o mesmo do Vídeo Clone (`video-clone/finalize.ts` +
 * `support/failure-alert.ts`), que é o irmão mais velho deste fluxo:
 *   1. quem quer falhar o job REIVINDICA a transição pra "erro" aqui — o
 *      UPDATE só pega row ainda em voo, então em corrida (duas abas fazendo
 *      poll do mesmo job) só UM chamador vence;
 *   2. SÓ o vencedor dispara a contingência (`handleTechFailure`, que estorna
 *      via RPC `add_extra_credits` — idempotente POR CONTAGEM no par
 *      (ref_type, ref_id) — e avisa o suporte). Mesmo padrão de
 *      `generations/falha-claim.ts`.
 * As duas camadas juntas fecham as duas corridas: o gate segura a leitura
 * simultânea de "0 estornos"; a contagem segura o webhook/poll reentregue
 * depois que a row já virou erro.
 *
 * Server-only nas rotas; este módulo em si não importa nada em runtime de
 * propósito (só tipos) — é o que deixa `estorno.test.ts` rodar no
 * `node --test` sem o alias `@/`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** ref_type do DÉBITO que a rota grava ao criar o job (`gerar/route.ts`). */
export const REACT_DEBIT_REF_TYPE = "react_job";
/**
 * ref_type do ESTORNO. ⚠️ Cadastrado em `_frank/ferramentas/_estornos.cjs`
 * (REF_TYPES_ESTORNO) NA MESMA ENTREGA em que nasceu — os chamados #185 e
 * #342 são o que acontece quando um refundRefType novo fica fora da lista:
 * estorno pago que lê como não-estornado, o falso negativo que paga em dobro.
 */
export const REACT_REFUND_REF_TYPE = "react_refund";
/** Estados em que o job ainda está em andamento — os únicos falháveis. */
export const REACT_STATUS_EM_VOO = ["fila", "baixando", "clonando", "montando"] as const;

/**
 * Tenta transicionar o job pra `erro`. Devolve `true` SÓ pra quem venceu a
 * transição — e só esse chamador dispara a contingência (estorno + e-mail).
 * Job já `pronto` ou já `erro` → 0 linhas → false: sucesso nunca estorna e
 * falha reentregue não estorna de novo.
 */
export async function reivindicarFalhaDoReact(
  admin: SupabaseClient<Database>,
  jobId: string,
  erro: string,
): Promise<boolean> {
  const { data } = await admin
    .from("react_jobs")
    .update({ status: "erro", erro, atualizado_em: new Date().toISOString() } as never)
    .eq("id", jobId)
    .in("status", [...REACT_STATUS_EM_VOO])
    .select("id");
  return Array.isArray(data) && data.length > 0;
}
