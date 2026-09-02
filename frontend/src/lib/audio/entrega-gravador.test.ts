/**
 * Testes da régua de entrega do Gravador (incidente #235, Alana).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/entrega-gravador.test.ts
 *
 * O defeito coberto: a CTA "Enviar para treinamento" liberava contando áudio
 * que a tela de destino NÃO importa (clipe além do teto de 20 arquivos), e o
 * aluno caía num botão "Treinar" morto e sem explicação.
 *
 * As armadilhas que estes testes travam:
 *   - a CTA olha o APROVEITADO, nunca o total da barra;
 *   - o corte pelo teto tira os clipes MAIS CURTOS (mesma regra do destino);
 *   - `metaIlusoria` só acusa quando a barra bate e a entrega não — é ele que
 *     obriga a tela a explicar em vez de simplesmente sumir com o botão;
 *   - take de celular CONTA (o destino importa do R2) e não sofre o teto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ARQUIVOS_TREINO,
  resumirEntregaDoGravador,
  type ClipeDoGravador,
} from "./entrega-gravador.ts";

const META = 20 * 60;

/** n clipes de `secs` segundos. */
function clipes(n: number, secs: number): ClipeDoGravador[] {
  return Array.from({ length: n }, () => ({ seconds: secs }));
}

test("caminho feliz: poucos clipes longos batendo a meta liberam o envio", () => {
  const r = resumirEntregaDoGravador(clipes(5, 5 * 60), 0, META);
  assert.equal(r.totalGravado, 25 * 60);
  assert.equal(r.aproveitados, 25 * 60);
  assert.equal(r.clipesForaDoTeto, 0);
  assert.equal(r.liberaEnvio, true);
  assert.equal(r.metaIlusoria, false);
});

test("abaixo da meta não libera e não é ilusão — é só faltar áudio", () => {
  const r = resumirEntregaDoGravador(clipes(3, 60), 0, META);
  assert.equal(r.liberaEnvio, false);
  assert.equal(r.metaIlusoria, false);
});

test("O DEFEITO #235: 24 clipes curtos fecham a barra mas não a entrega", () => {
  // 24 × 55s = 22min na barra; o destino só importa os 20 maiores = 18min20s.
  const r = resumirEntregaDoGravador(clipes(24, 55), 0, META);
  assert.equal(r.totalGravado, 24 * 55);
  assert.equal(r.aproveitados, 20 * 55);
  assert.equal(r.clipesForaDoTeto, 4);
  assert.equal(r.segundosForaDoTeto, 4 * 55);
  assert.equal(r.liberaEnvio, false, "não pode liberar CTA que morre no destino");
  assert.equal(r.metaIlusoria, true, "a tela é obrigada a explicar este caso");
});

test("o corte pelo teto tira os clipes MAIS CURTOS, igual ao destino", () => {
  const lista = [...clipes(20, 120), ...clipes(3, 5)];
  const r = resumirEntregaDoGravador(lista, 0, META);
  assert.equal(r.clipesForaDoTeto, 3);
  assert.equal(r.segundosForaDoTeto, 15, "saíram os de 5s, não os de 120s");
  assert.equal(r.aproveitados, 20 * 120);
  assert.equal(r.liberaEnvio, true);
});

test("take de celular conta (o destino importa do R2) e não sofre o teto", () => {
  const r = resumirEntregaDoGravador(clipes(2, 60), 19 * 60, META);
  assert.equal(r.aproveitados, 2 * 60 + 19 * 60);
  assert.equal(r.liberaEnvio, true);
  assert.equal(r.clipesForaDoTeto, 0);
});

test("celular sozinho, sem nenhum clipe, também libera", () => {
  const r = resumirEntregaDoGravador([], META, META);
  assert.equal(r.aproveitados, META);
  assert.equal(r.liberaEnvio, true);
});

test("exatamente na meta libera (>=, não >)", () => {
  const r = resumirEntregaDoGravador(clipes(1, META), 0, META);
  assert.equal(r.liberaEnvio, true);
});

test("entrada suja não vira NaN nem segundo negativo", () => {
  const r = resumirEntregaDoGravador(
    [{ seconds: -30 }, { seconds: Number.NaN as unknown as number }, { seconds: 60 }],
    -10,
    META,
  );
  assert.equal(Number.isFinite(r.totalGravado), true);
  assert.equal(r.totalGravado, 60);
  assert.equal(r.aproveitados, 60);
  assert.equal(r.liberaEnvio, false);
});

test("lista vazia é um zero honesto, não um bloqueio mal explicado", () => {
  const r = resumirEntregaDoGravador([], 0, META);
  assert.deepEqual(r, {
    totalGravado: 0,
    aproveitados: 0,
    clipesForaDoTeto: 0,
    segundosForaDoTeto: 0,
    liberaEnvio: false,
    metaIlusoria: false,
  });
});

test("o teto é o mesmo número que o destino usa", () => {
  assert.equal(MAX_ARQUIVOS_TREINO, 20);
  const r = resumirEntregaDoGravador(clipes(MAX_ARQUIVOS_TREINO + 1, 60), 0, META);
  assert.equal(r.clipesForaDoTeto, 1);
});
