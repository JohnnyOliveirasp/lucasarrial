/**
 * Testes do Trial Reel do Instagram (trial_params, provado na v23.0 em 22/09).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/social/trial-reel.test.ts
 *
 * Os testes 1–4 exercitam o createContainer REAL (instagram.ts) com um stub
 * de fetch que captura o corpo — nada sai pra rede, nenhum container é criado
 * na Meta. Os testes 5–6 exercitam o validador puro que a rota usa. O teste 7
 * é a MUTAÇÃO do item 4 do card: prova que, sem a guarda ehEstrategiaValida,
 * o valor inválido chegaria na Meta — (a) o montador serializa lixo sem
 * sanitizar, e (b) um tripwire na fonte acusa se alguém remover a guarda do
 * caminho real.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContainer, InstagramError } from "./instagram.ts";
import {
  DEFAULT_GRADUATION_STRATEGY,
  ERRO_ESTRATEGIA,
  ERRO_UMA_MIDIA,
  ERRO_VIDEO,
  ehEstrategiaValida,
  montarTrialParams,
  validarTrialReel,
} from "./trial-reel-pure.ts";

// ───────── stub de fetch (captura a chamada, nunca sai pra rede) ─────────

const fetchOriginal = globalThis.fetch;
type Captura = { url: string; body: URLSearchParams };
const chamadas: Captura[] = [];

function armarFetch(): void {
  chamadas.length = 0;
  globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
    chamadas.push({ url: String(url), body: init?.body as URLSearchParams });
    return { ok: true, json: async () => ({ id: "container-fake-1" }) };
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// 1. com trial → o corpo da chamada contém trial_params com o JSON certo
test("reel com trial manda trial_params com o JSON exato na mesma chamada /media", async () => {
  armarFetch();
  const id = await createContainer("tok", "ig-user-1", {
    kind: "reel",
    mediaUrl: "https://cdn.example.com/video.mp4",
    caption: "legenda",
    trial: { graduationStrategy: "SS_PERFORMANCE" },
  });
  assert.equal(id, "container-fake-1");
  assert.equal(chamadas.length, 1);
  // MESMO endpoint do container normal — nada de endpoint novo.
  assert.match(chamadas[0].url, /\/v23\.0\/ig-user-1\/media$/);
  const body = chamadas[0].body;
  assert.equal(body.get("media_type"), "REELS");
  assert.equal(body.get("trial_params"), '{"graduation_strategy":"SS_PERFORMANCE"}');
});

// 2. sem trial → NÃO contém trial_params (não vaza em reel normal)
test("reel normal (sem trial) não leva trial_params", async () => {
  armarFetch();
  await createContainer("tok", "ig-user-1", {
    kind: "reel",
    mediaUrl: "https://cdn.example.com/video.mp4",
  });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].body.get("trial_params"), null);
});

// 3. story → nunca leva trial_params, mesmo com o campo preenchido
test("story nunca leva trial_params, mesmo que o campo trial venha preenchido", async () => {
  armarFetch();
  await createContainer("tok", "ig-user-1", {
    kind: "story",
    mediaUrl: "https://cdn.example.com/video.mp4",
    trial: { graduationStrategy: "MANUAL" },
  });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].body.get("media_type"), "STORIES");
  assert.equal(chamadas[0].body.get("trial_params"), null);
});

// 4. estratégia inválida → recusa ANTES de chamar a Meta (fetch nunca roda)
test("estratégia inválida é 400 NOSSO, antes de qualquer chamada à Meta", async () => {
  armarFetch();
  await assert.rejects(
    createContainer("tok", "ig-user-1", {
      kind: "reel",
      mediaUrl: "https://cdn.example.com/video.mp4",
      trial: { graduationStrategy: "BANANA_VOADORA" },
    }),
    (e: unknown) => {
      assert.ok(e instanceof InstagramError);
      assert.equal(e.status, 400);
      assert.equal(e.message, ERRO_ESTRATEGIA);
      return true;
    },
  );
  assert.equal(chamadas.length, 0, "a Meta NÃO pode ser chamada com estratégia inválida");
  // E o validador da rota recusa igual (mesma regra, uma fonte só).
  const v = validarTrialReel({
    kind: "reel",
    mediaUrls: ["https://cdn.example.com/video.mp4"],
    graduationStrategy: "BANANA_VOADORA",
  });
  assert.deepEqual(v, { ok: false, erro: ERRO_ESTRATEGIA });
});

// 5. duas mídias com trial → recusa com a mensagem de "um único vídeo"
test("trial com duas mídias é recusado (um único vídeo)", () => {
  const v = validarTrialReel({
    kind: "reel",
    mediaUrls: ["https://cdn.example.com/a.mp4", "https://cdn.example.com/b.mp4"],
    graduationStrategy: "MANUAL",
  });
  assert.deepEqual(v, { ok: false, erro: ERRO_UMA_MIDIA });
});

// 6. mídia que não é vídeo com trial → recusa
test("trial com mídia que não é .mp4 é recusado; .mp4 (mesmo assinado) passa", () => {
  const v = validarTrialReel({
    kind: "reel",
    mediaUrls: ["https://cdn.example.com/foto.jpg"],
    graduationStrategy: "MANUAL",
  });
  assert.deepEqual(v, { ok: false, erro: ERRO_VIDEO });
  // r2://…/result.mp4 e URL assinada (?X-Amz-…) são os formatos reais da casa.
  for (const url of [
    "r2://bucket/video-clone/abc/result.mp4",
    "https://r2.example.com/result.mp4?X-Amz-Signature=abc",
  ]) {
    const ok = validarTrialReel({ kind: "reel", mediaUrls: [url], graduationStrategy: null });
    assert.deepEqual(ok, { ok: true, strategy: DEFAULT_GRADUATION_STRATEGY });
  }
  // story/image nunca viram trial, nem com vídeo válido.
  assert.equal(
    validarTrialReel({ kind: "story", mediaUrls: ["https://x.com/v.mp4"] }).ok,
    false,
  );
});

// 7. MUTAÇÃO: sem a guarda do item 4, o valor inválido chegaria na Meta
test("mutação: removida a guarda, o lixo chegaria na Meta — o montador não sanitiza", () => {
  // (a) o montador é montagem PURA: serializa qualquer valor sem validar.
  //     Ou seja, a ÚNICA coisa entre "BANANA_VOADORA" e a Meta é a guarda
  //     ehEstrategiaValida — exatamente o que o teste 4 prova que barra.
  assert.equal(
    montarTrialParams("BANANA_VOADORA"),
    '{"graduation_strategy":"BANANA_VOADORA"}',
  );
  assert.equal(ehEstrategiaValida("BANANA_VOADORA"), false);
  assert.equal(ehEstrategiaValida("MANUAL"), true);
  assert.equal(ehEstrategiaValida("SS_PERFORMANCE"), true);

  // (b) tripwire na fonte (mesmo recurso de erro-runpod-pure.test.ts): o
  //     createContainer REAL precisa validar com ehEstrategiaValida ANTES de
  //     montar o trial_params. Se alguém "simplificar" removendo a guarda,
  //     este assert acusa — e o (a) mostra o que aconteceria em seguida.
  const fonte = readFileSync(
    fileURLToPath(new URL("./instagram.ts", import.meta.url)),
    "utf8",
  );
  const guarda = fonte.indexOf("ehEstrategiaValida(input.trial.graduationStrategy)");
  const montagem = fonte.indexOf('params.set("trial_params"');
  assert.ok(guarda !== -1, "a guarda ehEstrategiaValida sumiu do createContainer");
  assert.ok(montagem !== -1, "a montagem do trial_params sumiu do createContainer");
  assert.ok(guarda < montagem, "a guarda precisa vir ANTES da montagem do trial_params");
});
