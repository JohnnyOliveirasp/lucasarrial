/**
 * Testes de regressão da assinatura de dedup de incidentes, com foco na
 * ARMADILHA do incidente #11 ("trainer failed").
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/incidents/classify.test.ts
 *
 * CONTEXTO: em 27/08 passamos a persistir o stderr/stdout do trainer (scripts/97
 * + finalize-training.ts, registrarSaidaDoTrainer) porque o RunPod purga o job
 * e o traceback se perdia. A tentação óbvia — e errada — era concatenar o
 * traceback em `training_jobs.error_message`. Esse campo vira o `error` de
 * admin_failures() e alimenta errorSignature() aqui; para cause='bug' a
 * assinatura são os primeiros 120 chars do texto normalizado. Traceback varia a
 * cada ocorrência, então cada falha viraria um incidente NOVO e o #11 (aberto
 * desde 21/07, 3 ocorrências) se estilhaçaria — a mesma patologia do "detector
 * cego" já medida no d3d8d1b2.
 *
 * Estes testes travam o valor de HOJE. Se um deles quebrar, alguém mexeu no
 * texto que vai pro error_message ou nas regras de normalização: os incidentes
 * de treino vão fragmentar em produção.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCause, errorSignature, incidentTitle } from "./classify.ts";

/** Exatamente o que o worker manda em `error` e o finalize-training grava em
 * training_jobs.error_message (jobs/train.py:97). Não é um texto inventado. */
const ERROR_MESSAGE_GRAVADO = "trainer failed";

/** A assinatura vigente em 27/08/2026, antes da mig 97. Constante congelada de
 * propósito: é o valor que agrupa as 3 ocorrências do incidente #11. */
const ASSINATURA_HOJE = "training:bug:trainer failed";

test("'trainer failed' continua sendo causa 'bug'", () => {
  assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO), "bug");
});

test("a assinatura do #11 não mudou com a mig 97", () => {
  assert.equal(errorSignature("training", ERROR_MESSAGE_GRAVADO), ASSINATURA_HOJE);
});

test("'voice' e 'training' caem no MESMO incidente", () => {
  // A mesma falha vista de duas tabelas — se divergir, o #11 vira dois.
  assert.equal(errorSignature("voice", ERROR_MESSAGE_GRAVADO), ASSINATURA_HOJE);
});

test("o invólucro 'RunPod FAILED:' do polling não cria incidente novo", () => {
  // Webhook grava o erro cru; o polling embrulha. Quem escreve é uma corrida.
  assert.equal(
    errorSignature("training", `RunPod FAILED: ${ERROR_MESSAGE_GRAVADO}`),
    ASSINATURA_HOJE,
  );
});

test("ARMADILHA: concatenar o traceback no error_message estilhaçaria o #11", () => {
  // Este teste NÃO valida o comportamento atual — ele DEMONSTRA o motivo de o
  // stderr morar em coluna própria. Duas ocorrências do MESMO bug, com
  // tracebacks diferentes (é o que acontece de verdade: paths, pids, tensores),
  // produziriam DUAS assinaturas.
  const ocorrencia1 =
    `${ERROR_MESSAGE_GRAVADO}\nTraceback (most recent call last):\n` +
    `  File "/app/train_voxcpm_finetune.py", line 412, in main\n` +
    `RuntimeError: CUDA error: device-side assert triggered`;
  const ocorrencia2 =
    `${ERROR_MESSAGE_GRAVADO}\nTraceback (most recent call last):\n` +
    `  File "/app/voice_pipeline/training.py", line 88, in preparar\n` +
    `ValueError: expected 2D tensor, got shape torch.Size([1, 3, 7])`;

  const s1 = errorSignature("training", ocorrencia1);
  const s2 = errorSignature("training", ocorrencia2);
  assert.notEqual(s1, ASSINATURA_HOJE);
  assert.notEqual(s2, ASSINATURA_HOJE);
  assert.notEqual(s1, s2); // <- 2 incidentes onde deveria haver 1
});

test("o título do incidente #11 continua legível", () => {
  assert.equal(incidentTitle("training", ERROR_MESSAGE_GRAVADO), "Treino de voz: trainer failed");
});
