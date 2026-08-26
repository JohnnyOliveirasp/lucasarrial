/**
 * Testes de regressão do caminho de link do onboarding (caso OneDrive, 22/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/links.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarLink, linkDiretoSharePoint, tokenShareOneDrive } from "./links.ts";

test("o link do OneDrive vira token u!<base64url> que decodifica de volta", () => {
  // 26/08 (incidente 144): a URL final mudou (api.onedrive.com → API v2.0 de
  // my.microsoftpersonalcontent.com, com token badger), mas o ENCODING do
  // share continua o da doc oficial: "u!" + base64url sem padding.
  for (const link of [
    "https://1drv.ms/u/s!AkX9zzz_exemplo",
    "https://onedrive.live.com/?id=ABC123%21105&cid=ABC123",
    "https://onedrive.live.com/redir?resid=AAA!105&authkey=xyz",
  ]) {
    const token = tokenShareOneDrive(link);
    assert.match(token, /^u!/);
    const corpo = token.slice(2);
    assert.equal(/[+/=]/.test(corpo), false, "token deve ser base64url sem padding");
    const decodificado = Buffer.from(
      corpo.replace(/_/g, "/").replace(/-/g, "+"),
      "base64",
    ).toString("utf8");
    assert.equal(decodificado, link);
  }
});

test("sharepoint.com baixa direto com download=1", () => {
  const direto = linkDiretoSharePoint(
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
