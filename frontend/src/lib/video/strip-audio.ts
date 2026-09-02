/**
 * Tira a FAIXA DE ÁUDIO de um vídeo gerado pelo Kie (Animar Imagem).
 * Server-only.
 *
 * Por que existe (incidente #236): o Bronze é `grok-imagine-video-1-5-preview`
 * e ele ANIMA A FOTO FALANDO — sai voz em inglês, do nada, num produto que a
 * pessoa espera mudo. Não há conserto por parâmetro: o input do Grok na Kie é
 * FECHADO (`additionalProperties: false`) e aceita só prompt, image_urls,
 * aspect_ratio, resolution, duration, nsfw_checker — não existe campo de áudio.
 * Mandar `generate_audio` ali é rejeitado na validação ou descartado, e nos
 * dois casos o vídeo continua falando. Kling v3-turbo e Hailuo 2.3 também não
 * têm campo de áudio. `generate_audio` só existe na família seedance (por isso
 * o Gold já sai mudo, via `buildVideoInput` em lib/kie/client.ts).
 *
 * Prompt do tipo "no speech, silent" NÃO é garantia — é pedido, não trava.
 *
 * Então o corte é feito AQUI, depois de baixar e antes de subir pro R2:
 * vendor-independent, funciona pra qualquer modelo que a Kie inventar amanhã.
 *
 * POR QUE SEMPRE, E NÃO SÓ NO NÃO-SEEDANCE (decisão do PR, com medição):
 *
 *  1. Gatear por tier NÃO cobre o caso real. O fallback de contingência
 *     (`VIDEO_FALLBACK_BY_TIER`) troca o modelo por baixo sem o aluno saber:
 *     **gold → kling** e **bronze → hailuo**, nenhum dos dois com flag de
 *     áudio. Ou seja, um vídeo do tier Gold pode ter sido gerado pelo Kling e
 *     sair falando. Um gate `tier !== "gold"` deixaria esse caso passar.
 *  2. Gatear pelo modelo gravado (`video_kie_model`) troca um bug por outro:
 *     a coluna é `string | null`, e um `null` (row antiga, corrida entre poll e
 *     webhook) cairia no ramo errado. "Sem áudio" tem que ser propriedade do
 *     arquivo que sobe, não de um metadado que pode faltar.
 *  3. Medido: em arquivo JÁ MUDO o comando é no-op de custo desprezível
 *     (3 execuções, <10ms cada — abaixo da resolução do `time`), porque
 *     `-c copy` é cópia de stream, não decodificação.
 *  4. Medido: o bitstream de vídeo sai BIT A BIT idêntico (mesmo MD5 do
 *     `-map 0:v -c copy`), então rodar sempre não custa qualidade nenhuma.
 *
 * Conclusão: aplicar sempre é mais barato de raciocinar, cobre o fallback e
 * não tem custo mensurável. A prova dos itens 3 e 4 está no corpo do PR.
 *
 * FALHA SEGURA (requisito explícito do card): se o ffmpeg falhar, estourar o
 * tempo ou nem existir no ambiente, esta função devolve os BYTES ORIGINAIS em
 * vez de lançar. Sair com áudio é um defeito cosmético; perder o vídeo é perder
 * a entrega de um aluno que já foi cobrado. Nunca derrubar a entrega.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
// Extensão `.ts` explícita (allowImportingTsExtensions) igual a
// heygen/imagem-content-type.ts: é o que deixa o `node --test` rodar este
// módulo sem passar por bundler.
import { dirTemporario } from "../onboarding/tmp.ts";

/**
 * Lido a CADA chamada, não uma vez no import: o `next start` do pm2 carrega o
 * .env.local no boot, e uma constante de módulo congelaria o valor conforme a
 * ordem de import. Também é o que deixa o teste de falha segura apontar pra um
 * binário inexistente de verdade.
 */
function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

/**
 * Teto do corte. Clipe de Animar Imagem tem 4–6s e o `-c copy` não decodifica,
 * então o normal é milissegundos; 60s é folga pra I/O lento, não expectativa.
 */
const STRIP_TIMEOUT_MS = 60_000;

/** Extensões em que o corte é seguro. Fora disso, sobe o original intacto. */
const EXTENSOES_SUPORTADAS = new Set(["mp4", "webm", "mov"]);

function run(cmd: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${cmd} passou de ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exit ${code}: ${err.slice(-200)}`));
    });
  });
}

/**
 * Devolve os mesmos bytes SEM faixa de áudio.
 *
 * Nunca lança: qualquer problema (ffmpeg ausente, timeout, contêiner exótico,
 * saída vazia) volta o buffer original e registra um `console.warn`.
 *
 * @param bytes  o mp4/webm/mov já baixado do Kie
 * @param ext    extensão detectada por `pickExt` (mp4 | webm | mov)
 */
export async function stripAudioTrack(bytes: Buffer, ext: string): Promise<Buffer> {
  if (!EXTENSOES_SUPORTADAS.has(ext)) {
    console.warn(`[strip-audio] extensão não suportada (${ext}) — subindo original`);
    return bytes;
  }
  if (bytes.length === 0) return bytes;

  let dir: string | null = null;
  try {
    dir = await dirTemporario("vidmute-");
    const entrada = join(dir, `in.${ext}`);
    const saida = join(dir, `out.${ext}`);
    await writeFile(entrada, bytes);

    // `-c copy` copia os streams sem reencodar (rápido e sem perda);
    // `-an` simplesmente não mapeia áudio nenhum pro arquivo de saída.
    await run(
      ffmpegBin(),
      ["-y", "-loglevel", "error", "-i", entrada, "-c", "copy", "-an", saida],
      STRIP_TIMEOUT_MS,
    );

    const mudo = await readFile(saida);
    // Saída vazia/truncada = corte deu errado em silêncio. Prefere o original.
    if (mudo.length === 0) {
      console.warn("[strip-audio] saída vazia — subindo original");
      return bytes;
    }
    return mudo;
  } catch (e) {
    // FALHA SEGURA: entregar com áudio é muito melhor que não entregar.
    console.warn(
      `[strip-audio] falhou, subindo vídeo original com áudio: ${e instanceof Error ? e.message : e}`,
    );
    return bytes;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
