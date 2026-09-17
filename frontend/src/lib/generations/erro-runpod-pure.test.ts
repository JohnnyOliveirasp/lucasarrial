/**
 * Testes do NOME ÚNICO da falha do RunPod (#457/e811cbc7, #461).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/generations/erro-runpod-pure.test.ts
 *
 * O QUE ESTÁ COBERTO:
 *   (A) a ordem de preferência do texto não mudou — a função é EXTRAÇÃO do que
 *       o webhook já fazia, e o teste trava isso byte a byte (se alguém "mudar
 *       o rótulo pra não parecer sucesso", a assinatura do incidente muda junto
 *       e o histórico racha — ver classify.ts);
 *   (B) a CONSEQUÊNCIA que motivou o cartão: o texto que o poll passa a gravar
 *       casa `ehFalhaTransitoria` e portanto GANHA o reenvio de graça, enquanto
 *       o texto antigo ("unknown") NÃO casava. Este é o par que prova o bug;
 *   (C) controles negativos: `RunPod FAILED/CANCELLED/TIMED_OUT` continuam
 *       FORA do reenvio — só COMPLETED tem a propriedade "a plataforma disse
 *       que deu certo e não veio arquivo";
 *   (D) tripwires: os DOIS routes realmente chamam a função compartilhada e
 *       não voltaram pras expressões soltas. Sem isto, reverter a linha do poll
 *       passaria despercebido — testar o route handler inteiro exigiria subir
 *       meio Next, então a trava é na fonte (mesmo recurso de
 *       `sgp/identidade-pure.test.ts`).
 *
 * O QUE ESTE ARQUIVO NÃO PROVA: que a assinatura do incidente passa a ser a
 * mesma nos dois caminhos. Isso é `errorSignature` (lib/incidents/classify.ts)
 * e foi conferido por leitura + contra o banco de produção (o #457 está gravado
 * com `signature = "generation:unknown:runpod completed"`), NÃO por teste —
 * `classify.test.ts` hoje nem executa: `classify.ts` importa
 * "./diagnostico-trainer" sem extensão e o arquivo inteiro morre em
 * ERR_MODULE_NOT_FOUND no `node --test`. Isso é anterior a esta mudança e está
 * reportado à parte; importá-lo aqui mataria ESTE arquivo junto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mensagemFalhaRunpod } from "./erro-runpod-pure.ts";
import { ehFalhaTransitoria } from "./execucao.ts";

// ------------------------------------------------ (A) o texto, byte a byte

test("(A1) erro do worker ganha de tudo", () => {
  assert.equal(
    mensagemFalhaRunpod("CUDA out of memory", "erro do job", "FAILED"),
    "CUDA out of memory",
  );
});

test("(A2) sem erro do worker, vale o erro do job", () => {
  assert.equal(
    mensagemFalhaRunpod(undefined, "System error.", "FAILED"),
    "System error.",
  );
});

/**
 * O CASO DO #457. Chegar no caminho de falha com COMPLETED e sem nenhum dos
 * dois erros significa, por construção, `out.uploaded` falsy: a plataforma
 * disse que deu certo e não veio arquivo.
 */
test("(A3) sem erro nenhum, o nome é o status cru — 'RunPod COMPLETED'", () => {
  assert.equal(mensagemFalhaRunpod(undefined, undefined, "COMPLETED"), "RunPod COMPLETED");
  assert.equal(mensagemFalhaRunpod(null, null, "COMPLETED"), "RunPod COMPLETED");
});

/**
 * `||` e não `??` — a diferença que existia entre os dois caminhos. Com `??`,
 * um erro de string VAZIA era gravado como erro vazio, e erro vazio vira a
 * assinatura cega `generation:unknown:` (classify.ts avisa que isso "desabaria
 * todas num único unknown").
 */
test("(A4) string vazia não vira error_message vazio", () => {
  assert.equal(mensagemFalhaRunpod("", "", "COMPLETED"), "RunPod COMPLETED");
  assert.equal(mensagemFalhaRunpod("", "System error.", "COMPLETED"), "System error.");
});

