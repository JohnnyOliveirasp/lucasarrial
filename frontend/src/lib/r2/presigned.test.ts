/**
 * Testes do `isAllowedAudioMime()` — incidente #391 (14/09).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --import ./test/alias-loader.mjs --test src/lib/r2/presigned.test.ts
 *
 * ⚠️ O `--import ./test/alias-loader.mjs` é OBRIGATÓRIO aqui. `presigned.ts`
 * importa `./client` (relativo, SEM extensão) e o ESM do Node não resolve isso
 * sozinho — sem o loader o teste morre com `ERR_MODULE_NOT_FOUND` antes de
 * rodar um caso sequer. É o mesmo hook já usado por
 * `src/lib/agent/escalate-simulacao.test.ts`; nada de produção depende dele.
 *
 * O DEFEITO COBERTO: o seletor de arquivos da tela de voz aceita `.ogg`
 * (`ACCEPT` em components/voice/voice-creator.tsx), mas o `ALLOWED_AUDIO_MIME`
 * daqui só tinha `audio/ogg`. A string `application/ogg` não existia em NENHUM
 * lugar de `frontend/src`. Resultado: `POST /api/v1/voices` recusava com
 *   `Unsupported content_type: application/ogg`
 * e o aluno não conseguia treinar uma segunda voz com áudio de WhatsApp.
 *
 * POR QUE O MESMO ARQUIVO PASSA NUM NAVEGADOR E FALHA NOUTRO: o browser rotula
 * pela EXTENSÃO, não pelo conteúdo. No fonte do Firefox, o array
 * `defaultMimeEntries` ("These are NOT OVERRIDABLE") mapeia `{APPLICATION_OGG,
 * "ogg"}` — todo `.ogg` escolhido no Firefox chega como `application/ogg`,
 * enquanto `.oga`/`.opus` mapeiam pra `audio/ogg`. Não é o arquivo do aluno que
 * mudou entre agosto e setembro: é o navegador.
 *
 * NÃO é abrir a guarda: `application/ogg` e `video/ogg` são rótulos de
 * CONTAINER com áudio dentro — exatamente o mesmo caso do `video/mp4` já aceito
 * (caso Joana, 21/07), que o worker resolve extraindo a faixa via ffmpeg.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isAllowedAudioMime, isAllowedImageMime } from "./presigned.ts";

/** O que quebrou o aluno do #391. Sem o fix, estes dois são `false`. */
const CONTAINERS_OGG = ["application/ogg", "video/ogg"];

/**
 * Tudo que JÁ era aceito antes do #391. Existe pra provar que a correção só
 * ACRESCENTA — nenhum formato que funcionava pode parar de funcionar.
 */
const JA_ACEITOS_ANTES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "audio/aac",
  "audio/x-aac",
  "audio/aacp",
  "audio/opus",
];

/**
 * Precisam continuar recusados. `application/pdf` e `application/octet-stream`
 * são o teste de que aceitar `application/ogg` não virou "aceita qualquer
 * `application/*`" — o alargamento é de DOIS tipos nomeados, não de família.
 */
const DEVEM_SER_RECUSADOS = [
  "application/pdf",
  "application/octet-stream",
  "application/json",
  "application/zip",
  "image/png",
  "image/jpeg",
  "text/plain",
  "video/quicktime",
  "",
];

test("#391: application/ogg é aceito (áudio de WhatsApp pelo Firefox)", () => {
  assert.equal(isAllowedAudioMime("application/ogg"), true);
});

test("#391: video/ogg é aceito (mesmo .ogg, rótulo de container de vídeo)", () => {
  assert.equal(isAllowedAudioMime("video/ogg"), true);
});

test("#391: os dois rótulos de container Ogg passam", () => {
  for (const mime of CONTAINERS_OGG) {
    assert.equal(isAllowedAudioMime(mime), true, `${mime} deveria ser aceito`);
  }
});

test("regressão: tudo que era aceito antes continua aceito", () => {
  for (const mime of JA_ACEITOS_ANTES) {
    assert.equal(isAllowedAudioMime(mime), true, `${mime} parou de ser aceito`);
  }
});

test("tipos claramente inválidos continuam recusados", () => {
  for (const mime of DEVEM_SER_RECUSADOS) {
    assert.equal(isAllowedAudioMime(mime), false, `${mime} NÃO deveria passar`);
  }
});

test("aceitar application/ogg não abriu a família application/*", () => {
  assert.equal(isAllowedAudioMime("application/pdf"), false);
  assert.equal(isAllowedAudioMime("application/octet-stream"), false);
  assert.equal(isAllowedAudioMime("application/ogg"), true);
});

test("o casamento é case-insensitive (browser pode mandar maiúsculo)", () => {
  assert.equal(isAllowedAudioMime("APPLICATION/OGG"), true);
  assert.equal(isAllowedAudioMime("Application/Ogg"), true);
  assert.equal(isAllowedAudioMime("VIDEO/OGG"), true);
  assert.equal(isAllowedAudioMime("APPLICATION/PDF"), false);
});

test("a lista de imagem não foi afetada pelo fix de áudio", () => {
  assert.equal(isAllowedImageMime("image/png"), true);
  assert.equal(isAllowedImageMime("image/jpeg"), true);
  assert.equal(isAllowedImageMime("application/ogg"), false);
  assert.equal(isAllowedImageMime("video/ogg"), false);
});
