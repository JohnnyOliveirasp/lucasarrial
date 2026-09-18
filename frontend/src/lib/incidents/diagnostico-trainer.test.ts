/**
 * O OOM DE GPU PRECISA SAIR DO GUARDA-CHUVA `training:bug:trainer failed`.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de `frontend/`:
 *   node --import ./test/alias-loader.mjs --test src/lib/incidents/diagnostico-trainer.test.ts
 *
 * O `--import ./test/alias-loader.mjs` é necessário porque este teste carrega
 * `classify.ts`, que importa `./diagnostico-trainer` SEM extensão — o bundler
 * do Next resolve, o ESM nativo do Node não. O loader já existia para os
 * testes de simulação; nada disto vale em produção.
 *
 * ── O que estes testes travam, e por quê ──────────────────────────────────
 * Medido no banco vivo em 16/09, com o código ANTERIOR a este arquivo:
 *
 *   · o worker manda sempre `error: "trainer failed"` (jobs/train.py:96-101),
 *     então `errorSignature("training", erro)` dava sempre a MESMA chave;
 *   · essa chave é o incidente #11 — aberto 21/07, status "investigating" há
 *     56 dias, 4 ocorrências, `last_seen_at` = 2026-09-15T21:46:06Z;
 *   · 2026-09-15T21:46:06Z é EXATAMENTE a falha de GPU do ricardoolito. Ou
 *     seja: o OOM caiu num guarda-chuva parado e não avisou ninguém;
 *   · e `classifyCause("trainer failed")` devolvia `bug` — infraestrutura
 *     carimbada como defeito nosso.
 *
 * Se um destes testes quebrar, a próxima falha de GPU volta a ser invisível.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASSINATURA_CUDA_OOM,
  ASSINATURA_DISCO_CHEIO,
  ASSINATURA_ESCRITA_CHECKPOINT,
  ehCudaOom,
  ehDiscoCheio,
  ehEscritaDeCheckpointFalhou,
  notaDeTransitoriedade,
  notaDiscoCheio,
  notaEscritaCheckpointFalhou,
} from "./diagnostico-trainer.ts";
import { classifyCause, errorSignature, incidentTitle } from "./classify.ts";

/** O que o worker grava em `training_jobs.error_message`. Não é texto inventado. */
const ERROR_MESSAGE_GRAVADO = "trainer failed";

/** A assinatura do #11. Constante congelada: é o guarda-chuva que o OOM
 *  precisa PARAR de alimentar. */
const ASSINATURA_DO_11 = "training:bug:trainer failed";

/**
 * STDERR REAL, copiado de `training_jobs.trainer_stderr` do job `c90ff577…`
 * (15/09, ricardoolito) — a ÚNICA falha instrumentada que existe na tabela.
 * Não é um traceback plausível escrito à mão: é o que o banco tem.
 */
const STDERR_OOM_REAL = `  File "/app/VoxCPM/src/voxcpm/modules/minicpm4/model.py", line 235, in forward
    return self.down_proj(self.act_fn(self.gate_proj(x)) * self.up_proj(x))
                                                           ^^^^^^^^^^^^^^^
  File "/usr/local/lib/python3.12/dist-packages/torch/nn/modules/linear.py", line 125, in forward
    return F.linear(input, self.weight, self.bias)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 24.00 MiB. GPU 0 has a total capacity of 94.97 GiB of which 16.88 MiB is free. Process 560 has 7.95 GiB memory in use. Including non-PyTorch memory, this process has 11.93 GiB memory in use. Of the allocated memory 11.24 GiB is allocated by PyTorch, and 14.48 MiB is reserved by PyTorch but unallocated.
`;

/** Falha de trainer que NÃO é OOM. Traceback plausível de import quebrado —
 *  e de propósito ele CITA um caminho com "cuda", que é a armadilha. */
const STDERR_SEM_OOM = `Traceback (most recent call last):
  File "/app/jobs/train.py", line 41, in <module>
    import torch
  File "/usr/local/lib/python3.12/dist-packages/torch/__init__.py", line 367, in <module>
    from torch._C import *
ModuleNotFoundError: No module named 'torch._C'
  (procurado em /usr/local/cuda/lib64 e /usr/local/cuda-12.4/targets)
`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. stderr com OOM → infra_gpu + assinatura própria
// ─────────────────────────────────────────────────────────────────────────────

test("stderr com OOM: o detector reconhece o traceback REAL do banco", () => {
  assert.equal(ehCudaOom(STDERR_OOM_REAL), true);
});

test("stderr com OOM: a causa deixa de ser 'bug' e vira infra_gpu", () => {
  // O defeito, em uma linha: o mesmo erro, sem e com diagnóstico.
  assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO), "bug");
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL, returncode: 1 }),
    "infra_gpu",
  );
});

test("stderr com OOM: a assinatura sai do guarda-chuva do #11", () => {
  const antes = errorSignature("training", ERROR_MESSAGE_GRAVADO);
  const depois = errorSignature("training", ERROR_MESSAGE_GRAVADO, {
    stderr: STDERR_OOM_REAL,
    returncode: 1,
  });
  assert.equal(antes, ASSINATURA_DO_11, "o guarda-chuva antigo continua sendo o que era");
  assert.equal(depois, ASSINATURA_CUDA_OOM);
  assert.equal(ASSINATURA_CUDA_OOM, "training:infra_gpu:cuda-oom");
  assert.notEqual(depois, antes);
});