test("(A5) os outros status mantêm o texto de sempre", () => {
  assert.equal(mensagemFalhaRunpod(undefined, undefined, "FAILED"), "RunPod FAILED");
  assert.equal(mensagemFalhaRunpod(undefined, undefined, "CANCELLED"), "RunPod CANCELLED");
  assert.equal(mensagemFalhaRunpod(undefined, undefined, "TIMED_OUT"), "RunPod TIMED_OUT");
});

// ------------------------------- (B) a consequência: quem ganha reenvio

/**
 * O PAR QUE PROVA O BUG. Os dois caminhos viam a MESMA falha (o gate de
 * sucesso é idêntico: COMPLETED && !out.error && out.uploaded), mas só o nome
 * do webhook ganhava reenvio. Medido em produção: a aluna
 * semeadorriquezas@gmail.com caiu nos dois lados em 43 minutos — 21:25:16 pelo
 * poll (geração 9ada4b25, "unknown", `request_attempts = 1`, estornada) e
 * 22:08:27 pelo webhook ("RunPod COMPLETED", com reenvio).
 */
test("(B1) o nome NOVO do poll ganha reenvio automático", () => {
  const nome = mensagemFalhaRunpod(undefined, undefined, "COMPLETED");
  assert.equal(ehFalhaTransitoria(nome), true, "COMPLETED sem upload tem que reenviar");
});

test("(B2) CONTROLE: o nome VELHO do poll ('unknown') não ganhava reenvio", () => {
  assert.equal(
    ehFalhaTransitoria("unknown"),
    false,
    "se isto virar true, alguém pôs 'unknown' em TRANSITORIAS — genérico demais, casa erro alheio",
  );
});

// ---------------------------------------------- (C) controles negativos

/**
 * A ressalva escrita em execucao.ts: casar por "runpod completed", NUNCA por
 * "completed" solto nem "runpod" solto. O mesmo fallback gera FAILED,
 * CANCELLED e TIMED_OUT, e ESSES podem ser falha real.
 */
test("(C1) RunPod FAILED/CANCELLED/TIMED_OUT continuam fora do reenvio", () => {
  for (const status of ["FAILED", "CANCELLED", "TIMED_OUT"]) {
    const nome = mensagemFalhaRunpod(undefined, undefined, status);
    assert.equal(ehFalhaTransitoria(nome), false, `${nome} não pode ganhar reenvio de graça`);
  }
});

test("(C2) erro real do worker continua fora do reenvio", () => {
  const nome = mensagemFalhaRunpod("CUDA out of memory", undefined, "FAILED");
  assert.equal(ehFalhaTransitoria(nome), false, "OOM não é transitória — repetir só faz esperar em dobro");
});

// --------------------------------------------------------- (D) tripwires

const AQUI = import.meta.dirname;

test("(D1) o POLL grava a string compartilhada, não mais 'unknown'", () => {
  const fonte = readFileSync(
    join(AQUI, "..", "..", "app", "api", "v1", "generations", "[id]", "route.ts"),
    "utf8",
  );
  assert.match(
    fonte,
    /mensagemFalhaRunpod\(\s*out\.error,\s*resp\.error,\s*resp\.status\s*\)/,
    "o poll não está montando o erro pela função compartilhada",
  );
  assert.doesNotMatch(
    fonte,
    /out\.error\s*\?\?\s*"unknown"/,
    "voltou o 'unknown' solto — é exatamente o bug do #457/#461",
  );
});

test("(D2) o WEBHOOK passou a usar a mesma função, sem mudar o texto", () => {
  const fonte = readFileSync(
    join(AQUI, "..", "..", "app", "api", "v1", "webhooks", "runpod", "route.ts"),
    "utf8",
  );
  assert.match(
    fonte,
    /mensagemFalhaRunpod\(\s*out\.error,\s*payload\.error,\s*payload\.status\s*\)/,
    "o webhook não está montando o erro pela função compartilhada",
  );
});
