/**
 * Testes do estorno do Vídeo React (card 22/09 — o React abriu aos alunos com
 * cobrança e SEM caminho de estorno).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/react/estorno.test.ts
 * ou:
 *   cd frontend && npx tsx --test src/lib/react/estorno.test.ts
 *
 * O que está coberto — e por que cada caso importa em dinheiro:
 *   1. job falha → estorna EXATAMENTE o valor debitado, com ref_type
 *      react_refund e ref_id do job (um React de 30s no Padrão = 3.450 cr);
 *   2. falha entregue DUAS vezes (webhook repetido / poll em corrida depois da
 *      transição) → estorna UMA vez só — a trava por contagem no par
 *      (ref_type, ref_id);
 *   3. job que terminou `pronto` → o claim NÃO reivindica e a row não é
 *      tocada — sucesso nunca estorna;
 *   4. HeyGen (só a taxa fixa de 300 no débito, porque o vídeo sai da conta
 *      do próprio aluno) → estorna 300, NÃO 300 + segundos: o valor vem do
 *      DÉBITO no extrato, nunca é recalculado da tabela de preço;
 *   5. quem não foi cobrado (equipe/admin, bypassesBilling) não tem débito →
 *      nada a devolver — estorno sem débito é dinheiro criado do nada.
 *
 * IMPORTANTE: o motor testado é `estornarDebitoIdempotente` — O MESMO código
 * que `handleTechFailure` (lib/support/failure-alert.ts) roda em produção,
 * extraído pra cá poder injetar banco e creditador fakes. Não é um espelho.
 * O creditador fake imita o contrato da RPC `add_extra_credits`: credita E
 * grava a linha do extrato — é essa linha que arma a idempotência da 2ª chamada.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA: que a rota só chama a contingência quando
 * `reivindicarFalhaDoReact` devolve `true`. Isso é o `if (reivindicou)` nos 4
 * caminhos de falha de `app/api/v1/react/gerar/route.ts` — verificado por
 * leitura, não por teste (testar o route handler exigiria subir meio Next).
 * E os itens 5-6 do card (ehEstorno('react_refund') + a MUTAÇÃO da lista)
 * moram em `_frank/ferramentas/_estornos.test.cjs`, junto da própria lista.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { estornarDebitoIdempotente, type Creditar } from "../support/estorno-idempotente.ts";
import {
  REACT_DEBIT_REF_TYPE,
  REACT_REFUND_REF_TYPE,
  reivindicarFalhaDoReact,
} from "./estorno.ts";

type LinhaExtrato = {
  user_id: string;
  ref_type: string;
  ref_id: string;
  amount: number;
  created_at: string;
};

type LinhaJob = { id: string; status: string; erro?: string | null };

/**
 * Fake do builder do PostgREST pro EXTRATO: aplica os filtros de verdade e
 * devolve `{ data, count }` como o Supabase — inclusive o detalhe de que o
 * `count: "exact"` conta TODAS as linhas que casam, mesmo com `.limit(1)`
 * (é dessa contagem que a idempotência depende).
 */
function consultaExtrato(linhas: LinhaExtrato[]) {
  const filtros: ((l: LinhaExtrato) => boolean)[] = [];
  let soConta = false;
  let maisRecentePrimeiro = false;
  let limite: number | null = null;
  const campo = (l: LinhaExtrato, c: string) => (l as unknown as Record<string, unknown>)[c];
  const b = {
    select(_cols: string, opts?: { count?: string; head?: boolean }) {
      soConta = opts?.head === true;
      return b;
    },
    eq(c: string, v: unknown) {
      filtros.push((l) => campo(l, c) === v);
      return b;
    },
    lt(c: string, v: number) {
      filtros.push((l) => (campo(l, c) as number) < v);
      return b;
    },
    order(_c: string, o?: { ascending?: boolean }) {
      maisRecentePrimeiro = o?.ascending === false;
      return b;
    },
    limit(n: number) {
      limite = n;
      return b;
    },
    then(resolve: (r: { data: unknown; count: number }) => void) {
      let sel = linhas.filter((l) => filtros.every((f) => f(l)));
      if (maisRecentePrimeiro) {
        sel = [...sel].sort((a, z) => (a.created_at < z.created_at ? 1 : -1));
      }
      const count = sel.length; // count "exact": ANTES do limit, como no PostgREST
      const data = soConta
        ? null
        : sel.slice(0, limite ?? undefined).map((l) => ({ amount: l.amount }));
      resolve({ data, count });
    },
  };
  return b;
}