test("kind 'voice' também unifica em 'training' na chave de OOM", () => {
  assert.equal(
    errorSignature("voice", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL }),
    ASSINATURA_CUDA_OOM,
  );
});

test("a assinatura de OOM é CONSTANTE: dois tracebacks diferentes, uma chave só", () => {
  // Este é o teste que impede a próxima fragmentação. O traceback muda a cada
  // ocorrência (bytes, pid, GiB livres) e, se qualquer pedaço dele entrasse no
  // head de 120 chars, cada OOM abriria um incidente novo.
  const outroOom = STDERR_OOM_REAL.replace("24.00 MiB", "512.00 MiB")
    .replace("Process 560", "Process 9931")
    .replace("16.88 MiB is free", "4.02 GiB is free");
  assert.notEqual(outroOom, STDERR_OOM_REAL, "o par de tracebacks precisa ser diferente");
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: outroOom }),
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL }),
  );
});

test("o título de OOM diz a CONDUTA, não só o sintoma, e cabe na coluna", () => {
  const t = incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL });
  assert.match(t, /OOM/);
  assert.match(t, /repetir/i);
  assert.ok(t.length <= 120, `título com ${t.length} chars estoura o slice(0,120)`);
});

test("o chamado de OOM afirma que a falha é TRANSITÓRIA e candidata a repetir", () => {
  const nota = notaDeTransitoriedade({ stderr: STDERR_OOM_REAL, returncode: 1 });
  assert.match(nota, /TRANSITÓRIA/);
  assert.match(nota, /repetir/i);
  assert.match(nota, /trainer_returncode: 1/);
  // ⚠️ A comparação honesta. 5,22% é a tabela inteira, com 70 falhas CEGAS
  // dentro; 0,25% é a janela instrumentada de 20 dias. Dizer que "melhorou de
  // 5,22% para 0,25%" seria mentira estatística, e a nota tem que registrar
  // isso por escrito — senão alguém vai citar a melhora que nunca foi medida.
  assert.match(nota, /não são comparáveis|NÃO são comparáveis/);
  // E nada de prometer retentativa automática, que não existe.
  assert.doesNotMatch(nota, /autom[áa]tic[ao]\s+(vai|será|acontece)/i);
});

test("returncode ausente não some da nota: fica explícito que não foi registrado", () => {
  assert.match(notaDeTransitoriedade({ stderr: STDERR_OOM_REAL }), /não registrado/);
  assert.match(notaDeTransitoriedade(undefined), /não registrado/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. stderr SEM OOM → comportamento de hoje, intacto
// ─────────────────────────────────────────────────────────────────────────────

test("stderr sem OOM: nada muda, mesmo com 'cuda' no meio do traceback", () => {
  // A armadilha: `classifyCause` tem a regra larga `e.includes("cuda")`, que é
  // boa no `error_message` (curto, escrito pelo worker) e seria um desastre
  // solta em cima de stderr — todo traceback cita /usr/local/cuda.
  assert.equal(ehCudaOom(STDERR_SEM_OOM), false, "path com 'cuda' não é OOM");
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_SEM_OOM, returncode: 1 }),
    "bug",
  );
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_SEM_OOM, returncode: 1 }),
    ASSINATURA_DO_11,
  );
});

test("stderr sem OOM não muda o título", () => {
  assert.equal(
    incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_SEM_OOM }),
    incidentTitle("training", ERROR_MESSAGE_GRAVADO),
  );
});

