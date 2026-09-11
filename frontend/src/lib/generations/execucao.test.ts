/**
 * Testes do teto de execução + do gatilho do reenvio (#15).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/generations/execucao.test.ts
 *
 * O que está coberto:
 *   1. a régua do teto não mudou ao sair da rota pro módulo compartilhado —
 *      é a mesma que o reenvio usa, senão as duas saem do ar uma da outra;
 *   2. o estouro do teto é reconhecido nas duas formas em que o erro chega
 *      (webhook cru e poll prefixado), e NUNCA num erro de worker;
 *   3. a CLASSE que ganha reenvio (`ehFalhaTransitoria`) inclui a exaustão da
 *      QA de cobertura (#52, 11/09) nas duas variantes da string, e continua
 *      excluindo OOM/CUDA, erro de modelo e áudio inválido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehFalhaTransitoria,
  ehTimeoutDeExecucao,
  inferenceExecutionTimeoutMs,
} from "./execucao.ts";

test("teto: piso de 8 min vale pra texto curto", () => {
  assert.equal(inferenceExecutionTimeoutMs(1), 8 * 60 * 1000);
  assert.equal(inferenceExecutionTimeoutMs(206), 8 * 60 * 1000); // caso 28/08
});

test("teto: reserva de setup + 40s por pedaço de 160 chars quando passa do piso", () => {
  // 2.567 chars = 17 pedaços → 360s + 680s = 1.040s
  assert.equal(inferenceExecutionTimeoutMs(2567), (360 + 17 * 40) * 1000);
});

/**
 * A GUARDA DO #15, e o motivo dela — não é teste de aritmética.
 *
 * O estouro que sobrou no #15 não é chunk pendurado: é pico de setup comendo a
 * base fixa do teto. O que mata a geração é o que sobra POR CHUNK depois que o
 * setup cobra a parte dele:
 *
 *     sobra_por_chunk = (reserva_setup − setup_real) / chunks + segundos_por_chunk
 *
 * Medido em 10/09 (n=279 desde 05/09): setup máx 260,7s, e o p95 de
 * segundos-por-chunk na faixa longa (9–12 chunks) é 34,4s. A régua antiga
 * (300s + 30s/chunk) dava 34,0s/chunk no pico de setup — ABAIXO do p95 da
 * própria frota, ou seja cara ou coroa. Este teste trava a propriedade: mesmo
 * no pior setup já visto, um texto longo tem que ter folga contra o p95.
 *
 * Se alguém apertar a régua e este teste cair, o número não é o problema — a
 * conta acima é. Re-meça setup e s/chunk ANTES de mexer nas constantes.
 */
test("#15: no pior setup já medido, texto longo ainda tem folga contra o p95 de s/chunk", () => {
  const SETUP_PIOR_MEDIDO_S = 260.7; // 09/09 16:11, geração 873fcee4
  const P95_SEGUNDOS_POR_CHUNK = 34.4; // faixa 9–12 chunks, n=279

  for (const chunks of [9, 10, 13, 17]) {
    const textLen = chunks * 160; // exatamente `chunks` pedaços
    const tetoS = inferenceExecutionTimeoutMs(textLen) / 1000;
    const sobraPorChunk = (tetoS - SETUP_PIOR_MEDIDO_S) / chunks;

    assert.ok(
      sobraPorChunk > P95_SEGUNDOS_POR_CHUNK,
      `${chunks} chunks: sobra ${sobraPorChunk.toFixed(1)}s/chunk contra p95 de ` +
        `${P95_SEGUNDOS_POR_CHUNK}s — a régua voltou a ser cara ou coroa no pico de setup`,
    );
  }
});

test("#15: a régua antiga (300s + 30s/chunk) FALHA essa mesma guarda", () => {
  // Controle negativo: sem isto, o teste acima passaria por acidente e ninguém
  // saberia que ele tem poder de reprovar. A régua velha é o caso conhecido-ruim.
  const antiga = (textLen: number) => {
    const chunks = Math.max(1, Math.ceil(textLen / 160));
    return Math.max(8 * 60, 5 * 60 + chunks * 30);
  };
  const chunks = 10;
  const sobraPorChunk = (antiga(chunks * 160) - 260.7) / chunks;
  assert.ok(
    sobraPorChunk < 34.4,
    "a régua antiga deveria reprovar aqui — se ela passa, a conta da guarda mudou",
  );
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

/**
 * #52 (37bacb68, 23 dias aberto, 19 alunos): quando a QA de cobertura esgota as
 * regenerações, a geração inteira morria e o aluno refazia NA MÃO.
 *
 * A justificativa está medida, não suposta: das 8 falhas em que o aluno
 * reenviou o texto IDÊNTICO, 7 saíram ready (9 sucessos contra 3 falhas). A
 * geração 67f28d0f (355 chars) falhou 20:53Z e o MESMO texto saiu ready em
 * 109s às 20:58Z. Chunk alucinado é sorteio do modelo, não propriedade do
 * texto — logo cabe na classe "não é material do aluno, vale refazer".
 *
 * As DUAS variantes abaixo são as únicas que existem no banco. Se alguém
 * trocar o casamento por algo mais estreito (a mensagem inteira, por exemplo),
 * a variante prefixada do poll para de casar e metade dos casos volta a
 * morrer sem reenvio — por isso as duas estão travadas aqui.
 */
test("#52: exaustão da QA de cobertura ganha reenvio nas DUAS variantes da string", () => {
  assert.ok(
    ehFalhaTransitoria(
      "qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes",
    ),
    "variante crua (webhook) deveria ser transitória",
  );
  assert.ok(
    ehFalhaTransitoria(
      "RunPod FAILED: qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes",
    ),
    "variante prefixada (poll) deveria ser transitória",
  );
  // com o sufixo de fase que errorMessageComFase acrescenta
  assert.ok(
    ehFalhaTransitoria(
      "qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes [fase: tts_chunk 2/3]",
    ),
  );
});

/**
 * CONTROLE — a fronteira é fina e tem que continuar existindo.
 *
 * "Áudio que não cobre o texto porque o modelo sorteou mal" (qa_coverage)
 * entra; "áudio que não presta" e erro de worker continuam FORA, porque aí
 * repetir só faz o aluno esperar em dobro pelo mesmo defeito. Sem este teste,
 * alargar o casamento pra "audio"/"incompleto" passaria despercebido.
 */
test("#52: OOM/CUDA, erro de modelo e áudio inválido continuam FORA do reenvio", () => {
  for (const erro of [
    "CUDA out of memory",
    "RunPod FAILED: CUDA out of memory",
    "torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB",
    "RunPod FAILED",
    "O áudio saiu incompleto (mais curto que o texto).",
    "invalid audio file",
    "Error loading model checkpoint",
  ]) {
    assert.equal(
      ehFalhaTransitoria(erro),
      false,
      `"${erro}" NÃO pode ganhar reenvio automático`,
    );
  }
});

test("#52: a classe transitória de 29/08 segue intacta (nada foi trocado por qa_coverage)", () => {
  assert.ok(ehFalhaTransitoria("RunPod FAILED: executionTimeout exceeded"));
  assert.ok(ehFalhaTransitoria("failed to download lora"));
  assert.ok(ehFalhaTransitoria("Connection reset by peer"));
  assert.ok(ehFalhaTransitoria("503 Service Unavailable"));
});
