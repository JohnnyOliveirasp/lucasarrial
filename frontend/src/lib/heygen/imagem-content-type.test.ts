/**
 * Testes de regressão do content-type mandado pro `/v1/asset` do HeyGen.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/heygen/imagem-content-type.test.ts
 *
 * O caso que motivou tudo (28/08): look importado da própria conta HeyGen, cujo
 * CDN serve WebP. O código carimbava "image/jpeg" em cima de bytes webp e o
 * HeyGen recusava com "Content type not match image/jpeg != image/webp".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentTypeImagemHeygen, erroImagemNaoSuportada } from "./imagem-content-type.ts";

// Cabeçalhos reais, do jeito que chegam do CDN / do R2.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]), // tamanho (ignorado pelo sniff)
  Buffer.from("WEBP", "latin1"),
  Buffer.alloc(32),
]);

// ── o content-type sai dos BYTES, nunca do rótulo ──────────────────────────

test("JPEG real → image/jpeg", () => {
  assert.equal(contentTypeImagemHeygen(new Uint8Array(JPEG)), "image/jpeg");
});

test("PNG real → image/png", () => {
  assert.equal(contentTypeImagemHeygen(new Uint8Array(PNG)), "image/png");
});

test("REGRESSÃO: WebP → image/webp, nunca image/jpeg", () => {
  // Era exatamente aqui que nascia "Content type not match image/jpeg != image/webp".
  assert.equal(contentTypeImagemHeygen(new Uint8Array(WEBP)), "image/webp");
});

test("REGRESSÃO: header mentindo não muda o veredito — quem decide são os bytes", () => {
  // O CDN do HeyGen mandava Content-Type: image/jpeg com corpo webp. A função
  // nem recebe o header de propósito: não há como o rótulo contaminar a decisão.
  assert.equal(contentTypeImagemHeygen(new Uint8Array(WEBP)), "image/webp");
  assert.notEqual(contentTypeImagemHeygen(new Uint8Array(WEBP)), "image/jpeg");
});

// ── o que NÃO vai pro HeyGen: erro claro, nunca chute ──────────────────────

test("GIF/BMP/TIFF são imagem, mas não vão rotulados como jpeg", () => {
  const gif = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(32)]);
  const bmp = Buffer.concat([Buffer.from("BM", "latin1"), Buffer.alloc(32)]);
  const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(32)]);
  for (const b of [gif, bmp, tiff]) {
    assert.equal(contentTypeImagemHeygen(new Uint8Array(b)), null);
  }
  assert.match(erroImagemNaoSuportada(new Uint8Array(gif)), /GIF/);
});

test("HEIC (foto de iPhone) é recusado com nome próprio, não como 'jpeg'", () => {
  const heic = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("ftypheic", "latin1"),
    Buffer.alloc(32),
  ]);
  assert.equal(contentTypeImagemHeygen(new Uint8Array(heic)), null);
  assert.match(erroImagemNaoSuportada(new Uint8Array(heic)), /HEIC/);
});

test("nem-imagem (PDF) → null, e a mensagem diz o que a pessoa mandou", () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7", "latin1"), Buffer.alloc(32)]);
  assert.equal(contentTypeImagemHeygen(new Uint8Array(pdf)), null);
  assert.match(erroImagemNaoSuportada(new Uint8Array(pdf)), /PDF/);
});

test("arquivo curto/vazio não quebra e não vira jpeg", () => {
  assert.equal(contentTypeImagemHeygen(new Uint8Array(0)), null);
  assert.equal(contentTypeImagemHeygen(new Uint8Array([0xff, 0xd8])), null);
  assert.equal(typeof erroImagemNaoSuportada(new Uint8Array(0)), "string");
});

// ── a cópia de 16 bytes não pode alterar a leitura ─────────────────────────

test("imagem grande é lida pelo cabeçalho, sem copiar o corpo", () => {
  const grande = new Uint8Array(Buffer.concat([WEBP, Buffer.alloc(5 * 1024 * 1024)]));
  assert.equal(contentTypeImagemHeygen(grande), "image/webp");
});

test("offset de subarray é respeitado (bytes não começam no índice 0 do buffer)", () => {
  // new Uint8Array(await res.arrayBuffer()) pode vir com byteOffset != 0.
  const cheio = Buffer.concat([Buffer.alloc(7, 0xaa), PNG]);
  const view = new Uint8Array(cheio.buffer, cheio.byteOffset + 7, PNG.length);
  assert.equal(contentTypeImagemHeygen(view), "image/png");
});
