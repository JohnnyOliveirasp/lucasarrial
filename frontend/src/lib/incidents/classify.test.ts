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
  stripFaseSuffix,
  stripRunpodWrapper,
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

/**
 * ── #510, 21/09: a MESMA falha de download virou DOIS incidentes ──────────
 *
 * O worker não conseguiu baixar um take do NOSSO R2 (voz 8d7e7c37, 12:54Z). A
 * URL presignada passa de 500 chars e o erro é truncado em 500 em dois
 * produtores diferentes (finalize-training.ts e ingest.ts) — o corte cai
 * DENTRO da URL, então cada produtor viu um tamanho diferente do mesmo erro:
 *
 *   #507  training:infra_storage:failed to download <url> httpsconnectionpool(
 *         host='voices-clone-ai-verse.<hex>.r#.cloudflarestorage.com', port=#): read
 *   #508  training:infra_storage:failed to download <url>
 *
 * A cura é a mesma disciplina do OOM/disco: chave CONSTANTE para a causa
 * decidida, e o texto cru deixa de mandar na assinatura.
 */
const ASSINATURA_STORAGE_R2 = "training:infra_storage:r2";

const HOST_R2 = "voices-clone-ai-verse.4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e.r2.cloudflarestorage.com";

/** URL presignada com a cara da real: credential + signature de 64 hex. É ela
 *  que estoura o teto de 500 dos produtores. */
const URL_PRESIGNADA =
  `https://${HOST_R2}/raw/8d7e7c37-5b2e-4c1a-9f3d-6e0a8b4c2d1f/` +
  "000_003_take_gravado_no_onboarding_9fK2mLxQ7Rt4Vw8Yz.wav" +
  "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
  `&X-Amz-Credential=${"a".repeat(32)}%2F20260921%2Fauto%2Fs3%2Faws4_request` +
  "&X-Amz-Date=20260921T125400Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host" +
  `&X-Amz-Signature=${"b".repeat(64)}&X-Amz-Checksum-Mode=ENABLED&x-id=GetObject`;

/** O erro INTEIRO, como o produtor que tinha ele em memória viu (→ #507). */
const ERRO_507_LONGO =
  `Failed to download ${URL_PRESIGNADA} HTTPSConnectionPool(host='${HOST_R2}', ` +
  "port=443): Read timed out. (read timeout=60)";

/** O MESMO erro depois do teto de 500 (→ #508). O slice imita finalize-training
 *  .ts/ingest.ts; o assert logo abaixo prova que o corte caiu dentro da URL. */
const ERRO_508_CURTO = `Failed to download ${URL_PRESIGNADA}`.slice(0, 500);

test("#510: o texto do #507 e o do #508 caem no MESMO incidente", () => {
  // Pré-condição do cenário: o corte de 500 tem de cair DENTRO da URL, senão
  // este teste não reproduz o racha real.
  assert.ok(
    `Failed to download ${URL_PRESIGNADA}`.length > 500,
    "a URL presignada do teste precisa estourar o teto de 500",
  );
  assert.equal(classifyCause(ERRO_507_LONGO), "infra_storage");
  assert.equal(classifyCause(ERRO_508_CURTO), "infra_storage");
  assert.equal(errorSignature("training", ERRO_507_LONGO), ASSINATURA_STORAGE_R2);
  assert.equal(errorSignature("training", ERRO_508_CURTO), ASSINATURA_STORAGE_R2);
});

test("#510: alunos diferentes, URLs presignadas diferentes, MESMO incidente", () => {
  const outroAluno =
    `Failed to download https://${HOST_R2}/raw/aa11bb22-cc33-4d44-8e55-ff6677889900/` +
    "voice_0002.wav?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
    `&X-Amz-Credential=${"c".repeat(32)}%2F20260921%2Fauto%2Fs3%2Faws4_request` +
    `&X-Amz-Signature=${"d".repeat(64)} ` +
    `HTTPSConnectionPool(host='${HOST_R2}', port=443): Read timed out. (read timeout=60)`;
  assert.equal(errorSignature("training", outroAluno), ASSINATURA_STORAGE_R2);
  assert.equal(
    errorSignature("training", outroAluno),
    errorSignature("training", ERRO_507_LONGO),
    "duas ocorrências têm de somar no MESMO incidente",
  );
});

test("#510: material impróprio do aluno NÃO vira chave de storage", () => {
  // Espelho do "erro de dataset continua ganhando do diagnóstico" (OOM/disco):
  // a guarda em errorSignature é pela CAUSA DECIDIDA, então um erro de dataset
  // que por acaso cite o bucket não pode nascer `training:user_dataset:r2`.
  const erroMisto = `insufficient_audio: no usable speech in file fetched from ${URL_PRESIGNADA}`;
  assert.equal(classifyCause(erroMisto), "user_dataset");
  assert.equal(errorSignature("training", erroMisto), "training:user_dataset");
  assert.doesNotMatch(errorSignature("training", erroMisto), /infra_storage|:r2$/);
});

test("#510: infra_gpu e infra_disk continuam com as chaves de hoje", () => {
  // Zero regressão nos vizinhos: as três chaves constantes provadas por stderr
  // não mudam, e o infra_gpu decidido por TEXTO continua com head (é o
  // comportamento de hoje — só o storage saiu do head neste PR).
  const STDERR_OOM =
    "torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 24.00 MiB. " +
    "GPU 0 has a total capacity of 94.97 GiB of which 16.88 MiB is free.";
  const STDERR_DISCO =
    "safetensors._safetensors_rust.SafetensorError: Error while serializing: " +
    "I/O error: No space left on device (os error 28)";
  assert.equal(
    errorSignature("training", "trainer failed", { stderr: STDERR_OOM }),
    "training:infra_gpu:cuda-oom",
  );
  assert.equal(
    errorSignature("training", "trainer failed", { stderr: STDERR_DISCO }),
    "training:infra_disk:no-space",
  );
  assert.equal(
    errorSignature("training", "CUDA error: device-side assert triggered"),
    "training:infra_gpu:cuda error: device-side assert triggered",
  );
});

test("#510 MUTAÇÃO: o código VELHO rachava a mesma falha em dois cartões", () => {
  // Réplica literal do caminho ANTES da correção: infra_storage caía no caso
  // geral e herdava o head do texto cru. Se este teste passar também no código
  // novo, a réplica está errada — o par de asserts finais prova o conserto.
  const velho = (kind: string, error: string) => {
    const k = kind === "voice" ? "training" : kind;
    const head = stripRunpodWrapper(stripFaseSuffix(error))
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "<url>")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
      .replace(/[0-9a-f]{16,}/g, "<hex>")
      .replace(/\d+/g, "#")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return `${k}:infra_storage:${head}`;
  };
  const a = velho("training", ERRO_507_LONGO);
  const b = velho("training", ERRO_508_CURTO);
  // Era este o defeito: o MESMO erro, visto por dois produtores, dava duas
  // assinaturas — e são exatamente as dos cartões reais de 21/09.
  assert.notEqual(a, b);
  assert.equal(
    a,
    "training:infra_storage:failed to download <url> httpsconnectionpool(" +
      "host='voices-clone-ai-verse.<hex>.r#.cloudflarestorage.com', port=#): read ",
  );
  assert.equal(b, "training:infra_storage:failed to download <url>");
  // E é este o conserto:
  assert.equal(errorSignature("training", ERRO_507_LONGO), errorSignature("training", ERRO_508_CURTO));
});
