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
import { objectHead } from "@/lib/r2/exists";
import { createPresignedGet } from "@/lib/r2/presigned";
import {
  ASPECT_VALUES,
  imageCreditCost,
  resolveResolutionForAspect,
} from "@/lib/kie/config";
import { kieCreateImageTask, kieCallbackUrl } from "@/lib/kie/client";
import { pickImageRoute } from "@/lib/kie/failover";
import { generateImagePrompt } from "@/lib/llm/generate-image-prompt";
import { translateImagePrompt } from "@/lib/llm/translate-image-prompt";
import {
  moderateImagePrompt,
  CONTENT_BLOCKED_MESSAGE,
} from "@/lib/llm/moderate-image-prompt";

// 24h: a premissa antiga ("o Kie busca a referência logo no início") quebrou
// em 28/07 — com o Kie sobrecarregado a fila passou de 1h, o link expirava e
// a geração morria com "Image fetch failed" JÁ COBRADA. R2 aceita até 7 dias.
const PRESIGN_EXPIRES = 24 * 60 * 60;
const PROMPT_MAX = 20_000; // limite do gpt-image-2
// gpt-image-2 aceita até 16; o fallback Seedream corta sozinho em 10 (a fixa
// vai primeiro no array, então ela nunca fica de fora).
const MAX_REFERENCE_IMAGES = 15;
// Teto do PESO SOMADO das referências (#199). Ver o bloco que usa esta
// constante: a contagem sozinha nunca pegou o caso de 340 MB em 14 fotos.
const MAX_REFERENCE_BYTES = 150 * 1024 * 1024;

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
  // Duas áreas válidas: `images/` (inputs de upload) e `refs/` (referências
  // salvas, 19/08 — a referência adotada mora lá e tem que poder gerar).
  if (
    inputKeys.some(
      (k) =>
        !k.startsWith(`${auth.user_id}/images/`) &&
        !k.startsWith(`${auth.user_id}/refs/`),
    )
  ) {
    return badRequest("Imagem de referência inválida");
  }

  // ── Disjuntor (caso 28/07) + contingência Seedream (spec 29/07): titular
  // (GPT) falhando em série → roteia as novas tasks pro fallback SOZINHO (e
  // volta sozinho quando o GPT sara). Com KIE_FALLBACK_ENABLED desligado, cai
  // no comportamento antigo: pausa com aviso claro, sem cobrar.
  const route = await pickImageRoute();
  if (route.blocked) {
    return jsonError(
      "provider_degraded",
      "O gerador de imagens está sobrecarregado neste momento. Aguarde alguns minutos e tente de novo — você não foi cobrado por esta tentativa.",
      503,
    );
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

  // O aluno escreve/edita em pt-BR; o modelo de imagem rende melhor em inglês.
  // Tradução invisível (Haiku, fallback = texto original). O prompt pt fica na
  // row pro aluno; o prompt_en vai pro Kie (inclusive no retry).
  const promptEn = await translateImagePrompt(prompt);

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

  // Referência morta (foto apagada junto com uma geração antiga do histórico,
  // caso 06/08): valida ANTES de criar a task no Kie — erro claro, sem cobrar,
  // em vez de "Image fetch failed" já cobrado + estorno + rajada de retries.
  const heads = await Promise.all(inputKeys.map((k) => objectHead(imagesBucket(), k)));
  if (heads.some((h) => !h.exists)) {
    return jsonError(
      "reference_missing",
      "Uma das fotos de referência não existe mais (ela foi apagada junto com uma geração antiga do histórico). Remova essa referência e adicione a foto de novo — você não foi cobrado por esta tentativa.",
      400,
    );
  }

  // PESO das referências (#199, 30/08). O aluno mandou 14 fotos originais de
  // câmera — 340 MB somados — e o Kie recusou com "generate playground failed,
  // task id is blank". Três vezes. Ele tentou três vezes porque a NOSSA
  // mensagem de falha mandava "tente de novo em alguns minutos", e essa falha
  // é DETERMINÍSTICA: o mesmo payload nunca ia passar. Cada tentativa cobrou e
  // estornou 525 créditos, e o aluno só se destravou sozinho ao usar menos fotos.
  //
  // A régua vem da medição do Frank (HeadObject nos bytes reais): até ~129 MB
  // gerou ready, a partir de ~317 MB falhou 3/3, nas duas famílias de modelo.
  // A CONTAGEM não separa nada (15 refs geraram ready 20 vezes pra 11 alunos),
  // por isso o `MAX_REFERENCE_IMAGES` sozinho nunca pegou este caso. O limiar
  // exato do Kie não é público: 150 MB fica acima do maior sucesso observado e
  // bem abaixo do menor fracasso — e barrar aqui é grátis, enquanto deixar
  // passar custa uma cobrança, um estorno e um aluno achando que quebrou.
  const totalBytes = heads.reduce((s, h) => s + (h.bytes ?? 0), 0);
  if (totalBytes > MAX_REFERENCE_BYTES) {
    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(0)} MB`;
    return jsonError(
      "references_too_large",
      `As suas ${inputKeys.length} fotos de referência somam ${mb(totalBytes)}, e o limite é ${mb(MAX_REFERENCE_BYTES)} — ` +
        `o gerador recusa antes de começar. Não adianta tentar de novo com as mesmas fotos: ` +
        `use menos fotos, ou fotos mais leves (as originais de câmera são bem pesadas; ` +
        `uma foto tirada pelo celular ou uma versão reduzida resolve). Você não foi cobrado por esta tentativa.`,
      400,
      { total_bytes: totalBytes, max_bytes: MAX_REFERENCE_BYTES, count: inputKeys.length },
    );
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
        prompt: promptEn,
        input_urls: inputUrls,
        aspect_ratio: aspect,
        resolution,
      },
      { callBackUrl: kieCallbackUrl(), model: route.model },
    );
    taskId = created.taskId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kie createTask failed";
    console.error("[images/generate] Kie createTask falhou:", msg);
    // Rejeição upstream conhecida (ex.: 2026-07-15 o gpt-image-2 desativou
    // temporariamente 4:5/5:4): erro ACIONÁVEL → 400 com instrução clara,
    // não o 500 genérico que esconde a causa do aluno.
    if (/aspect ratio/i.test(msg)) {
      return jsonError(
        "aspect_unavailable",
        "A proporção escolhida está temporariamente indisponível no gerador de imagens. Escolha outra proporção (ex.: 1:1, 9:16 ou 16:9) e tente de novo.",
        400,
      );
    }
    return serverError(`Kie: ${msg}`);
  }

  const id = randomUUID();
  const name = (body.name ?? "").trim().slice(0, 120) || null;

  const { error: insertErr } = await admin.from("image_generations").insert({
    id,
    user_id: auth.user_id,
    name,
    prompt,
    prompt_en: promptEn,
    idea,
    input_image_path: inputKeys[0],
    input_image_paths: inputKeys,
    aspect_ratio: aspect,
    resolution,
    credits_cost: billed ? creditCost : 0,
    status: "pending",
    kie_task_id: taskId,
    kie_model: route.model,
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
