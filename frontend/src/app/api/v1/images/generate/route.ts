/**
 * POST /api/v1/images/generate
 *
 * Dispara a geração de imagem (clone) no Kie (gpt-image-2-image-to-image).
 *
 * Body:
 *   {
 *     input_image_key: string,   // chave da referência (do /upload-url)
 *     prompt?: string,           // prompt final (se a pessoa escreveu/editou)
 *     idea?: string,             // ideia crua (gera prompt via LLM se faltar prompt)
 *     aspect_ratio?: string,     // auto | 1:1 | 4:5 | 9:16 | 16:9 | 3:2 | 2:3
 *     resolution?: string,       // 1K | 2K | 4K
 *     name?: string              // nome opcional pra renomear na lista
 *   }
 *
 * Fluxo: valida → custo por resolução → pré-checa saldo (402) → (LLM se preciso)
 * → presigned GET da referência → createTask no Kie (com callback) → insere row
 * pending → debita → retorna { id }.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonError,
  jsonOk,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import {
  ASPECT_VALUES,
  imageCreditCost,
  resolveResolutionForAspect,
} from "@/lib/kie/config";
import { kieCreateImageTask, kieCallbackUrl } from "@/lib/kie/client";
import { generateImagePrompt } from "@/lib/llm/generate-image-prompt";
import {
  moderateImagePrompt,
  CONTENT_BLOCKED_MESSAGE,
} from "@/lib/llm/moderate-image-prompt";

const PRESIGN_EXPIRES = 60 * 60; // 1h — o Kie busca a referência logo no início
const PROMPT_MAX = 20_000; // limite do gpt-image-2
const MAX_REFERENCE_IMAGES = 6; // gpt-image-2 aceita até 16; 6 cobre bem o caso de uso

type Body = {
  // Aceita uma (input_image_key) ou várias (input_image_keys) — várias fotos da
  // mesma pessoa melhoram a semelhança. Todas vão pro Kie em input_urls.
  input_image_key?: string;
  input_image_keys?: string[];
  prompt?: string;
  idea?: string;
  aspect_ratio?: string;
  resolution?: string;
  name?: string;
};

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  // Referências: 1 ou mais. Cada chave tem que pertencer ao próprio usuário
  // (defesa em profundidade). Aceita o campo singular legado ou o array novo.
  const rawKeys = Array.isArray(body.input_image_keys)
    ? body.input_image_keys
    : body.input_image_key
      ? [body.input_image_key]
      : [];
  const inputKeys = [...new Set(rawKeys.map((k) => (k ?? "").trim()).filter(Boolean))];
  if (inputKeys.length === 0) {
    return badRequest("Envie ao menos uma imagem de referência");
  }
  if (inputKeys.length > MAX_REFERENCE_IMAGES) {
    return badRequest(`Máximo de ${MAX_REFERENCE_IMAGES} fotos de referência`);
  }
  if (inputKeys.some((k) => !k.startsWith(`${auth.user_id}/images/`))) {
    return badRequest("Imagem de referência inválida");
  }

  // Proporção + resolução (faz o clamp das restrições do modelo).
  const aspect = ASPECT_VALUES.includes(body.aspect_ratio ?? "")
    ? (body.aspect_ratio as string)
    : "auto";
  const resolution = resolveResolutionForAspect(aspect, body.resolution ?? "1K");

  // Prompt: usa o que veio; senão gera a partir da ideia; senão erro.
  let prompt = (body.prompt ?? "").trim();
  const idea = (body.idea ?? "").trim() || null;
  if (!prompt && idea) {
    prompt = (await generateImagePrompt(idea)).trim();
  }
  if (!prompt) return badRequest("Escreva um prompt ou uma ideia");
  if (prompt === "__BLOCKED__") return jsonError("content_blocked", CONTENT_BLOCKED_MESSAGE, 400);
  if (prompt.length > PROMPT_MAX) return badRequest(`Prompt máx ${PROMPT_MAX} caracteres`);

  // SEGURANÇA: modera o prompt FINAL antes de mandar pro Kie (a pessoa pode ter
  // digitado direto, pulando o prompt automático). Bloqueado → não gera, não
  // cobra. Protege o rosto real da pessoa e as contas da empresa (Kie/OpenAI).
  const moderation = await moderateImagePrompt(prompt);
  if (!moderation.allowed) {
    return jsonError("content_blocked", CONTENT_BLOCKED_MESSAGE, 400, {
      reason: moderation.reason,
    });
  }

  // Custo fixo por resolução. Equipe/admin não é cobrada. Pré-checa saldo.
  const creditCost = imageCreditCost(resolution);
  const billed = !bypassesBilling(auth.email);
  const admin = getAdmin();
  if (billed) {
    const bal = await getBalance(auth.user_id);
    if (bal.total < creditCost) {
      const { data: prof } = await admin
        .from("profiles")
        .select("access_until")
        .eq("id", auth.user_id)
        .maybeSingle();
      const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
      return jsonError(
        "insufficient_credits",
        `Créditos insuficientes: esta imagem custa ${creditCost} e você tem ${bal.total}.`,
        402,
        { subscribed, balance: bal.total, cost: creditCost },
      );
    }
  }

  // Presigned GET de TODAS as referências pro Kie baixar.
  let inputUrls: string[];
  try {
    inputUrls = await Promise.all(
      inputKeys.map((k) => createPresignedGet(imagesBucket(), k, PRESIGN_EXPIRES)),
    );
  } catch (e) {
    return serverError(
      e instanceof Error ? `R2 presigned: ${e.message}` : "R2 presigned failed",
    );
  }

  // Cria a task no Kie (assíncrona — callback + poll). Manda TODAS as fotos.
  let taskId: string;
  try {
    const created = await kieCreateImageTask(
      {
        prompt,
        input_urls: inputUrls,
        aspect_ratio: aspect,
        resolution,
      },
      { callBackUrl: kieCallbackUrl() },
    );
    taskId = created.taskId;
  } catch (e) {
    return serverError(e instanceof Error ? `Kie: ${e.message}` : "Kie createTask failed");
  }

  const id = randomUUID();
  const name = (body.name ?? "").trim().slice(0, 120) || null;

  const { error: insertErr } = await admin.from("image_generations").insert({
    id,
    user_id: auth.user_id,
    name,
    prompt,
    idea,
    input_image_path: inputKeys[0],
    input_image_paths: inputKeys,
    aspect_ratio: aspect,
    resolution,
    credits_cost: billed ? creditCost : 0,
    status: "pending",
    kie_task_id: taskId,
  });
  if (insertErr) return serverError("Failed to create image generation row");

  // Debita após criar a row. (TODO: estornar no callback se a task falhar.)
  if (billed) {
    await debitCredits({
      userId: auth.user_id,
      amount: creditCost,
      kind: "image",
      refType: "image_generation",
      refId: id,
      note: `geração de imagem (${resolution})`,
    });
  }

  return jsonOk({ id, status: "pending" });
}