test("erro de dataset continua ganhando do diagnóstico", () => {
  // Ordem escrita de propósito em classifyCause: material do aluno é a causa
  // acionável e é o comportamento de hoje. Nunca observado junto, mas a ordem
  // não pode mudar por acidente.
  const erroAluno = "insufficient_audio: only 4s of usable speech";
  assert.equal(classifyCause(erroAluno, { stderr: STDERR_OOM_REAL }), "user_dataset");
  assert.equal(
    errorSignature("training", erroAluno, { stderr: STDERR_OOM_REAL }),
    errorSignature("training", erroAluno),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. As 70 falhas CEGAS (pré-mig 97) não podem quebrar nem ganhar causa
// ─────────────────────────────────────────────────────────────────────────────

test("falha cega (stderr/returncode nulos) classifica exatamente como antes", () => {
  // Isto é o estado REAL de 70 das 71 falhas da tabela, e das 3 primeiras
  // ocorrências do #11 (21/07, 10/08, 27/08): colunas nulas, jobs já purgados
  // no RunPod. Elas NÃO podem virar OOM por palpite.
  for (const diag of [
    undefined,
    {},
    { stderr: null, returncode: null },
    { stderr: "", returncode: null },
    { stderr: null, returncode: 1 },
  ]) {
    assert.equal(ehCudaOom(diag?.stderr), false);
    assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO, diag), "bug");
    assert.equal(errorSignature("training", ERROR_MESSAGE_GRAVADO, diag), ASSINATURA_DO_11);
    assert.equal(
      incidentTitle("training", ERROR_MESSAGE_GRAVADO, diag),
      incidentTitle("training", ERROR_MESSAGE_GRAVADO),
    );
  }
});

test("erro vazio sem diagnóstico continua 'unknown' — não inventa causa", () => {
  assert.equal(classifyCause("", { stderr: null, returncode: 1 }), "unknown");
  assert.equal(classifyCause("", undefined), "unknown");
});

test("erro vazio COM prova de OOM no stderr é classificado assim mesmo", () => {
  // O caminho oposto do teste acima: quando a prova existe, a ausência de
  // texto no `error` não pode apagá-la.
  assert.equal(classifyCause("", { stderr: STDERR_OOM_REAL }), "infra_gpu");
  assert.equal(errorSignature("training", "", { stderr: STDERR_OOM_REAL }), ASSINATURA_CUDA_OOM);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Detector: as duas grafias da classe do torch
// ─────────────────────────────────────────────────────────────────────────────

test("detector cobre as duas grafias da exceção do torch e é imune a caixa", () => {
  // `torch.cuda.OutOfMemoryError` até o torch 2.3; `torch.OutOfMemoryError`
  // depois. A âncora de verdade é a MENSAGEM ("CUDA out of memory"), que não
  // mudou entre as duas — mas as classes entram como reforço.
  assert.equal(ehCudaOom("torch.cuda.OutOfMemoryError: CUDA out of memory"), true);
  assert.equal(ehCudaOom("torch.OutOfMemoryError: CUDA out of memory"), true);
  assert.equal(ehCudaOom("TORCH.OUTOFMEMORYERROR"), true);
  assert.equal(ehCudaOom("RuntimeError: CUDA out of memory"), true);
  assert.equal(ehCudaOom(null), false);
  assert.equal(ehCudaOom(undefined), false);
  // NÃO é OOM de GPU: memória do host. Causa e conduta são outras.
  assert.equal(ehCudaOom("MemoryError: Unable to allocate 4.00 GiB for an array"), false);
  assert.equal(ehCudaOom("Killed (out of memory)"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DISCO CHEIO no worker (17/09) — o mesmo vão do OOM, com outro nome
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STDERR REAL, copiado de `training_jobs.trainer_stderr` do job `bbf4b050…`
 * (17/09, almaraujo13). Não é traceback plausível escrito à mão: é o que o
 * banco tem. Repare no `step 490` — o treino estava no FIM (chegou ao 499 de
 * 500) quando morreu gravando o checkpoint.
 */
const STDERR_DISCO_REAL = `[train] step 490: loss/diff: 1.101653, loss/stop: 0.000516, lr: 0.000000, epoch: 10.425532, grad_norm: 0.106999, log interval: 2.29s
Traceback (most recent call last):
  File "/usr/local/lib/python3.12/dist-packages/argbind/argbind.py", line 159, in cmd_func
    return func(*cmd_args, **kwargs)
           ^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/app/VoxCPM/scripts/train_voxcpm_finetune.py", line 357, in train
    save_checkpoint(model, optimizer, scheduler, save_dir, step, pretrained_path, hf_model_id, distribute)
  File "/app/VoxCPM/scripts/train_voxcpm_finetune.py", line 777, in save_checkpoint
    save_file(state_dict, folder / "lora_weights.safetensors")
  File "/usr/local/lib/python3.12/dist-packages/safetensors/torch.py", line 323, in save_file
    serialize_file(
safetensors._safetensors_rust.SafetensorError: Error while serializing: I/O error: No space left on device (os error 28)
`;

test("stderr com ENOSPC: o detector reconhece o traceback REAL do banco", () => {
  assert.equal(ehDiscoCheio(STDERR_DISCO_REAL), true);
  // E o OOM NÃO reclama dele: as duas classes são disjuntas no caso real.
  // (Medido: o stderr do bbf4b050 não contém "cuda out of memory".)
  assert.equal(ehCudaOom(STDERR_DISCO_REAL), false);
});

test("stderr com ENOSPC: a causa deixa de ser 'bug' e vira infra_disk", () => {
  assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO), "bug");
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL, returncode: 1 }),
    "infra_disk",
  );
});

test("stderr com ENOSPC: a assinatura sai do guarda-chuva do #11", () => {
  const antes = errorSignature("training", ERROR_MESSAGE_GRAVADO);
  const depois = errorSignature("training", ERROR_MESSAGE_GRAVADO, {
    stderr: STDERR_DISCO_REAL,
    returncode: 1,
  });
  assert.equal(antes, ASSINATURA_DO_11, "o guarda-chuva antigo continua sendo o que era");
  assert.equal(depois, ASSINATURA_DISCO_CHEIO);
  assert.equal(ASSINATURA_DISCO_CHEIO, "training:infra_disk:no-space");
  assert.notEqual(depois, antes);
  // E não colide com a chave de OOM: são incidentes diferentes.
  assert.notEqual(ASSINATURA_DISCO_CHEIO, ASSINATURA_CUDA_OOM);
});

test("a assinatura de disco é CONSTANTE: dois tracebacks diferentes, uma chave só", () => {
  // Mesma patologia que o OOM já trava: o traceback muda a cada ocorrência
  // (step alcançado, loss, epoch). Se qualquer pedaço entrasse no head de 120
  // chars, cada disco cheio abriria um incidente novo.
  const outroDisco = STDERR_DISCO_REAL.replace("step 490", "step 120")
    .replace("1.101653", "2.998001")
    .replace("epoch: 10.425532", "epoch: 2.551020");
  assert.notEqual(outroDisco, STDERR_DISCO_REAL, "o par de tracebacks precisa ser diferente");
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: outroDisco }),
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL }),
  );
});

