/**
 * Testes de regressão do caminho de link do onboarding (OneDrive 22/08 e
 * incidente 144 de 26/08 — migração pro SharePoint Online).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/links.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarLink, linkDiretoSharePoint } from "./links.ts";
import { extrairIdsDaPagina, extrairIdsDaUrl, residNoPath } from "./onedrive.ts";

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

// ── incidente 144: extração de cid/resid da URL final da cadeia FedAuth ──

test("extrairIdsDaUrl pega cid e resid da URL final do onedrive.live.com", () => {
  // Formato real medido 26/08 (probe da Luzielia): resid vem %21-encodado.
  const { cid, resid } = extrairIdsDaUrl(
    "https://onedrive.live.com/?cid=10773FB2E0D0FFDA&resid=10773FB2E0D0FFDA%21s9231e1063df54d2789237bb2977d3969&migratedtospo=true",
  );
  assert.equal(cid, "10773FB2E0D0FFDA");
  // URLSearchParams decodifica o %21 de volta pro "!".
  assert.equal(resid, "10773FB2E0D0FFDA!s9231e1063df54d2789237bb2977d3969");
});

test("extrairIdsDaUrl aceita o resid vindo como id=", () => {
  const { cid, resid } = extrairIdsDaUrl(
    "https://onedrive.live.com/?id=ABCDEF0123456789%21s0e377b366fb941ae&cid=ABCDEF0123456789",
  );
  assert.equal(cid, "ABCDEF0123456789");
  assert.equal(resid, "ABCDEF0123456789!s0e377b366fb941ae");
});

test("extrairIdsDaPagina garimpa os ids do HTML quando a URL final não traz", () => {
  const html =
    '<script>var x={"cid":"D6D430138ED48071","id":"D6D430138ED48071!s0e377b366fb941ae"};' +
    'var y="?resid=D6D430138ED48071%21s0e377b366fb941ae&foo=1";</script>';
  const { cid, resid } = extrairIdsDaPagina(html);
  assert.equal(cid, "D6D430138ED48071");
  assert.equal(resid, "D6D430138ED48071!s0e377b366fb941ae");
});

test("residNoPath manda o ! como %21 (formato medido nos probes)", () => {
  assert.equal(residNoPath("AAA!s123"), "AAA%21s123");
  assert.equal(residNoPath("AAA%21s123"), "AAA%21s123"); // já encodado não dobra
});
