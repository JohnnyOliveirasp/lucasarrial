/**
 * O motor do Video React: clone → montagem.
 *
 * Fica separado da rota porque são dois momentos distintos — dispara o clone
 * (RunPod, minutos) e depois monta (ffmpeg, no nosso servidor). A rota só
 * chama estas funções.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { CLONE_TIERS, cloneExecutionTimeoutMs } from "@/lib/video-clone/config";
import { buildInfiniteTalkWorkflow } from "@/lib/video-clone/workflow";
import { getInfiniteTalkStatus, runInfiniteTalk } from "@/lib/video-clone/runpod";
import { montarReact, type LayoutMontagem } from "./montagem";

const run = promisify(execFile);
/** Padrão 2.0 — o mesmo tier do Vídeo Clone público. */
const TIER = CLONE_TIERS[0];

/**
 * ⚠️ O worker grava no bucket `voices-clone-ai-verse` (BUCKET_NAME do
 * endpoint RunPod), NÃO no de generations. Descoberto na marra em 14/08:
 * procurar o mp4 no bucket errado parece que o job falhou.
 */
const BUCKET_WORKER = "voices-clone-ai-verse";

/** Traz um arquivo de URL pública pro nosso R2 (a foto sai do Kie e expira). */
export async function trazerParaR2(url: string, key: string, contentType: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`não consegui baixar ${key} (${res.status})`);
  const bin = Buffer.from(await res.arrayBuffer());
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKETS.generations,
      Key: key,
      Body: bin,
      ContentType: contentType,
    }),
  );
  return key;
}

/** Dispara o clone com a foto de fundo verde + a fala. Devolve o job do RunPod. */
export async function dispararClone(args: {
  fotoKey: string;
  audioKey: string;
  saidaKey: string;
  segundos: number;
}): Promise<string> {
  const [imageUrl, audioUrl] = await Promise.all([
    createPresignedGet(R2_BUCKETS.generations, args.fotoKey, 60 * 60 * 3),
    createPresignedGet(R2_BUCKETS.generations, args.audioKey, 60 * 60 * 3),
  ]);
  const { workflow } = buildInfiniteTalkWorkflow({
    imageUrl,
    audioUrl,
    s3Key: args.saidaKey,
    tier: TIER,
    durationSeconds: args.segundos,
  });
  const { jobId } = await runInfiniteTalk(workflow, {
    executionTimeoutMs: cloneExecutionTimeoutMs(TIER, args.segundos),
  });
  return jobId;
}

export async function estadoClone(jobId: string) {
  return getInfiniteTalkStatus(jobId);
}

async function baixarDoR2(bucket: string, key: string, destino: string): Promise<void> {
  const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await obj.Body!.transformToByteArray();
  await fs.writeFile(destino, Buffer.from(bytes));
}

/**
 * Junta tudo e sobe o mp4 final. Roda quando o clone termina.
 * O áudio sai do próprio clone (ele já vem com a fala embutida) — o que
 * entra separado é o som do viral, abaixado pela montagem.
 */
export async function montarEEnviar(args: {
  viralKey: string;
  cloneKey: string;
  audioKey: string;
  layout: LayoutMontagem;
  segundos: number;
  /** Duração do viral: define onde ele acaba e começa o "só você". */
  viralSegundos: number;
  saidaKey: string;
}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "react-"));
  try {
    const viral = path.join(dir, "viral.mp4");
    const clone = path.join(dir, "clone.mp4");
    const audio = path.join(dir, "fala.mp3");
    const saida = path.join(dir, "final.mp4");

    await Promise.all([
      baixarDoR2(R2_BUCKETS.generations, args.viralKey, viral),
      baixarDoR2(BUCKET_WORKER, args.cloneKey, clone),
      baixarDoR2(R2_BUCKETS.generations, args.audioKey, audio),
    ]);

    await montarReact({
      viral,
      avatar: clone,
      audio,
      saida,
      layout: args.layout,
      segundos: args.segundos,
      viralSegundos: args.viralSegundos,
    });

    // Conferência barata: vídeo vazio não sobe.
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      saida,
    ]);
    if (Number(stdout.trim()) < 1) throw new Error("montagem saiu vazia");

    const bin = await fs.readFile(saida);
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKETS.generations,
        Key: args.saidaKey,
        Body: bin,
        ContentType: "video/mp4",
      }),
    );
    return args.saidaKey;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
