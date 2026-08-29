/**
 * SGP tela 2 — impressão digital da foto, pra barrar repetida.
 *
 * 29/08 (Johnny): "subi a mesma foto e ele deixou subir". Duas impressões,
 * porque o aluno repete de dois jeitos:
 *  - `sha256`: arquivo idêntico (mandou o mesmo de novo);
 *  - `dhash`: a MESMA imagem re-salva/recomprimida/redimensionada — o sha
 *    muda, mas o conteúdo é o mesmo. dHash 8x8 (64 bits) via ffmpeg, e a
 *    comparação é por distância de Hamming.
 *
 * Falhou o ffmpeg? devolve `dhash: null` e sobra o sha — nunca derruba o
 * upload por causa da impressão.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2/client";
import { dirTemporario } from "@/lib/onboarding/tmp";

const exec = promisify(execFile);

/** Abaixo disto é a mesma imagem (64 bits; ~8% de diferença). */
export const DHASH_LIMITE = 5;

export type Impressao = { sha256: string; dhash: string | null };

export async function impressaoDaFoto(bucket: string, key: string): Promise<Impressao> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("foto sem corpo no R2");
  const bytes = Buffer.from(await res.Body.transformToByteArray());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { sha256, dhash: await dhash(bytes) };
}

/** dHash: 9x8 cinza, bit = pixel maior que o vizinho da direita. */
async function dhash(bytes: Buffer): Promise<string | null> {
  const dir = await dirTemporario("sgp-dhash-");
  try {
    const entrada = join(dir, "in.img");
    await writeFile(entrada, bytes);
    const { stdout } = await exec(
      "ffmpeg",
      ["-v", "error", "-i", entrada, "-vf", "scale=9:8,format=gray", "-frames:v", "1", "-f", "rawvideo", "-"],
      { encoding: "buffer", timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
    const px = stdout as unknown as Buffer;
    if (px.length < 72) return null;
    let bits = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
      }
    }
    // Hex direto dos bits: nada de BigInt (o target do projeto é pré-ES2020).
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function distancia(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}

/** É repetida de alguma que já está no pedido? */
export function ehRepetida(nova: Impressao, existentes: Array<{ sha256?: string | null; dhash?: string | null }>): boolean {
  return existentes.some(
    (f) =>
      (f.sha256 && f.sha256 === nova.sha256) ||
      (f.dhash && nova.dhash && distancia(f.dhash, nova.dhash) <= DHASH_LIMITE),
  );
}
