/**
 * Testes do retry em 429 do createTask do Kie — incidente 11/09
 * (conta mcpaganatto@gmail.com: 40 débitos / 22 estornos no MESMO dia, 16
 * cenas mortas no MESMO minuto).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/kie/client.test.ts
 *
 * O DEFEITO COBERTO: o Kie sinaliza throttle com **HTTP 200** e `code: 429` no
 * CORPO ("Your call frequency is too high"). O código antigo fazia
 *
 *     if (!res.ok) { ...throw }          // 200 passa limpo
 *     const taskId = json.data?.taskId;  // undefined
 *     if (!taskId) throw new Error(...)  // morre na PRIMEIRA tentativa
 *
 * — ou seja, um engarrafamento momentâneo virava falha definitiva, a cena ia
 * pra `failed` e o débito era estornado. O aluno via a falha na hora,
 * reapertava, e alimentava o próprio rate-limit.
 *
 * ⚠️ POR QUE O TESTE ÓBVIO NÃO PEGA ISSO: um teste que simule o throttle com
 * `status: 429` passa NOS DOIS códigos (o antigo também tratava status ruim).
 * O caso que separa o código novo do velho é `status: 200` + `code: 429` no
 * corpo — é ele que está em "corpo 200 + code 429" e na prova de
 * não-tautologia lá embaixo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { postCreateTask, friendlyKieError, KieRateLimitError } from "./http.ts";

/**
 * O SUT é o `postCreateTask` de `./http.ts` — caminho ÚNICO por onde imagem e
 * vídeo criam task. Os wrappers `kieCreateVideoTask`/`kieCreateImageTask`
 * vivem em `./client.ts`, que importa `./config` sem extensão (o Next resolve,
 * o `node --test` não) e por isso não é carregável aqui. A cobertura não perde
 * nada: os dois wrappers são `return postCreateTask(...)` de uma linha, e o
 * que este arquivo testa é exatamente a política de retry que ambos herdam.
 */
const msgVideo = (code: unknown, msg: string) =>
  `Kie createTask (vídeo) sem taskId (code=${code}, msg=${msg})`;
const msgImagem = (code: unknown, msg: string) =>
  `Kie createTask sem taskId (code=${code}, msg=${msg})`;

const kieCreateVideoTask = (
  _input: unknown,
  opts: { hooks?: Parameters<typeof postCreateTask>[2] } = {},
) => postCreateTask({ model: "bytedance/seedance-v1-pro" }, msgVideo, opts.hooks);

const kieCreateImageTask = (
  _input: unknown,
  opts: { hooks?: Parameters<typeof postCreateTask>[2] } = {},
) => postCreateTask({ model: "gpt-image-2-image-to-image" }, msgImagem, opts.hooks);

process.env.KIE_API_KEY = "chave-de-teste";

const VIDEO_INPUT = {
  model: "bytedance/seedance-v1-pro",
  promptEn: "she smiles",
  imageUrl: "https://r2.example/cena.png",
  aspectRatio: "9:16",
  resolution: "720p",
  durationSeconds: 5,
};

const IMAGE_INPUT = {
  prompt: "retrato",
  input_urls: ["https://r2.example/foto.png"],
  aspect_ratio: "9:16",
  resolution: "1K",
};

/** Resposta de throttle do jeito REAL do Kie: HTTP 200, code 429 no corpo. */
function throttle200(msg = "Your call frequency is too high"): Response {
  return new Response(JSON.stringify({ code: 429, msg }), { status: 200 });
}

function ok(taskId: string): Response {
  return new Response(JSON.stringify({ code: 200, data: { taskId } }), { status: 200 });
}

/**
 * Troca o `fetch` global por uma fila de respostas e registra as esperas.
 * Devolve os ganchos determinísticos (jitter fixo no meio da faixa) + o diário.
 */
function montar(respostas: Response[]) {
  const diario = { chamadas: 0, esperas: [] as number[] };
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    const r = respostas[diario.chamadas];
    diario.chamadas++;
    if (!r) throw new Error(`fetch chamado ${diario.chamadas}x, fila só tem ${respostas.length}`);
    return r;
  }) as typeof fetch;
  const hooks = {
    sleep: async (ms: number) => {
      diario.esperas.push(ms);
    },
    random: () => 0.5, // jitter no centro: base * (0.75 + 0.5*0.5) = base * 1.0
  };
  return { diario, hooks, restaurar: () => void (globalThis.fetch = original) };
}

