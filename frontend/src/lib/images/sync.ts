/**
 * Sincroniza o estado de uma geração de imagem com o Kie (consulta recordInfo)
 * e atualiza a row: success → baixa+salva no R2 e marca ready; fail → failed;
 * generating → atualiza o status; waiting/queuing → mantém pending.
 *
 * Usado pelo poll (GET /images/[id]) e pelo callback (webhook do Kie).
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { kieGetTask } from "@/lib/kie/client";
import { finalizeImageSuccess, failImageGeneration } from "@/lib/images/finalize";

export async function syncImageTask(
  id: string,
  userId: string,
  taskId: string,
): Promise<void> {
  const info = await kieGetTask(taskId);

  if (info.state === "success") {
    const url = info.resultUrls[0];
    if (!url) {
      await failImageGeneration(id, "Kie retornou sucesso sem imagem");
      return;
    }
    try {
      await finalizeImageSuccess(id, userId, url);
    } catch (e) {
      await failImageGeneration(
        id,
        e instanceof Error ? `salvar resultado: ${e.message}` : "salvar resultado falhou",
      );
    }
    return;
  }

  if (info.state === "fail") {
    await failImageGeneration(id, info.failMsg || info.failCode || "geração falhou");
    return;
  }

  // Em progresso: reflete "generating" pra UI (não toca se já estiver adiante).
  if (info.state === "generating") {
    await getAdmin()
      .from("image_generations")
      .update({ status: "generating" })
      .eq("id", id)
      .in("status", ["pending"]);
  }
}
