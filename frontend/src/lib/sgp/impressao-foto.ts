/**
 * SGP tela 2 — impressão digital da foto, pra barrar repetida.
 *
 * 29/08 (Johnny): "subi a mesma foto e ele deixou subir". Duas impressões,
 * porque o aluno repete de dois jeitos:
 *  - `sha256`: arquivo idêntico (mandou o mesmo de novo);
 *  - `dhash`: a MESMA imagem re-salva/recomprimida/redimensionada — o sha
 *    muda, mas o conteúdo é o mesmo. dHash 16x16 (256 bits) via ffmpeg, e a
 *    comparação é por distância de Hamming.
 *
 * Falhou o ffmpeg? devolve `dhash: null` e sobra o sha — nunca derruba o
 * upload por causa da impressão.
 *
 * Aqui mora só o que precisa do R2 e do temp do servidor. A RÉGUA (o hash, a
 * distância, o limite e o `ehRepetida`) mora em `./impressao-foto-pure`, que
 * sobe num `node --test` — ver o cabeçalho de lá para a medição do #349 que
 * levou o hash de 8x8 para 16x16.
 */
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2/client";
import { dirTemporario } from "@/lib/onboarding/tmp";
import { dhashDeBytes, type Impressao } from "./impressao-foto-pure";

export { DHASH_LIMITE, distancia, ehRepetida, type Impressao } from "./impressao-foto-pure";

export async function impressaoDaFoto(bucket: string, key: string): Promise<Impressao> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("foto sem corpo no R2");
  const bytes = Buffer.from(await res.Body.transformToByteArray());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { sha256, dhash: await dhash(bytes) };
}

/** Abre o diretório de trabalho, tira o dHash e faxina no fim. */
async function dhash(bytes: Buffer): Promise<string | null> {
  const dir = await dirTemporario("sgp-dhash-");
  try {
    return await dhashDeBytes(bytes, dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