test("kind 'voice' também unifica em 'training' na chave de disco", () => {
  assert.equal(
    errorSignature("voice", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL }),
    ASSINATURA_DISCO_CHEIO,
  );
});

test("o título de disco diz que o treino COMPLETOU, e cabe na coluna", () => {
  const t = incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL });
  assert.match(t, /disco cheio/i);
  // A informação que muda a conduta de quem lê: não adianta procurar defeito
  // no material do aluno, o treino rodou até o fim.
  assert.match(t, /completou/i);
  assert.ok(t.length <= 120, `título com ${t.length} chars estoura o slice(0,120)`);
});

test("erro vazio COM prova de ENOSPC no stderr é classificado assim mesmo", () => {
  // Guarda `!e` de classifyCause: sem incluir o detector de disco nela, este
  // caso sairia como "unknown" antes de chegar na regra que o classifica.
  assert.equal(classifyCause("", { stderr: STDERR_DISCO_REAL }), "infra_disk");
  assert.equal(
    errorSignature("training", "", { stderr: STDERR_DISCO_REAL }),
    ASSINATURA_DISCO_CHEIO,
  );
});

test("a nota de disco carrega as 3 coisas que mudam a conduta de quem lê", () => {
  const nota = notaDiscoCheio({ stderr: STDERR_DISCO_REAL, returncode: 1 });
  // (a) o treino COMPLETOU e o artefato se perdeu no save — repetir é barato em
  //     risco e CARO em GPU.
  assert.match(nota, /step 499 de 500|terminou|completou/i);
  assert.match(nota, /save_checkpoint|salvar/i);
  // (b) o disco é do WORKER, não do aluno: nada para ele corrigir.
  assert.match(nota, /DISCO É DO WORKER, NÃO DO ALUNO/);
  assert.match(nota, /intacto/i);
  // (c) JÁ ACONTECEU ANTES (10/08, resolution_note do #11) → é infra, não código.
  assert.match(nota, /JÁ ACONTECEU ANTES/);
  assert.match(nota, /10\/08/);
  assert.match(nota, /SEGUNDA vez/);
  assert.match(nota, /INFRA para alguém olhar/);
  assert.match(nota, /trainer_returncode: 1/);
  // n=1 escrito por extenso: a nota não pode sugerir "50% das falhas".
  assert.match(nota, /n=1/);
  // E nada de prometer retentativa automática, que não existe (regra do #308).
  assert.doesNotMatch(nota, /autom[áa]tic[ao]\s+(vai|será|acontece)/i);
});

test("a nota de disco NÃO é a nota de OOM — são condutas diferentes", () => {
  // O risco real aqui é alguém copiar o parágrafo do OOM e o chamado dizer
  // "a GPU ficou sem memória" para uma falha de disco.
  const disco = notaDiscoCheio({ stderr: STDERR_DISCO_REAL, returncode: 1 });
  assert.doesNotMatch(disco, /GPU ficou sem memória/);
  assert.notEqual(disco, notaDeTransitoriedade({ stderr: STDERR_OOM_REAL, returncode: 1 }));
});

test("returncode ausente não some da nota de disco", () => {
  assert.match(notaDiscoCheio({ stderr: STDERR_DISCO_REAL }), /não registrado/);
  assert.match(notaDiscoCheio(undefined), /não registrado/);
});

// ── Controles NEGATIVOS: mencionar disco/espaço não é estar sem espaço ──────

test("traceback que só MENCIONA disco/espaço não vira disco cheio", () => {
  // A armadilha simétrica à do "cuda" solto no detector de OOM. Estas frases
  // citam disco, espaço e device — e nenhuma delas é um ENOSPC.
  assert.equal(ehDiscoCheio("RuntimeError: could not check free space on device"), false);
  assert.equal(ehDiscoCheio("WARNING: disk space is low (2% free), continuing"), false);
  assert.equal(ehDiscoCheio("Saving checkpoint to /mnt/space/device-0/out.bin"), false);
  assert.equal(ehDiscoCheio("No space suffix configured for this device"), false);
  assert.equal(ehDiscoCheio(null), false);
  assert.equal(ehDiscoCheio(undefined), false);
  assert.equal(ehDiscoCheio(""), false);
  // O traceback de import quebrado do bloco 2 também não é disco.
  assert.equal(ehDiscoCheio(STDERR_SEM_OOM), false);
});

test("detector de disco cobre as duas camadas que gritam ENOSPC e é imune a caixa", () => {
  // Rust (safetensors) e Python puro dizem a MESMA frase canônica; o
  // "os error 28" entra como reforço, como as classes do torch no OOM.
  assert.equal(ehDiscoCheio("I/O error: No space left on device (os error 28)"), true);
  assert.equal(ehDiscoCheio("OSError: [Errno 28] No space left on device"), true);
  assert.equal(ehDiscoCheio("NO SPACE LEFT ON DEVICE"), true);
  assert.equal(ehDiscoCheio("io error: os error 28"), true);
});

