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
 *
 * MUDANÇA DE CRITÉRIO (01/09, incidente 95 — caso Luciano): `.mov` PASSOU a
 * ser aceito. É o formato nativo do iPhone e era descartado aqui, no
 * navegador, antes de chegar no worker — que sabe extrair a faixa de áudio.
 * `.mp4`, também container de vídeo, já era aceito desde o caso Joana.
 *
 * O comentário que estava aqui dizia que container de vídeo travaria o envio
 * porque o navegador não mede a duração. Isso deixou de ser verdade em 31/08:
 * pelo incidente #203 a medição que falha devolve um MOTIVO nomeado
 * (`erro-do-audio` → chave "formato") e a tela mostra o erro, em vez do limbo
 * "medindo…" que matava o botão sem explicar. Navegador que não abre QuickTime
 * mostra o motivo ao aluno; Chrome/Safari medem e treinam. Nos dois casos é
 * melhor do que o arquivo sumir sem aviso.
 *
 * `.amr` e `.mkv` continuam FORA de propósito — o alargamento é só do `.mov`.
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
  assert.equal(aceitos.length, 4); // a.mp3, c.wav, d.mov, f.m4a
  assert.equal(descartados.length, 3); // b.amr, e.mkv, notas.txt
  assert.equal(aceitos.length + descartados.length, entrada.length);
  assert.deepEqual(
    aceitos.map((f) => f.name),
    ["a.mp3", "c.wav", "d.mov", "f.m4a"],
  );
  assert.deepEqual(
    descartados.map((f) => f.name),
    ["b.amr", "e.mkv", "notas.txt"],
  );
});

test("MIME audio/* aceita mesmo com extensão estranha (critério inalterado)", () => {
  const { aceitos, descartados } = filterAudioFiles([
    arquivo("sem-extensao", "audio/mpeg"),
  ]);
  assert.equal(aceitos.length, 1);
  assert.equal(descartados.length, 0);
});

test("isAudioFile: mp4 e mov sim; mkv e amr não", () => {
  assert.equal(isAudioFile(arquivo("aac-de-celular.mp4")), true);
  assert.equal(isAudioFile(arquivo("video.mov")), true); // incidente 95
  assert.equal(isAudioFile(arquivo("video.mkv")), false);
  assert.equal(isAudioFile(arquivo("gravacao.amr")), false);
});

/**
 * Trava do alargamento: o conserto do incidente 95 é sobre `.mov` e só. Se
 * alguém trocar a regex por algo genérico (ex.: `video/*` ou "qualquer
 * container"), este teste quebra — que é o ponto. O worker aguenta muita
 * coisa, mas cada formato novo aqui é uma promessa na tela do aluno.
 */
test("o alargamento do 95 não vaza para outros containers de vídeo", () => {
  for (const nome of ["a.mkv", "b.avi", "c.wmv", "d.flv", "e.3gp", "f.mpg"]) {
    assert.equal(isAudioFile(arquivo(nome)), false, `${nome} não deveria entrar`);
  }
});

/** O MOV do iPhone chega com MIME video/quicktime — entra pela extensão. */
test("mov do iPhone (video/quicktime) é aceito", () => {
  assert.equal(isAudioFile(arquivo("IMG_4821.mov", "video/quicktime")), true);
  assert.equal(isAudioFile(arquivo("IMG_4821.MOV", "video/quicktime")), true);
});
