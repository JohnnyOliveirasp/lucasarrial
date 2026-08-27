/**
 * Tripwire de código do incidente #11 (persistir o stderr do trainer).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/finalize-training.test.ts
 *
 * POR QUE ler o fonte em vez de importar o módulo: finalize-training.ts fala com
 * Supabase, Resend e o alias "@/" — importá-lo num teste unitário exigiria
 * montar meio backend de mentira, e o que precisa ser travado aqui não é
 * comportamento em runtime, é uma DECISÃO ESTRUTURAL que um refactor bem
 * intencionado desfaz sem perceber:
 *
 *  1. O diagnóstico do trainer NÃO pode entrar no `error_message` do claim.
 *     Esse campo alimenta errorSignature() (ver incidents/classify.test.ts);
 *     texto variável = incidente novo a cada falha = o #11 estilhaçado.
 *  2. O UPDATE da telemetria NÃO pode entrar no claim idempotente. A DDL de
 *     scripts/97 ainda não foi aplicada; coluna inexistente dentro do claim
 *     derruba a finalização inteira e o ESTORNO do aluno nunca roda.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FONTE = readFileSync(join(import.meta.dirname, "finalize-training.ts"), "utf8");

/**
 * O bloco do gate idempotente: do começo do UPDATE até o filtro de status.
 * Ancorado em `const { data: claimed }`, NÃO em `.from("training_jobs")` — as
 * funções de telemetria (registrarCuraEBuild/registrarSaidaDoTrainer) escrevem
 * na mesma tabela e aparecem ANTES no arquivo, então o `.from` genérico casaria
 * com elas e o teste acusaria falso positivo.
 */
function blocoDoClaim(): string {
  const inicio = FONTE.indexOf("const { data: claimed } = await admin");
  const fim = FONTE.indexOf('.in("status"', inicio);
  assert.ok(inicio > 0 && fim > inicio, "não achei o claim idempotente no fonte");
  return FONTE.slice(inicio, fim);
}

test("o claim idempotente grava error_message CRU, sem traceback", () => {
  const claim = blocoDoClaim();
  assert.match(claim, /error_message:\s*adminError/);
  for (const proibido of ["trainer_stderr", "trainer_stdout", "stderr_tail", "stdout_tail"]) {
    assert.ok(
      !claim.includes(proibido),
      `"${proibido}" entrou no claim idempotente — isso muda o error_message ` +
        `e/ou derruba a finalização se a mig 97 não estiver aplicada`,
    );
  }
});

test("adminError sai só do rawError, truncado — nada de log do trainer", () => {
  assert.match(FONTE, /const adminError = success \? null : rawError\.slice\(0, 500\);/);
});

test("a telemetria do trainer roda DEPOIS do gate e é best-effort", () => {
  const posClaim = FONTE.indexOf("if (!claimed || claimed.length === 0)");
  const posChamada = FONTE.indexOf("await registrarSaidaDoTrainer(");
  assert.ok(posClaim > 0, "não achei o gate idempotente");
  assert.ok(posChamada > posClaim, "registrarSaidaDoTrainer foi chamado ANTES do gate");

  // O UPDATE da função tem que estar dentro de try/catch — falhar a telemetria
  // não pode derrubar voz/estorno/amostra.
  const inicioFn = FONTE.indexOf("async function registrarSaidaDoTrainer(");
  const corpo = FONTE.slice(inicioFn, FONTE.indexOf("export async function finalizeTraining"));
  assert.ok(inicioFn > 0, "não achei registrarSaidaDoTrainer");
  assert.match(corpo, /try\s*\{[\s\S]*\.from\("training_jobs"\)[\s\S]*\}\s*catch/);
  assert.match(corpo, /logger\.warn\(/);
});

test("os logs do trainer são truncados em 8000 chars, pelo FIM", () => {
  assert.match(FONTE, /const MAX_TRAINER_LOG_CHARS = 8000;/);
  // slice NEGATIVO: o traceback está no fim da saída.
  assert.match(FONTE, /stderr\.slice\(-MAX_TRAINER_LOG_CHARS\)/);
  assert.match(FONTE, /stdout\.slice\(-MAX_TRAINER_LOG_CHARS\)/);
});
