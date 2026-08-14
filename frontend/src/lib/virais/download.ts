/**
 * Baixa o mp4 de um viral pro nosso R2 — o "worker de download".
 *
 * Só acontece quando a pessoa vai PRODUZIR (decisão do Johnny 14/08:
 * reservar ≠ baixar). Por isso resolve o link NA HORA: o `video_url` que a
 * busca salvou é uma URL de CDN do TikTok que expira em horas, então guardar
 * e usar depois não funciona.
 *
 * Provado na mão em 14/08 com um viral da prateleira do Johnny: yt-dlp baixa
 * TikTok público sem login, 1080x1920, **sem marca d'água** (nem logo girando
 * nem @usuário). ⚠️ A nota antiga de "yt-dlp morto no TikTok" era sobre BUSCA
 * (que exige conta logada) — baixar um vídeo pela URL funciona.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

const run = promisify(execFile);
type Admin = SupabaseClient<Database>;

const YTDLP = () => process.env.YTDLP_BIN || "yt-dlp";

/** Teto de tamanho: viral de 2min em 1080p dá ~15MB; 80MB é folga com sobra. */
const MAX_FILESIZE = "80M";
const TIMEOUT_MS = 240_000;

/**
 * Ambiente MÍNIMO do processo filho (mesmo cuidado do roteiro/link.ts): sem
 * isto o yt-dlp herdaria o process.env inteiro do Next — service role do
 * Supabase, R2, RunPod. Ele não lê nada disso, mas não há razão pra entregar.
 */
function childEnv(): NodeJS.ProcessEnv {
  const e = process.env;
  const tmp = os.tmpdir();
  return {
    NODE_ENV: e.NODE_ENV,
    PATH: e.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: e.HOME ?? tmp,
    TMPDIR: e.TMPDIR ?? tmp,
    NO_COLOR: "1",
    ...(e.SystemRoot ? { SystemRoot: e.SystemRoot } : {}),
    ...(e.ComSpec ? { ComSpec: e.ComSpec } : {}),
    ...(e.PATHEXT ? { PATHEXT: e.PATHEXT } : {}),
  };
}

export class DownloadViralError extends Error {
  constructor(
    message: string,
    readonly code: "sem_ferramenta" | "fora_do_ar" | "grande_demais" | "falhou",
  ) {
    super(message);
  }
}

/** Traduz o erro cru do yt-dlp em algo que o aluno entende. */
function traduzir(cru: string): DownloadViralError {
  const s = cru.toLowerCase();
  if (s.includes("enoent") || s.includes("not found")) {
    return new DownloadViralError("Ferramenta de download indisponível no servidor.", "sem_ferramenta");
  }
  if (s.includes("video not available") || s.includes("removed") || s.includes("404") || s.includes("private")) {
    return new DownloadViralError(
      "Esse vídeo saiu do ar no TikTok — o autor apagou ou deixou privado.",
      "fora_do_ar",
    );
  }
  if (s.includes("file is larger") || s.includes("max-filesize")) {
    return new DownloadViralError("Esse vídeo é grande demais pra baixar aqui.", "grande_demais");
  }
  return new DownloadViralError("Não consegui baixar esse vídeo agora. Tente de novo.", "falhou");
}

export type ViralBaixado = { r2Key: string; bytes: number };

/**
 * Baixa e sobe pro R2. Devolve a chave — quem chama grava em
 * viral_user_videos (o arquivo é POR PESSOA: quem pediu, tem).
 */
export async function baixarViral(args: {
  url: string;
  userId: string;
  viralId: string;
}): Promise<ViralBaixado> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "viral-"));
  const saida = path.join(dir, "video.mp4");
  try {
    try {
      await run(
        YTDLP(),
        [
          "--no-warnings",
          "--no-playlist",
          "--max-filesize", MAX_FILESIZE,
          // mp4 já mesclado quando existir; senão o melhor disponível.
          "-f", "mp4/best[ext=mp4]/best",
          "-o", saida,
          args.url,
        ],
        { timeout: TIMEOUT_MS, env: childEnv(), maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (e) {
      const cru = e instanceof Error ? `${e.message}` : String(e);
      throw traduzir(cru);
    }

    const bin = await fs.readFile(saida).catch(() => null);
    if (!bin || bin.length === 0) {
      throw new DownloadViralError("O download veio vazio.", "falhou");
    }

    const r2Key = `${args.userId}/virais/${args.viralId}.mp4`;
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKETS.generations,
        Key: r2Key,
        Body: bin,
        ContentType: "video/mp4",
      }),
    );
    return { r2Key, bytes: bin.length };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Marca o estado do download na linha PESSOAL (mig 75). */
export async function marcarDownload(
  admin: Admin,
  userId: string,
  viralId: string,
  campos: { status: string; r2Key?: string | null; erro?: string | null },
): Promise<void> {
  await admin.from("viral_user_videos").upsert(
    {
      user_id: userId,
      viral_id: viralId,
      reservado: true,
      download_status: campos.status,
      r2_key: campos.r2Key ?? null,
      download_erro: campos.erro ?? null,
      arquivo_tocado_em: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,viral_id" },
  );
}
