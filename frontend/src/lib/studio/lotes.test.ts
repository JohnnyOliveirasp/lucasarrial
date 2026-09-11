/**
 * Testes do teto de concorrência do poll de cenas (#358, perna 2).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/studio/lotes.test.ts
 *
 * O DEFEITO COBERTO: `GET /api/v1/studio/[id]` fazia `Promise.all` sobre TODAS
 * as cenas pendentes do projeto. Com 48 cenas (caso medido em produção 11/09),
 * são 48 chamadas simultâneas ao Kie por tick — a rajada que gera o 429.
 *
 * ⚠️ O teste que importa é o do TETO: um helper que só fatia a lista mas
 * `await`-a tudo junto passaria nos testes de ordem e de resiliência do mesmo
 * jeito. Quem separa o certo do errado é `nunca mais de N em voo ao mesmo
 * tempo`, medido com um contador de concorrência ao vivo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { emLotes, fatiar } from "./lotes.ts";

/** Promise que só resolve quando a gente mandar — controla o "em voo". */
function represa<T>() {
  let liberar!: (v: T) => void;
  const promessa = new Promise<T>((r) => {
    liberar = r;
  });
  return { promessa, liberar };
}

test("fatiar respeita o tamanho e preserva a ordem", () => {
  assert.deepEqual(fatiar([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(fatiar([1, 2, 3, 4], 4), [[1, 2, 3, 4]]);
  assert.deepEqual(fatiar([], 4), []);
});

test("fatiar não entra em laço infinito com tamanho inválido", () => {
  // 0 / negativo / fracionário viram 1 — sem isto o `i += 0` do chamador
  // travaria o processo em vez de dar erro.
  assert.deepEqual(fatiar([1, 2], 0), [[1], [2]]);
  assert.deepEqual(fatiar([1, 2], -3), [[1], [2]]);
  assert.deepEqual(fatiar([1, 2, 3], 2.7), [[1, 2], [3]]);
});

test("emLotes devolve os resultados na ordem de ENTRADA, não na de término", async () => {
  // O item 0 termina por último de propósito: se a saída viesse na ordem de
  // conclusão, o 'a' cairia no fim.
  const atrasos = [30, 20, 10, 0];
  const saida = await emLotes(["a", "b", "c", "d"], 4, async (item, i) => {
    await new Promise((r) => setTimeout(r, atrasos[i]));
    return item.toUpperCase();
  });
  assert.deepEqual(saida, ["A", "B", "C", "D"]);
});

test("emLotes passa o índice global (não o índice dentro do lote)", async () => {
  const vistos: number[] = [];
  await emLotes(["a", "b", "c", "d", "e"], 2, async (_item, i) => {
    vistos.push(i);
    return i;
  });
  assert.deepEqual(vistos, [0, 1, 2, 3, 4]);
});

test("emLotes NUNCA passa do teto de concorrência", async () => {
  const TETO = 4;
  const TOTAL = 48; // o caso real do incidente
  let emVoo = 0;
  let pico = 0;
  const portoes: Array<(v: unknown) => void> = [];

  const rodada = emLotes(
    Array.from({ length: TOTAL }, (_, i) => i),
    TETO,
    async (n) => {
      emVoo += 1;
      pico = Math.max(pico, emVoo);
      const { promessa, liberar } = represa<unknown>();
      portoes.push(liberar);
      await promessa;
      emVoo -= 1;
      return n;
    },
  );

  // Solta os portões aos poucos; a cada volta do event loop confere que o
  // helper não encheu a fila além do teto.
  for (let i = 0; i < TOTAL; i += 1) {
    await new Promise((r) => setImmediate(r));
    assert.ok(emVoo <= TETO, `em voo ${emVoo} passou do teto ${TETO}`);
    portoes[i]?.(undefined);
  }
  await new Promise((r) => setImmediate(r));
  portoes.forEach((p) => p(undefined));

  const saida = await rodada;
  assert.equal(saida.length, TOTAL);
  assert.equal(pico, TETO, `o pico de concorrência devia ser ${TETO}, foi ${pico}`);
  assert.equal(emVoo, 0);

  // PROVA DE NÃO-TAUTOLOGIA: o código ANTIGO (Promise.all em cima de tudo)
  // teria pico = 48 neste mesmo cenário. Reconstruído aqui pra mostrar que o
  // teste acima de fato separa um do outro.
  let emVooVelho = 0;
  let picoVelho = 0;
  await Promise.all(
    Array.from({ length: TOTAL }, async () => {
      emVooVelho += 1;
      picoVelho = Math.max(picoVelho, emVooVelho);
      await new Promise((r) => setImmediate(r));
      emVooVelho -= 1;
    }),
  );
  assert.equal(picoVelho, TOTAL);
  assert.ok(picoVelho > pico);
});

test("uma cena que falha não derruba o lote (uso real do poll, com o .catch por cena)", async () => {
  // Reproduz a chamada do route: `(s) => syncStudioScene(s).catch(() => {})`.
  const executadas: string[] = [];
  const sync = async (nome: string) => {
    executadas.push(nome);
    if (nome === "b" || nome === "e") throw new Error(`kie caiu em ${nome}`);
    return nome;
  };

  const saida = await emLotes(["a", "b", "c", "d", "e", "f"], 2, (nome) =>
    sync(nome).catch(() => undefined),
  );

  // Todas rodaram, inclusive as que vêm DEPOIS da que falhou.
  assert.deepEqual(executadas, ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(saida, ["a", undefined, "c", "d", undefined, "f"]);
});

test("emLotes com lista vazia não chama a fn", async () => {
  let chamou = 0;
  const saida = await emLotes([], 4, async () => {
    chamou += 1;
    return 1;
  });
  assert.deepEqual(saida, []);
  assert.equal(chamou, 0);
});
