/**
 * `node --test src/lib/credits/refund-erro.test.ts`
 *
 * O que estes testes protegem (#446): a ESTREITEZA do reconhecimento de
 * "função ausente". O valor da ponte está inteiro em não generalizar o catch —
 * se `rpcFuncaoAusente` passar a devolver `true` pra erro transitório, o webhook
 * para de dar 500 em falha de rede/timeout, a Hotmart para de reenviar, e o
 * estorno é perdido EM SILÊNCIO. Trocaríamos um defeito barulhento (o de hoje)
 * por um mudo, que é muito pior.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOTIVO_RPC_AUSENTE,
  PREFIXO_RPC_AUSENTE,
  RPC_ESTORNO,
  motivoEhRpcAusente,
  rpcFuncaoAusente,
} from "./refund-erro.ts";

// ── RECONHECE A FUNÇÃO AUSENTE ────────────────────────────────────────────

test("PGRST202 é o código que produção devolve hoje (2 de 2 eventos desde 14/09)", () => {
  assert.equal(
    rpcFuncaoAusente({
      code: "PGRST202",
      message: `Could not find the function public.${RPC_ESTORNO}(p_event_type, p_ref_id, p_user_id) in the schema cache`,
    }),
    true,
  );
});

test("42883 (undefined_function do Postgres) também conta", () => {
  assert.equal(rpcFuncaoAusente({ code: "42883", message: "function does not exist" }), true);
});

test("sem code, a mensagem do PostgREST ainda identifica o caso", () => {
  assert.equal(
    rpcFuncaoAusente({ code: null, message: "Could not find the function in the schema cache" }),
    true,
  );
});

// ── NÃO ENGOLE O RESTO ────────────────────────────────────────────────────

test("timeout (57014) NÃO é função ausente — tem que continuar lançando", () => {
  assert.equal(
    rpcFuncaoAusente({ code: "57014", message: "canceling statement due to statement timeout" }),
    false,
  );
});

test("permissão negada (42501) NÃO é função ausente", () => {
  assert.equal(
    rpcFuncaoAusente({ code: "42501", message: "permission denied for function" }),
    false,
  );
});

test("deadlock (40P01) NÃO é função ausente", () => {
  assert.equal(rpcFuncaoAusente({ code: "40P01", message: "deadlock detected" }), false);
});

test("erro de rede sem code nenhum NÃO é função ausente", () => {
  assert.equal(rpcFuncaoAusente({ message: "fetch failed" }), false);
});

test("erro vazio/ausente não é função ausente (sem code nem mensagem, não se inventa)", () => {
  assert.equal(rpcFuncaoAusente(null), false);
  assert.equal(rpcFuncaoAusente(undefined), false);
  assert.equal(rpcFuncaoAusente({}), false);
  assert.equal(rpcFuncaoAusente({ code: "", message: "" }), false);
});

test("code parecido não cola: 'PGRST2020' e '4288' não são os códigos", () => {
  assert.equal(rpcFuncaoAusente({ code: "PGRST2020", message: "outra coisa" }), false);
  assert.equal(rpcFuncaoAusente({ code: "4288", message: "outra coisa" }), false);
});

// ── LEITURA DO MOTIVO NO WEBHOOK ──────────────────────────────────────────

test("o motivo carrega o nome da função: quem lê o payment_events.error sabe qual é", () => {
  assert.equal(MOTIVO_RPC_AUSENTE, `${PREFIXO_RPC_AUSENTE}${RPC_ESTORNO}`);
  assert.ok(MOTIVO_RPC_AUSENTE.includes(RPC_ESTORNO));
});

test("motivoEhRpcAusente separa a ponte dos outros ok:false já existentes", () => {
  assert.equal(motivoEhRpcAusente(MOTIVO_RPC_AUSENTE), true);
  // `no_profile` é resposta legítima da própria função: NÃO pode disparar o
  // aviso da ponte nem ganhar o texto de "zerar à mão".
  assert.equal(motivoEhRpcAusente("no_profile"), false);
  assert.equal(motivoEhRpcAusente(""), false);
  assert.equal(motivoEhRpcAusente(null), false);
});
