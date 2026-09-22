/**
 * `npx tsx --test src/lib/sgp/link-entrada-pure.test.ts`
 *
 * O que estes testes protegem: que o link de entrada na conta do aluno NUNCA
 * volte a ser o `action_link`. Medido em 20/09 (ver docblock do módulo): o
 * `action_link` devolve a sessão no fragmento (`#access_token=…`), o callback
 * não lê fragmento, e o token de uso único é queimado no caminho — o atendente
 * cai em `/login?error=missing_code_or_token` com o link já morto.
 *
 * A trava principal é `sem hashed_token → erro explícito, nunca action_link`.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESTINO_PADRAO,
  casaDoAluno,
  montarLinkDeEntrada,
  type PropriedadesDoLink,
} from "./link-entrada-pure.ts";

// O painel mora no apex; o link do ALUNO sai no `www.` (cookie é por host —
// no mesmo host a sessão do aluno tomava a da atendente, Karen 22/09).
const SITE = "https://fastcloner.com";
const CASA_DO_ALUNO = "https://www.fastcloner.com";

test("casaDoAluno: apex ganha www; www, localhost, staging e IP ficam como estão", () => {
  assert.equal(casaDoAluno("https://fastcloner.com"), CASA_DO_ALUNO);
  assert.equal(casaDoAluno("https://fastcloner.com///"), CASA_DO_ALUNO);
  assert.equal(casaDoAluno("https://www.fastcloner.com"), "https://www.fastcloner.com");
  assert.equal(casaDoAluno("http://localhost:3000"), "http://localhost:3000");
  assert.equal(casaDoAluno("https://aiverse.jcsolutionsus.com"), "https://aiverse.jcsolutionsus.com");
  assert.equal(casaDoAluno("http://91.99.15.213"), "http://91.99.15.213");
  assert.equal(casaDoAluno(""), "");
  assert.equal(casaDoAluno("nao-e-url"), "nao-e-url");
});

test("o link do aluno NUNCA sai no host do painel quando o site é o apex", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: "h4sh" }), SITE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(new URL(r.link).host, "www.fastcloner.com");
});
const ACTION_LINK =
  "https://fastcloner.supabase.co/auth/v1/verify?token=abc123&type=magiclink&redirect_to=x";

const props = (p: Partial<NonNullable<PropriedadesDoLink>>): PropriedadesDoLink => ({
  action_link: ACTION_LINK,
  ...p,
});

test("com hashed_token: monta token_hash + type=magiclink + next=/app", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: "h4sh" }), SITE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(
    r.link,
    "https://www.fastcloner.com/auth/callback?token_hash=h4sh&type=magiclink&next=%2Fapp",
  );
});

test("o link montado tem os três parâmetros na QUERY, nunca no fragmento", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: "h4sh" }), SITE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const u = new URL(r.link);
  assert.equal(u.hash, "", "não pode haver fragmento — o servidor não o recebe");
  assert.equal(u.searchParams.get("token_hash"), "h4sh");
  assert.equal(u.searchParams.get("type"), "magiclink");
  assert.equal(u.searchParams.get("next"), "/app");
  assert.equal(u.pathname, "/auth/callback");
});

test("SEM hashed_token: erro explícito, e o action_link NÃO vaza pro link", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: null }), SITE);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.erro, /hashed_token/);
  assert.doesNotMatch(r.erro, /auth\/v1\/verify/, "não devolver o action_link");
  assert.equal("link" in r, false);
});

test("hashed_token vazio ou só espaço conta como ausente", () => {
  for (const vazio of ["", "   "]) {
    const r = montarLinkDeEntrada(props({ hashed_token: vazio }), SITE);
    assert.equal(r.ok, false, `"${vazio}" deveria falhar`);
  }
});

test("properties ausente (null/undefined) falha alto, não estoura", () => {
  assert.equal(montarLinkDeEntrada(null, SITE).ok, false);
  assert.equal(montarLinkDeEntrada(undefined as unknown as PropriedadesDoLink, SITE).ok, false);
});

test("nunca devolve um link apontando pro /auth/v1/verify do Supabase", () => {
  for (const p of [
    props({ hashed_token: "h4sh" }),
    props({ hashed_token: null }),
    null,
  ]) {
    const r = montarLinkDeEntrada(p, SITE);
    if (r.ok) assert.doesNotMatch(r.link, /auth\/v1\/verify/);
  }
});

test("barra final no site não duplica a barra do caminho", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: "h4sh" }), "https://fastcloner.com///");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.link, /^https:\/\/www\.fastcloner\.com\/auth\/callback\?/);
});

test("site vazio falha alto em vez de montar link relativo quebrado", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: "h4sh" }), "");
  assert.equal(r.ok, false);
});

test("next externo é descartado (anti open-redirect); interno é respeitado", () => {
  const mau = montarLinkDeEntrada(
    props({ hashed_token: "h4sh" }),
    SITE,
    "https://evil.com/x",
  );
  assert.equal(mau.ok, true);
  if (!mau.ok) return;
  assert.equal(new URL(mau.link).searchParams.get("next"), DESTINO_PADRAO);

  const bom = montarLinkDeEntrada(props({ hashed_token: "h4sh" }), SITE, "/app/sgp");
  assert.equal(bom.ok, true);
  if (!bom.ok) return;
  assert.equal(new URL(bom.link).searchParams.get("next"), "/app/sgp");
});

test("hashed_token com caractere especial é percent-encoded", () => {
  const r = montarLinkDeEntrada(props({ hashed_token: "a+b/c=" }), SITE);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // O valor tem que sobreviver à viagem: o callback precisa ler o token igual.
  assert.equal(new URL(r.link).searchParams.get("token_hash"), "a+b/c=");
});
