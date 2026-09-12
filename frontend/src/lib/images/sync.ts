/**
 * Sincroniza o estado de uma geração de imagem com o Kie (consulta recordInfo)
 * e atualiza a row: success → baixa+salva no R2 e marca ready; fail transiente
 * OU recusa por moderação → 1 RETRY automático com task nova e links frescos
 * (caso 28/07: Kie sobrecarregado; caso 12/09: falso positivo de moderação no
 * titular); fail definitivo → failed + estorno automático (finalize);
 * generating → atualiza o status; waiting/queuing → mantém pending.
 *
 * Usado pelo poll (GET /images/[id]) e pelo callback (webhook do Kie).
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import { kieGetTask, kieCreateImageTask, kieCallbackUrl } from "@/lib/kie/client";
import {
  KIE_IMAGE_MODEL,
  KIE_FALLBACK_IMAGE_MODEL,
  kieFallbackEnabled,
  type KieImageModel,
} from "@/lib/kie/config";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { finalizeImageSuccess, failImageGeneration } from "@/lib/images/finalize";
// Retry CRUZADO (spec Seedream 29/07): com o fallback ligado, a retentativa vai
// pro OUTRO modelo — GPT falhou → Seedream (o aluno do probe nem vê a falha, e a
// row seedream+retry_count=1 reabre o disjuntor); Seedream falhou → GPT (probe
// de volta). Fallback desligado = retentativa no titular. A decisão é PURA e
// mora em retry-politica.ts, com teste.
import { decidirAposFalhaImagem } from "@/lib/images/retry-politica";

// Mesmo TTL do generate: cobre fila lenta do Kie (a de 1h expirava — 28/07).
const RETRY_PRESIGN_EXPIRES = 24 * 60 * 60;

/**
 * Tenta o retry automático NO MODELO JÁ DECIDIDO: trava o claim (retry_count
 * 0→1, à prova de corrida webhook×poll), recria os presigned das referências e
 * submete task NOVA no Kie. true = nova task no ar (poll/webhook seguem
 * acompanhando).
 */
async function tryImageRetry(id: string, model: KieImageModel): Promise<boolean> {
  const admin = getAdmin();
  const { data: claimed } = await admin
    .from("image_generations")
    .update({ retry_count: 1 })
    .eq("id", id)
    .eq("retry_count", 0)
    .in("status", ["pending", "generating"])
    .select(
      "id, prompt, prompt_en, input_image_path, input_image_paths, aspect_ratio, resolution",
    );
  const row = (claimed ?? [])[0] as
    | {
        id: string;
        prompt: string;
        prompt_en: string | null;
        input_image_path: string;
        input_image_paths: string[] | null;
        aspect_ratio: string;
        resolution: string;
      }
    | undefined;
  if (!row) return false; // já tentou 1x ou já finalizou

  try {
    const keys =
      row.input_image_paths && row.input_image_paths.length > 0
        ? row.input_image_paths
        : [row.input_image_path];
    const inputUrls = await Promise.all(
      keys.map((k) => createPresignedGet(imagesBucket(), k, RETRY_PRESIGN_EXPIRES)),
    );
    const { taskId } = await kieCreateImageTask(
      {
        // prompt_en (mig 56) é o que o modelo entende; rows antigas (null) já
        // tinham o prompt em inglês.
        prompt: row.prompt_en || row.prompt,
        input_urls: inputUrls,
        aspect_ratio: row.aspect_ratio,
        resolution: row.resolution,
      },
      { callBackUrl: kieCallbackUrl(), model },
    );
    await admin
      .from("image_generations")
      .update({ kie_task_id: taskId, status: "pending", kie_model: model })
      .eq("id", id);
    console.log(
      `[images/sync] retry automático: gen ${id} → nova task ${taskId} (${model})`,
    );
    return true;
  } catch (e) {
    // resubmit falhou (Kie ainda fora?) — deixa o fluxo normal marcar failed.
    console.error(
      "[images/sync] retry falhou:",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

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
    const raw = info.failMsg || info.failCode || "geração falhou";
    // Retry cruzado vale pra: erro transiente (qualquer modelo), recusa por
    // MODERAÇÃO no titular (incidente 12/09 — o Seedream tem outra moderação e
    // pode aceitar o que o GPT recusou) OU QUALQUER erro no fallback (o titular
    // pode aceitar o que o Seedream recusou — caso 05/08: 4 alunos morreram no
    // Seedream sem 2ª chance com o GPT saudável).
    const { data: cur } = await getAdmin()
      .from("image_generations")
      .select("kie_model, retry_count")
      .eq("id", id)
      .maybeSingle();
    const atual = cur as { kie_model?: string; retry_count?: number } | null;
    const decisao = decidirAposFalhaImagem({
      raw,
      modeloAtual: atual?.kie_model ?? KIE_IMAGE_MODEL,
      modeloTitular: KIE_IMAGE_MODEL,
      modeloFallback: KIE_FALLBACK_IMAGE_MODEL,
      fallbackLigado: kieFallbackEnabled(),
      retryCount: atual?.retry_count ?? 0,
    });
    if (decisao.acao === "retry" && (await tryImageRetry(id, decisao.modelo))) return;
    await failImageGeneration(id, raw);
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
