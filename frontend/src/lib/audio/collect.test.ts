/**
 * Testes do coletor de áudio do navegador (descarte silencioso, ronda 21/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/collect.test.ts
 *
 * O defeito coberto: filterAudioFiles jogava fora .amr/.mov/.mkv (e qualquer
 * outro não-áudio) sem contar nem avisar — .amr de gravador Android sumia e o
 * aluno levava "áudio insuficiente" sem entender. Agora a função devolve
 * {aceitos, descartados} e NADA some sem aparecer num dos dois lados.
 * O critério de aceitação NÃO mudou: .amr continua fora (de propósito — o
 * navegador não mede duração de container de vídeo e o envio trancaria).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterAudioFiles, isAudioFile } from "./collect.ts";

function arquivo(nome: string, type = ""): File {
  return new File(["x"], nome, { type });
}

test(".amr entra em descartados, não em aceitos", () => {
  const { aceitos, descartados } = filterAudioFiles([arquivo("gravacao.amr")]);
  assert.equal(aceitos.length, 0);
  assert.equal(descartados.length, 1);
  assert.equal(descartados[0].name, "gravacao.amr");
});

test(".mp3 entra em aceitos, não em descartados", () => {
  const { aceitos, descartados } = filterAudioFiles([arquivo("aula.mp3")]);
  assert.equal(aceitos.length, 1);
  assert.equal(aceitos[0].name, "aula.mp3");
  assert.equal(descartados.length, 0);
});

test("mistura: a contagem bate e nada some", () => {
  const entrada = [
    arquivo("a.mp3"),
    arquivo("b.amr"),
    arquivo("c.wav"),
    arquivo("d.mov"),
    arquivo("e.mkv"),
    arquivo("f.m4a"),
    arquivo("notas.txt"),
  ];
  const { aceitos, descartados } = filterAudioFiles(entrada);
  assert.equal(aceitos.length, 3); // a.mp3, c.wav, f.m4a
  assert.equal(descartados.length, 4); // b.amr, d.mov, e.mkv, notas.txt
  assert.equal(aceitos.length + descartados.length, entrada.length);
  assert.deepEqual(
    aceitos.map((f) => f.name),
    ["a.mp3", "c.wav", "f.m4a"],
  );
  assert.deepEqual(
    descartados.map((f) => f.name),
    ["b.amr", "d.mov", "e.mkv", "notas.txt"],
  );
});

test("MIME audio/* aceita mesmo com extensão estranha (critério inalterado)", () => {
  const { aceitos, descartados } = filterAudioFiles([
    arquivo("sem-extensao", "audio/mpeg"),
  ]);
  assert.equal(aceitos.length, 1);
  assert.equal(descartados.length, 0);
});

test("isAudioFile continua com o mesmo critério (mp4 sim, mkv não)", () => {
  assert.equal(isAudioFile(arquivo("aac-de-celular.mp4")), true);
  assert.equal(isAudioFile(arquivo("video.mkv")), false);
  assert.equal(isAudioFile(arquivo("video.mov")), false);
  assert.equal(isAudioFile(arquivo("gravacao.amr")), false);
});
