/**
 * Testes de onde sai o mp4 do viral (chamado #540 — o vídeo que o aluno sobe
 * no React nunca passava do passo 1).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/virais/fonte-do-mp4.test.ts
 *
 * O que está coberto — e por que importa:
 *   1. upload próprio (url vazia + r2_key) É utilizável: é o bug do #540;
 *   2. viral de link segue utilizável pela url — o caminho que já funcionava;
 *   3. privado de OUTRO aluno é recusado: ligar o upload sem isso abriria a
 *      transcrição do vídeo alheio a quem soubesse o id;
 *   4. removido pelo admin é recusado;
 *   5. upload sem arquivo no R2 não vale — a chave é a única prova que temos.
 *
 * O que ele NÃO cobre: as duas rotas que consomem isto (roteiro e gerar) — o
 * repo não tem runner de rota, então o uso da chave lá foi conferido por
 * leitura, não por teste.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ehUploadProprio, podeUsarViral, type FonteDoViral } from "./fonte-do-mp4.ts";

const EU = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

const upload = (over: Partial<FonteDoViral> = {}): FonteDoViral => ({
  id: "v-upload",
  plataforma: "upload",
  url: "",
  r2_key: `virais/comunidade/upload/${EU}/abc.mp4`,
  publico: false,
  enviado_por: EU,
  removido_em: null,
  ...over,
});

const doLink = (over: Partial<FonteDoViral> = {}): FonteDoViral => ({
  id: "v-link",
  plataforma: "tiktok",
  url: "https://www.tiktok.com/@alguem/video/123",
  r2_key: null,
  publico: true,
  enviado_por: null,
  removido_em: null,
  ...over,
});

test("upload próprio é utilizável mesmo com url vazia (#540)", () => {
  assert.equal(ehUploadProprio(upload()), true);
  assert.equal(podeUsarViral(upload(), EU), true);
});

test("viral de link segue utilizável pela url", () => {
  assert.equal(ehUploadProprio(doLink()), false);
  assert.equal(podeUsarViral(doLink(), EU), true);
});

test("upload sem arquivo no R2 não vale", () => {
  assert.equal(podeUsarViral(upload({ r2_key: null }), EU), false);
});

test("privado de outro aluno é recusado", () => {
  assert.equal(podeUsarViral(upload({ enviado_por: OUTRO }), EU), false);
});

test("removido pelo admin é recusado, público ou não", () => {
  assert.equal(podeUsarViral(doLink({ removido_em: "2026-09-23T00:00:00Z" }), EU), false);
});

test("viral inexistente é recusado", () => {
  assert.equal(podeUsarViral(null, EU), false);
});
