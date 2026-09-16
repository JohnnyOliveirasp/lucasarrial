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
  ehCudaOom,
  notaDeTransitoriedade,
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
