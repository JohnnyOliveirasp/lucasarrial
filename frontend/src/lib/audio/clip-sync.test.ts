/**
 * Testes do DESFECHO da listagem de gravações da conta (incidente #235, Alana).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/clip-sync.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE:
 * `listServerClips` já devolveu `ServerClip[]` puro — e nessa forma "a conta
 * não tem gravação" e "não consegui perguntar" viravam o MESMO `[]`. Quem lê
 * não tinha como distinguir, então um soluço de rede era lido como "não há
 * nada", o Gravador marcava a leitura como confiável e o bilhete de gravação
 * (localStorage) era APAGADO — destruindo a única prova que permite a tela
 * seguinte dizer "você gravou e eu não achei". Era o #235 renascendo por
 * outro gatilho.
 *
 * Essa forma fraca já voltou uma vez, num merge de reconciliação. Estes
 * testes existem para que ela não volte em silêncio de novo: o contrato
 * `{ ok, clips }` é o que separa vazio-de-verdade de falha.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { listServerClips } from "./clip-sync.ts";

const fetchOriginal = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

/** Troca o `fetch` global pelo comportamento que o teste quer medir. */
function comFetch(impl: () => Promise<unknown>) {
  globalThis.fetch = impl as unknown as typeof globalThis.fetch;
}

test("conta sem gravação: ok=true e lista vazia (vazio de VERDADE)", async () => {
  comFetch(async () => ({ ok: true, json: async () => ({ clips: [] }) }));
  const r = await listServerClips();
  assert.equal(r.ok, true, "leitura deu certo, então ok tem que ser true");
  assert.deepEqual(r.clips, []);
});

test("rede caiu: ok=false — vazio por FALHA nunca vale como vazio de verdade", async () => {
  comFetch(async () => {
    throw new TypeError("Failed to fetch");
  });
  const r = await listServerClips();
  assert.equal(r.ok, false, "fetch lançou: não dá pra afirmar que a conta está vazia");
  assert.deepEqual(r.clips, [], "sem dado, a lista é vazia — mas com ok=false junto");
});

test("servidor respondeu erro (500/401): ok=false, não some calado", async () => {
  comFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  const r = await listServerClips();
  assert.equal(r.ok, false);
  assert.deepEqual(r.clips, []);
});

test("resposta sem a chave `clips`: ok=true, mas lista vazia em vez de undefined", async () => {
  comFetch(async () => ({ ok: true, json: async () => ({}) }));
  const r = await listServerClips();
  assert.equal(r.ok, true);
  assert.deepEqual(r.clips, [], "nunca devolver undefined pra quem vai dar .map()");
});

test("nunca LANÇA: quem chama trata desfecho, não exceção", async () => {
  comFetch(async () => {
    throw new Error("qualquer coisa");
  });
  await assert.doesNotReject(() => listServerClips());
});

test("as gravações da conta chegam intactas quando dá tudo certo", async () => {
  const clip = {
    key: "voice-clips/u1/a.wav",
    name: "a.wav",
    seconds: 42,
    size: 1234,
    at: "2026-09-02T18:00:00.000Z",
    url: "https://r2.example/a.wav",
  };
  comFetch(async () => ({ ok: true, json: async () => ({ clips: [clip] }) }));
  const r = await listServerClips();
  assert.equal(r.ok, true);
  assert.equal(r.clips.length, 1);
  assert.deepEqual(r.clips[0], clip);
});
