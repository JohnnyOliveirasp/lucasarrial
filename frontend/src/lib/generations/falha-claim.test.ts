/**
 * Testes do gate idempotente da FALHA (corrida com o reenvio automático).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/generations/falha-claim.test.ts
 *
 * O caso real que originou isto (12/09, geração b744e6da): o reenvio deixa a
 * row em `pending` com um job NOVO; a falha ATRASADA do job VELHO reivindicava
 * o gate (que só olhava status), marcava `failed` e ESTORNAVA por cima de um
 * job que ainda rodava — e que terminou bem (ready, 8,432s). O aluno viu
 * "falhou, créditos devolvidos", desistiu e refez na mão pagando outros 400.
 *
 * O que está coberto:
 *   1. CORRIDA: falha do job velho não reivindica nada e não toca a row;
 *   2. CONTROLE: falha do job ATUAL continua marcando failed (o teste que
 *      impede o conserto virar "nunca mais estorna");
 *   3. jobId nulo preserva o comportamento de hoje (gate só por status);
 *   4. idempotência velha intacta: row já `failed`/`ready` não é reivindicada;
 *   5. o gate realmente filtra por `runpod_job_id` (pega a mutação);
 *   6. o LOG de diagnóstico do #52: sai quando o gate barra a falha de um job
 *      VELHO por cima de reenvio VIVO, e NÃO sai nos outros motivos de claim
 *      vazio (senão vira ruído e o sinal deixa de servir como evidência).
 *
 * O QUE ESTE ARQUIVO NÃO PROVA: que os dois chamadores só estornam quando
 * `reivindicarFalha` devolve `true`. Isso é o `if (claimed)` em
 * webhooks/runpod/route.ts e generations/[id]/route.ts — verificado por leitura,
 * não por teste (testar o route handler exigiria subir meio Next).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { reivindicarFalha } from "./falha-claim.ts";

type Linha = {
  id: string;
  status: string;
  runpod_job_id: string | null;
  error_message: string | null;
};

const MSG_TRUNCADO =
  "O áudio saiu incompleto (mais curto que o texto). Refaça — os créditos foram devolvidos.";

function falhaUpdate(msg = "RunPod TIMED_OUT") {
  return { status: "failed", error_message: msg } as Record<string, unknown>;
}

/**
 * Fake do builder do PostgREST que simula um `UPDATE ... WHERE` de verdade:
 * aplica o patch SÓ nas linhas que casam com todos os filtros e devolve as
 * linhas afetadas — que é exatamente o sinal em que o gate se apoia.
 */
function bancoFake(linhas: Linha[], opcoes: { leituraExplode?: boolean } = {}) {
  const colunasFiltradas: string[] = [];
  // Contador separado do `colunasFiltradas` de propósito: as leituras de
  // diagnóstico não podem contaminar as asserções de filtro do UPDATE.
  const leituras: string[][] = [];
  const valorDe = (l: Linha, c: string) => (l as unknown as Record<string, unknown>)[c];

  const admin = {
    from(tabela: string) {
      assert.equal(tabela, "generations");
      return {
        // Caminho de LEITURA (só o diagnóstico do #52 usa).
        select(colunas: string) {
          const eqs: Array<[string, unknown]> = [];
          const builder = {
            eq(coluna: string, valor: unknown) {
              eqs.push([coluna, valor]);
              return builder;
            },
            maybeSingle() {
              leituras.push(colunas.split(",").map((c) => c.trim()));
              if (opcoes.leituraExplode) return Promise.reject(new Error("PostgREST caiu"));
              const achada = linhas.find((l) => eqs.every(([c, v]) => valorDe(l, c) === v));
              return Promise.resolve({ data: achada ?? null, error: null });
            },
          };
          return builder;
        },
        update(valores: Record<string, unknown>) {
          const eqs: Array<[string, unknown]> = [];
          const ins: Array<[string, readonly string[]]> = [];
          const builder = {
            eq(coluna: string, valor: unknown) {
              colunasFiltradas.push(coluna);
              eqs.push([coluna, valor]);
              return builder;
            },
            in(coluna: string, valores: readonly string[]) {
              colunasFiltradas.push(coluna);
              ins.push([coluna, valores]);
              return builder;
            },
            select() {
              const afetadas = linhas.filter(
                (l) =>
                  eqs.every(([c, v]) => valorDe(l, c) === v) &&
                  ins.every(([c, vs]) => vs.includes(String(valorDe(l, c)))),
              );
              for (const l of afetadas) Object.assign(l, valores);
              return Promise.resolve({ data: afetadas.map((l) => ({ id: l.id })), error: null });
            },
          };
          return builder;
        },
      };
    },
  };

  return { admin: admin as unknown as SupabaseClient<Database>, colunasFiltradas, leituras };
}

