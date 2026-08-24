/**
 * Testes do sweep de imagens presas (incidente 69f0aec5).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/images/sweep-stuck.test.ts
 *
 * O defeito coberto: image_generations só era reconciliada pelo poll da tela
 * e pelo webhook — sem os dois, a row ficava presa em pending/generating pra
 * sempre (achada uma de 28 dias). Testa-se a lógica pura (sweep-stuck-core)
 * com dependências fake; o wrapper real (sweep-stuck.ts) só liga os fios.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sweepStuckImagesWith,
  NO_TASK_FAIL_MS,
  type ImageSweepDeps,
  type StuckImageRow,
} from "./sweep-stuck-core.ts";

const T0 = Date.parse("2026-08-22T12:00:00Z");

function row(over: Partial<StuckImageRow>): StuckImageRow {
  return {
    id: "gen-1",
    user_id: "user-1",
    status: "pending",
    kie_task_id: "task-1",
    created_at: new Date(T0 - 20 * 60 * 1000).toISOString(), // presa há 20min
    ...over,
  };
}

function deps(over: Partial<ImageSweepDeps>): ImageSweepDeps {
  return {
    fetchStuck: async () => ({ data: [], error: null }),
    sync: async () => {},
    readStatus: async () => "pending",
    failOrphan: async () => {},
    now: () => T0,
    ...over,
  };
}

test("row com kie_task_id chama syncImageTask e conta o desfecho RELIDO do banco", async () => {
  const syncCalls: Array<[string, string, string]> = [];
  const statusDepois: Record<string, string> = {
    "gen-a": "ready",
    "gen-b": "failed",
    "gen-c": "generating", // retry no ar / fila do Kie
  };
  const summary = await sweepStuckImagesWith(
    deps({
      fetchStuck: async () => ({
        data: [
          row({ id: "gen-a", kie_task_id: "task-a" }),
          row({ id: "gen-b", kie_task_id: "task-b" }),
          row({ id: "gen-c", kie_task_id: "task-c" }),
        ],
        error: null,
      }),
      sync: async (id, userId, taskId) => {
        syncCalls.push([id, userId, taskId]);
      },
      readStatus: async (id) => statusDepois[id] ?? null,
    }),
  );
  assert.deepEqual(syncCalls, [
    ["gen-a", "user-1", "task-a"],
    ["gen-b", "user-1", "task-b"],
    ["gen-c", "user-1", "task-c"],
  ]);
  assert.deepEqual(summary, {
    checked: 3,
    ready: 1,
    failed: 1,
    still_running: 1,
    orphan_failed: 0,
    errors: 0,
  });
});

test("row sem kie_task_id e velha (>1h) vira failed órfão", async () => {
  const orphaned: Array<[string, string]> = [];
  const summary = await sweepStuckImagesWith(
    deps({
      fetchStuck: async () => ({
        data: [
          row({
            id: "gen-orfa",
            kie_task_id: null,
            created_at: new Date(T0 - NO_TASK_FAIL_MS - 1000).toISOString(),
          }),
        ],
        error: null,
      }),
      sync: async () => {
        assert.fail("sem task não há o que sincronizar");
      },
      failOrphan: async (id, message) => {
        orphaned.push([id, message]);
      },
    }),
  );
  assert.deepEqual(orphaned, [["gen-orfa", "registro sem task no Kie (órfão)"]]);
  assert.equal(summary.orphan_failed, 1);
  assert.equal(summary.checked, 1);
  assert.equal(summary.errors, 0);
});

test("row sem kie_task_id e nova (<1h) NÃO é tocada — ainda pode estar submetendo", async () => {
  const summary = await sweepStuckImagesWith(
    deps({
      fetchStuck: async () => ({
        data: [
          row({
            id: "gen-nova",
            kie_task_id: null,
            created_at: new Date(T0 - 30 * 60 * 1000).toISOString(), // 30min
          }),
        ],
        error: null,
      }),
      sync: async () => {
        assert.fail("não pode sincronizar row sem task");
      },
      failOrphan: async () => {
        assert.fail("não pode falhar row que ainda pode estar submetendo");
      },
    }),
  );
  assert.deepEqual(summary, {
    checked: 1,
    ready: 0,
    failed: 0,
    still_running: 0,
    orphan_failed: 0,
    errors: 0,
  });
});

test("erro na consulta NÃO vira '0 presas' — conta como erro e para", async () => {
  const summary = await sweepStuckImagesWith(
    deps({
      fetchStuck: async () => ({
        data: null,
        error: { message: "permission denied for table image_generations" },
      }),
      sync: async () => {
        assert.fail("com a consulta quebrada não há rows pra tocar");
      },
    }),
  );
  assert.equal(summary.errors, 1);
  assert.equal(summary.checked, 0);
});

test("uma row que lança NÃO derruba o sweep — as demais são processadas", async () => {
  const summary = await sweepStuckImagesWith(
    deps({
      fetchStuck: async () => ({
        data: [
          row({ id: "gen-ruim", kie_task_id: "task-ruim" }),
          row({ id: "gen-boa", kie_task_id: "task-boa" }),
        ],
        error: null,
      }),
      sync: async (id) => {
        if (id === "gen-ruim") throw new Error("Kie fora do ar");
      },
      readStatus: async () => "ready",
    }),
  );
  assert.deepEqual(summary, {
    checked: 2,
    ready: 1,
    failed: 0,
    still_running: 0,
    orphan_failed: 0,
    errors: 1,
  });
});