// ── Não-regressão: o OOM continua indo para infra_gpu ───────────────────────

test("o OOM NÃO regride para infra_disk: continua infra_gpu com a chave dele", () => {
  // Este é o teste de não-regressão que o PR do disco precisa ter. Ele prova
  // que o stderr de OOM não é capturado pelo detector novo — mas repare que
  // ele NÃO depende da ordem das duas regras em classifyCause: os detectores
  // são disjuntos neste fixture, então reordená-las não quebraria este teste.
  // Quem trava a ordem é o teste do desempate, logo abaixo.
  assert.equal(ehDiscoCheio(STDERR_OOM_REAL), false, "stderr de OOM não é disco cheio");
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL, returncode: 1 }),
    "infra_gpu",
  );
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL }),
    ASSINATURA_CUDA_OOM,
  );
  assert.match(
    incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL }),
    /OOM/,
  );
});

test("stderr com OS DOIS textos: o OOM ganha, e a ordem fica travada", () => {
  /**
   * ⚠️ CASO NUNCA OBSERVADO — teste de CARACTERIZAÇÃO, não de requisito.
   *
   * Nenhum stderr real tem os dois textos (medido 17/09: o `bbf4b050` tem
   * ENOSPC e não tem OOM; o `c90ff577` o contrário). Este teste não afirma que
   * "OOM é mais importante que disco": ele apenas CONGELA o desempate que a
   * ordem das regras em `classifyCause` produz hoje, para que reordenar as duas
   * linhas seja uma decisão consciente e não um acidente de refatoração.
   *
   * A ordem escolhida (OOM primeiro) é a conservadora: garante que nenhum
   * stderr que já classificava como `infra_gpu` mude de causa por causa do
   * detector novo.
   */
  const ambos = STDERR_OOM_REAL + "\n" + STDERR_DISCO_REAL;
  assert.equal(ehCudaOom(ambos), true, "o fixture precisa casar os DOIS detectores");
  assert.equal(ehDiscoCheio(ambos), true, "o fixture precisa casar os DOIS detectores");
  assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: ambos }), "infra_gpu");
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: ambos }),
    ASSINATURA_CUDA_OOM,
  );
});

test("falha CEGA continua 'bug': disco cheio não é palpite para quem não tem stderr", () => {
  // As 70 falhas sem stderr não podem ganhar causa nova por causa deste PR —
  // é a mesma decisão escrita no cabeçalho de diagnostico-trainer.ts.
  for (const diag of [undefined, {}, { stderr: null }, { stderr: "" }]) {
    assert.equal(ehDiscoCheio(diag?.stderr), false);
    assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO, diag), "bug");
    assert.equal(errorSignature("training", ERROR_MESSAGE_GRAVADO, diag), ASSINATURA_DO_11);
  }
});

test("erro de dataset continua ganhando do diagnóstico de disco", () => {
  // Mesma precedência já travada para o OOM: material do aluno é a causa
  // acionável. E a guarda por CAUSA em errorSignature impede a chave
  // inconsistente `training:user_dataset:no-space`.
  const erroAluno = "insufficient_audio: only 4s of usable speech";
  assert.equal(classifyCause(erroAluno, { stderr: STDERR_DISCO_REAL }), "user_dataset");
  assert.equal(
    errorSignature("training", erroAluno, { stderr: STDERR_DISCO_REAL }),
    errorSignature("training", erroAluno),
  );
  assert.doesNotMatch(
    errorSignature("training", erroAluno, { stderr: STDERR_DISCO_REAL }),
    /no-space/,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ESCRITA DE CHECKPOINT TRUNCADA (18/09) — a MESMA função, o arquivo
//    SEGUINTE, e o torch engolindo o errno
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STDERR REAL, copiado de `training_jobs.trainer_stderr` do job `c7a376e5…`
 * (18/09 22:40:12Z). Não é traceback plausível escrito à mão: é o que o banco
 * tem. Repare em DUAS coisas que este fixture prova sozinho:
 *
 *  1. morreu na MESMA `save_checkpoint()` do caso de ENOSPC — mas na linha
 *     814 (`optimizer.pth`, gravado pelo torch), não na 777
 *     (`lora_weights.safetensors`, gravado pelo safetensors);
 *  2. NÃO existe a string "no space left on device" em lugar nenhum. O torch
 *     engole o errno — é exatamente por isso que `ehDiscoCheio` não pegou e o
 *     incidente #11 reabriu.
 */
const STDERR_ESCRITA_REAL = `Traceback (most recent call last):
  File "/app/VoxCPM/scripts/train_voxcpm_finetune.py", line 357, in train
    save_checkpoint(model, optimizer, scheduler, save_dir, step, pretrained_path, hf_model_id, distribute)
  File "/app/VoxCPM/scripts/train_voxcpm_finetune.py", line 814, in save_checkpoint
    torch.save(optimizer.state_dict(), folder / "optimizer.pth")
  File "/usr/local/lib/python3.12/dist-packages/torch/serialization.py", line 1268, in _save
    zip_file.write_record(name, storage, num_bytes)
RuntimeError: [enforce fail at inline_container.cc:858] . PytorchStreamWriter failed writing file data/1004: file write failed

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/app/VoxCPM/scripts/train_voxcpm_finetune.py", line 814, in save_checkpoint
    torch.save(optimizer.state_dict(), folder / "optimizer.pth")
  File "/usr/local/lib/python3.12/dist-packages/torch/serialization.py", line 966, in save
    with _open_zipfile_writer(f) as opened_zipfile:
  File "/usr/local/lib/python3.12/dist-packages/torch/serialization.py", line 798, in __exit__
    self.file_like.write_end_of_file()
RuntimeError: [enforce fail at inline_container.cc:664] . unexpected pos 131040192 vs 131040080
`;

test("stderr de escrita truncada: o detector reconhece o traceback REAL do banco", () => {
  assert.equal(ehEscritaDeCheckpointFalhou(STDERR_ESCRITA_REAL), true);
  // E — o ponto do cartão — o detector de ENOSPC NÃO pega este caso. Não é
  // regressão do `ehDiscoCheio`: o texto do errno simplesmente não está aqui.
  assert.equal(
    ehDiscoCheio(STDERR_ESCRITA_REAL),
    false,
    "o torch engole o errno: 'no space left on device' não aparece neste stderr",
  );
  assert.equal(ehCudaOom(STDERR_ESCRITA_REAL), false);
});

test("stderr de escrita truncada: a causa deixa de ser 'bug' e vira infra_disk", () => {
  // Era isto que acontecia às 22:40:12Z de 18/09: caía em `bug` e reabria o #11.
  assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO), "bug");
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_ESCRITA_REAL, returncode: 1 }),
    "infra_disk",
  );
});

