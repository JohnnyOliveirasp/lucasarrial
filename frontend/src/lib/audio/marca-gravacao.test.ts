/**
 * Testes do bilhete do Gravador (incidente #235, Alana).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/marca-gravacao.test.ts
 *
 * O bilhete existe para a tela de criar voz poder dizer "você gravou aqui e eu
 * não achei as gravações" em vez de abrir um formulário mudo. Ele é a ÚNICA
 * prova que sobra quando o IndexedDB falha — então o maior risco não é ele
 * faltar, é o nosso próprio código apagá-lo por engano.
 *
 * As armadilhas que estes testes travam:
 *   - `marcarGravacao(0, …)` APAGA. O efeito do Gravador roda no mount com a
 *     lista ainda vazia, então chamá-lo direto destrói o bilhete só de abrir a
 *     página — e destrói justamente para a vítima, cuja leitura falhou;
 *   - lista vazia por leitura NÃO confiável nunca pode apagar;
 *   - lista vazia por leitura confiável TEM que apagar (senão a tela acusa
 *     perda de gravação que a pessoa deletou de propósito);
 *   - clipe removido na tela de criar voz desconta do bilhete, sem mexer na
 *     hora da gravação;
 *   - `localStorage` proibido (Safari privado) não pode derrubar nada.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  descontarDaMarca,
  lerMarcaGravacao,
  limparMarcaGravacao,
  marcarGravacao,
  sincronizarMarcaGravacao,
  type MarcaGravacao,
} from "./marca-gravacao.ts";

const CHAVE = "aiverse-voice:gravacoes";

let dados = new Map<string, string>();
let proibido = false;

/** `localStorage` de mentira — com o modo "proibido" do Safari privado. */
const localStorageFalso = {
  getItem(k: string): string | null {
    if (proibido) throw new Error("SecurityError");
    const v = dados.get(k);
    return v === undefined ? null : v;
  },
  setItem(k: string, v: string): void {
    if (proibido) throw new Error("QuotaExceededError");
    dados.set(k, v);
  },
  removeItem(k: string): void {
    if (proibido) throw new Error("SecurityError");
    dados.delete(k);
  },
};

(globalThis as unknown as { window: unknown }).window = { localStorage: localStorageFalso };

/** Escreve um bilhete direto no armário, sem passar pelo módulo. */
function semear(marca: MarcaGravacao): void {
  dados.set(CHAVE, JSON.stringify(marca));
}

beforeEach(() => {
  dados = new Map();
  proibido = false;
});

test("o bilhete escrito é o bilhete lido", () => {
  marcarGravacao(3, 610.4);
  const m = lerMarcaGravacao();
  assert.equal(m?.clipes, 3);
  assert.equal(m?.segundos, 610);
  assert.equal(typeof m?.em, "number");
});

test("marcarGravacao(0) APAGA — é esta a arma que o mount não pode disparar", () => {
  semear({ clipes: 8, segundos: 1334, em: 1_700_000_000_000 });
  marcarGravacao(0, 0);
  assert.equal(lerMarcaGravacao(), null);
  assert.equal(dados.has(CHAVE), false);
});

test("O DEFEITO: leitura ainda não assentou → lista vazia NÃO apaga o bilhete", () => {
  semear({ clipes: 8, segundos: 1334, em: 1_700_000_000_000 });
  // Exatamente o que o efeito do Gravador faz no mount: clips = [].
  sincronizarMarcaGravacao(false, 0, 0);
  const m = lerMarcaGravacao();
  assert.equal(m?.clipes, 8, "o bilhete da vítima do #235 tem que sobreviver ao mount");
  assert.equal(m?.segundos, 1334);
});

test("leitura QUEBRADA deixa a lista vazia para sempre e ainda assim preserva a prova", () => {
  semear({ clipes: 12, segundos: 1500, em: 1_700_000_000_000 });
  // O IndexedDB rejeitou: `leituraConfiavel` nunca vira true e o efeito roda
  // de novo a cada render.
  sincronizarMarcaGravacao(false, 0, 0);
  sincronizarMarcaGravacao(false, 0, 0);
  sincronizarMarcaGravacao(false, 0, 0);
  assert.equal(lerMarcaGravacao()?.clipes, 12);
});

test("leitura confiável + lista vazia APAGA (a pessoa deletou tudo mesmo)", () => {
  semear({ clipes: 4, segundos: 300, em: 1_700_000_000_000 });
  sincronizarMarcaGravacao(true, 0, 0);
  assert.equal(lerMarcaGravacao(), null);
});

test("clipe na tela escreve o bilhete mesmo com a leitura quebrada", () => {
  // Gravou DEPOIS da falha de leitura: o bilhete novo é verdade e tem que ir.
  sincronizarMarcaGravacao(false, 2, 90);
  const m = lerMarcaGravacao();
  assert.equal(m?.clipes, 2);
  assert.equal(m?.segundos, 90);
});

test("descontar um clipe encolhe o bilhete e preserva a hora da gravação", () => {
  semear({ clipes: 8, segundos: 1334, em: 1_700_000_000_000 });
  const restante = descontarDaMarca(200);
  assert.equal(restante?.clipes, 7);
  assert.equal(restante?.segundos, 1134);
  assert.equal(restante?.em, 1_700_000_000_000, "remover clipe não muda quando gravou");
  assert.deepEqual(lerMarcaGravacao(), restante);
});

test("descontar o último clipe apaga o bilhete (fim do falso alarme)", () => {
  semear({ clipes: 1, segundos: 120, em: 1_700_000_000_000 });
  assert.equal(descontarDaMarca(120), null);
  assert.equal(dados.has(CHAVE), false);
});

test("descontar sem bilhete nenhum é um no-op honesto", () => {
  assert.equal(descontarDaMarca(60), null);
  assert.equal(dados.has(CHAVE), false);
});

test("desconto sujo (NaN, negativo, maior que o total) não vira segundo negativo", () => {
  semear({ clipes: 3, segundos: 100, em: 1 });
  assert.equal(descontarDaMarca(Number.NaN)?.segundos, 100);
  semear({ clipes: 3, segundos: 100, em: 1 });
  assert.equal(descontarDaMarca(-50)?.segundos, 100);
  semear({ clipes: 3, segundos: 100, em: 1 });
  assert.equal(descontarDaMarca(999)?.segundos, 0);
});

test("bilhete corrompido não é lido como gravação existente", () => {
  dados.set(CHAVE, "{isso nao e json");
  assert.equal(lerMarcaGravacao(), null);
  dados.set(CHAVE, JSON.stringify({ clipes: 0, segundos: 10, em: 1 }));
  assert.equal(lerMarcaGravacao(), null);
});

test("localStorage proibido (Safari privado) não derruba o Gravador", () => {
  proibido = true;
  assert.doesNotThrow(() => marcarGravacao(2, 60));
  assert.doesNotThrow(() => sincronizarMarcaGravacao(true, 0, 0));
  assert.doesNotThrow(() => limparMarcaGravacao());
  assert.doesNotThrow(() => descontarDaMarca(10));
  assert.equal(lerMarcaGravacao(), null);
});
