/**
 * Testes de regressão do DELETE em massa do histórico (incidente 1970fcaa).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/images/refs-pure.test.ts
 *
 * O defeito coberto: o DELETE de /api/v1/images mandava pro deleteKeys TUDO
 * que a row referenciava — inclusive a chave adotada em `{user}/refs/`, que
 * é COMPARTILHADA (outras gerações e a referência fixa do estúdio apontam
 * pra mesma foto). Medido em 22/08: 60 refs mortas, 17 alunos, 181 gerações
 * vivas com referência quebrada. O cabeçalho de refs.ts sempre prometeu
 * "refs/ sobrevive ao DELETE do histórico"; agora o filtro existe e é este.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chavesApagaveisDoHistorico,
  ehReferenciaSalva,
  refsPrefix,
} from "./refs-pure.ts";

const USER = "u-aluna";

test("apagar a geração A não derruba a referência usada pela geração B", () => {
  const refCompartilhada = `${USER}/refs/ab12cd34_foto.jpg`;
  // A aluna apaga só a geração A; a geração B (não selecionada) usa a MESMA ref.
  const rowA = {
    input_image_paths: [refCompartilhada],
    input_image_path: null,
    image_path: `${USER}/images/gen-a/result.png`,
    video_path: null,
  };
  const keys = chavesApagaveisDoHistorico(USER, [rowA]);
  assert.ok(!keys.includes(refCompartilhada), "a chave de refs/ NÃO pode ir pro deleteKeys");
  assert.ok(keys.includes(`${USER}/images/gen-a/result.png`), "o resultado da própria geração sai");
});

test("resultado, vídeo e staging saem; refs/ fica — em todas as colunas", () => {
  const row = {
    // ref adotada no array novo E na coluna legada singular
    input_image_paths: [`${USER}/refs/aa_1.jpg`, `${USER}/images/gen-1/input_b.jpg`],
    input_image_path: `${USER}/refs/bb_2.jpg`,
    image_path: `${USER}/images/gen-1/result.png`,
    video_path: `${USER}/images/gen-1/video.mp4`,
  };
  const keys = chavesApagaveisDoHistorico(USER, [row]);
  assert.deepEqual(
    [...keys].sort(),
    [
      `${USER}/images/gen-1/input_b.jpg`,
      `${USER}/images/gen-1/result.png`,
      `${USER}/images/gen-1/video.mp4`,
    ].sort(),
  );
});

test("refs/ de OUTRO usuário não é tratada como salva (guarda é por dono)", () => {
  // Não deveria acontecer (o SELECT filtra por user_id), mas a guarda é
  // literal: só protege o refs/ do PRÓPRIO dono, igual às guardas irmãs
  // (apagarStagingAdotado, apagarReferencia).
  assert.equal(ehReferenciaSalva(USER, `${USER}/refs/x.jpg`), true);
  assert.equal(ehReferenciaSalva(USER, `outro-user/refs/x.jpg`), false);
  assert.equal(refsPrefix(USER), `${USER}/refs/`);
});

test("chaves duplicadas entre rows saem deduplicadas; null/vazio não passam", () => {
  const shared = `${USER}/images/gen-1/input_c.jpg`;
  const rows = [
    { input_image_paths: [shared], input_image_path: null, image_path: null, video_path: null },
    { input_image_paths: null, input_image_path: shared, image_path: "", video_path: null },
  ];
  const keys = chavesApagaveisDoHistorico(USER, rows);
  assert.deepEqual(keys, [shared]);
});

test("row só com refs/ resulta em lista vazia (nada pro deleteKeys)", () => {
  const rows = [
    {
      input_image_paths: [`${USER}/refs/cc_3.jpg`],
      input_image_path: null,
      image_path: null,
      video_path: null,
    },
  ];
  assert.deepEqual(chavesApagaveisDoHistorico(USER, rows), []);
});