/** Fake do UPDATE de react_jobs: patch só nas linhas que casam TODOS os filtros. */
function consultaJobs(jobs: LinhaJob[]) {
  let patch: Record<string, unknown> = {};
  const filtros: ((j: LinhaJob) => boolean)[] = [];
  const campo = (j: LinhaJob, c: string) => (j as unknown as Record<string, unknown>)[c];
  const b = {
    update(p: Record<string, unknown>) {
      patch = p;
      return b;
    },
    eq(c: string, v: unknown) {
      filtros.push((j) => campo(j, c) === v);
      return b;
    },
    in(c: string, vs: string[]) {
      filtros.push((j) => vs.includes(campo(j, c) as string));
      return b;
    },
    select(_cols: string) {
      void _cols;
      const alvo = jobs.filter((j) => filtros.every((f) => f(j)));
      for (const j of alvo) Object.assign(j, patch);
      return Promise.resolve({ data: alvo.map((j) => ({ id: j.id })) });
    },
  };
  return b;
}

function bancoFake(estado: { extrato: LinhaExtrato[]; jobs?: LinhaJob[] }) {
  return {
    from(tabela: string) {
      if (tabela === "credit_transactions") return consultaExtrato(estado.extrato);
      if (tabela === "react_jobs") return consultaJobs(estado.jobs ?? []);
      throw new Error(`tabela inesperada no teste: ${tabela}`);
    },
  } as unknown as SupabaseClient<Database>;
}

/**
 * Creditador fake com o CONTRATO da RPC add_extra_credits: credita e grava a
 * linha no extrato na mesma operação. É a linha gravada que faz a 2ª chamada
 * ver refundCount ≥ debitCount — sem ela a idempotência não teria onde se apoiar.
 */
function creditadorFake(estado: { extrato: LinhaExtrato[] }) {
  const chamadas: { userId: string; amount: number; refType?: string; refId?: string }[] = [];
  const creditar: Creditar = async (a) => {
    chamadas.push(a);
    estado.extrato.push({
      user_id: a.userId,
      ref_type: a.refType ?? "",
      ref_id: a.refId ?? "",
      amount: a.amount,
      created_at: "2026-09-22T13:00:00Z",
    });
    return { ok: true, balance: 0 };
  };
  return { chamadas, creditar };
}

const ALUNO = "aluno-1";
const JOB = "job-react-1";

/** Débito como a rota grava: ref_type react_job, ref_id = id do job, amount < 0. */
function debitoDoReact(valor: number, jobId = JOB): LinhaExtrato {
  return {
    user_id: ALUNO,
    ref_type: REACT_DEBIT_REF_TYPE,
    ref_id: jobId,
    amount: -valor,
    created_at: "2026-09-22T12:00:00Z",
  };
}

test("1. job falha → estorna exatamente o valor debitado, como react_refund no ref_id do job", async () => {
  // React de 30s no Padrão 2.0: 300 fixos + 30×105 = 3.450 cr. E um débito de
  // OUTRO job no extrato pra provar que o casamento é por ref_id, não por aluno.
  const estado = {
    extrato: [debitoDoReact(3450), debitoDoReact(9999, "job-de-outro-react")],
  };
  const { chamadas, creditar } = creditadorFake(estado);

  const nota = await estornarDebitoIdempotente(
    { db: bancoFake(estado), creditar },
    {
      userId: ALUNO,
      refId: JOB,
      debitRefType: REACT_DEBIT_REF_TYPE,
      refundRefType: REACT_REFUND_REF_TYPE,
    },
  );

  assert.equal(chamadas.length, 1, "exatamente UM crédito");
  assert.deepEqual(chamadas[0], {
    userId: ALUNO,
    amount: 3450,
    refType: REACT_REFUND_REF_TYPE,
    refId: JOB,
  });
  assert.match(nota, /estorno de 3\.450 créditos aplicado automaticamente/);
});

