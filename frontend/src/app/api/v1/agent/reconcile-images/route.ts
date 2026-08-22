/**
 * POST /api/v1/agent/reconcile-images — sweeper de gerações de IMAGEM órfãs.
 * Rede de segurança embaixo do webhook do Kie e do poll da tela (incidente
 * 69f0aec5, 22/08: syncImageTask só rodava com a tela aberta ou webhook
 * entregue — sem os dois, a row ficava presa em pending/generating PARA
 * SEMPRE; caso extremo de 676h em generating com o Kie dizendo fail havia
 * semanas, 525 créditos nunca estornados; e um pending de 19h cuja imagem o
 * Kie tinha entregue em 74s). Especialmente grave no onboarding, onde o
 * aluno nem tem acesso ao app pra abrir tela nenhuma.
 *
 * Mesmo padrão do sweep-clones: cron no Hetzner chama com x-agent-token
 * (AGENT_MONITOR_TOKEN). Pra cada image_generation presa em
 * pending/generating há >15min COM kie_task_id: chama o syncImageTask que já
 * existe — success → baixa+R2+ready; fail → failed + estorno automático;
 * generating → segue. NÃO cria task nova no Kie (recordInfo é leitura; o
 * único resubmit é o tryImageRetry interno do sync, que já é o comportamento
 * de produção do webhook/poll hoje).
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { getAdmin } from "@/lib/db/admin";
import { syncImageTask } from "@/lib/images/sync";

const STUCK_AFTER_MS = 15 * 60 * 1000; // só olha o que está preso há 15min+
const BATCH_LIMIT = 50; // teto por rodada pra não virar rajada no Kie

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const admin = getAdmin();

  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data: stuck, error } = await admin
    .from("image_generations")
    .select("id, user_id, status, kie_task_id, created_at")
    .in("status", ["pending", "generating"])
    .not("kie_task_id", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) return jsonError("db_error", error.message, 500);

  let ready = 0;
  let failed = 0;
  let inProgress = 0;
  let errors = 0;
  for (const g of stuck ?? []) {
    try {
      await syncImageTask(g.id, g.user_id, g.kie_task_id!);
      // syncImageTask devolve void — o desfecho fica na row. Relê pra
      // classificar (e é o que o banco CONFIRMA, não o que o código planejou).
      const { data: after } = await admin
        .from("image_generations")
        .select("status")
        .eq("id", g.id)
        .maybeSingle();
      const status = (after as { status?: string } | null)?.status ?? "desconhecido";
      if (status === "ready") ready += 1;
      else if (status === "failed") failed += 1;
      else inProgress += 1;
      console.log(
        `[reconcile-images] gen ${g.id} (era ${g.status} desde ${g.created_at}): ${status}`,
      );
    } catch (e) {
      // Erro numa row (Kie fora, rede) NUNCA derruba as outras — próxima
      // rodada tenta de novo.
      errors += 1;
      console.error(
        `[reconcile-images] gen ${g.id} erro:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const summary = {
    checked: (stuck ?? []).length,
    ready,
    failed_refunded: failed,
    still_running: inProgress,
    errors,
  };
  if (summary.checked > 0) console.log("[reconcile-images]", JSON.stringify(summary));
  return jsonOk({ reconcile: summary });
}