/**
 * Captura o `console.log` durante a chamada. Sem isto o teste do log seria
 * "leitura visual", que não pega regressão nenhuma.
 */
async function capturarLog<T>(fn: () => Promise<T>): Promise<{ valor: T; linhas: string[] }> {
  const original = console.log;
  const linhas: string[] = [];
  console.log = (...args: unknown[]) => {
    linhas.push(args.map(String).join(" "));
  };
  try {
    return { valor: await fn(), linhas };
  } finally {
    console.log = original;
  }
}

test("CORRIDA: falha do job VELHO não marca failed nem reivindica o estorno", async () => {
  // Estado pós-reenvio: mesma geração, status pending (de propósito), job NOVO.
  const row: Linha = {
    id: "b744e6da",
    status: "pending",
    runpod_job_id: "JOB_NOVO",
    error_message: null,
  };
  const { admin } = bancoFake([row]);

  const claimed = await reivindicarFalha(admin, "b744e6da", "JOB_VELHO", falhaUpdate());

  assert.equal(claimed, false, "job velho não pode vencer a transição");
  assert.equal(row.status, "pending", "a row tem que seguir andando pro aluno");
  assert.equal(row.error_message, null, "nem o texto de erro pode ser escrito");
});

test("CORRIDA: vale também pro caminho do áudio truncado", async () => {
  const row: Linha = {
    id: "g2",
    status: "pending",
    runpod_job_id: "JOB_NOVO",
    error_message: null,
  };
  const { admin } = bancoFake([row]);

  const claimed = await reivindicarFalha(admin, "g2", "JOB_VELHO", falhaUpdate(MSG_TRUNCADO));

  assert.equal(claimed, false);
  assert.equal(row.status, "pending");
});

test("CONTROLE: falha do job ATUAL continua marcando failed (o estorno não pode sumir)", async () => {
  const row: Linha = {
    id: "g3",
    status: "generating",
    runpod_job_id: "JOB_ATUAL",
    error_message: null,
  };
  const { admin } = bancoFake([row]);

  const claimed = await reivindicarFalha(admin, "g3", "JOB_ATUAL", falhaUpdate("RunPod FAILED"));

  assert.equal(claimed, true, "falha legítima TEM que reivindicar — senão o aluno fica sem estorno");
  assert.equal(row.status, "failed");
  assert.equal(row.error_message, "RunPod FAILED");
});

test("CONTROLE: status pending com job atual também reivindica", async () => {
  const row: Linha = { id: "g4", status: "pending", runpod_job_id: "JOB_A", error_message: null };
  const { admin } = bancoFake([row]);

  assert.equal(await reivindicarFalha(admin, "g4", "JOB_A", falhaUpdate()), true);
  assert.equal(row.status, "failed");
});

test("jobId nulo preserva o comportamento de hoje: reivindica só por status", async () => {
  // Mesmo com a row apontando pra um job qualquer — endurecer aqui deixaria
  // falha legítima sem estorno, que é pior que a corrida.
  const row: Linha = { id: "g5", status: "pending", runpod_job_id: "JOB_X", error_message: null };
  const { admin, colunasFiltradas } = bancoFake([row]);

  const claimed = await reivindicarFalha(admin, "g5", null, falhaUpdate());

  assert.equal(claimed, true);
  assert.equal(row.status, "failed");
  assert.ok(
    !colunasFiltradas.includes("runpod_job_id"),
    "sem jobId o gate não pode filtrar por job",
  );
});

