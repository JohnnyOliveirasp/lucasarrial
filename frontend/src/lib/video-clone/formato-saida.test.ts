/**
 * Teste do aviso de formato do Vídeo Clone (caso quaglioandre@gmail.com:
 * 8 clones, 43.360 créditos, todos "ready", partindo de foto deitada).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo). O `--import` é necessário
 * porque `formato-saida.ts` importa `./config` SEM extensão, como o resto do
 * código de produção — quem ensina o runner a resolver isso é o alias-loader:
 *   node --import ./test/alias-loader.mjs --test src/lib/video-clone/formato-saida.test.ts
 *
 * O que precisa ficar travado aqui:
 *   1. foto DEITADA (16:9) → aviso específico de corte;
 *   2. foto EM PÉ (9:16) → só o aviso genérico de formato, sem alarme falso;
 *   3. proporção desconhecida ("auto", nulo, lixo) → genérico, sem quebrar;
 *   4. o aviso NÃO desabilita nada — a regressão que importa, porque já temos
 *      reclamação de portão no #372 e recortar foto deitada é uso legítimo;
 *   5. o número do quadro sai de CLONE_TIERS, nunca de literal na tela (#414).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLONE_TIERS } from "./config.ts";
import {
  avisoDeFormato,
  formatoUnicoDaSaida,
  orientacaoDaImagem,
  type CloneTierLike,
} from "./formato-saida.ts";

test("orientação: os rótulos curados do acervo", () => {
  assert.equal(orientacaoDaImagem("16:9"), "horizontal");
  assert.equal(orientacaoDaImagem("3:2"), "horizontal");
  assert.equal(orientacaoDaImagem("9:16"), "vertical");
  assert.equal(orientacaoDaImagem("3:4"), "vertical");
  assert.equal(orientacaoDaImagem("2:3"), "vertical");
  assert.equal(orientacaoDaImagem("1:1"), "quadrada");
  // Legado que ainda existe em linhas antigas (opção saiu da UI em 03/08).
  assert.equal(orientacaoDaImagem("4:5"), "vertical");
});

test("orientação: a razão CRUA que o import grava quando a foto não bate com rótulo", () => {
  // /api/v1/images/import devolve `${w}:${h}` fora de ~3% de qualquer rótulo.
  assert.equal(orientacaoDaImagem("1600:1000"), "horizontal");
  assert.equal(orientacaoDaImagem("4032:3024"), "horizontal");
  assert.equal(orientacaoDaImagem("1080:1920"), "vertical");
});

test("orientação: sem dado NÃO vira chute", () => {
  assert.equal(orientacaoDaImagem("auto"), "desconhecida");
  assert.equal(orientacaoDaImagem(null), "desconhecida");
  assert.equal(orientacaoDaImagem(undefined), "desconhecida");
  assert.equal(orientacaoDaImagem(""), "desconhecida");
  assert.equal(orientacaoDaImagem("original"), "desconhecida");
  assert.equal(orientacaoDaImagem("16:0"), "desconhecida");
});

test("orientação: quase-quadrada não dispara alarme de corte", () => {
  // 1000×999 é quadrada aos olhos; sem a tolerância o aviso apareceria no
  // upload (dimensões cruas) e sumiria no refresh (rótulo salvo "1:1").
  assert.equal(orientacaoDaImagem("1000:999"), "quadrada");
  assert.equal(orientacaoDaImagem("999:1000"), "quadrada");
  // Fora da tolerância volta a ser deitada.
  assert.equal(orientacaoDaImagem("1200:1000"), "horizontal");
});

test("o quadro de saída vem de CLONE_TIERS e hoje é vertical", () => {
  const f = formatoUnicoDaSaida();
  assert.notEqual(f, null, "os tiers divergiram: a tela precisa parar de afirmar um quadro só");
  assert.equal(f!.vertical, true);
  assert.equal(f!.width, CLONE_TIERS[0].width);
  assert.equal(f!.height, CLONE_TIERS[0].height);
  // Todo tier sai no MESMO quadro — a foto é escolhida ANTES do tier.
  for (const t of CLONE_TIERS) {
    assert.equal(t.width, f!.width, `tier ${t.id} saiu de outro quadro`);
    assert.equal(t.height, f!.height, `tier ${t.id} saiu de outro quadro`);
    assert.ok(t.height > t.width, `tier ${t.id} não é vertical`);
  }
});

test("tier com outro quadro → não afirma número nenhum (em vez de mostrar o errado)", () => {
  const divergentes: CloneTierLike[] = [
    { id: "a", width: 480, height: 832 },
    { id: "b", width: 720, height: 1280 },
  ];
  assert.equal(formatoUnicoDaSaida(divergentes), null);
});

test("aviso: 16:9 → específico; 9:16 → só genérico; sem dado → genérico", () => {
  const deitada = avisoDeFormato("16:9");
  assert.equal(deitada.cortaLaterais, true);
  assert.notEqual(deitada.formato, null, "o aviso específico precisa do quadro pra citar");

  const emPe = avisoDeFormato("9:16");
  assert.equal(emPe.cortaLaterais, false);
  assert.notEqual(emPe.formato, null, "o genérico continua aparecendo");

  for (const sem of ["auto", null, undefined, "original"]) {
    const g = avisoDeFormato(sem);
    assert.equal(g.cortaLaterais, false, `"${sem}" não pode virar alarme`);
    assert.notEqual(g.formato, null, `"${sem}" ainda mostra o formato genérico`);
  }
});

/**
 * REGRESSÃO QUE IMPORTA: isto é AVISO, não portão.
 *
 * Não há renderizador de DOM neste projeto, então o travamento é na FONTE:
 * nenhuma expressão `disabled={…}` das telas do clone pode depender da
 * proporção da foto. Se alguém "melhorar" o aviso virando bloqueio, quebra
 * aqui. (Mutação conferida: incluir `cortaLaterais` num `disabled` faz falhar.)
 */
