/**
 * SIMULAÇÃO DO EXTRATO CEGO (#260) — a prova de que ESTORNO não chega ao
 * modelo com cara de COMPRA.
 *
 * O caso real: a Fast AFIRMOU a uma aluna um estorno que não existia. O bloco
 * de conta trazia só `kind` e `note`, e `add_extra_credits`
 * (scripts/13_credits.sql:131) grava TODO estorno com kind='extra_purchase' e
 * note='pacote avulso' FIXOS. No texto que o modelo lia, três estornos de
 * 19/08 eram indistinguíveis de três compras de pacote — palavra por palavra.
 *
 * O QUE ESTE ARQUIVO PROVA:
 *   (a) o select PEDE ref_type/ref_id (sem isso nenhum rótulo é possível);
 *   (b) estorno sai rotulado como ESTORNO e NÃO como compra;
 *   (c) a regra é o sufixo `_refund` — vale pros 12 ref_types de estorno que
 *       existem hoje, não só `generation_refund`;
 *   (d) compra avulsa de verdade continua sendo chamada de compra (o fix não
 *       pode transformar todo crédito em "estorno");
 *   (e) o extrato é recortado em 7 dias;
 *   (f) extrato VAZIO diz que é só a janela — senão o #260 só troca de lado e
 *       a Fast passa a afirmar "você nunca comprou".
 *
 * Como rodar (precisa do resolvedor de alias + mock de módulo):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/agent/account-extrato-simulacao.test.ts
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Tx = { kind: string; amount: number; note: string | null; ref_type: string | null; ref_id: string | null; created_at: string };

/** O que o código PEDIU ao banco — é aqui que o item (a) é medido. */
let selectDeTx = "";
/** Filtro de data aplicado no extrato (item (e)). */
let gteDeTx: string | null = null;
let transacoes: Tx[] = [];

const PERFIL = {
  id: "u1",
  email: "aluna@gmail.com",
  display_name: "Katia",
  plan: "pro",
  access_until: null,
  access_source: "hotmart",
  credits_subscription: 1000,
  credits_extra: 5280,
  pending_payment_at: null,
  created_at: "2026-08-01T10:00:00Z",
};

function admin() {
  const construir = (tabela: string) => {
    const api: Record<string, unknown> = {
      select(cols: string) {
        if (tabela === "credit_transactions") selectDeTx = cols;
        return api;
      },
      eq: () => api,
      ilike: () => (tabela === "payment_events" ? Promise.resolve({ data: [], error: null }) : api),
      gte(_col: string, valor: string) {
        if (tabela === "credit_transactions") gteDeTx = valor;
        return api;
      },
      order: () => api,
      limit: () => Promise.resolve({ data: tabela === "credit_transactions" ? transacoes : [], error: null }),
      maybeSingle: () => Promise.resolve({ data: tabela === "profiles" ? PERFIL : null, error: null }),
    };
    return api;
  };
  return { from: (t: string) => construir(t) };
}

let account: typeof import("./account.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => admin() } });
  mock.module("@/lib/agent/provider", { namedExports: { agentProvider: () => null, sendAgentText: async () => "" } });
  mock.module("@/lib/agent/waha", { namedExports: { wahaLidToPhone: async () => null } });
  account = await import("./account.ts");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};
const ontem = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

/** Os três estornos de 19/08 do caso real, como o banco os grava. */
const ESTORNOS: Tx[] = [1, 2, 3].map((n) => ({
  kind: "extra_purchase",
  amount: 1760,
  note: "pacote avulso",
  ref_type: "generation_refund",
  ref_id: `ger-${n}`,
  created_at: ontem(),
}));

test("(a) o select do extrato PEDE ref_type e ref_id", pular, async () => {
  transacoes = ESTORNOS;
  await account!.buildAccountContext("u1");
  assert.match(selectDeTx, /ref_type/, "sem ref_type no select não existe como distinguir estorno de compra");
  assert.match(selectDeTx, /ref_id/, "ref_id é o que liga o estorno ao trabalho que falhou");
});