test("jobId nulo com row sem job nenhum também reivindica", async () => {
  const row: Linha = { id: "g6", status: "pending", runpod_job_id: null, error_message: null };
  const { admin } = bancoFake([row]);

  assert.equal(await reivindicarFalha(admin, "g6", null, falhaUpdate()), true);
  assert.equal(row.status, "failed");
});

test("idempotência velha intacta: row já failed não é reivindicada de novo", async () => {
  const row: Linha = {
    id: "g7",
    status: "failed",
    runpod_job_id: "JOB_A",
    error_message: "primeiro erro",
  };
  const { admin } = bancoFake([row]);

  const claimed = await reivindicarFalha(admin, "g7", "JOB_A", falhaUpdate("segundo erro"));

  assert.equal(claimed, false, "segunda falha do mesmo job não pode estornar duas vezes");
  assert.equal(row.error_message, "primeiro erro");
});

test("idempotência velha intacta: row já ready não vira failed", async () => {
  const row: Linha = { id: "g8", status: "ready", runpod_job_id: "JOB_A", error_message: null };
  const { admin } = bancoFake([row]);

  assert.equal(await reivindicarFalha(admin, "g8", "JOB_A", falhaUpdate()), false);
  assert.equal(row.status, "ready");
});

test("outra geração no banco não é afetada (o gate por id continua valendo)", async () => {
  const alvo: Linha = { id: "g9", status: "pending", runpod_job_id: "JOB_A", error_message: null };
  const vizinha: Linha = {
    id: "g10",
    status: "pending",
    runpod_job_id: "JOB_A",
    error_message: null,
  };
  const { admin } = bancoFake([alvo, vizinha]);

  assert.equal(await reivindicarFalha(admin, "g9", "JOB_A", falhaUpdate()), true);
  assert.equal(alvo.status, "failed");
  assert.equal(vizinha.status, "pending");
});

test("o gate filtra por id, status E runpod_job_id quando há job", async () => {
  const row: Linha = { id: "g11", status: "pending", runpod_job_id: "JOB_A", error_message: null };
  const { admin, colunasFiltradas } = bancoFake([row]);

  await reivindicarFalha(admin, "g11", "JOB_A", falhaUpdate());

  assert.deepEqual(colunasFiltradas.sort(), ["id", "runpod_job_id", "status"]);
});

/* ------------------------------------------------------------------------- *
 * LOG DE DIAGNÓSTICO DO #52
 *
 * O acerto do gate é um NÃO-EVENTO: não escreve no banco e não muda a row. Sem
 * log não dá pra distinguir "o gate funcionou" de "a corrida não aconteceu" — e
 * em 12/09 o próprio aluno apagou as duas rows da corrida, então a row nem é
 * evidência confiável. Estes testes cobram o sinal E o silêncio.
 * ------------------------------------------------------------------------- */

test("ALVO: gate barrando job VELHO sobre reenvio VIVO loga uma linha com os dois jobs", async () => {
  const row: Linha = {
    id: "b744e6da",
    status: "pending",
    runpod_job_id: "JOB_NOVO",
    error_message: null,
  };
  const { admin } = bancoFake([row]);

  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "b744e6da", "JOB_VELHO", falhaUpdate()),
  );

  assert.equal(claimed, false, "a decisão do gate não pode mudar por causa do log");
  assert.equal(row.status, "pending", "diagnóstico não pode escrever na row");
  assert.equal(linhas.length, 1, `esperava 1 linha de log, veio ${linhas.length}`);
  assert.match(linhas[0], /^\[generations\/falha-claim\] #52 gate barrou falha de job velho /);
  assert.match(linhas[0], /b744e6da/);
  assert.match(linhas[0], /job_que_falhou=JOB_VELHO/);
  assert.match(linhas[0], /job_atual=JOB_NOVO/);
});