test("stderr de escrita truncada: assinatura PRÓPRIA, fora do #11 e fora do no-space", () => {
  const antes = errorSignature("training", ERROR_MESSAGE_GRAVADO);
  const depois = errorSignature("training", ERROR_MESSAGE_GRAVADO, {
    stderr: STDERR_ESCRITA_REAL,
    returncode: 1,
  });
  assert.equal(antes, ASSINATURA_DO_11, "o guarda-chuva antigo continua sendo o que era");
  assert.equal(depois, ASSINATURA_ESCRITA_CHECKPOINT);
  assert.equal(ASSINATURA_ESCRITA_CHECKPOINT, "training:infra_disk:write-failed");
  assert.notEqual(depois, antes);
  // ⚠️ A decisão central deste PR, travada por teste: MESMA causa do ENOSPC,
  // chave DIFERENTE. Reaproveitar `no-space` afirmaria no chamado um errno que
  // o torch nunca entregou.
  assert.notEqual(ASSINATURA_ESCRITA_CHECKPOINT, ASSINATURA_DISCO_CHEIO);
  assert.doesNotMatch(depois, /no-space/);
  assert.notEqual(ASSINATURA_ESCRITA_CHECKPOINT, ASSINATURA_CUDA_OOM);
});

test("a assinatura de escrita truncada é CONSTANTE: dois tracebacks, uma chave só", () => {
  // Mesma patologia que as outras duas já travam. Aqui o que muda entre
  // ocorrências é o nome do registro do zip (`data/1004`) e os dois números do
  // `unexpected pos` — se qualquer um entrasse no head de 120 chars, cada falha
  // abriria um incidente novo.
  const outraEscrita = STDERR_ESCRITA_REAL.replace("data/1004", "data/37")
    .replace("131040192", "88604672")
    .replace("131040080", "88604544");
  assert.notEqual(outraEscrita, STDERR_ESCRITA_REAL, "o par de tracebacks precisa ser diferente");
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: outraEscrita }),
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_ESCRITA_REAL }),
  );
});

test("kind 'voice' também unifica em 'training' na chave de escrita truncada", () => {
  assert.equal(
    errorSignature("voice", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_ESCRITA_REAL }),
    ASSINATURA_ESCRITA_CHECKPOINT,
  );
});

test("o título de escrita truncada diz PROVÁVEL, não afirma o errno, e cabe na coluna", () => {
  const t = incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_ESCRITA_REAL });
  assert.match(t, /truncada/i);
  // A palavra que separa hipótese de fato. Quem varre a fila lê só o título.
  assert.match(t, /prov[áa]vel/i);
  assert.ok(t.length <= 120, `título com ${t.length} chars estoura o slice(0,120)`);
  // E não pode ser o título do ENOSPC provado: são certezas diferentes.
  assert.notEqual(
    t,
    incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL }),
  );
});

test("erro vazio COM prova de escrita truncada é classificado assim mesmo", () => {
  // Guarda `!e` de classifyCause: sem incluir o detector novo nela, este caso
  // sairia como "unknown" antes de chegar na regra que o classifica.
  assert.equal(classifyCause("", { stderr: STDERR_ESCRITA_REAL }), "infra_disk");
  assert.equal(
    errorSignature("training", "", { stderr: STDERR_ESCRITA_REAL }),
    ASSINATURA_ESCRITA_CHECKPOINT,
  );
});

