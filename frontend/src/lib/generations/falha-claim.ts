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
 *
 * POR QUE ISTO TAMBÉM LOGA: o acerto do gate é um NÃO-EVENTO — quando ele barra,
 * nada é escrito no banco e a geração segue exatamente igual. Sem log, "o gate
 * funcionou" fica indistinguível de "a corrida não aconteceu", e o incidente #52
 * não pode ser fechado por evidência: "reenvio que terminou ready sem estorno"
 * já acontecia 5 vezes ANTES do conserto (050af6bb 29/08, ac156bdb 30/08,
 * 31998c0f 03/09, b2ab9d26 04/09, d6d9ba71 09/09 — todas request_attempts=2 e
 * ready). Pior: em 12/09 a corrida bateu DUAS vezes em 6 minutos no mesmo aluno
 * e o próprio aluno apagou as duas rows — a evidência só sobreviveu no extrato
 * (credit_transactions) e no log do servidor. A linha logada abaixo é a única
 * prova do acerto que não depende de a row continuar existindo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** Estados em que a geração ainda está em andamento — os únicos falháveis. */
export const STATUS_EM_ANDAMENTO = ["pending", "generating"] as const;

/**
 * Registra UMA linha quando o claim voltou vazio E o motivo foi o gate barrando
 * a falha de um job VELHO por cima de um reenvio VIVO — que é o acerto que a
 * gente precisa provar.
 *
 * O que NÃO loga, de propósito: row já `failed`/`ready` (é a idempotência velha
 * funcionando, acontece o tempo todo e viraria ruído) e row inexistente.
 *
 * Custo: UM select de 1 linha, e só no caminho em que o claim JÁ voltou vazio —
 * o caminho normal (claim vencido) não ganha leitura nenhuma. É best-effort:
 * diagnóstico nunca pode derrubar o caminho de falha do aluno, então qualquer
 * erro aqui é engolido. No texto entram só ids — nada do aluno.
 */
async function logarGateBarrouJobVelho(
  admin: SupabaseClient<Database>,
  generationId: string,
  jobId: string,
): Promise<void> {
  try {
    const { data } = await admin
      .from("generations")
      .select("status, runpod_job_id")
      .eq("id", generationId)
      .maybeSingle();
    const row = data as { status: string | null; runpod_job_id: string | null } | null;
    if (!row) return;
    const emAndamento = (STATUS_EM_ANDAMENTO as readonly string[]).includes(row.status ?? "");
    if (!emAndamento || row.runpod_job_id === jobId) return;
    console.log(
      `[generations/falha-claim] #52 gate barrou falha de job velho ${generationId} ` +
        `job_que_falhou=${jobId} job_atual=${row.runpod_job_id}`,
    );
  } catch {
    // Instrumentação é best-effort: se a leitura de diagnóstico falhar, o
    // resultado do gate (já decidido acima) não pode mudar por causa disso.
  }
}

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
  const reivindicou = Array.isArray(data) && data.length > 0;
  // A DECISÃO já está tomada na linha acima e não muda mais daqui pra baixo —
  // o que vem a seguir é só diagnóstico do #52.
  if (!reivindicou && jobId) await logarGateBarrouJobVelho(admin, generationId, jobId);
  return reivindicou;
}