test("ALVO: vale também com a row em generating", async () => {
  const row: Linha = {
    id: "g12",
    status: "generating",
    runpod_job_id: "JOB_NOVO",
    error_message: null,
  };
  const { admin } = bancoFake([row]);

  const { linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "g12", "JOB_VELHO", falhaUpdate()),
  );

  assert.equal(linhas.length, 1);
  assert.match(linhas[0], /job_atual=JOB_NOVO/);
});

test("CONTROLE 1: row já failed barra e NÃO loga (idempotência velha não é ruído)", async () => {
  const row: Linha = {
    id: "g13",
    status: "failed",
    runpod_job_id: "JOB_A",
    error_message: "primeiro erro",
  };
  const { admin } = bancoFake([row]);

  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "g13", "JOB_B", falhaUpdate("segundo erro")),
  );

  assert.equal(claimed, false);
  assert.deepEqual(linhas, [], "row já failed acontece o tempo todo; logar aqui mata o sinal");
});

test("CONTROLE 2: row já ready barra e NÃO loga", async () => {
  const row: Linha = { id: "g14", status: "ready", runpod_job_id: "JOB_A", error_message: null };
  const { admin } = bancoFake([row]);

  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "g14", "JOB_VELHO", falhaUpdate()),
  );

  assert.equal(claimed, false);
  assert.deepEqual(linhas, []);
});

test("CONTROLE 3: falha do job ATUAL reivindica, não loga e NÃO faz leitura extra", async () => {
  const row: Linha = { id: "g15", status: "pending", runpod_job_id: "JOB_A", error_message: null };
  const { admin, leituras } = bancoFake([row]);

  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "g15", "JOB_A", falhaUpdate()),
  );

  assert.equal(claimed, true);
  assert.equal(row.status, "failed");
  assert.deepEqual(linhas, []);
  assert.deepEqual(leituras, [], "o caminho normal não pode ganhar uma leitura a mais");
});

test("CONTROLE 4: jobId nulo não loga e não lê nada (comportamento de hoje intacto)", async () => {
  const row: Linha = { id: "g16", status: "ready", runpod_job_id: "JOB_A", error_message: null };
  const { admin, leituras } = bancoFake([row]);

  // `ready` + jobId nulo = claim vazio, que é o gatilho do diagnóstico; sem job
  // não há o que comparar, então nem a leitura pode acontecer.
  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "g16", null, falhaUpdate()),
  );

  assert.equal(claimed, false);
  assert.deepEqual(linhas, []);
  assert.deepEqual(leituras, []);
});

test("a leitura de diagnóstico pede só status e runpod_job_id (nada do aluno)", async () => {
  const row: Linha = {
    id: "g17",
    status: "pending",
    runpod_job_id: "JOB_NOVO",
    error_message: null,
  };
  const { admin, leituras } = bancoFake([row]);

  await capturarLog(() => reivindicarFalha(admin, "g17", "JOB_VELHO", falhaUpdate()));

  assert.deepEqual(leituras, [["status", "runpod_job_id"]]);
});

test("row inexistente: barra e não loga (não há corrida pra provar)", async () => {
  const { admin } = bancoFake([]);

  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "sumida", "JOB_VELHO", falhaUpdate()),
  );

  assert.equal(claimed, false);
  assert.deepEqual(linhas, []);
});

test("diagnóstico é best-effort: leitura que explode não derruba o gate", async () => {
  const row: Linha = {
    id: "g18",
    status: "pending",
    runpod_job_id: "JOB_NOVO",
    error_message: null,
  };
  const { admin } = bancoFake([row], { leituraExplode: true });

  const { valor: claimed, linhas } = await capturarLog(() =>
    reivindicarFalha(admin, "g18", "JOB_VELHO", falhaUpdate()),
  );

  assert.equal(claimed, false, "instrumentação não pode virar exceção no caminho de falha");
  assert.deepEqual(linhas, []);
  assert.equal(row.status, "pending");
});