test("a nota de escrita truncada carrega as 4 coisas que mudam a conduta", () => {
  const nota = notaEscritaCheckpointFalhou({ stderr: STDERR_ESCRITA_REAL, returncode: 1 });
  // (a) disco cheio é a causa PROVÁVEL, com o porquê: 777 → 814, mesma função.
  assert.match(nota, /disco cheio/i);
  assert.match(nota, /777/);
  assert.match(nota, /814/);
  assert.match(nota, /save_checkpoint/);
  assert.match(nota, /7115da78/, "o caso de ENOSPC provado do mesmo dia é a evidência");
  // (b) "unexpected pos X vs Y" é escrita TRUNCADA, não escrita recusada.
  assert.match(nota, /TRUNCADA/);
  assert.match(nota, /131040192/);
  assert.match(nota, /131040080/);
  // (c) a RESSALVA: o torch não entrega o errno → provável, não confessado.
  assert.match(nota, /CAUSA PROVÁVEL, NÃO CONFESSADA/);
  assert.match(nota, /errno/);
  assert.match(nota, /n[ãa]o prova/i);
  // (d) o disco é do WORKER, não do aluno.
  assert.match(nota, /DISCO É DO WORKER, NÃO DO ALUNO/);
  assert.match(nota, /intacto/i);
  // Retentar é barato e funciona — com o caso medido, não "costuma curar".
  assert.match(nota, /Heitor/);
  assert.match(nota, /260s/);
  assert.match(nota, /trainer_returncode: 1/);
  // E nada de prometer retentativa automática, que não existe (regra do #308).
  assert.match(nota, /Não há\s*\n?\s*retentativa automática/);
  assert.doesNotMatch(nota, /autom[áa]tic[ao]\s+(vai|será|acontece)/i);
});

test("a nota de escrita truncada NÃO é a de disco cheio nem a de OOM", () => {
  // O risco real: alguém copiar o parágrafo do ENOSPC e o chamado afirmar um
  // errno que o torch nunca devolveu.
  const escrita = notaEscritaCheckpointFalhou({ stderr: STDERR_ESCRITA_REAL, returncode: 1 });
  assert.notEqual(escrita, notaDiscoCheio({ stderr: STDERR_DISCO_REAL, returncode: 1 }));
  assert.notEqual(escrita, notaDeTransitoriedade({ stderr: STDERR_OOM_REAL, returncode: 1 }));
  assert.doesNotMatch(escrita, /GPU ficou sem memória/);
  assert.doesNotMatch(escrita, /os error 28/i);
});

test("returncode ausente não some da nota de escrita truncada", () => {
  assert.match(notaEscritaCheckpointFalhou({ stderr: STDERR_ESCRITA_REAL }), /não registrado/);
  assert.match(notaEscritaCheckpointFalhou(undefined), /não registrado/);
});

// ── Controles NEGATIVOS: mencionar escrita/posição não é escrita truncada ───

test("traceback que só MENCIONA escrita/posição não vira escrita truncada", () => {
  // As três armadilhas nomeadas no cartão, e o motivo de cada uma:
  // "write failed", "enforce fail" e "pos" são palavras que um traceback cita
  // por mil motivos. A âncora exige o writer PELO NOME junto do verbo.
  assert.equal(ehEscritaDeCheckpointFalhou("OSError: could not write log file"), false);
  assert.equal(ehEscritaDeCheckpointFalhou("ValueError: unexpected position in stream"), false);
  // ⚠️ ESTE é o caso que trava o espaço final de "unexpected pos ". O de cima
  // NÃO trava: ele é rejeitado pela exigência de `inline_container`, então
  // apagar o espaço do detector continuaria passando (medido por mutação). Aqui
  // os dois termos estão presentes e só o espaço separa "pos" de "position".
  assert.equal(
    ehEscritaDeCheckpointFalhou(
      "RuntimeError: [enforce fail at inline_container.cc:120] . unexpected position for record data/7",
    ),
    false,
    "'unexpected position' não é 'unexpected pos <n>' — o espaço final é o que separa",
  );
  assert.equal(
    ehEscritaDeCheckpointFalhou("[debug] PytorchStreamWriter opened file model.pt"),
    false,
    "abrir o writer não é falhar ao escrever nele",
  );
  // Palavras soltas, uma a uma, como o cartão exige.
  assert.equal(ehEscritaDeCheckpointFalhou("RuntimeError: file write failed"), false);
  assert.equal(ehEscritaDeCheckpointFalhou("[enforce fail at foo.cc:12] . bad alloc"), false);
  assert.equal(ehEscritaDeCheckpointFalhou("seek to pos 4096 before reading"), false);
  // "unexpected pos " sem o inline_container também não basta: os dois termos
  // são exigidos JUNTOS.
  assert.equal(ehEscritaDeCheckpointFalhou("parser: unexpected pos 12 vs 13"), false);
  assert.equal(ehEscritaDeCheckpointFalhou("[enforce fail at inline_container.cc:1] . ok"), false);
  // Os stderrs das outras duas classes não são esta.
  assert.equal(ehEscritaDeCheckpointFalhou(STDERR_SEM_OOM), false);
  assert.equal(ehEscritaDeCheckpointFalhou(STDERR_OOM_REAL), false);
  assert.equal(ehEscritaDeCheckpointFalhou(STDERR_DISCO_REAL), false);
});

