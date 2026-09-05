/**
 * Testes da lista branca de telemetria de saída (incidente d3d8d1b2, #15).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/generations/telemetria-saida.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE: o `setup_s` foi adicionado à entrega do worker
 * em `2bd3c3f` (PR #183) pra fechar a cegueira do #15, mas `qaTelemetria` é uma
 * lista branca e ninguém o nomeou nela. Resultado: o worker mandava, o webhook
 * chamava a função, e o campo era descartado ANTES do banco — em silêncio, sem
 * erro, sem log. A ronda seguinte leria `qa->>'setup_s' = null` e concluiria
 * que o worker não estava mandando. O defeito era invisível porque nada
 * afirmava o contrário; é isso que estes testes passam a afirmar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { qaTelemetria } from "./telemetria-saida.ts";

test("setup_s sobrevive até o qa (a regressão do #183)", () => {
  // Entrega real do worker: setup_s é IRMÃO de qa, não mora dentro dele.
  const out = {
    sample_rate: 24000,
    duration_s: 12.5,
    elapsed_s: 27.43,
    setup_s: 41.8,
    qa: { regens: 0, coverage_min: 0.9 },
  };
  const qa = qaTelemetria(out);
  assert.ok(qa, "qa não pode ser null quando o worker mandou telemetria");
  assert.equal(qa.setup_s, 41.8, "setup_s foi descartado pela lista branca");
});

test("setup_s = 0 é valor legítimo e não pode sumir", () => {
  // Guarda contra checagem por veracidade (`if (out.setup_s)`), que engoliria
  // o zero e faria "setup instantâneo" virar "worker não mandou".
  const qa = qaTelemetria({ setup_s: 0, qa: { regens: 1 } });
  assert.ok(qa);
  assert.equal(qa.setup_s, 0);
});

test("setup_s sozinho já basta pra existir qa (sem bloco qa do worker)", () => {
  // No caminho em que o worker não devolve `qa`, o setup_s ainda precisa
  // chegar ao banco — senão a medição da régua perde justamente as entregas
  // mais simples.
  const qa = qaTelemetria({ setup_s: 5.2 });
  assert.ok(qa, "não pode devolver null tendo setup_s");
  assert.equal(qa.setup_s, 5.2);
});

test("setup_s ausente não inventa a chave", () => {
  const qa = qaTelemetria({ qa: { regens: 2 } });
  assert.ok(qa);
  assert.equal("setup_s" in qa, false);
  assert.equal(qa.regens, 2);
});

test("campo não-numérico é ignorado (worker antigo / payload sujo)", () => {
  // Durante a janela de rollout convivem worker novo e antigo; lixo no campo
  // não pode virar número no banco.
  const qa = qaTelemetria({ setup_s: "41.8" as unknown as number, qa: { regens: 0 } });
  assert.ok(qa);
  assert.equal("setup_s" in qa, false);
});

test("o que já funcionava continua funcionando (coverage_* da falha)", () => {
  const qa = qaTelemetria({
    coverage_failed_chunk: 3,
    coverage_best: 0.71,
    coverage_min: 0.9,
    elapsed_s: 484.78,
  });
  assert.ok(qa);
  assert.equal(qa.coverage_failed_chunk, 3);
  assert.equal(qa.coverage_best, 0.71);
  assert.equal(qa.coverage_min, 0.9);
});

test("o bloco qa do worker é preservado e os irmãos entram por cima", () => {
  const qa = qaTelemetria({
    qa: { regens: 4, echo_checked: 12, coverage_min: 0.5 },
    coverage_min: 0.9,
    setup_s: 8.1,
  });
  assert.ok(qa);
  assert.equal(qa.regens, 4, "chave do worker não pode ser perdida");
  assert.equal(qa.echo_checked, 12);
  assert.equal(qa.coverage_min, 0.9, "o irmão explícito prevalece sobre o do bloco");
  assert.equal(qa.setup_s, 8.1);
});

test("output vazio continua devolvendo null (timeout com SIGKILL)", () => {
  // Cenário do d3d8d1b2: job morto, output vazio. Tem que seguir null pra
  // `preservaFaseCorrente` conseguir manter a fase_corrente do heartbeat.
  assert.equal(qaTelemetria({}), null);
});
