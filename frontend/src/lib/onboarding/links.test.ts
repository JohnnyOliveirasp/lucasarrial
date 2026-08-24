/**
 * Testes de regressão do caminho de link do onboarding (caso OneDrive, 22/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/links.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarLink, linkDiretoOneDrive } from "./links.ts";

test("1drv.ms e onedrive.live.com viram a API de shares (u! + base64url)", () => {
  for (const link of [
    "https://1drv.ms/u/s!AkX9zzz_exemplo",
    "https://onedrive.live.com/?id=ABC123%21105&cid=ABC123",
  ]) {
    const direto = linkDiretoOneDrive(link);
    assert.match(direto, /^https:\/\/api\.onedrive\.com\/v1\.0\/shares\/u!/);
    assert.ok(direto.endsWith("/root/content"));
    // O token tem que DECODIFICAR de volta pro link original (base64url).
    const token = direto.match(/shares\/u!([^/]+)\//)?.[1] ?? "";
    assert.equal(/[+/=]/.test(token), false, "token deve ser base64url sem padding");
    const decodificado = Buffer.from(
      token.replace(/_/g, "/").replace(/-/g, "+"),
      "base64",
    ).toString("utf8");
    assert.equal(decodificado, link);
  }
});

test("o formato VELHO (/redir, que o replace antigo cobria) também vai pela API de shares", () => {
  // A API de shares aceita QUALQUER link de compartilhamento — não precisa
  // mais do par de replaces frágeis.
  const direto = linkDiretoOneDrive("https://onedrive.live.com/redir?resid=AAA!105&authkey=xyz");
  assert.match(direto, /^https:\/\/api\.onedrive\.com\/v1\.0\/shares\/u!/);
});

test("sharepoint.com baixa direto com download=1", () => {
  const direto = linkDiretoOneDrive(
    "https://contoso-my.sharepoint.com/:u:/g/personal/aluno/Ea1b2c3?e=abc",
  );
  const u = new URL(direto);
  assert.equal(u.hostname.endsWith("sharepoint.com"), true);
  assert.equal(u.searchParams.get("download"), "1");
});

test("classificarLink continua reconhecendo os provedores", () => {
  assert.equal(classificarLink("https://1drv.ms/u/s!abc"), "onedrive");
  assert.equal(classificarLink("https://onedrive.live.com/?id=x"), "onedrive");
  assert.equal(classificarLink("https://x-my.sharepoint.com/:u:/g/p/a"), "onedrive");
  assert.equal(classificarLink("https://drive.google.com/drive/folders/x"), "drive");
  assert.equal(classificarLink("https://we.tl/t-abc"), "wetransfer");
  assert.equal(classificarLink("https://www.dropbox.com/s/x/a.mp3?dl=0"), "dropbox");
});