test("(b) estorno NÃO chega ao modelo com cara de compra", pular, async () => {
  transacoes = ESTORNOS;
  const ctx = (await account!.buildAccountContext("u1")) ?? "";
  const linhas = ctx.split("\n").filter((l) => l.includes("1760"));
  assert.equal(linhas.length, 3, "as três movimentações têm que aparecer");
  for (const l of linhas) {
    assert.match(l, /ESTORNO/, `linha de estorno sem rótulo de estorno: ${l}`);
    assert.match(l, /NÃO é compra/, `linha de estorno precisa negar a compra explicitamente: ${l}`);
  }
});

test("(c) a regra é o sufixo _refund — vale pros 12 ref_types de estorno", pular, async () => {
  const TODOS = [
    "generation_refund",
    "video_clone_refund",
    "voice_train_refund",
    "image_refund",
    "image_video_refund",
    "studio_audio_refund",
    "studio_face_refund",
    "studio_montage_refund",
    "studio_scene_refund",
    "edicao_broll_refund",
    "edicao_captions_refund",
  ];
  for (const ref of TODOS) {
    assert.match(
      account!.rotuloTransacao({ kind: "extra_purchase", ref_type: ref, amount: 100 }),
      /ESTORNO/,
      `${ref} tem que ser lido como estorno`,
    );
  }
  // Ferramenta que ainda não existe: já nasce rotulada certo.
  assert.match(account!.rotuloTransacao({ kind: "extra_purchase", ref_type: "ferramenta_nova_refund", amount: 1 }), /ESTORNO/);
});

test("(d) compra avulsa DE VERDADE continua sendo chamada de compra", pular, async () => {
  assert.match(account!.rotuloTransacao({ kind: "extra_purchase", ref_type: "stripe_session", amount: 5000 }), /compra de pacote avulso/);
  assert.match(account!.rotuloTransacao({ kind: "subscription_grant", ref_type: "payment_event", amount: 3000 }), /créditos do plano/);
  assert.match(account!.rotuloTransacao({ kind: "generation", ref_type: "generation", amount: -120 }), /consumo/);
  assert.match(account!.rotuloTransacao({ kind: "extra_purchase", ref_type: "courtesy_grant", amount: 500 }), /cortesia/);
  // A cortesia também não pode ser apresentada COMO compra: ninguém pagou por
  // ela. (O rótulo contém a palavra "compra" na negação — o que não pode é ser
  // rotulada como "compra de pacote avulso".)
  assert.doesNotMatch(account!.rotuloTransacao({ kind: "extra_purchase", ref_type: "courtesy_grant", amount: 500 }), /compra de pacote/);
  assert.doesNotMatch(account!.rotuloTransacao({ kind: "extra_purchase", ref_type: "generation_refund", amount: 500 }), /compra de pacote/);
});

test("(e) o extrato é recortado em 7 dias", pular, async () => {
  transacoes = ESTORNOS;
  gteDeTx = null;
  await account!.buildAccountContext("u1");
  assert.ok(gteDeTx, "o extrato tem que ter janela — movimentação velha lida como recente foi parte do #260");
  const dias = (Date.now() - Date.parse(gteDeTx!)) / (24 * 60 * 60 * 1000);
  assert.ok(dias > 6.9 && dias < 7.1, `janela esperada de ~7 dias, veio ${dias.toFixed(2)}`);
});

test("(f) extrato VAZIO avisa que é só a janela — não vira 'você nunca comprou'", pular, async () => {
  transacoes = [];
  const ctx = (await account!.buildAccountContext("u1")) ?? "";
  assert.match(ctx, /Nenhuma movimentação de crédito nos últimos 7 dias/);
  assert.match(ctx, /NÃO afirme que a pessoa nunca comprou/, "o vazio precisa proibir a afirmação de ausência, senão o #260 só troca de lado");
});
