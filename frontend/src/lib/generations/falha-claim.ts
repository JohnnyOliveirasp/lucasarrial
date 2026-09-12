/**
 * Gate idempotente do caminho de FALHA da geração (corrida webhook × poll).
 *
 * POR QUE existe assim, com a prova de 12/09 (geração b744e6da, aluno
 * gabriel.reis2212.pt@gmail.com): o gate reivindicava SÓ por status
 * (`.in("status", ["pending","generating"])`). Só que o reenvio automático
 * (`lib/generations/reenviar.ts`) deixa a row justamente em `pending` com um
 * job NOVO — de propósito, pra aluno ver a geração continuar sem estorno e sem
 * débito novo. Resultado: a falha ATRASADA do job VELHO achava a row em
 * `pending`, reivindicava o gate e escrevia `failed` + estorno POR CIMA de um
 * job que ainda estava rodando.
 *
 * O caminho medido: o GET de `generations/[id]` lê a row UMA vez (guardando
 * `runpod_job_id`), depois consulta a RunPod. Se nesse meio-tempo o webhook
 * falhou o job 1 e disparou o reenvio, o poll segue com o job VELHO, chama
 * `failGeneration`, recebe "nao_aplica" do reenvio (tentativas esgotadas) e cai
 * no caminho de falha — encontrando a row em `pending`. O job do reenvio
 * TERMINOU BEM (row lida depois como `ready`, 8,432s), mas o aluno já tinha
 * visto "falhou, créditos devolvidos", desistiu e refez na mão pagando outros
 * 400 créditos.
 *
 * O CONSERTO: o job entra no PRÓPRIO gate. Se a row já trocou de job, o UPDATE
 * afeta 0 linhas e não há `failed` nem estorno. É o mesmo padrão idempotente
 * que já estava ali, só que agora a identidade do job faz parte da condição.
 *
 * LIMITE DE PROPÓSITO: `jobId` nulo mantém o comportamento de hoje (reivindica
 * só por status). Endurecer o gate a ponto de deixar falha legítima SEM estorno
 * é pior que a corrida — falha de verdade tem que continuar devolvendo crédito.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** Estados em que a geração ainda está em andamento — os únicos falháveis. */
export const STATUS_EM_ANDAMENTO = ["pending", "generating"] as const;

/**
 * Tenta transicionar a geração pra `failed`. Devolve `true` SÓ pra quem venceu
 * a transição — e só esse é quem dispara a contingência (estorno + e-mail pro
 * suporte) no chamador.
 */
export async function reivindicarFalha(
  admin: SupabaseClient<Database>,
  generationId: string,
  jobId: string | null,
  failUpdate: Record<string, unknown>,
): Promise<boolean> {
  let q = admin
    .from("generations")
    .update(failUpdate as never)
    .eq("id", generationId)
    .in("status", STATUS_EM_ANDAMENTO);
  // A condição que fecha a corrida com o reenvio: a falha só vale pro job que
  // a row está rodando AGORA. Job velho → 0 linhas → sem failed, sem estorno.
  if (jobId) q = q.eq("runpod_job_id", jobId);
  const { data } = await q.select("id");
  return Array.isArray(data) && data.length > 0;
}
