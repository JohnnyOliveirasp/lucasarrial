/**
 * Teste da guarda de TAMANHO antes do Whisper (caso valdirtrentotrg, 15/09).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo + alias "@/"):
 *   node --import ./test/alias-loader.mjs --test src/lib/video/transcribe.test.ts
 *
 * O defeito coberto: a rota baixava o objeto do R2 e empurrava os bytes pra
 * OpenAI ANTES de olhar o tamanho. Um MP4 de 60 minutos subia inteiro só pra
 * voltar 413. O aluno já recebia explicação (PR #200); o que se perdia era o
 * upload.
 *
 * O que precisa ficar travado aqui:
 *   1. acima do teto → recusa SEM chamar o Whisper (o upload não acontece);
 *   2. pequeno e curto → passa exatamente como hoje;
 *   3. pequeno mas acima de 90s → CONTINUA barrado pela regra de DURAÇÃO —
 *      tamanho não é duração, e uma guarda não substitui a outra;
 *   4. a frase que o aluno lê é a MESMA do 413 da Whisper, e o número dela sai
 *      da constante (nada de "25 MB" reescrito em lugar nenhum).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WHISPER_MAX_BYTES,
  acimaDoTetoDaTranscricao,
  falhaDeAudio,
  recusaPorDuracao,
  transcribeUploadedAudio,
} from "./transcribe.ts";

const MAX_SEGUNDOS = 90; // CLONE_MAX_AUDIO_SECONDS

/**
 * Dublê do R2 + Whisper: registra se cada um foi chamado. `baixadas` é o que
 * prova a economia — recusa antecipada não pode nem BAIXAR o objeto.
 */
function deps(bytesNoR2: number | null, transcricao = { text: "oi", durationSeconds: 10 }) {
  const chamadas: { filename: string; bytes: number }[] = [];
  const baixadas: string[] = [];
  return {
    chamadas,
    baixadas,
    head: async () => ({ bytes: bytesNoR2 }),
    baixar: async (key: string) => {
      baixadas.push(key);
      return new Uint8Array(8); // conteúdo não importa, só QUEM foi chamado
    },
    transcrever: async (b: Uint8Array, filename: string) => {
      chamadas.push({ filename, bytes: b.byteLength });
      return transcricao;
    },
  };
}

test("acima do teto: recusa ANTES de chamar o Whisper", async () => {
  // o caso real: MP4 de 60min. 300 MB é ~12x o teto.
  const d = deps(300 * 1024 * 1024);
  await assert.rejects(
    () => transcribeUploadedAudio("user/video-clone/uploads/gigante.mp4", d),
    /audio-grande-demais-pre-upload/,
  );
  assert.equal(d.chamadas.length, 0, "o Whisper NÃO pode ter sido chamado");
  assert.equal(d.baixadas.length, 0, "nem o download do R2 — é justamente o que se economiza");
});

test("o aluno lê a MESMA frase do 413, e o número vem da constante", async () => {
  const d = deps(WHISPER_MAX_BYTES + 1);
  const erro = await transcribeUploadedAudio("user/video-clone/uploads/g.mp4", d).catch((e) => e);

  const nossa = falhaDeAudio(erro, { rota: "teste" });
  const daWhisper = falhaDeAudio(new Error("Whisper API 413: Maximum content size"), {
    rota: "teste",
  });
  assert.equal(nossa, daWhisper, "recusar cedo não pode mudar o que o aluno lê");
  assert.match(nossa, /o limite é 25 MB/);
  assert.match(nossa, /Nenhum crédito foi cobrado/);
});

test("teto é estrito: cravado no limite PASSA, um byte acima não", () => {
  assert.equal(acimaDoTetoDaTranscricao(WHISPER_MAX_BYTES), false);
  assert.equal(acimaDoTetoDaTranscricao(WHISPER_MAX_BYTES + 1), true);
  assert.equal(acimaDoTetoDaTranscricao(0), false);
});

test("fail-open: tamanho desconhecido NÃO recusa (falso positivo é pior)", async () => {
  // HEAD transitório do R2 devolve bytes: null — segue o caminho de antes,
  // e quem estiver acima do teto leva o 413 da Whisper, como sempre levou.
  assert.equal(acimaDoTetoDaTranscricao(null), false);
  assert.equal(acimaDoTetoDaTranscricao(Number.NaN), false);
});

test("pequeno e curto: passa como hoje", async () => {
  const d = deps(2 * 1024 * 1024, { text: "roteiro do aluno", durationSeconds: 42 });
  const t = await transcribeUploadedAudio("user/video-clone/uploads/ok.mp3", d);

  assert.equal(t.text, "roteiro do aluno");
  assert.equal(t.durationSeconds, 42);
  assert.equal(d.chamadas.length, 1, "o Whisper PRECISA ter sido chamado");
  assert.equal(d.chamadas[0].filename, "ok.mp3");
  assert.equal(recusaPorDuracao(t.durationSeconds, MAX_SEGUNDOS), null);
});

test("TAMANHO NÃO É DURAÇÃO: cabe nos 25 MB e ainda assim é barrado pelos 90s", async () => {
  // MP3 de 20min em bitrate baixo: 8 MB no R2, 1200s de duração.
  const d = deps(8 * 1024 * 1024, { text: "vinte minutos", durationSeconds: 1200 });
  const t = await transcribeUploadedAudio("user/video-clone/uploads/longo.mp3", d);

  assert.equal(d.chamadas.length, 1, "a guarda de tamanho deixou passar, e tinha que deixar");
  assert.equal(
    recusaPorDuracao(t.durationSeconds, MAX_SEGUNDOS),
    "O áudio tem 1200s — o máximo é 90s (1min30s).",
  );
});

test("duração: o teto tolera a fração do Whisper, mas não um áudio longo", () => {
  assert.equal(recusaPorDuracao(90, MAX_SEGUNDOS), null, "90s cravado passa");
  assert.equal(recusaPorDuracao(90.4, MAX_SEGUNDOS), null, "fração do Whisper não recusa");
  assert.match(recusaPorDuracao(91, MAX_SEGUNDOS) ?? "", /^O áudio tem 91s/);
  assert.equal(
    recusaPorDuracao(0, MAX_SEGUNDOS),
    "Não conseguimos ler a duração desse áudio.",
    "duração ilegível tem frase própria, igual à de antes",
  );
});
