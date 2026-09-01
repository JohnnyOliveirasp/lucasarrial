/**
 * Testes do teto de execução + do gatilho do reenvio (#15).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/generations/execucao.test.ts
 *
 * O que está coberto:
 *   1. a régua do teto não mudou ao sair da rota pro módulo compartilhado —
 *      é a mesma que o reenvio usa, senão as duas saem do ar uma da outra;
 *   2. o reenvio dispara SÓ no estouro do teto, nas duas formas em que o erro
 *      chega (webhook cru e poll prefixado), e NUNCA em erro de worker.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ehTimeoutDeExecucao, inferenceExecutionTimeoutMs } from "./execucao.ts";

test("teto: piso de 8 min vale pra texto curto", () => {
  assert.equal(inferenceExecutionTimeoutMs(1), 8 * 60 * 1000);
  assert.equal(inferenceExecutionTimeoutMs(206), 8 * 60 * 1000); // caso 28/08
});

test("teto: 5 min + 30s por pedaço de 160 chars quando passa do piso", () => {
  // 2.567 chars = 17 pedaços → 5min + 8,5min = 13,5 min
  assert.equal(inferenceExecutionTimeoutMs(2567), (5 * 60 + 17 * 30) * 1000);
});

test("reenvio dispara nas duas formas do erro de teto", () => {
  assert.ok(ehTimeoutDeExecucao("executionTimeout exceeded"));
  assert.ok(ehTimeoutDeExecucao("RunPod FAILED: executionTimeout exceeded"));
  // com o sufixo de fase que errorMessageComFase acrescenta
  assert.ok(ehTimeoutDeExecucao("executionTimeout exceeded [fase: tts_chunk 3/7]"));
});

test("reenvio NÃO dispara em erro de worker — repetiria o mesmo defeito", () => {
  assert.equal(ehTimeoutDeExecucao("CUDA out of memory"), false);
  assert.equal(ehTimeoutDeExecucao("RunPod FAILED"), false);
  assert.equal(
    ehTimeoutDeExecucao("O áudio saiu incompleto (mais curto que o texto)."),
    false,
  );
});
