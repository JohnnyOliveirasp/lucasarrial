/**
 * Testes de regressão do sniff de áudio (caso OneDrive, 22/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/audio-tipo.test.ts
 *
 * O caso que motivou tudo: a página de LOGIN da Microsoft (HTML de ~300KB)
 * subia pro R2 como .mp3 — o fallback "mp3" do pickExtension fazia qualquer
 * conteúdo sem nome nem content-type passar no filtro de áudio. Vozes reais:
 * 0e2f5726 (marlonwsmuniz) e 3d3c4da8 (lazevedo), as duas com "Header
 * missing" no ffprobe e 42 ocorrências de "microsoft" no corpo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffAudio, ehPaginaWeb } from "./audio-tipo.ts";

// ── sniffAudio: formatos que a régua aceita têm assinatura reconhecida ─────

test("mp3 com ID3 é áudio", () => {
  const b = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(32)]);
  assert.deepEqual(sniffAudio(b), { mime: "audio/mpeg", ext: "mp3" });
});

test("mp3 sem ID3 (frame sync 0xFFEx) é áudio — e AAC ADTS (0xFFF1) também", () => {
  const mp3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(32)]);
  assert.equal(sniffAudio(mp3)?.ext, "mp3");
  const adts = Buffer.concat([Buffer.from([0xff, 0xf1, 0x50, 0x80]), Buffer.alloc(32)]);
  assert.equal(adts.length >= 12 && sniffAudio(adts) !== null, true);
});

test("wav (RIFF+WAVE) é áudio; AVI (RIFF+AVI ) não é", () => {
  const wav = Buffer.concat([
    Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(16),
  ]);
  assert.equal(sniffAudio(wav)?.ext, "wav");
  const avi = Buffer.concat([
    Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("AVI "), Buffer.alloc(16),
  ]);
  assert.equal(sniffAudio(avi), null);
});

test("ogg, flac, webm/mkv, wma e amr são áudio", () => {
  assert.equal(sniffAudio(Buffer.concat([Buffer.from("OggS"), Buffer.alloc(16)]))?.ext, "ogg");
  assert.equal(sniffAudio(Buffer.concat([Buffer.from("fLaC"), Buffer.alloc(16)]))?.ext, "flac");
  assert.equal(
    sniffAudio(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]))?.ext,
    "webm",
  );
  assert.equal(
    sniffAudio(
      Buffer.concat([
        Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]),
        Buffer.alloc(16),
      ]),
    )?.ext,
    "wma",
  );
  assert.equal(sniffAudio(Buffer.concat([Buffer.from("#!AMR\n"), Buffer.alloc(16)]))?.ext, "amr");
});

test("m4a (ftyp M4A) é áudio; mp4/mov (ftyp isom/qt) é contêiner aceito", () => {
  const m4a = Buffer.concat([
    Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypM4A "), Buffer.alloc(16),
  ]);
  assert.equal(sniffAudio(m4a)?.ext, "m4a");
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(16),
  ]);
  assert.equal(sniffAudio(mp4)?.ext, "mp4");
});

// ── A regressão que importa: foto e página de login NÃO passam ─────────────

test("HEIC (ftyp heic) é FOTO, não áudio — regressão do filtro 910ea757", () => {
  // Antes do sniff, foto era barrada pelo rótulo. O sniff não pode reabrir
  // essa porta: ftyp com marca HEIF é imagem de iPhone.
  const heic = Buffer.concat([
    Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypheic"), Buffer.alloc(16),
  ]);
  assert.equal(sniffAudio(heic), null);
});

test("jpeg, png, pdf e zip não são áudio", () => {
  assert.equal(sniffAudio(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])), null);
  assert.equal(
    sniffAudio(
      Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]),
    ),
    null,
  );
  assert.equal(sniffAudio(Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(16)])), null);
  assert.equal(sniffAudio(Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(16)])), null);
});

test("a página de login da Microsoft é reconhecida como página web", () => {
  // O começo real de uma página dessas: doctype + html + head.
  const login = Buffer.from(
    "<!DOCTYPE html><html dir=\"ltr\" lang=\"pt-BR\"><head><title>Entrar na sua conta</title>" +
      "<script>var Microsoft = {};</script></head><body>OneDrive</body></html>",
  );
  assert.equal(ehPaginaWeb(login), true);
  assert.equal(sniffAudio(login), null);
});

test("página web com BOM e espaço na frente também é pega", () => {
  const comBom = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("\n  <html><head></head></html>"),
  ]);
  assert.equal(ehPaginaWeb(comBom), true);
  const soEspaco = Buffer.from("\r\n\t <!doctype html><html></html>");
  assert.equal(ehPaginaWeb(soEspaco), true);
});

test("áudio de verdade NUNCA é confundido com página web", () => {
  // Contra-teste: um mp3 cujo conteúdo por acaso contém "<html" no meio dos
  // bytes não pode ser recusado — só o COMEÇO do arquivo decide.
  const mp3 = Buffer.concat([
    Buffer.from("ID3"),
    Buffer.alloc(16),
    Buffer.from("<html>lixo de metadado</html>"),
  ]);
  assert.equal(ehPaginaWeb(mp3), false);
  assert.equal(sniffAudio(mp3)?.ext, "mp3");
  // E binário aleatório que começa com "<" mas não é HTML também não.
  const naoHtml = Buffer.from("<xml-que-nao-e-html com qualquer coisa>");
  assert.equal(ehPaginaWeb(naoHtml), false);
});

test("arquivo minúsculo/vazio não quebra nem vira áudio", () => {
  assert.equal(sniffAudio(Buffer.alloc(0)), null);
  assert.equal(sniffAudio(Buffer.from("oi")), null);
  assert.equal(ehPaginaWeb(Buffer.alloc(0)), false);
});
