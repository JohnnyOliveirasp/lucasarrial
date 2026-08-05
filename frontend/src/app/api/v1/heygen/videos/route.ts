/**
 * /api/v1/heygen/videos — geração Avatar IV via conta HeyGen do ALUNO (BYOK).
 *
 *   POST → cria o job: imagem (gerada na plataforma OU upload) + áudio da voz
 *          clonada → sobe a foto pro HeyGen (asset) → av4/generate.
 *          ⚠️ Consome créditos de API DA CONTA HEYGEN do aluno (a UI avisa).
 *   GET  → lista os vídeos HeyGen do usuário.
 *
 * O resultado é copiado pro nosso R2 quando fica pronto (poll no GET /[id]).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { decryptApiKey } from "@/lib/heygen/crypto";
import {
  uploadImageAsset,
  generateAvatarIV,
  friendlyHeygenError,
} from "@/lib/heygen/client";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import type { HeygenAccountRow, HeygenVideoRow } from "@/lib/db/types";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const AUDIO_URL_TTL = 2 * 60 * 60; // HeyGen baixa o áudio na hora; 2h de folga

type PostBody = {
  image?: {
    kind?: "platform_image" | "upload";
    image_generation_id?: string;
    /** upload direto: data URL (jpeg/png, ≤8MB) */
    data_url?: string;
  };
  audio_generation_id?: string;
  title?: string;
};

async function loadApiKey(userId: string): Promise<string | null> {
  const { data } = await getAdmin()
    .from("heygen_accounts")
    .select("api_key_encrypted, status")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as Pick<HeygenAccountRow, "api_key_encrypted" | "status"> | null;
  if (!row || row.status !== "active") return null;
  return decryptApiKey(row.api_key_encrypted);
}

async function imageBytesFromBody(
  userId: string,
  image: NonNullable<PostBody["image"]>,
): Promise<{ bytes: Uint8Array; contentType: "image/jpeg" | "image/png" } | string> {
  if (image.kind === "platform_image") {
    if (!image.image_generation_id) return "Escolha uma imagem da plataforma";
    const { data } = await getAdmin()
      .from("image_generations")
      .select("image_path, status, user_id")
      .eq("id", image.image_generation_id)
      .maybeSingle();
    const row = data as { image_path: string | null; status: string; user_id: string } | null;
    if (!row || row.user_id !== userId || row.status !== "ready" || !row.image_path) {
      return "Imagem não encontrada";
    }
    const url = await createPresignedGet(imagesBucket(), row.image_path, 600);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return "Não foi possível ler a imagem";
    const ct = res.headers.get("content-type")?.includes("png") ? "image/png" : "image/jpeg";
    return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: ct };
  }

  // upload direto (data URL)
  const m = image.data_url?.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
  if (!m) return "Envie uma foto JPG ou PNG";
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_UPLOAD_BYTES) return "Foto muito grande (máx. 8MB)";
  return { bytes: new Uint8Array(bytes), contentType: m[1] as "image/jpeg" | "image/png" };
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const image = body.image;
  if (!image || (image.kind !== "platform_image" && image.kind !== "upload")) {
    return badRequest("Escolha a imagem do avatar");
  }
  if (!body.audio_generation_id) return badRequest("Escolha um áudio da sua voz");

  const apiKey = await loadApiKey(auth.user_id);
  if (!apiKey) return badRequest("Conecte sua conta HeyGen primeiro");

  // Áudio: geração PRONTA do próprio usuário → URL presignada pro HeyGen baixar.
  const { data: genData } = await getAdmin()
    .from("generations")
    .select("audio_path, status, user_id, duration_seconds")
    .eq("id", body.audio_generation_id)
    .maybeSingle();
  const gen = genData as {
    audio_path: string | null;
    status: string;
    user_id: string;
    duration_seconds: number | null;
  } | null;
  if (!gen || gen.user_id !== auth.user_id || gen.status !== "ready" || !gen.audio_path) {
    return badRequest("Áudio não encontrado (a geração precisa estar pronta)");
  }
  const audioUrl = await createPresignedGet(R2_BUCKETS.generations, gen.audio_path, AUDIO_URL_TTL);

  const img = await imageBytesFromBody(auth.user_id, image);
  if (typeof img === "string") return badRequest(img);

  try {
    const { image_key } = await uploadImageAsset(apiKey, img.bytes, img.contentType);
    const { video_id } = await generateAvatarIV(apiKey, {
      image_key,
      audio_url: audioUrl,
      title: body.title || "FastCloner — Vídeo HeyGen",
    });
    const { data: inserted, error } = await getAdmin()
      .from("heygen_videos")
      .insert({
        user_id: auth.user_id,
        heygen_video_id: video_id,
        image_source: image.kind,
        audio_generation_id: body.audio_generation_id,
        title: body.title ?? null,
        status: "processing",
      })
      .select("id")
      .single();
    if (error || !inserted) return serverError("Não foi possível registrar o vídeo");
    return jsonOk({ id: (inserted as { id: string }).id, status: "processing" });
  } catch (e) {
    return badRequest(friendlyHeygenError(e));
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const { data } = await getAdmin()
    .from("heygen_videos")
    .select("id, status, title, image_source, duration_seconds, error_message, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(30);
  return jsonOk({ videos: (data ?? []) as Partial<HeygenVideoRow>[] });
}
