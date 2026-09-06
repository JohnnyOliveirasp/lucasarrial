/**
 * `node --test src/lib/credits/access-window.test.ts`
 *
 * O que estes testes protegem: este é o GATE DE ACESSO DA PLATAFORMA INTEIRA.
 * Errar pro lado permissivo abre a casa; errar pro restritivo tranca pagante.
 *
 * O bug que motivou o arquivo: compra AVULSA gera entitlement vitalício
 * (access_until NULL). `recomputeProfileAccess` concluía "tem acesso" e gravava
 * NULL no profile — e o gate lia NULL como "sem acesso". A MESMA função decidia
 * "vitalício" e produzia "bloqueado". A desambiguação é o `access_source`, que
 * o schema (scripts/12_payments.sql:14) já documentava desde sempre.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWLIST_PADRAO,
  decidirAcesso,
  emailNaAllowlist,
  janelaDeAcessoAberta,
} from "./access-window.ts";

const AGORA = Date.parse("2026-09-06T12:00:00.000Z");
const FUTURO = "2026-12-31T00:00:00.000Z";
const PASSADO = "2026-08-01T00:00:00.000Z";

// ── a regra nova: NULL + origem = vitalício ──────────────────────────────────

test("VITALÍCIO: sem data mas com origem => TEM acesso (o bug que consertamos)", () => {
  assert.equal(janelaDeAcessoAberta(null, "hotmart", AGORA), true);
  assert.equal(janelaDeAcessoAberta(null, "mercadopago", AGORA), true);
  // é o caso real do drfabiovilhena29: pagou avulso, entitlement active,
  // profile com plan='pro' + source='hotmart' + until=NULL.
  assert.equal(decidirAcesso(false, null, "hotmart", AGORA), true);
});

test("SEM ACESSO: sem data e sem origem => NÃO tem (quem nunca pagou)", () => {
  assert.equal(janelaDeAcessoAberta(null, null, AGORA), false);
  assert.equal(janelaDeAcessoAberta(undefined, undefined, AGORA), false);
  assert.equal(decidirAcesso(false, null, null, AGORA), false);
});

// ── o que NÃO pode regredir: os 768 entitlements 'active' COM data ───────────

test("ASSINANTE VIGENTE: data no futuro => TEM acesso (com ou sem origem)", () => {
  assert.equal(janelaDeAcessoAberta(FUTURO, "hotmart", AGORA), true);
  assert.equal(janelaDeAcessoAberta(FUTURO, null, AGORA), true);
  assert.equal(decidirAcesso(false, FUTURO, "hotmart", AGORA), true);
});

test("ASSINANTE VENCIDO: data no passado => NÃO tem acesso, nem com origem", () => {
  assert.equal(janelaDeAcessoAberta(PASSADO, "hotmart", AGORA), false);
  assert.equal(janelaDeAcessoAberta(PASSADO, null, AGORA), false);
  assert.equal(decidirAcesso(false, PASSADO, "hotmart", AGORA), false);
});

test("a origem NÃO ressuscita quem venceu — a data preenchida manda sozinha", () => {
  // Esta é a armadilha permissiva: quem cancelou/venceu mantém access_source
  // preenchido no profile. Se a origem 'vazasse' por cima da data, todo
  // ex-assinante viraria vitalício. Varredura na régua inteira:
  for (const dias of [-400, -30, -1, 0]) {
    const quando = new Date(AGORA + dias * 86400000).toISOString();
    assert.equal(
      janelaDeAcessoAberta(quando, "hotmart", AGORA),
      false,
      `data ${quando} (${dias}d) não podia dar acesso`,
    );
  }
  for (const dias of [1, 30, 400]) {
    const quando = new Date(AGORA + dias * 86400000).toISOString();
    assert.equal(janelaDeAcessoAberta(quando, "hotmart", AGORA), true, `data ${quando} devia dar acesso`);
  }
});

test("a borda é estritamente maior: vencer AGORA não é ter acesso", () => {
  const agoraIso = new Date(AGORA).toISOString();
  assert.equal(janelaDeAcessoAberta(agoraIso, null, AGORA), false);
  assert.equal(janelaDeAcessoAberta(new Date(AGORA + 1).toISOString(), null, AGORA), true);
});

// ── retrocompatibilidade: o 3º argumento é OPCIONAL ─────────────────────────

test("RETROCOMPAT: chamada sem o 3º argumento se comporta como antes", () => {
  // regra antiga: `if (!accessUntil) return false; return data > agora;`
  const antiga = (until: string | null | undefined) =>
    !until ? false : new Date(until).getTime() > AGORA;
  for (const until of [null, undefined, FUTURO, PASSADO, "lixo"]) {
    assert.equal(
      janelaDeAcessoAberta(until, undefined, AGORA),
      antiga(until),
      `divergiu em ${JSON.stringify(until)}`,
    );
  }
});

test("data ilegível não inventa acesso (fecha, como antes)", () => {
  assert.equal(janelaDeAcessoAberta("lixo", null, AGORA), false);
  // e nem com origem: a data preenchida, ainda que podre, manda.
  assert.equal(janelaDeAcessoAberta("lixo", "hotmart", AGORA), false);
});

test("origem vazia/só espaço NÃO é origem (não vira vitalício por acidente)", () => {
  assert.equal(janelaDeAcessoAberta(null, "", AGORA), false);
  assert.equal(janelaDeAcessoAberta(null, "   ", AGORA), false);
});

// ── allowlist / admin ganham de tudo ────────────────────────────────────────

test("BYPASS (allowlist/admin) continua true em QUALQUER combinação", () => {
  const combos: Array<[string | null, string | null]> = [
    [null, null],
    [null, "hotmart"],
    [FUTURO, "hotmart"],
    [PASSADO, "hotmart"],
    [PASSADO, null],
    ["lixo", null],
  ];
  for (const [until, source] of combos) {
    assert.equal(
      decidirAcesso(true, until, source, AGORA),
      true,
      `bypass devia vencer em ${JSON.stringify([until, source])}`,
    );
  }
});

test("a allowlist de cortesia é a combinada e é case-insensitive", () => {
  assert.equal(emailNaAllowlist("johnny.oliveirasp@gmail.com", {}), true);
  assert.equal(emailNaAllowlist("LUCAS.M.ARRIAL@GMAIL.COM", {}), true);
  assert.equal(emailNaAllowlist("eduardo@lucasarrial.com", {}), true);
  assert.equal(emailNaAllowlist("aluno.qualquer@gmail.com", {}), false);
  assert.equal(emailNaAllowlist(null, {}), false);
  assert.equal(emailNaAllowlist("", {}), false);
  // a env sobrescreve a lista inteira
  assert.equal(emailNaAllowlist("johnny.oliveirasp@gmail.com", { COMP_ACCESS_EMAILS: "outro@x.com" }), false);
  assert.equal(emailNaAllowlist("outro@x.com", { COMP_ACCESS_EMAILS: " outro@x.com , b@x.com " }), true);
  assert.ok(ALLOWLIST_PADRAO.includes("eduardo@lucasarrial.com"));
});

// ── a tabela-verdade inteira, de uma vez ────────────────────────────────────

test("tabela-verdade completa do gate", () => {
  const casos: Array<[string | null, string | null, boolean, string]> = [
    [FUTURO, "hotmart", true, "assinante vigente"],
    [FUTURO, null, true, "vigente sem origem registrada"],
    [PASSADO, "hotmart", false, "assinatura vencida"],
    [PASSADO, null, false, "vencida sem origem"],
    [null, "hotmart", true, "VITALÍCIO (compra avulsa)"],
    [null, null, false, "nunca pagou / perdeu acesso"],
  ];
  for (const [until, source, esperado, nome] of casos) {
    assert.equal(decidirAcesso(false, until, source, AGORA), esperado, `caso: ${nome}`);
  }
});
