/**
 * 🧪 Lab · Gravador pelo Celular — POST do take gravado NO CELULAR.
 * Auth = token stateless do QR/link (sem login no aparelho). Grava o blob
 * direto no R2 (bucket voices) dentro da pasta da sessão de teste.
 */
import type { NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { recorderPrefix, verifyRecorderToken } from "@/lib/recorder-test/token";

export const dynamic = "force-dynamic";

const MAX_BYTES = 40 * 1024 * 1024; // ~40MB ≈ 5min de wav/opus com folga
const OK_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a", "audio/aac"];

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-recorder-token") ?? "";
  const userId = verifyRecorderToken(token);
  if (!userId) return jsonError("unauthorized", "Sessão expirada — gere um novo link no computador.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Envio inválido.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Arquivo ausente.");
  if (file.size === 0 || file.size > MAX_BYTES) return badRequest("Áudio vazio ou grande demais.");
  const mime = (file.type || "audio/webm").split(";")[0].toLowerCase();
  if (!OK_TYPES.includes(mime)) return badRequest(`Formato não suportado (${mime}).`);

  const ext = mime === "audio/mp4" || mime === "audio/x-m4a" ? "m4a"
    : mime === "audio/mpeg" ? "mp3"
    : mime === "audio/wav" ? "wav"
    : mime === "audio/ogg" ? "ogg"
    : "webm";
  const key = `${recorderPrefix(userId, token)}take_${Date.now()}.${ext}`;

  try {
    const body = Buffer.from(await file.arrayBuffer());
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key, Body: body, ContentType: mime }));
  } catch {
    return serverError("Falha ao guardar o áudio — tente de novo.");
  }
  return jsonOk({ key }, 201);
}
