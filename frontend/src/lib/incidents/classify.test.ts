/**
 * Testes de regressão da assinatura de dedup de incidentes, com foco na
 * ARMADILHA do incidente #11 ("trainer failed").
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --import ./test/alias-loader.mjs --test src/lib/incidents/classify.test.ts
 *
 * ⚠️ O `--import ./test/alias-loader.mjs` virou OBRIGATÓRIO em 16/09.
 * `classify.ts` deixou de ser um módulo sem imports quando o diagnóstico do
 * trainer passou a ser entrada da classificação (`./diagnostico-trainer`), e o
 * ESM nativo do Node não resolve import relativo SEM extensão. O loader — que
 * já existia para os testes de simulação — ensina isso ao runner. Nada muda em
 * produção, onde quem resolve é o bundler do Next.
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
import {
  classifyCause,
  ehChunkDoDatasetInvalido,
  errorSignature,
  incidentTitle,
  isCorruptFile,
} from "./classify.ts";

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

/**
 * ── #475, 19/09: a mesma frase, dois donos ────────────────────────────────
 *
 * "Invalid data found when processing input" aparece em exatamente DOIS jobs
 * em toda a história de `training_jobs` (medido em 19/09) e significa coisas
 * opostas. O que decide não é o texto: é a PASTA do arquivo citado.
 *
 *   /raw/     → upload do aluno  → user_dataset, mensagem "reenvie", sem chamado
 *   /dataset/ → chunk que NÓS cortamos → bug nosso, chamado aberto, sem culpar
 *
 * O caso real: a josiclareth ficou 5h sem voz, sem chamado nenhum na fila, com
 * uma mensagem mandando regravar 23 minutos por um arquivo que ela não enviou.
 */
const ERRO_DATASET_NOSSO =
  "[Errno 1094995529] Invalid data found when processing input: " +
  "'/workspace/jobs/05a57533-8403-4015-9a11-47ad9153dbcc/dataset/voice_0032.wav'";

const ERRO_RAW_DO_ALUNO =
  "ffmpeg stereo 44k failed: /workspace/jobs/ca61b94d-ccb8-4db8-868a-53d2bd99025c/" +
  "raw/000_000_onboarding_1y99Dd_kRYy8KBSEf3Y4JWXi4sJCgr9WT.zip: " +
  "Invalid data found when processing input";

test("#475: chunk inválido em /dataset/ é bug NOSSO, não material do aluno", () => {
  assert.equal(classifyCause(ERRO_DATASET_NOSSO), "bug");
  assert.equal(isCorruptFile(ERRO_DATASET_NOSSO), false);
  assert.equal(ehChunkDoDatasetInvalido(ERRO_DATASET_NOSSO), true);
});

test("#475: a MESMA frase em /raw/ continua sendo do aluno (zero regressão)", () => {
  // Este é o teste que protege o caso de 14/08. Se ele quebrar, passamos a
  // abrir chamado e retreinar por nossa conta em cima de zip podre do aluno.
  assert.equal(classifyCause(ERRO_RAW_DO_ALUNO), "user_dataset");
  assert.equal(isCorruptFile(ERRO_RAW_DO_ALUNO), true);
  assert.equal(ehChunkDoDatasetInvalido(ERRO_RAW_DO_ALUNO), false);
});

test("#475: erro de mídia SEM caminho continua do aluno (não alarguei nada)", () => {
  // O caso Carla 29/07 e o caso Erica 31/07 não citam pasta nenhuma.
  assert.equal(classifyCause("moov atom not found"), "user_dataset");
  assert.equal(classifyCause("does not contain any stream"), "user_dataset");
  assert.equal(isCorruptFile("could not find codec parameters"), true);
});

test("#475: a assinatura é CONSTANTE — o incidente acumula em vez de rachar", () => {
  // O `[Errno 1094995529]` e o índice do chunk mudam entre ocorrências; se a
  // assinatura levasse o head, cada falha abriria cartão novo (patologia #11).
  const outroChunk =
    "[Errno 42] Invalid data found when processing input: " +
    "'/workspace/jobs/99999999-0000-0000-0000-000000000000/dataset/voice_0007.wav'";
  const a = errorSignature("training", ERRO_DATASET_NOSSO);
  const b = errorSignature("training", outroChunk);
  assert.equal(a, b, "duas ocorrências têm de somar no MESMO incidente");
  assert.match(a, /dataset-chunk-invalido/);
  // e não pode colidir com o guarda-chuva do #11 nem com o do aluno
  assert.notEqual(a, errorSignature("training", "trainer failed"));
  assert.notEqual(a, errorSignature("training", ERRO_RAW_DO_ALUNO));
});

test("#475: o título diz de QUEM é o arquivo", () => {
  const t = incidentTitle("training", ERRO_DATASET_NOSSO);
  assert.match(t, /NOSSO/);
  assert.match(incidentTitle("training", ERRO_RAW_DO_ALUNO), /arquivo enviado corrompido/);
});

test("#475 MUTAÇÃO: o código VELHO culpava a aluna", () => {
  // Réplica literal do predicado antes da correção: só texto, sem caminho.
  const velho = (error: string) => {
    const e = (error || "").toLowerCase();
    return (
      e.includes("moov atom") ||
      e.includes("invalid data found when processing input") ||
      e.includes("could not find codec parameters") ||
      e.includes("corrompido ou incompleto") ||
      e.includes("does not contain any stream")
    );
  };
  assert.equal(velho(ERRO_DATASET_NOSSO), true, "era este o defeito: arquivo nosso lido como dela");
  assert.equal(isCorruptFile(ERRO_DATASET_NOSSO), false, "e é este o conserto");
  // O velho acertava o caso do aluno, e o novo tem de continuar acertando.
  assert.equal(velho(ERRO_RAW_DO_ALUNO), true);
  assert.equal(isCorruptFile(ERRO_RAW_DO_ALUNO), true);
});
