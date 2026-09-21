/**
 * Download do viral que o ALUNO enviou — a cópia é do ACERVO, não da pessoa.
 *
 * Diferença pro `download.ts` (que existe desde 14/08): lá o mp4 é por aluno
 * (`{userId}/virais/{id}.mp4`), porque cada um baixa o que vai produzir. Aqui
 * o vídeo é de todos, então uma cópia só (`virais/comunidade/...`) — guardar
 * uma por aluno seria pagar armazenamento várias vezes pelo mesmo arquivo.
 *
 * Nunca lança: o envio já está gravado quando esta função roda, e derrubar o
 * envio por causa do arquivo seria perder o que o aluno trouxe. Falhou, o
 * estado fica em `download_status` + `download_erro` e pode ser refeito.
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
const MAX_FILESIZE = "80M";
const TIMEOUT_MS = 240_000;

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

/** Cookie do Instagram (o mesmo da busca por hashtag), no formato do yt-dlp. */
async function arquivoDeCookies(dir: string): Promise<string | null> {
  const cru = process.env.INSTAGRAM_WEB_COOKIES?.trim();
  if (!cru) return null;
  const linhas = cru
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf("=");
      return i > 0 ? `.instagram.com\tTRUE\t/\tTRUE\t0\t${p.slice(0, i).trim()}\t${p.slice(i + 1).trim()}` : null;
    })
    .filter((x): x is string => !!x);
  if (linhas.length === 0) return null;
  const alvo = path.join(dir, "cookies.txt");
  await fs.writeFile(alvo, `# Netscape HTTP Cookie File\n${linhas.join("\n")}\n`, "utf8");
  return alvo;
}

export async function baixarViralDaComunidade(
  admin: Admin,
  viralId: string,
  url: string,
): Promise<boolean> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "viral-com-"));
  const saida = path.join(dir, "video.mp4");
  try {
    const args = [
      "--no-warnings",
      "--no-playlist",
      "--max-filesize",
      MAX_FILESIZE,
      "-f",
      "mp4/best[ext=mp4]/best",
      "-o",
      saida,
    ];
    if (url.includes("instagram.com")) {
      const cookies = await arquivoDeCookies(dir);
      if (cookies) args.push("--cookies", cookies);
    }
    args.push(url);

    await run(YTDLP(), args, { timeout: TIMEOUT_MS, env: childEnv(), maxBuffer: 8 * 1024 * 1024 });

    const bin = await fs.readFile(saida).catch(() => null);
    if (!bin || bin.length === 0) throw new Error("download vazio");

    const r2Key = `virais/comunidade/${viralId}.mp4`;
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKETS.generations,
        Key: r2Key,
        Body: bin,
        ContentType: "video/mp4",
      }),
    );
    await admin
      .from("viral_videos")
      .update({ r2_key: r2Key, download_status: "pronto", download_erro: null })
      .eq("id", viralId);
    return true;
  } catch (e) {
    const motivo = e instanceof Error ? e.message.slice(0, 300) : "falhou";
    await admin
      .from("viral_videos")
      .update({ download_status: "erro", download_erro: motivo })
      .eq("id", viralId)
      .then(() => null, () => null);
    return false;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
