/**
 * SIMULAÇÃO DO ESTORNO (#446) — prova o comportamento da função REAL
 * `zeroSubscriptionCreditsOnRefund`, não só da decisão pura ao lado.
 *
 * As três coisas que precisam ser verdade ao mesmo tempo:
 *   (a) função ausente (PGRST202) → `ok:false` com `reason` `rpc_ausente:…`,
 *       SEM lançar — é isso que devolve `processed_at` ao evento;
 *   (b) erro transitório (timeout) → AINDA LANÇA — 500 pra Hotmart reenviar.
 *       Provar só o (a) seria perigoso: uma ponte que engole tudo perde estorno
 *       em silêncio, que é pior que o defeito que ela conserta;
 *   (c) resposta ok do RPC continua passando igual, sem regressão.
 *
 * Como rodar (precisa do resolvedor de alias + mock de módulo, porque
 * `refund.ts` importa `@/lib/db/admin`):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/credits/refund-simulacao.test.ts
 *
 * Sem essas flags o arquivo PULA cada teste com o motivo impresso, em vez de
 * derrubar a suíte — o resto dos testes da casa roda com `node --test` pelado.
 * O carregamento mora num `before()` de propósito: ver o comentário longo nele.
 */
import { before, test, mock, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { MOTIVO_RPC_AUSENTE, RPC_ESTORNO } from "./refund-erro.ts";

type RespostaRpc = { data: unknown; error: unknown };

/** O que o RPC mockado devolve na próxima chamada (trocado por cada teste). */
let resposta: RespostaRpc = { data: null, error: null };
/** Como o chamador de verdade invocou o RPC — nome e argumentos. */
const chamadas: Array<{ nome: string; args: unknown }> = [];

let refund: typeof import("./refund.ts") | null = null;
let motivoSkip = "";

/**
 * O mock + o import do módulo sob teste moram num `before()`, NÃO no escopo do
 * módulo. Motivo (#446): `await` no topo do arquivo é ilegal quando o runner
 * transpila pra CJS (`npx tsx --test` → esbuild → "Top-level await is currently
 * not supported with the cjs output format"), e essa falha é de COMPILAÇÃO —
 * acontece antes de qualquer linha rodar, então o `try/catch` abaixo nunca
 * dispararia e o arquivo inteiro morreria sem executar um único teste. Um
 * arquivo de prova que não roda é pior que nenhum, porque engana quem revisa.
 * Dentro de uma função async o `await import` é legal nos dois formatos, então
 * aqui o try/catch volta a ter poder: sem as flags, os testes PULAM com motivo.
 */
before(async () => {
  try {
    mock.module("@/lib/db/admin", {
      namedExports: {
        getAdmin: () => ({
          rpc: async (nome: string, args: unknown) => {
            chamadas.push({ nome, args });
            return resposta;
          },
        }),
      },
    });
    refund = await import("@/lib/credits/refund");
  } catch (e) {
    motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
  }
});

/**
 * Pula COM MOTIVO IMPRESSO quando o módulo não pôde ser carregado. Precisa ser
 * em tempo de execução (e não `{ skip: … }` no registro do teste) porque agora
 * o motivo só é conhecido depois do `before()`.
 */
function semModulo(t: TestContext): boolean {
  if (motivoSkip) {
    t.skip(motivoSkip);
    return true;
  }
  return false;
}

const ARGS = { userId: "user-1", refId: "HP123456", eventType: "PURCHASE_REFUNDED" };

// ── (a) FUNÇÃO AUSENTE: NÃO LANÇA ─────────────────────────────────────────

test("PGRST202 (função não existe) devolve ok:false e NÃO lança", async (t) => {
  if (semModulo(t)) return;
  chamadas.length = 0;
  resposta = {
    data: null,
    error: {
      code: "PGRST202",
      message: `Could not find the function public.${RPC_ESTORNO}(p_event_type, p_ref_id, p_user_id) in the schema cache`,
    },
  };

  const r = await refund!.zeroSubscriptionCreditsOnRefund(ARGS);

  assert.equal(r.ok, false);
  assert.equal((r as { ok: false; reason: string }).reason, MOTIVO_RPC_AUSENTE);
  // o motivo nomeia a função: é o que o humano lê no payment_events.error
  assert.ok((r as { ok: false; reason: string }).reason.includes(RPC_ESTORNO));
  // e o chamador continua chamando o RPC certo, com os mesmos argumentos
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].nome, RPC_ESTORNO);
  assert.deepEqual(chamadas[0].args, {
    p_user_id: ARGS.userId,
    p_ref_id: ARGS.refId,
    p_event_type: ARGS.eventType,
  });
});

test("42883 (undefined_function) também devolve ok:false sem lançar", async (t) => {
  if (semModulo(t)) return;
  resposta = { data: null, error: { code: "42883", message: "function does not exist" } };
  const r = await refund!.zeroSubscriptionCreditsOnRefund(ARGS);
  assert.equal(r.ok, false);
  assert.equal((r as { ok: false; reason: string }).reason, MOTIVO_RPC_AUSENTE);
});

// ── (b) ERRO TRANSITÓRIO: AINDA LANÇA ─────────────────────────────────────

test("timeout (57014) AINDA LANÇA — 500 pra Hotmart reenviar", async (t) => {
  if (semModulo(t)) return;
  resposta = {
    data: null,
    error: { code: "57014", message: "canceling statement due to statement timeout" },
  };
  await assert.rejects(
    () => refund!.zeroSubscriptionCreditsOnRefund(ARGS),
    /statement timeout/,
    "falha transitória virou ok:false — a ponte generalizou e o estorno se perde calado",
  );
});

test("permissão negada AINDA LANÇA (não é 'função ausente')", async (t) => {
  if (semModulo(t)) return;
  resposta = {
    data: null,
    error: { code: "42501", message: "permission denied for function" },
  };
  await assert.rejects(() => refund!.zeroSubscriptionCreditsOnRefund(ARGS), /permission denied/);
});

test("resposta inesperada do RPC (sem `ok`) continua lançando", async (t) => {
  if (semModulo(t)) return;
  resposta = { data: { qualquer: "coisa" }, error: null };
  await assert.rejects(
    () => refund!.zeroSubscriptionCreditsOnRefund(ARGS),
    /resposta inesperada/,
  );
});

// ── (c) CAMINHO FELIZ INTOCADO ────────────────────────────────────────────

test("resposta ok do RPC continua passando igual (sem regressão)", async (t) => {
  if (semModulo(t)) return;
  resposta = {
    data: { ok: true, already_processed: false, debited: 1000, balance: 0 },
    error: null,
  };
  const r = await refund!.zeroSubscriptionCreditsOnRefund(ARGS);
  assert.deepEqual(r, { ok: true, already_processed: false, debited: 1000, balance: 0 });
});

test("ok:false legítimo da própria função (no_profile) passa como antes", async (t) => {
  if (semModulo(t)) return;
  resposta = { data: { ok: false, reason: "no_profile" }, error: null };
  const r = await refund!.zeroSubscriptionCreditsOnRefund(ARGS);
  assert.deepEqual(r, { ok: false, reason: "no_profile" });
});
