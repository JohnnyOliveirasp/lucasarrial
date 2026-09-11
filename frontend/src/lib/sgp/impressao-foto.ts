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
 * ⚠️ 11/09 — ERA 8x8 (64 bits) E TRANCAVA ALUNO FORA (incidente `3dbd2bf0`).
 * Nos 64 bits a faixa de "mesma imagem re-salva" SE SOBREPÕE à de "fotos
 * diferentes da mesma pessoa": não existe limiar que separe. O aluno anexava
 * 1-2 fotos e TODAS as outras dele passavam a ser recusadas como "repetida",
 * e retentar nunca resolvia. 1 pagante travado ~6h em 10/09.
 *
 * Medido em produção (214 fotos de 40 pedidos reais, 481 pares de fotos
 * DIFERENTES × 642 re-salvas, 0 falha de instrumento):
 *
 *   8x8 limite 5 (o que estava no ar): 8/481 = 1,7% dos pares de fotos
 *       DIFERENTES recusados como repetida — inclusive 2 pares do próprio
 *       Igor, a distância 3. O defeito, reproduzido.
 *   8x8 limite 2 é o maior com 0 falso-positivo, mas o par distinto mais
 *       próximo está a 3: **1 bit de folga**. Não dá pra confiar.
 *   16x16 limite 12: 0/481 falso-positivo, par distinto mais próximo a 23 —
 *       **11 bits de folga**, e ainda pega 83,8% das re-salvas.
 *
 * A assimetria manda no desenho: falso-POSITIVO tranca um pagante sem saída
 * (retentar não resolve), falso-NEGATIVO só deixa o aluno com uma foto
 * parecida entre as 6 — e o sha256 continua pegando reenvio byte a byte.
 * Escolhemos folga contra falso-positivo, não taxa de captura.
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

/** Lado do dHash. 16 => 256 bits. A grade é (LADO+1) x LADO. */
const LADO = 16;

/**
 * Até esta distância (inclusive) é a MESMA imagem. Ver a medição no topo.
 *
 * ⚠️ TEM QUE FICAR ABAIXO DE 64. `distancia()` aqui e `sgp_dhash_distancia()`
 * no banco devolvem **64 como sentinela** de "comprimento diferente" (hash
 * velho de 16 chars × hash novo de 64). Com o limite abaixo de 64 essa
 * sentinela cai como "NÃO é repetida", que é o lado seguro: o pedido antigo
 * perde o dedup das fotos já gravadas, mas nunca tranca ninguém. Subir o
 * limite pra 64+ inverteria isso e passaria a marcar como "repetida" toda
 * foto cujo hash tem outro tamanho.
 */
export const DHASH_LIMITE = 12;

export type Impressao = { sha256: string; dhash: string | null };

export async function impressaoDaFoto(bucket: string, key: string): Promise<Impressao> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("foto sem corpo no R2");
  const bytes = Buffer.from(await res.Body.transformToByteArray());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { sha256, dhash: await dhash(bytes) };
}

/** dHash: 17x16 cinza, bit = pixel maior que o vizinho da direita. */
async function dhash(bytes: Buffer): Promise<string | null> {
  const dir = await dirTemporario("sgp-dhash-");
  try {
    const entrada = join(dir, "in.img");
    await writeFile(entrada, bytes);
    const { stdout } = await exec(
      "ffmpeg",
      ["-v", "error", "-i", entrada, "-vf", `scale=${LADO + 1}:${LADO},format=gray`, "-frames:v", "1", "-f", "rawvideo", "-"],
      { encoding: "buffer", timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
    const px = stdout as unknown as Buffer;
    // Quadro incompleto: devolve null e sobra o sha. Nunca derruba o upload.
    if (px.length < (LADO + 1) * LADO) return null;
    let bits = "";
    for (let y = 0; y < LADO; y++) {
      for (let x = 0; x < LADO; x++) {
        bits += px[y * (LADO + 1) + x] > px[y * (LADO + 1) + x + 1] ? "1" : "0";
      }
    }
    // Hex direto dos bits: nada de BigInt (o target do projeto é pré-ES2020).
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Distância de Hamming entre dois dHash em hex.
 *
 * Comprimento diferente => 64, a MESMA sentinela do `sgp_dhash_distancia()` no
 * banco (os dois têm que concordar, senão o dedup decide um no JS e outro no
 * SQL). É o caso do hash velho de 16 chars contra o novo de 64: com
 * DHASH_LIMITE < 64 isso lê "não é repetida" — falha ABERTO, de propósito.
 */
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