test("corpo 200 + code 429: retenta em vez de falhar na primeira (O BUG)", async () => {
  const { diario, hooks, restaurar } = montar([throttle200(), ok("task-abc")]);
  try {
    const r = await kieCreateVideoTask(VIDEO_INPUT, { hooks });
    assert.equal(r.taskId, "task-abc");
    assert.equal(diario.chamadas, 2, "devia ter retentado exatamente 1 vez");
    assert.deepEqual(diario.esperas, [2000], "primeira espera é a de 2s");
  } finally {
    restaurar();
  }
});

test("throttle persistente: 4 tentativas (1 + 3) e backoff 2s/5s/12s", async () => {
  const { diario, hooks, restaurar } = montar([
    throttle200(),
    throttle200(),
    throttle200(),
    throttle200(),
  ]);
  try {
    await assert.rejects(
      () => kieCreateVideoTask(VIDEO_INPUT, { hooks }),
      (e: unknown) => {
        assert.ok(e instanceof KieRateLimitError, "erro tipado permite o chamador distinguir throttle");
        assert.equal((e as KieRateLimitError).status, 429);
        assert.match((e as Error).message, /call frequency/i);
        return true;
      },
    );
    assert.equal(diario.chamadas, 4, "1 original + 3 retentativas");
    assert.deepEqual(diario.esperas, [2000, 5000, 12000]);
  } finally {
    restaurar();
  }
});

test("throttle por STATUS 429 (não só pelo corpo) também retenta", async () => {
  const { diario, hooks, restaurar } = montar([
    new Response("too many requests", { status: 429 }),
    ok("task-status"),
  ]);
  try {
    const r = await kieCreateVideoTask(VIDEO_INPUT, { hooks });
    assert.equal(r.taskId, "task-status");
    assert.equal(diario.chamadas, 2);
  } finally {
    restaurar();
  }
});

test("a IMAGEM tem a mesma proteção (o defeito era idêntico nos dois)", async () => {
  const { diario, hooks, restaurar } = montar([throttle200(), ok("img-1")]);
  try {
    const r = await kieCreateImageTask(IMAGE_INPUT, { hooks });
    assert.equal(r.taskId, "img-1");
    assert.equal(diario.chamadas, 2);
  } finally {
    restaurar();
  }
});

test("erro NÃO-429 continua falhando na hora, sem retentar e com a msg antiga", async () => {
  const { diario, hooks, restaurar } = montar([new Response("boom", { status: 500 })]);
  try {
    await assert.rejects(
      () => kieCreateVideoTask(VIDEO_INPUT, { hooks }),
      (e: unknown) => {
        assert.ok(!(e instanceof KieRateLimitError));
        assert.equal((e as Error).message, "Kie 500: boom");
        return true;
      },
    );
    assert.equal(diario.chamadas, 1, "500 não é throttle: insistir só atrasa o aluno");
    assert.deepEqual(diario.esperas, []);
  } finally {
    restaurar();
  }
});

test("sem taskId e sem 429 = falha determinística: 1 tentativa, mensagem preservada", async () => {
  const { diario, hooks, restaurar } = montar([
    new Response(JSON.stringify({ code: 422, msg: "aspect ratio unavailable" }), { status: 200 }),
  ]);
  try {
    await assert.rejects(
      () => kieCreateVideoTask(VIDEO_INPUT, { hooks }),
      (e: unknown) => {
        // Formato idêntico ao de antes do refactor (logs/alertas dependem dele).
        assert.equal(
          (e as Error).message,
          "Kie createTask (vídeo) sem taskId (code=422, msg=aspect ratio unavailable)",
        );
        return true;
      },
    );
    assert.equal(diario.chamadas, 1);
  } finally {
    restaurar();
  }
});

