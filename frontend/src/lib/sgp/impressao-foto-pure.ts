/**
 * SGP tela 2 — o NÚCLEO da impressão digital da foto, sem R2 e sem alias "@/".
 *
 * ⚠️ POR QUE ISTO É UM MÓDULO PURO E SEPARADO (mesmo motivo do `previa-pure.ts`):
 * o `impressao-foto.ts` importa o cliente do R2 e o `dirTemporario`, e por isso
 * não sobe num `node --test`. A régua "o que é a mesma foto" é justamente a
 * parte que precisa de teste com imagem de verdade — então ela mora aqui, e o
 * `impressao-foto.ts` reexporta tudo para quem já importava de lá.
 *
 * O aluno repete de dois jeitos, e cada um tem a sua impressão:
 *  - `sha256`: arquivo idêntico (mandou o mesmo de novo);
 *  - `dhash`: a MESMA imagem re-salva/recomprimida/redimensionada — o sha muda,
 *    mas o conteúdo é o mesmo. A comparação é por distância de Hamming.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * INCIDENTE #349 — POR QUE O HASH É 16x16 E NÃO MAIS 8x8
 *
 * Até 10/09 o dHash era 8x8 (64 bits) com limite 5. Medido em produção, nos 32
 * objetos reais da sessão 42454b04 (Igor Moraes), com a própria `distancia()`:
 *
 *     8x8 (64 bits)    mesma imagem re-salva ....... 0..1
 *                      fotos DIFERENTES ............ 1..4     ← se sobrepõe
 *
 * As duas faixas se encostam: em 64 bits NÃO EXISTE limiar que separe "a mesma
 * foto de novo" de "outra foto da mesma pessoa". Baixar o limite não conserta
 * (1 e 2 já eram fotos diferentes) e mantê-lo em 5 barra tudo. O parâmetro
 * nunca foi o problema — a RESOLUÇÃO do hash era.
 *
 * Consequência real: depois de anexar 2 fotos, as 6 fotos distintas restantes
 * do aluno batiam <= 5 contra uma das duas. Ele ficou ~6h travado na tela 2
 * (o mínimo é 4 fotos), e a mensagem ainda mandava "escolha outra, de um ângulo
 * diferente" — que era exatamente o que ele já estava fazendo.
 *
 * Nos MESMOS arquivos, com 16x16 (256 bits, `scale=17:16`):
 *
 *     16x16 (256 bits) mesma imagem re-salva ....... 0..1
 *                      fotos DIFERENTES ............ 5, 6, 35, 55, 56
 *
 * Agora separa, com uma janela vazia entre 1 e 5. Daí `DHASH_LIMITE = 3`, no
 * meio dessa janela.
 *
 * COMPATIBILIDADE COM O HASH ANTIGO: o dhash de 8x8 tem 16 chars, o de 16x16
 * tem 64. `distancia()` devolve 64 quando os comprimentos diferem, então foto
 * velha x foto nova NUNCA é lida como repetida. Isso FALHA ABERTO (deixa
 * passar), nunca trava aluno — que é a regra declarada deste módulo: a
 * impressão nunca pode DERRUBAR um upload, só barrar repetição óbvia. Um
 * pedido antigo no meio do caminho perde o dedup contra o que já estava
 * anexado até o aluno reenviar; é o lado seguro de errar.
 *
 * O espelho no banco (`public.sgp_dhash_distancia`, em
 * scripts/103_sgp_anexo_atomico.sql) NÃO precisa de migration: ele já é
 * genérico no comprimento (itera 1..length(a) e devolve 64 quando os tamanhos
 * diferem), e `sgp_anexar_foto` recebe o limite por parâmetro — que vem daqui,
 * via `anexar.ts`. Só o comentário do .sql ficou falando em "64 bits = 16
 * chars"; o código está certo.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const exec = promisify(execFile);

/**
 * Abaixo disto é a mesma imagem (256 bits).
 * Janela medida em #349: mesma imagem 0..1, fotos diferentes >= 5.
 */
export const DHASH_LIMITE = 3;

/** Lado do hash em pixels: 16x16 = 256 bits = 64 chars de hex. */
const LADO = 16;
/** Uma coluna a mais, porque o bit compara o pixel com o VIZINHO DA DIREITA. */
const LARGURA = LADO + 1;
/** O ffmpeg tem que devolver pelo menos isto de pixel cinza (17*16 = 272). */
const PIXELS = LARGURA * LADO;

export type Impressao = { sha256: string; dhash: string | null };

/**
 * dHash: 17x16 cinza, bit = pixel maior que o vizinho da direita.
 *
 * `dir` é o diretório de trabalho (o chamador é quem decide onde — em produção
 * é o temp EM DISCO do servidor, ver `lib/onboarding/tmp.ts`). Este módulo não
 * cria nem apaga o diretório: quem cria, apaga.
 *
 * Falhou o ffmpeg? devolve `null` e sobra o sha — nunca derruba o upload.
 */
export async function dhashDeBytes(bytes: Buffer, dir: string): Promise<string | null> {
  try {
    const entrada = join(dir, "in.img");
    await writeFile(entrada, bytes);
    const { stdout } = await exec(
      "ffmpeg",
      [
        "-v", "error",
        "-i", entrada,
        "-vf", `scale=${LARGURA}:${LADO},format=gray`,
        "-frames:v", "1",
        "-f", "rawvideo", "-",
      ],
      { encoding: "buffer", timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
    const px = stdout as unknown as Buffer;
    if (px.length < PIXELS) return null;
    let bits = "";
    for (let y = 0; y < LADO; y++) {
      for (let x = 0; x < LADO; x++) {
        bits += px[y * LARGURA + x] > px[y * LARGURA + x + 1] ? "1" : "0";
      }
    }
    // Hex direto dos bits: nada de BigInt (o target do projeto é pré-ES2020).
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

/**
 * Hamming entre dois dHash hex. Espelho de `public.sgp_dhash_distancia`.
 *
 * O 64 devolvido quando os comprimentos diferem NÃO é "os bits todos": é o
 * sentinela de "nada a ver", e tem que continuar sendo 64 para bater com o SQL.
 * Com limite 3 ele segue muito acima do corte, que é o que faz o hash antigo
 * (16 chars) x o novo (64 chars) falhar ABERTO em vez de travar o aluno.
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