test("o aviso NUNCA desabilita botão nas telas do clone", () => {
  const raiz = join(import.meta.dirname, "..", "..");
  const telas = [
    "components/video-clone/clone-pickers.tsx",
    "components/video-clone/clone-studio.tsx",
    "components/edicao/clone-padrao.tsx",
  ];
  const proibidos = [
    "cortaLaterais",
    "avisoDeFormato",
    "orientacaoDaImagem",
    "formatoUnicoDaSaida",
    "aspectRatio",
    "aspect_ratio",
    "formato",
  ];

  let expressoesLidas = 0;
  for (const tela of telas) {
    const src = readFileSync(join(raiz, tela), "utf8");
    for (const expr of expressoesDisabled(src)) {
      expressoesLidas++;
      for (const p of proibidos) {
        assert.ok(
          !expr.includes(p),
          `${tela}: "disabled={${expr}}" passou a depender de "${p}" — aviso virou portão (#372)`,
        );
      }
    }
  }
  // Se o scanner deixar de achar `disabled=`, o teste acima passa à toa.
  assert.ok(expressoesLidas >= 3, `esperava achar disabled={…} nas 3 telas, achei ${expressoesLidas}`);
});

test("a tela do clone realmente consome o aviso (senão o guarda acima é vazio)", () => {
  const picker = readFileSync(
    join(import.meta.dirname, "..", "..", "components/video-clone/clone-pickers.tsx"),
    "utf8",
  );
  assert.ok(picker.includes("avisoDeFormato"), "clone-pickers.tsx parou de usar o aviso de formato");
  // O quadro nunca pode voltar a ser literal na tela (#414, #175/#178/#209).
  assert.ok(!/\b480\s*[×x]\s*832\b/.test(picker), "quadro 480×832 hardcoded na tela — importe de config.ts");
  assert.ok(!picker.includes("9:16"), 'proporção "9:16" hardcoded na tela — a saída é 480×832, que não é 9:16');
});

/** Extrai cada expressão dentro de `disabled={ … }`, com chaves balanceadas. */
function expressoesDisabled(src: string): string[] {
  const achados: string[] = [];
  const marca = "disabled={";
  let i = src.indexOf(marca);
  while (i !== -1) {
    let profundidade = 1;
    let j = i + marca.length;
    while (j < src.length && profundidade > 0) {
      if (src[j] === "{") profundidade++;
      else if (src[j] === "}") profundidade--;
      j++;
    }
    achados.push(src.slice(i + marca.length, j - 1));
    i = src.indexOf(marca, j);
  }
  return achados;
}
