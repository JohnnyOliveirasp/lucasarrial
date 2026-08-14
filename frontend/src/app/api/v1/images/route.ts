/**
 * /api/v1/images
 *   GET    → lista as imagens geradas do usuário (com presigned URL do resultado)
 *   DELETE → apaga em lote { ids: string[] } (R2 da referência + resultado + banco)
 *
 * Histórico de imagens. Apagar é irreversível.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { translatePromptTo } from "@/lib/llm/translate-image-prompt";
import { imagesBucket } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";
import { createPresignedGet } from "@/lib/r2/presigned";

/** Quantas traduções lazy por request (1x por imagem; o resto vem na próxima). */
const TRANSLATE_CAP = 8;

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  // Idioma da página (?lang=pt|en|es): o prompt exibido acompanha (pedido
  // Johnny 06/08 — a pessoa copia o prompt pra regerar no idioma dela).
  const langParam = request.nextUrl.searchParams.get("lang") ?? "pt";
  const lang: "pt" | "en" | "es" = langParam === "en" ? "en" : langParam === "es" ? "es" : "pt";

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("image_generations")
    .select(
      "id, name, prompt, prompt_en, prompt_es, aspect_ratio, resolution, credits_cost, image_path, status, error_message, created_at, video_status, video_path, video_tier, video_prompt_pt, video_error, kie_model",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list images");

  // Tradução preguiçosa com cache no banco: traduz UMA vez e reaproveita.
  let translateBudget = TRANSLATE_CAP;
  async function promptFor(g: {
    id: string;
    prompt: string;
    prompt_en: string | null;
    prompt_es: string | null;
  }): Promise<string> {
    if (lang === "pt") return g.prompt;
    const cached = lang === "en" ? g.prompt_en : g.prompt_es;
    if (cached) return cached;
    if (translateBudget <= 0) return g.prompt;
    translateBudget--;
    const translated = await translatePromptTo(lang, g.prompt);
    if (translated && translated !== g.prompt) {
      await admin
        .from("image_generations")
        .update(lang === "en" ? { prompt_en: translated } : { prompt_es: translated })
        .eq("id", g.id);
    }
    return translated;
  }

  const items = await Promise.all(
    (rows ?? []).map(async (g) => {
      let image_url: string | null = null;
      if (g.status === "ready" && g.image_path) {
        try {
          image_url = await createPresignedGet(imagesBucket(), g.image_path, 60 * 60);
        } catch {
          image_url = null;
        }
      }
      let video_url: string | null = null;
      if (g.video_status === "ready" && g.video_path) {
        try {
          video_url = await createPresignedGet(imagesBucket(), g.video_path, 60 * 60);
        } catch {
          video_url = null;
        }
      }
      return {
        id: g.id,
        name: g.name,
        prompt: g.prompt,
        // Prompt no idioma da página (copiável pra regerar).
        prompt_display: await promptFor(g),
        aspect_ratio: g.aspect_ratio,
        resolution: g.resolution,
        credits_cost: g.credits_cost,
        status: g.status,
        error_message: g.error_message,
        created_at: g.created_at,
        image_url,
        // Chave R2 do resultado — "usar como referência" no estúdio (29/07).
        image_path: g.status === "ready" ? g.image_path : null,
        // Johnny 13/08: histórico é só de GERADAS — o front usa isto pra
        // esconder uploads (kie_model === "upload") do card de histórico.
        kie_model: g.kie_model,
        video_status: g.video_status,
        video_tier: g.video_tier,
        video_prompt_pt: g.video_prompt_pt,
        video_error: g.video_error,
        video_url,
      };
    }),
  );

  return jsonOk({ images: items });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { ids?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return badRequest("Nenhuma imagem selecionada");

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("image_generations")
    .select("id, input_image_path, input_image_paths, image_path, video_path")
    .eq("user_id", auth.user_id)
    .in("id", ids);
  if (error) return serverError("Failed to load images");
  const found = rows ?? [];
  if (found.length === 0) return jsonOk({ deleted: 0 });

  try {
    const keys = found
      .flatMap((r) => [
        // todas as refs (array novo) + a legada singular + o resultado + vídeo
        ...(r.input_image_paths ?? []),
        r.input_image_path,
        r.image_path,
        r.video_path,
      ])
      .filter((k): k is string => !!k);
    if (keys.length) await deleteKeys(imagesBucket(), [...new Set(keys)]);
  } catch (e) {
    return serverError(e instanceof Error ? `R2: ${e.message}` : "R2 cleanup failed");
  }

  const foundIds = found.map((r) => r.id);
  const { error: dErr } = await admin
    .from("image_generations")
    .delete()
    .eq("user_id", auth.user_id)
    .in("id", foundIds);
  if (dErr) return serverError("Failed to delete images");

  return jsonOk({ deleted: foundIds.length });
}
