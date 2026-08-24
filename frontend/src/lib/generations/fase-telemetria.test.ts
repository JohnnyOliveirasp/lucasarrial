/**
 * Testes da telemetria de fase do worker (incidente d3d8d1b2, chamado #15).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/generations/fase-telemetria.test.ts
 *
 * O que está coberto:
 *   1. sem FASE_TELEMETRIA_SECRET a feature fica DESLIGADA em silêncio
 *      (token null, input {} — o job de hoje não muda em nada);
 *   2. com a env, o input ganha exatamente fase_url/fase_token/fase_ref e a
 *      URL aponta pra rota nova;
 *   3. o token só valida pro MESMO generationId (HMAC por-job): token de uma
 *      geração não autentica outra, token inventado não autentica nada;
 *   4. qaComFase faz merge sem perder as chaves já existentes do qa;
 *   5. preservaFaseCorrente: o rewrite de qa na FALHA (que num timeout vem
 *      vazio) não apaga a fase_corrente gravada pelo heartbeat — e quando não
 *      há fase gravada, devolve o qa novo INTACTO (comportamento de hoje).
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  faseTelemetriaToken,
  faseTelemetriaInput,
  faseTokenValido,
  qaComFase,
  preservaFaseCorrente,
  type FaseCorrente,
} from "./fase-telemetria.ts";

const ENV_BACKUP: Record<string, string | undefined> = {};
const ENVS = ["FASE_TELEMETRIA_SECRET", "NEXT_PUBLIC_SITE_URL", "SITE_URL"];

beforeEach(() => {
  for (const k of ENVS) {
    ENV_BACKUP[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENVS) {
    if (ENV_BACKUP[k] === undefined) delete process.env[k];
    else process.env[k] = ENV_BACKUP[k];
  }
});

const GEN_ID = "11111111-2222-3333-4444-555555555555";

test("sem secret: feature desligada em silêncio (token null, input vazio)", () => {
  assert.equal(faseTelemetriaToken(GEN_ID), null);
  assert.deepEqual(faseTelemetriaInput(GEN_ID), {});
  assert.equal(faseTokenValido(GEN_ID, "qualquer-coisa"), false);
});

test("secret curta demais (<16) também desliga — não dá falsa sensação de auth", () => {
  process.env.FASE_TELEMETRIA_SECRET = "curta";
  assert.equal(faseTelemetriaToken(GEN_ID), null);
  assert.deepEqual(faseTelemetriaInput(GEN_ID), {});
});

test("com secret + site url: input ganha exatamente as 3 chaves e a URL certa", () => {
  process.env.FASE_TELEMETRIA_SECRET = "um-segredo-com-tamanho-suficiente";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.exemplo.com/";
  const input = faseTelemetriaInput(GEN_ID);
  assert.deepEqual(Object.keys(input).sort(), ["fase_ref", "fase_token", "fase_url"]);
  assert.equal(input.fase_url, "https://app.exemplo.com/api/v1/webhooks/runpod-fase");
  assert.equal(input.fase_ref, GEN_ID);
  assert.equal(input.fase_token, faseTelemetriaToken(GEN_ID));
});

test("com secret mas SEM site url: input vazio (não manda token sem destino)", () => {
  process.env.FASE_TELEMETRIA_SECRET = "um-segredo-com-tamanho-suficiente";
  assert.deepEqual(faseTelemetriaInput(GEN_ID), {});
});

test("token valida pro mesmo id e reprova pra id trocado / token errado", () => {
  process.env.FASE_TELEMETRIA_SECRET = "um-segredo-com-tamanho-suficiente";
  const token = faseTelemetriaToken(GEN_ID);
  assert.ok(token && token.length === 64); // sha256 hex
  assert.equal(faseTokenValido(GEN_ID, token), true);
  // token de OUTRA geração não autentica esta
  const outro = faseTelemetriaToken("99999999-8888-7777-6666-555555555555");
  assert.equal(faseTokenValido(GEN_ID, outro), false);
  // lixo não autentica
  assert.equal(faseTokenValido(GEN_ID, "deadbeef"), false);
  assert.equal(faseTokenValido(GEN_ID, null), false);
  assert.equal(faseTokenValido(GEN_ID, 123), false);
});

const FASE: FaseCorrente = {
  fase: "inference.chunk.generate",
  running_s: 312.4,
  job_type: "inference",
  visto_em: "2026-08-24T15:49:00.000Z",
};

test("qaComFase preserva as chaves existentes do qa", () => {
  const qa = qaComFase({ coverage_best: 0.91, echo: false }, FASE);
  assert.equal(qa.coverage_best, 0.91);
  assert.equal(qa.echo, false);
  assert.deepEqual(qa.fase_corrente, FASE);
});

test("qaComFase com qa null cria o objeto do zero", () => {
  assert.deepEqual(qaComFase(null, FASE), { fase_corrente: FASE });
});

test("preservaFaseCorrente: falha por timeout (qa novo null) NÃO apaga a fase", () => {
  // cenário real do d3d8d1b2: SIGKILL → output vazio → qaTelemetria(out) = null
  const qaAtual = { fase_corrente: FASE };
  assert.deepEqual(preservaFaseCorrente(null, qaAtual), { fase_corrente: FASE });
});

test("preservaFaseCorrente: qa novo com dados + fase gravada = merge", () => {
  const novo = { coverage_failed_chunk: 7 };
  const merged = preservaFaseCorrente(novo, { fase_corrente: FASE, outra: 1 });
  assert.deepEqual(merged, { coverage_failed_chunk: 7, fase_corrente: FASE });
});

test("preservaFaseCorrente: sem fase gravada devolve o qa novo INTACTO (hoje)", () => {
  const novo = { coverage_best: 0.5 };
  assert.equal(preservaFaseCorrente(novo, null), novo);
  assert.equal(preservaFaseCorrente(novo, { sem_fase: true }), novo);
  assert.equal(preservaFaseCorrente(null, null), null);
  assert.equal(preservaFaseCorrente(null, "string-lixo"), null);
  assert.equal(preservaFaseCorrente(null, [1, 2]), null);
});
