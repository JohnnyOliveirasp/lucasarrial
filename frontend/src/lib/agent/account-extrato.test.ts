/**
 * O extrato que a Fast recebe precisa deixar ESTORNO visível. Rodar:
 *   node --test src/lib/agent/account-extrato.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (#260 / `5009d7ab`, medido em 07/09/2026).
 *
 * Em 04/09 a Fast escreveu a uma aluna PAGANTE "seus créditos já foram
 * estornados automaticamente". Não havia estorno nenhum. O commit `8405eb0`
 * tirou do manual a promessa categórica que autorizava a frase e pôs no lugar
 * uma ordem clara: só afirme que o estorno saiu se você VIR a linha no extrato
 * da pessoa; se não vir, escale.
 *
 * Só que a Fast NÃO TINHA COMO VER. O bloco CONTA DO ALUNO mandava as 6
 * últimas linhas de `credit_transactions` com `kind, amount, note, created_at`
 * — e `kind` MENTE sobre estorno:
 *
 *   estorno é gravado com `kind = 'extra_purchase'`.
 *
 * Medido na base em 07/09: 668 linhas de estorno, TODAS com esse `kind`, em 8
 * `ref_type` distintos — video_clone_refund 216, image_refund 169,
 * image_video_refund 78, generation_refund 72, voice_train_refund 67,
 * studio_scene_refund 40, support_refund 14, studio_audio_refund 12.
 *
 * Ou seja: sem `ref_type`, um estorno chegava na Fast indistinguível de uma
 * COMPRA de crédito. A instrução do manual virava impossível de cumprir — ela
 * só podia escalar, inclusive quando o estorno estava ali na frente. E, no
 * outro sentido, "extra_purchase" convida a leitura oposta: dizer à pessoa que
 * ela comprou crédito quando o que houve foi devolução.
 *
 * É a mesma armadilha que já quase pagou 13 alunos em dobro em 18/08:
 * **estorno se confere por `ref_type`, NUNCA por `kind`.** Se alguém tirar o
 * `ref_type` do select ou da renderização, este teste cai antes de a Fast
 * voltar a falar errado com aluno sobre dinheiro.
 *
 * Lê o FONTE (padrão do `manual.test.ts` / #215): `account.ts` importa por
 * alias `@/`, que o runner nativo do Node não resolve sem loader, e o que se
 * quer proteger aqui são duas linhas literais.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FONTE = readFileSync(
  fileURLToPath(new URL("./account.ts", import.meta.url)),
  "utf8",
);

/** A chamada que busca o extrato, isolada do resto do arquivo. */
function selectDoExtrato(): string {
  const i = FONTE.indexOf('admin.from("credit_transactions")');
  assert.notEqual(
    i,
    -1,
    "sumiu a busca de credit_transactions em account.ts — se mudou de forma, ajuste este teste junto",
  );
  return FONTE.slice(i, FONTE.indexOf("\n", i));
}

test("o extrato da Fast traz ref_type (sem ele, estorno é invisível)", () => {
  const select = selectDoExtrato();
  assert.match(
    select,
    /\bref_type\b/,
    "o select do extrato perdeu ref_type — a Fast volta a ver todo estorno como 'extra_purchase'",
  );
});

test("o extrato continua trazendo o que já trazia (não trocar um campo pelo outro)", () => {
  const select = selectDoExtrato();
  for (const campo of ["kind", "amount", "note", "created_at"]) {
    assert.match(select, new RegExp(`\\b${campo}\\b`), `o select perdeu ${campo}`);
  }
});

test("ref_type é RENDERIZADO, não só buscado", () => {
  // Buscar e não imprimir seria pior que não buscar: custa a consulta e a Fast
  // continua cega. O prompt só enxerga o que entra em txLines.
  const i = FONTE.indexOf("const txLines");
  assert.notEqual(i, -1, "sumiu a montagem de txLines");
  const bloco = FONTE.slice(i, FONTE.indexOf(".join(", i));
  assert.match(
    bloco,
    /\bref_type\b/,
    "ref_type é buscado mas não aparece na linha montada — a Fast continua sem enxergar estorno",
  );
});
