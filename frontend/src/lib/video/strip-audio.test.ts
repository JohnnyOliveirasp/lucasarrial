/**
 * Teste do corte da faixa de áudio do Animar Imagem (incidente #236).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/video/strip-audio.test.ts
 *
 * O defeito coberto: o Bronze (`grok-imagine-video-1-5-preview`) anima a foto
 * FALANDO em inglês, e não existe parâmetro na Kie pra desligar isso — o input
 * do Grok é fechado (`additionalProperties:false`) e não tem campo de áudio.
 * Como o conserto é de pós-processamento, o que precisa ser provado é o
 * ARQUIVO: depois de `stripAudioTrack` não pode sobrar stream de áudio.
 *
 * O teste gera um mp4 720x1280 (9:16, como o clipe de produção) com faixa de
 * áudio real, roda a função de produção e afirma com `ffprobe` que:
 *   1. sobrou 0 stream de áudio;
 *   2. o stream de VÍDEO continua lá e bit a bit idêntico (não reencodou);
 *   3. arquivo já mudo passa incólume (o caso Gold/seedance);
 *   4. FALHA SEGURA: ffmpeg inexistente devolve o original em vez de lançar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripAudioTrack } from "./strip-audio.ts";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) =>
      c === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exit ${c}: ${err.slice(-200)}`)),
    );
  });
}

/** Lista os codec_type dos streams — a prova de que sobrou (ou não) áudio. */
async function tiposDeStream(file: string): Promise<string[]> {
  const out = await run(FFPROBE, [
    "-v", "error",
    "-show_entries", "stream=codec_type",
    "-of", "csv=p=0",
    file,
  ]);
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** MD5 do BITSTREAM de vídeo (ignora o contêiner) — prova ausência de reencode. */
async function md5DoVideo(file: string): Promise<string> {
  return run(FFMPEG, ["-v", "error", "-i", file, "-map", "0:v", "-c", "copy", "-f", "md5", "-"]);
}

/** Gera um mp4 9:16 de 2s, com ou sem faixa de áudio. */
async function fixture(dir: string, nome: string, comAudio: boolean): Promise<string> {
  const alvo = join(dir, nome);
  const args = ["-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=24:duration=2"];
  if (comAudio) args.push("-f", "lavfi", "-i", "sine=frequency=440:duration=2");
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p");
  if (comAudio) args.push("-c:a", "aac", "-shortest");
  args.push(alvo);
  await run(FFMPEG, args);
  return alvo;
}

async function comDirTemp(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "stripaudio-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

test("tira a faixa de áudio e preserva o vídeo sem reencodar", async () => {
  await comDirTemp(async (dir) => {
    const origem = await fixture(dir, "com-audio.mp4", true);

    // Pré-condição: a fixture REALMENTE tem áudio (senão o teste não prova nada).
    const antes = await tiposDeStream(origem);
    assert.ok(antes.includes("audio"), `fixture deveria ter áudio, veio: ${antes.join(",")}`);
    assert.ok(antes.includes("video"));

    const mudo = await stripAudioTrack(await readFile(origem), "mp4");
    const saida = join(dir, "mudo.mp4");
    await writeFile(saida, mudo);

    const depois = await tiposDeStream(saida);
    assert.equal(
      depois.filter((t) => t === "audio").length,
      0,
      `ainda há faixa de áudio: ${depois.join(",")}`,
    );
    assert.ok(depois.includes("video"), "o vídeo sumiu junto com o áudio");

    // O vídeo tem que ser o MESMO bitstream: `-c copy` não pode reencodar.
    assert.equal(await md5DoVideo(saida), await md5DoVideo(origem), "o vídeo foi reencodado");
  });
});

test("arquivo já mudo (Gold/seedance) continua íntegro e sem áudio", async () => {
  await comDirTemp(async (dir) => {
    const semAudio = await fixture(dir, "ja-mudo.mp4", false);

    const saida = await stripAudioTrack(await readFile(semAudio), "mp4");
    assert.ok(saida.length > 0, "devolveu buffer vazio");

    const alvo = join(dir, "out.mp4");
    await writeFile(alvo, saida);

    const tipos = await tiposDeStream(alvo);
    assert.equal(tipos.filter((t) => t === "audio").length, 0);
    assert.ok(tipos.includes("video"));
    assert.equal(await md5DoVideo(alvo), await md5DoVideo(semAudio));
  });
});

test("FALHA SEGURA: sem ffmpeg no ambiente, devolve o original em vez de lançar", async () => {
  const original = process.env.FFMPEG_PATH;
  // Binário que não existe — simula o runtime sem ffmpeg instalado.
  process.env.FFMPEG_PATH = "/nao/existe/ffmpeg-inexistente";
  try {
    const entrada = Buffer.from("nao-e-um-video-de-verdade-mas-nao-pode-sumir");
    const saida = await stripAudioTrack(entrada, "mp4");
    assert.deepEqual(saida, entrada, "perdeu o vídeo do aluno quando o ffmpeg falhou");
  } finally {
    if (original === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = original;
  }
});

test("extensão não suportada sobe o original intacto", async () => {
  const entrada = Buffer.from("conteudo-qualquer");
  assert.deepEqual(await stripAudioTrack(entrada, "mkv"), entrada);
});
