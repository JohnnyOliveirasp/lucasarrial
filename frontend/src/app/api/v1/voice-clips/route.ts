/**
 * 🎙️ Gravador do NAVEGADOR — persistência no servidor (caso Allan/Alana, 02/09).
 *
 * Até aqui o clipe gravado no navegador vivia SÓ no IndexedDB até o treino
 * começar: trocou de navegador/aparelho ou limpou dados = 20 minutos de
 * gravação perdidos, e o aluno lia isso como "apagaram meu áudio". Ordem do
 * Johnny: "se está na tela, tem que estar guardado".
 *
 * Este endpoint espelha o do celular (recorder-test/upload): cada clipe aceito
 * sobe na hora, convertido pra MP3 com loudnorm, em `<userId>/gravador/`.
 * A duração medida pelo gravador vai no NOME (`take_<ts>_<seg>s.mp3`) porque a
 * listagem precisa dela sem baixar nem re-medir nada (lição do #203: re-medir
 * no browser é o caminho que falha calado).
 *
 * Auth = usuário logado (authenticate), não o token de QR do celular.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export const dynamic = "force-dynamic";

// WAV mono 16-bit 48kHz do gravador ≈ 5,8MB/min; teto de clipe é 5min → ~29MB.
const MAX_BYTES = 60 * 1024 * 1024;
const OK_TYPES = ["audio/wav", "audio/x-wav", "audio/webm", "audio/ogg"];
const MAX_CLIPS = 60; // ninguém legítimo grava mais que isso pra 20min de meta

const prefixo = (userId: string) => `${userId}/gravador/`;

/** `take_1756830000000_87s.mp3` → 87. Sem sufixo legível → 0 (nunca inventa). */
function segundosDoNome(name: string): number {
  const m = name.match(/_(\d+)s\.mp3$/);
  return m ? Number(m[1]) : 0;
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Envio inválido.");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return badRequest("Arquivo ausente.");
  if (file.size === 0 || file.size > MAX_BYTES) return badRequest("Áudio vazio ou grande demais.");
  const mime = (file.type || "audio/wav").split(";")[0].toLowerCase();
  if (!OK_TYPES.includes(mime)) return badRequest(`Formato não suportado (${mime}).`);
  const seconds = Math.max(0, Math.min(3600, Math.round(Number(form.get("seconds") ?? 0)) || 0));

  // Anti-abuso barato: além do teto de clipes, nada de crescer sem limite.
  try {
    const atual = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKETS.voices, Prefix: prefixo(auth.user_id), MaxKeys: MAX_CLIPS + 1,
    }));
    if ((atual.KeyCount ?? 0) >= MAX_CLIPS) {
      return badRequest("Limite de gravações guardadas atingido — apague alguma ou inicie o treino.");
    }
  } catch { /* listagem falhou: não bloqueia o upload por isso */ }

  // Mesmo tratamento do take do celular: MP3 128k + loudnorm (o gravador do
  // navegador desliga o AGC, então lapela fraca chega baixa aqui também).
  const key = `${prefixo(auth.user_id)}take_${Date.now()}_${seconds}s.mp3`;
  let dir: string | null = null;
  try {
    const body = Buffer.from(await file.arrayBuffer());
    dir = await mkdtemp(join(tmpdir(), "gravclip-"));
    const src = join(dir, "in");
    const out = join(dir, "out.mp3");
    await writeFile(src, body);
    await new Promise<void>((resolve, reject) => {
      const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vn",
        "-af", "loudnorm=I=-18:TP=-2:LRA=11",
        "-codec:a", "libmp3lame", "-b:a", "128k", out]);
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
    });
    const mp3 = await readFile(out);
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key, Body: mp3, ContentType: "audio/mpeg" }));
  } catch (e) {
    console.error("[voice-clips] conversão/upload falhou:", e instanceof Error ? e.message : e);
    return serverError("Falha ao guardar a gravação — ela continua neste navegador; tente salvar de novo.");
  } finally {
    if (dir) void rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  return jsonOk({ key, seconds }, 201);
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  try {
    const out = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKETS.voices, Prefix: prefixo(auth.user_id), MaxKeys: 200,
    }));
    const objects = (out.Contents ?? []).sort(
      (a, b) => (a.LastModified?.getTime() ?? 0) - (b.LastModified?.getTime() ?? 0),
    );
    const clips = await Promise.all(objects.map(async (o) => ({
      key: o.Key!,
      name: o.Key!.split("/").pop()!,
      seconds: segundosDoNome(o.Key!),
      size: o.Size ?? 0,
      at: o.LastModified?.toISOString() ?? null,
      url: await createPresignedGet(R2_BUCKETS.voices, o.Key!, 3600),
    })));
    return jsonOk({ clips });
  } catch {
    return serverError("Falha ao listar as gravações.");
  }
}

/** DELETE ?key= — apaga UMA gravação (só dentro da pasta gravador do dono). */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith(prefixo(auth.user_id)) || key.includes("..")) {
    return badRequest("Chave inválida.");
  }
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKETS.voices, Key: key }));
  } catch {
    return serverError("Falha ao apagar a gravação.");
  }
  return jsonOk({ deleted: key });
}