test("2. falha entregue DUAS vezes (webhook repetido) → estorna UMA vez só", async () => {
  const estado = { extrato: [debitoDoReact(3450)] };
  const { chamadas, creditar } = creditadorFake(estado);
  const args = {
    userId: ALUNO,
    refId: JOB,
    debitRefType: REACT_DEBIT_REF_TYPE,
    refundRefType: REACT_REFUND_REF_TYPE,
  };

  const primeira = await estornarDebitoIdempotente({ db: bancoFake(estado), creditar }, args);
  const segunda = await estornarDebitoIdempotente({ db: bancoFake(estado), creditar }, args);

  assert.match(primeira, /aplicado automaticamente/);
  assert.equal(segunda, "estorno já aplicado anteriormente");
  assert.equal(chamadas.length, 1, "a reentrega NÃO pode creditar de novo");
  // E o extrato fecha em zero: débito -3450 + estorno +3450 — o critério de
  // "quitado" que o _estornos.cjs define como prova (casar ref_id, somar o sinal).
  const doJob = estado.extrato.filter((l) => l.ref_id === JOB);
  assert.equal(doJob.reduce((s, l) => s + l.amount, 0), 0);
});

test("3. job que terminou pronto → o claim não reivindica e nada é tocado", async () => {
  // O contrato da rota é "só o vencedor do claim estorna" (if (reivindicou)).
  // Job `pronto` não está em voo → o UPDATE pega 0 linhas → false → a rota
  // nunca chega no handleTechFailure. Idem job já `erro` (falha reentregue).
  const jobs: LinhaJob[] = [
    { id: JOB, status: "pronto", erro: null },
    { id: "job-ja-erro", status: "erro", erro: "clone FAILED" },
  ];
  const estado = { extrato: [debitoDoReact(3450)], jobs };
  const db = bancoFake(estado);

  assert.equal(await reivindicarFalhaDoReact(db, JOB, "não deveria"), false);
  assert.equal(await reivindicarFalhaDoReact(db, "job-ja-erro", "não deveria"), false);
  assert.equal(jobs[0].status, "pronto", "sucesso não pode virar erro");
  assert.equal(jobs[0].erro, null);

  // E o controle positivo do claim — sem ele o conserto viraria "nunca estorna":
  jobs.push({ id: "job-em-voo", status: "clonando", erro: null });
  assert.equal(await reivindicarFalhaDoReact(db, "job-em-voo", "clone TIMED_OUT"), true);
  assert.equal(jobs[2].status, "erro");
  assert.equal(jobs[2].erro, "clone TIMED_OUT");
  // Segunda entrega da MESMA falha: a row já está em erro → claim perde.
  assert.equal(await reivindicarFalhaDoReact(db, "job-em-voo", "clone TIMED_OUT"), false);
});

test("4. HeyGen (débito de só 300, a taxa fixa) → estorna 300, não 300 + segundos", async () => {
  // No HeyGen o vídeo sai da conta BYOK do aluno: a rota debita SÓ a taxa fixa.
  // O estorno tem que copiar o DÉBITO do extrato — recalcular por custoDoReact
  // (que pra 30s no Padrão daria 3.450) devolveria crédito que nunca saiu.
  const estado = { extrato: [debitoDoReact(300)] };
  const { chamadas, creditar } = creditadorFake(estado);

  await estornarDebitoIdempotente(
    { db: bancoFake(estado), creditar },
    {
      userId: ALUNO,
      refId: JOB,
      debitRefType: REACT_DEBIT_REF_TYPE,
      refundRefType: REACT_REFUND_REF_TYPE,
    },
  );

  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].amount, 300, "o valor vem do extrato, não da tabela de preço");
});

test("5. sem débito no extrato (equipe/admin, bypassesBilling) → nada a devolver", async () => {
  const estado = { extrato: [] as LinhaExtrato[] };
  const { chamadas, creditar } = creditadorFake(estado);

  const nota = await estornarDebitoIdempotente(
    { db: bancoFake(estado), creditar },
    {
      userId: ALUNO,
      refId: JOB,
      debitRefType: REACT_DEBIT_REF_TYPE,
      refundRefType: REACT_REFUND_REF_TYPE,
    },
  );

  assert.equal(nota, "nada cobrado (sem débito no extrato)");
  assert.equal(chamadas.length, 0, "estorno sem débito é dinheiro criado do nada");
});
