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
import {
  contentTypeImagemHeygen,
  erroImagemNaoSuportada,
  type ContentTypeHeygen,
} from "@/lib/heygen/imagem-content-type";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { imagesBucket, r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import type { HeygenAccountRow, HeygenVideoRow } from "@/lib/db/types";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const AUDIO_URL_TTL = 2 * 60 * 60; // HeyGen baixa o áudio na hora; 2h de folga

type PostBody = {
  image?: {
    kind?: "platform_image" | "upload" | "heygen_look";
    image_generation_id?: string;
    /** upload direto: data URL (jpeg/png, ≤8MB) */
    data_url?: string;
    /** look de foto-avatar da PRÓPRIA conta HeyGen (feedback Lucas 11/08) */
    look_url?: string;
  };
  audio_generation_id?: string;
  /** take gravado na hora (rotina do Gravador) — fica salvo pro treino depois */
  audio_take_key?: string;
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
): Promise<{ bytes: Uint8Array; contentType: ContentTypeHeygen } | string> {
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
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = contentTypeImagemHeygen(bytes);
    if (!ct) return erroImagemNaoSuportada(bytes);
    return { bytes, contentType: ct };
  }

  if (image.kind === "heygen_look") {
    // Look da conta HeyGen do aluno. A URL veio da NOSSA rota /avatars, mas o
    // client pode mandar qualquer coisa — valida esquema e domínio antes do
    // fetch server-side (anti-SSRF): só hosts do HeyGen/CDN deles.
    let u: URL;
    try {
      u = new URL(image.look_url ?? "");
    } catch {
      return "Look inválido";
    }
    const hostOk =
      u.protocol === "https:" &&
      (/(^|\.)heygen\.(com|ai)$/.test(u.hostname) || /(^|\.)amazonaws\.com$/.test(u.hostname));
    if (!hostOk) return "Look inválido";
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) return "Não foi possível ler a foto do avatar no HeyGen";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_UPLOAD_BYTES * 2) return "Foto do avatar muito grande";
    // ⚠️ Este é o caminho da queixa: o CDN do HeyGen serve WebP. Ler o header
    // aqui era o que produzia "Content type not match image/jpeg != image/webp".
    const ct = contentTypeImagemHeygen(buf);
    if (!ct) return erroImagemNaoSuportada(buf);
    return { bytes: buf, contentType: ct };
  }

  // upload direto (data URL) — o prefixo `data:image/...` é só rótulo mandado
  // pelo browser; quem decide o content-type continua sendo o conteúdo.
  const m = image.data_url?.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!m) return "Envie uma foto JPG, PNG ou WebP";
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
  if (bytes.length > MAX_UPLOAD_BYTES) return "Foto muito grande (máx. 8MB)";
  const ct = contentTypeImagemHeygen(bytes);
  if (!ct) return erroImagemNaoSuportada(bytes);
  return { bytes, contentType: ct };
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
  if (
    !image ||
    (image.kind !== "platform_image" && image.kind !== "upload" && image.kind !== "heygen_look")
  ) {
    return badRequest("Escolha a imagem do avatar");
  }
  if (!body.audio_generation_id && !body.audio_take_key) {
    return badRequest("Escolha um áudio da sua voz ou grave um agora");
  }

  const apiKey = await loadApiKey(auth.user_id);
  if (!apiKey) return badRequest("Conecte sua conta HeyGen primeiro");

  // Áudio: geração PRONTA do usuário OU take gravado (pasta recorder-test
  // dele no R2 — a mesma que o treino de voz importa) → URL presignada.
  let audioUrl: string;
  if (body.audio_take_key) {
    const key = body.audio_take_key;
    if (!key.startsWith(`${auth.user_id}/recorder-test/`) || key.includes("..")) {
      return badRequest("Gravação inválida");
    }
    try {
      await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key }));
    } catch {
      return badRequest("Gravação não encontrada — grave de novo");
    }
    audioUrl = await createPresignedGet(R2_BUCKETS.voices, key, AUDIO_URL_TTL);
  } else {
    const genId = body.audio_generation_id as string;
    const { data: genData } = await getAdmin()
      .from("generations")
      .select("audio_path, status, user_id, duration_seconds")
      .eq("id", genId)
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
    audioUrl = await createPresignedGet(R2_BUCKETS.generations, gen.audio_path, AUDIO_URL_TTL);
  }

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
        audio_generation_id: body.audio_generation_id ?? null,
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
