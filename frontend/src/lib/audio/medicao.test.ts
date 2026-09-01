/**
 * Testes da régua de medição (incidente #203, Jussara).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/medicao.test.ts
 *
 * O defeito coberto: "ainda medindo" e "não deu pra medir" eram o MESMO `null`,
 * a tela mostrava "medindo…" pros dois e o botão Treinar morria sem explicação.
 * As armadilhas que estes testes travam:
 *   - falha NÃO pode ser confundida com pendente (são estados distintos);
 *   - arquivo não medido vale ZERO no total (não se inventa duração);
 *   - mas `bloqueadoPorFalha` só acusa quando a falha É a causa do botão morto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveDoMotivo,
  estadoDoItem,
  resumirMedicao,
  vaiAdiantarTentarDeNovo,
  type ItemMedicao,
} from "./medicao.ts";

const MIN = 20 * 60;
const MAX = 60 * 60;

test("os três estados são distintos — medindo ≠ falhou", () => {
  assert.equal(estadoDoItem({ duracao: 600 }), "medido");
  assert.equal(estadoDoItem({ duracao: null }), "medindo");
  assert.equal(estadoDoItem({ duracao: null, falha: "timeout" }), "falhou");
});

test("falha não conta no total e não vira 'medindo'", () => {
  const itens: ItemMedicao[] = [
    { duracao: 600 },
    { duracao: null, falha: "erro-do-audio" },
  ];
  const r = resumirMedicao(itens, MIN, MAX);
  assert.equal(r.total, 600);
  assert.equal(r.medidos, 1);
  assert.equal(r.falhados, 1);
  assert.equal(r.medindo, 0, "arquivo que falhou não pode ficar em 'medindo' pra sempre");
});

test("CASO JUSSARA: único arquivo não mediu → total 0, botão morto E a causa é a falha", () => {
  const r = resumirMedicao([{ duracao: null, falha: "timeout" }], MIN, MAX);
  assert.equal(r.total, 0);
  assert.equal(r.atingeMinimo, false);
  assert.equal(
    r.bloqueadoPorFalha,
    true,
    "é exatamente isto que a tela precisa saber pra explicar o botão apagado",
  );
});

test("falha NÃO bloqueia quando o resto do áudio já passa do mínimo", () => {
  const itens: ItemMedicao[] = [
    { duracao: 21 * 60 },
    { duracao: null, falha: "decode-falhou" },
  ];
  const r = resumirMedicao(itens, MIN, MAX);
  assert.equal(r.atingeMinimo, true);
  assert.equal(
    r.bloqueadoPorFalha,
    false,
    "um arquivo ilegível no meio de 21min bons não pode travar o envio",
  );
});

test("enquanto AINDA mede, não acusa bloqueio por falha", () => {
  const r = resumirMedicao([{ duracao: null }], MIN, MAX);
  assert.equal(r.medindo, 1);
  assert.equal(r.falhados, 0);
  assert.equal(r.bloqueadoPorFalha, false, "medindo é passagem, não desfecho");
});

test("acima do teto reprova mesmo com tudo medido", () => {
  const r = resumirMedicao([{ duracao: 61 * 60 }], MIN, MAX);
  assert.equal(r.acimaDoMaximo, true);
  assert.equal(r.atingeMinimo, false);
});

test("faltam reflete só o que foi medido", () => {
  const r = resumirMedicao([{ duracao: 15 * 60 }, { duracao: null, falha: "timeout" }], MIN, MAX);
  assert.equal(r.faltam, 5 * 60);
});

test("todo motivo tem chave de tradução (nenhum cai em undefined)", () => {
  const motivos = [
    "timeout",
    "erro-do-audio",
    "sem-duracao",
    "decode-falhou",
    "sem-audiocontext",
    "fora-do-browser",
    "excecao",
  ] as const;
  for (const m of motivos) {
    const chave = chaveDoMotivo(m);
    assert.equal(typeof chave, "string");
    assert.ok(chave.length > 0, `motivo ${m} ficou sem chave`);
  }
});

test("só timeout convida a tentar de novo", () => {
  assert.equal(vaiAdiantarTentarDeNovo("timeout"), true);
  assert.equal(vaiAdiantarTentarDeNovo("erro-do-audio"), false);
  assert.equal(vaiAdiantarTentarDeNovo("decode-falhou"), false);
});
