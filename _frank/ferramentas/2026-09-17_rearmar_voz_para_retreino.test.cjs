/**
 * Testes da prova de causa do rearme. Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/2026-09-17_rearmar_voz_para_retreino.test.cjs
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca só o código de saída (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que não RODOU também sai com exit 0.
 *
 * ── De onde vêm os casos ──────────────────────────────────────────────────
 * Nenhum é inventado. Os quatro saíram de `training_jobs` em produção, lidos
 * em 18/09/2026 durante a ronda que destravou o #32 (`9119254c`):
 *
 *   b76f9ec0  18/09 09:17Z  Alexandre Scalzitti  stderr NULL, rc NULL,
 *                           error_message = "[Errno 28] No space left on device"
 *   76cdefc2  10/08 10:39Z  (a 1ª ocorrência do #32)   idem
 *   bbf4b050  17/09 21:27Z  Alberto Martins      stderr 2000 chars COM a marca,
 *                           rc = 1, error_message = "trainer failed"
 *
 * As duas formas importam porque a ferramenta nasceu enxergando só a forma A
 * (stderr) — e as DUAS ocorrências do #32, que é a classe pra qual ela existe,
 * são da forma B. O falso negativo deixou o pedido SGP `251b2b1e` parado em
 * `falhou`, sem saída, com a tela prometendo "o retreino é por nossa conta".
 *
 * A última seção roda o código VELHO (a linha original, copiada) contra os
 * MESMOS casos e prova que ele reprova. Teste que passa nos dois lados não
 * prova nada.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { INFRA, acharInfra } = require("./2026-09-17_rearmar_voz_para_retreino.cjs");

/** Forma B: morreu antes do trainer subir. Medido em b76f9ec0 e 76cdefc2. */
const FORMA_B = {
  id: "b76f9ec0-f522-401e-b3bd-fa258a885e7c",
  started_at: null,
  trainer_returncode: null,
  trainer_stderr: null,
  trainer_stdout: null,
  error_message: "[Errno 28] No space left on device",
};

/** Forma A: o trainer subiu e morreu no meio. Medido em bbf4b050. */
const FORMA_A = {
  id: "bbf4b050-3993-4c46-bdaa-02eb081437aa",
  started_at: null,
  trainer_returncode: 1,
  trainer_stderr:
    "Traceback (most recent call last):\n  ...\nOSError: [Errno 28] No space left on device\n",
  trainer_stdout: "",
  error_message: "trainer failed",
};

test("forma B: acha a marca em error_message quando não existe stderr", () => {
  const achado = acharInfra(FORMA_B);
  assert.ok(achado, "tem de reconhecer — a causa está escrita, só não no stderr");
  assert.equal(achado.causa, "disco cheio no worker");
  assert.equal(achado.coluna, "error_message");
});

test("forma A: continua achando no stderr, e prefere o stderr", () => {
  const achado = acharInfra(FORMA_A);
  assert.ok(achado);
  assert.equal(achado.causa, "disco cheio no worker");
  assert.equal(
    achado.coluna,
    "trainer_stderr",
    "com as duas colunas preenchidas, a do trainer é a mais específica",
  );
});

test("OOM de GPU vale nas duas colunas", () => {
  assert.equal(acharInfra({ trainer_stderr: "torch.OutOfMemoryError: CUDA" }).causa, "OOM de GPU");
  assert.equal(acharInfra({ error_message: "CUDA out of memory" }).causa, "OOM de GPU");
});

test("a lista é FECHADA: mensagem genérica não vira licença pra gastar GPU", () => {
  // Esta é a trava que não pode afrouxar. "trainer failed" sozinho (sem stderr)
  // é exatamente a causa cega que a recusa existe pra barrar.
  assert.equal(acharInfra({ error_message: "trainer failed", trainer_stderr: null }), null);
  assert.equal(acharInfra({ error_message: "unknown" }), null);
  assert.equal(acharInfra({ error_message: "audio muito curto para treinar" }), null);
  assert.equal(acharInfra({}), null);
  assert.equal(acharInfra(null), null);
});

test("caixa não decide o destino do aluno", () => {
  assert.equal(acharInfra({ error_message: "[errno 28] no space left on device" }).causa, "disco cheio no worker");
});

/**
 * Forma C: o MESMO disco cheio, na língua do torch. Medido em c7a376e5
 * (18/09 22:40Z, Tati, tatidermaestetica@). Trecho literal do banco, cortado
 * só no comprimento — não é reescrito.
 *
 * Importa porque é o vão que fez a trava recusar um caso que era nosso: o
 * safetensors (linha 777) entrega "No space left on device"; o torch.save da
 * linha 814 engole o errno e só diz "file write failed".
 */
const FORMA_C = {
  id: "c7a376e5-4ade-4e96-a96d-a27c0d1f2246",
  trainer_returncode: 1,
  trainer_stderr:
    '[train] step 120: loss/diff: 0.987212, loss/stop: 0.000106\n' +
    "Traceback (most recent call last):\n" +
    '  File "/usr/local/lib/python3.12/dist-packages/torch/serialization.py", line 1268, in _save\n' +
    "    zip_file.write_record(name, storage, num_bytes)\n" +
    "RuntimeError: [enforce fail at inline_container.cc:858] . " +
    "PytorchStreamWriter failed writing file data/1004: file write failed\n" +
    "During handling of the above exception, another exception occurred:\n" +
    '  File "/app/VoxCPM/scripts/train_voxcpm_finetune.py", line 814, in save_checkpoint\n' +
    '    torch.save(optimizer.state_dict(), folder / "optimizer.pth")\n' +
    "RuntimeError: [enforce fail at inline_container.cc:664] . unexpected pos 131040192 vs 131040080\n",
  error_message: "trainer failed",
};

test("forma C: disco cheio na língua do torch também é infra nossa", () => {
  const achado = acharInfra(FORMA_C);
  assert.ok(achado, "sem isto a Tati fica sem voz por um disco que é nosso");
  assert.equal(achado.coluna, "trainer_stderr");
  assert.match(achado.causa, /escrita do checkpoint/);
});

test("a marca nova NÃO afrouxa a lista fechada", () => {
  // O perigo de admitir a forma C é casar em pedaço solto de I/O. Estas quatro
  // mencionam escrita/posição/stream e NÃO são a falha do checkpoint.
  assert.equal(acharInfra({ trainer_stderr: "could not write log file" }), null);
  assert.equal(acharInfra({ trainer_stderr: "file write failed" }), null, "solta demais: tem de exigir a frase inteira");
  assert.equal(acharInfra({ trainer_stderr: "unexpected position in stream" }), null);
  assert.equal(acharInfra({ trainer_stderr: "PytorchStreamWriter opened file lora.safetensors" }), null);
});

test("MUTAÇÃO — o código VELHO (só stderr) reprova nos casos reais do #32", () => {
  // Cópia literal da linha original, antes do conserto de 18/09.
  const velho = (job) => {
    const stderr = job?.trainer_stderr || "";
    return INFRA.find((i) => stderr.includes(i.marca)) || null;
  };
  assert.equal(velho(FORMA_B), null, "é este o falso negativo que travou o Alexandre");
  assert.equal(velho(FORMA_A)?.causa, "disco cheio no worker", "o velho só acertava a forma A");

  // E o novo tem de acertar as duas — senão o conserto não é conserto.
  assert.ok(acharInfra(FORMA_B));
  assert.ok(acharInfra(FORMA_A));
});