test("detector de escrita truncada: âncora, reforço e imunidade a caixa", () => {
  // A âncora sozinha basta (primeira exceção da cadeia).
  assert.equal(
    ehEscritaDeCheckpointFalhou("PytorchStreamWriter failed writing file data/1004"),
    true,
  );
  assert.equal(ehEscritaDeCheckpointFalhou("PYTORCHSTREAMWRITER FAILED WRITING FILE data/3"), true);
  // O reforço sozinho basta — é o caso em que só a SEGUNDA exceção sobrevive no
  // tail do stderr, que é o que o banco guarda.
  assert.equal(
    ehEscritaDeCheckpointFalhou(
      "RuntimeError: [enforce fail at inline_container.cc:664] . unexpected pos 131040192 vs 131040080",
    ),
    true,
  );
  assert.equal(ehEscritaDeCheckpointFalhou(null), false);
  assert.equal(ehEscritaDeCheckpointFalhou(undefined), false);
  assert.equal(ehEscritaDeCheckpointFalhou(""), false);
});

// ── Não-regressão: as duas classes anteriores não se mexem ──────────────────

test("o ENOSPC NÃO regride: continua infra_disk com a chave no-space", () => {
  assert.equal(ehDiscoCheio(STDERR_DISCO_REAL), true);
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL, returncode: 1 }),
    "infra_disk",
  );
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL }),
    ASSINATURA_DISCO_CHEIO,
  );
  assert.match(
    incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_DISCO_REAL }),
    /disco cheio/i,
  );
});

test("o OOM NÃO regride por causa do detector novo", () => {
  assert.equal(
    classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL, returncode: 1 }),
    "infra_gpu",
  );
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: STDERR_OOM_REAL }),
    ASSINATURA_CUDA_OOM,
  );
});

test("stderr com ENOSPC E escrita truncada: o errno PROVADO ganha", () => {
  /**
   * ⚠️ CASO NUNCA OBSERVADO — teste de CARACTERIZAÇÃO, não de requisito.
   *
   * Diferente do desempate OOM × disco, este é PLAUSÍVEL de verdade: as duas
   * classes moram na mesma `save_checkpoint()`, em arquivos consecutivos, e um
   * stderr longo o bastante poderia trazer as duas mensagens. Por isso o
   * desempate está travado aqui: ganha o ENOSPC, que é o único dos dois com
   * prova de errno. Inferência não pode sobrepor confissão.
   *
   * Este teste também protege a ordem em `classifyCause` e em `errorSignature`:
   * ao contrário do caso OOM × disco, os dois detectores NÃO são disjuntos
   * neste fixture, então reordenar as linhas quebra aqui.
   */
  const ambos = STDERR_DISCO_REAL + "\n" + STDERR_ESCRITA_REAL;
  assert.equal(ehDiscoCheio(ambos), true, "o fixture precisa casar os DOIS detectores");
  assert.equal(ehEscritaDeCheckpointFalhou(ambos), true, "o fixture precisa casar os DOIS");
  assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO, { stderr: ambos }), "infra_disk");
  assert.equal(
    errorSignature("training", ERROR_MESSAGE_GRAVADO, { stderr: ambos }),
    ASSINATURA_DISCO_CHEIO,
  );
  assert.match(
    incidentTitle("training", ERROR_MESSAGE_GRAVADO, { stderr: ambos }),
    /disco cheio/i,
  );
});

test("falha CEGA continua 'bug': escrita truncada não é palpite para quem não tem stderr", () => {
  // As 70 falhas sem stderr não podem ganhar causa nova por causa deste PR.
  for (const diag of [
    undefined,
    {},
    { stderr: null },
    { stderr: "" },
    { stderr: null, returncode: 1 },
  ]) {
    assert.equal(ehEscritaDeCheckpointFalhou(diag?.stderr), false);
    assert.equal(classifyCause(ERROR_MESSAGE_GRAVADO, diag), "bug");
    assert.equal(errorSignature("training", ERROR_MESSAGE_GRAVADO, diag), ASSINATURA_DO_11);
    assert.equal(
      incidentTitle("training", ERROR_MESSAGE_GRAVADO, diag),
      incidentTitle("training", ERROR_MESSAGE_GRAVADO),
    );
  }
});

test("erro vazio sem diagnóstico continua 'unknown' com o detector novo na guarda", () => {
  // A guarda `!e` ganhou um terceiro detector; ela não pode ter passado a
  // classificar erro vazio sem prova nenhuma.
  assert.equal(classifyCause("", { stderr: null, returncode: 1 }), "unknown");
  assert.equal(classifyCause("", { stderr: "" }), "unknown");
  assert.equal(classifyCause("", undefined), "unknown");
});

test("erro de dataset continua ganhando do diagnóstico de escrita truncada", () => {
  // Mesma precedência das outras duas. A guarda por CAUSA em errorSignature
  // impede a chave inconsistente `training:user_dataset:write-failed`.
  const erroAluno = "insufficient_audio: only 4s of usable speech";
  assert.equal(classifyCause(erroAluno, { stderr: STDERR_ESCRITA_REAL }), "user_dataset");
  assert.equal(
    errorSignature("training", erroAluno, { stderr: STDERR_ESCRITA_REAL }),
    errorSignature("training", erroAluno),
  );
  assert.doesNotMatch(
    errorSignature("training", erroAluno, { stderr: STDERR_ESCRITA_REAL }),
    /write-failed/,
  );
});