test("Retry-After MAIOR que o backoff manda; MENOR é ignorado", async () => {
  // 1ª: provedor pede 20s (> 2s do backoff) → vale 20s.
  // 2ª: provedor pede 1s (< 5s do backoff) → vale 5s; encurtar é o que nos pôs aqui.
  const { diario, hooks, restaurar } = montar([
    new Response("wait", { status: 429, headers: { "retry-after": "20" } }),
    new Response("wait", { status: 429, headers: { "retry-after": "1" } }),
    ok("task-ra"),
  ]);
  try {
    const r = await kieCreateVideoTask(VIDEO_INPUT, { hooks });
    assert.equal(r.taskId, "task-ra");
    assert.deepEqual(diario.esperas, [20000, 5000]);
  } finally {
    restaurar();
  }
});

test("Retry-After absurdo é capado em 30s (não seguramos a request pra sempre)", async () => {
  const { diario, hooks, restaurar } = montar([
    new Response("wait", { status: 429, headers: { "retry-after": "3600" } }),
    ok("task-cap"),
  ]);
  try {
    await kieCreateVideoTask(VIDEO_INPUT, { hooks });
    assert.deepEqual(diario.esperas, [30000]);
  } finally {
    restaurar();
  }
});

test("jitter fica na faixa ±25% da régua", async () => {
  for (const [sorte, esperado] of [
    [0, 1500], // 2000 * 0.75
    [1, 2500], // 2000 * 1.25
  ] as const) {
    const { diario, restaurar } = montar([throttle200(), ok("t")]);
    try {
      await kieCreateVideoTask(VIDEO_INPUT, {
        hooks: { sleep: async (ms) => void diario.esperas.push(ms), random: () => sorte },
      });
      assert.deepEqual(diario.esperas, [esperado]);
    } finally {
      restaurar();
    }
  }
});

test("friendlyKieError: throttle ganha uma mensagem própria, que desestimula o retap", () => {
  const msg = friendlyKieError("Kie 429: Your call frequency is too high");
  assert.match(msg, /congestionado/i);
  assert.match(msg, /aguarde/i);
  // A msg velha ("Tente novamente.") convidava o aluno a reapertar na hora —
  // foi assim que 16 cenas morreram no mesmo minuto.
  assert.notEqual(msg, "Não foi possível gerar o vídeo agora. Tente novamente.");
});

test("friendlyKieError: 429 escrito como 'quota' NÃO vira 'limite do provedor'", () => {
  // Regressão de ORDEM: "quota" casa na régua de saldo. Se o teste de throttle
  // não vier primeiro, uma fila cheia é reportada como provedor sem crédito e
  // manda o suporte investigar o lugar errado.
  const msg = friendlyKieError("Kie 429: quota exceeded, too many requests");
  assert.match(msg, /congestionado/i);
  assert.doesNotMatch(msg, /limite do provedor/i);
});

test("friendlyKieError: saldo de verdade CONTINUA caindo na régua de saldo", () => {
  const msg = friendlyKieError("Kie 402: insufficient balance");
  assert.match(msg, /limite do provedor/i);
});

/**
 * PROVA DE NÃO-TAUTOLOGIA: reimplementa o miolo do createTask ANTIGO (copiado
 * literal do origin/main) e mostra que ele ESTOURA no fixture do primeiro
 * teste. Sem isto, os testes acima poderiam estar só descrevendo o código novo.
 */
test("o código ANTIGO falha neste mesmo fixture (prova de que o teste morde)", async () => {
  const res = throttle200();
  // --- miolo antigo, verbatim ---
  let erro: Error | null = null;
  if (!res.ok) {
    erro = new Error(`Kie ${res.status}`);
  } else {
    const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
    const taskId = json.data?.taskId;
    if (!taskId) {
      erro = new Error(`Kie createTask (vídeo) sem taskId (code=${json.code}, msg=${json.msg ?? ""})`);
    }
  }
  // --- fim do miolo antigo ---
  assert.ok(erro, "o código antigo lançava erro na PRIMEIRA tentativa");
  assert.match(erro.message, /sem taskId \(code=429/);

  // E o novo, no mesmo fixture, entrega o vídeo.
  const { hooks, restaurar } = montar([throttle200(), ok("task-novo")]);
  try {
    assert.equal((await kieCreateVideoTask(VIDEO_INPUT, { hooks })).taskId, "task-novo");
  } finally {
    restaurar();
  }
});
