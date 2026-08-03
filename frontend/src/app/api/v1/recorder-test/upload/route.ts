/**
 * 🧪 Lab · Gravador pelo Celular — POST do take gravado NO CELULAR.
 * Auth = token stateless do QR/link (sem login no aparelho). Grava o blob
 * direto no R2 (bucket voices) dentro da pasta da sessão de teste.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  // Node 18 do servidor NÃO tem o global File (só 20+) — checa por Blob.
  const file = form.get("file");
  if (!(file instanceof Blob)) return badRequest("Arquivo ausente.");
  if (file.size === 0 || file.size > MAX_BYTES) return badRequest("Áudio vazio ou grande demais.");
  const mime = (file.type || "audio/webm").split(";")[0].toLowerCase();
  if (!OK_TYPES.includes(mime)) return badRequest(`Formato não suportado (${mime}).`);

  // O webm do MediaRecorder vem SEM cabeçalho de duração e o <audio> trava
  // no 1º pedaço ("só ouvi 'O dia que.'", Johnny 03/08). Converte pra MP3 no
  // servidor (ffmpeg já existe pro render worker) — toca em qualquer lugar.
  const key = `${recorderPrefix(userId, token)}take_${Date.now()}.mp3`;
  let dir: string | null = null;
  try {
    const body = Buffer.from(await file.arrayBuffer());
    dir = await mkdtemp(join(tmpdir(), "rectest-"));
    const src = join(dir, "in");
    const out = join(dir, "out.mp3");
    await writeFile(src, body);
    await new Promise<void>((resolve, reject) => {
      const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vn", "-codec:a", "libmp3lame", "-b:a", "128k", out]);
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    });
    const mp3 = await readFile(out);
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key, Body: mp3, ContentType: "audio/mpeg" }));
  } catch (e) {
    console.error("[recorder-test] conversão/upload falhou:", e instanceof Error ? e.message : e);
    return serverError("Falha ao guardar o áudio — tente de novo.");
  } finally {
    if (dir) void rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  return jsonOk({ key }, 201);
}
