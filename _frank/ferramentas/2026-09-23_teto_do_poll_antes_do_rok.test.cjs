/**
 * GUARDA DE REGRESSAO — #477 / incidente b5073c91 (PR #352).
 *
 * O QUE ESTE TESTE PROTEGE, e por que ele le o ARQUIVO REAL e nao uma replica:
 * o defeito do PR #352, como veio do Vigia, NAO era de valor nem de tipo — era
 * de ORDEM. O teto de 5 min estava escrito DEPOIS do try/catch, e o callback do
 * poll tem um `if (!r.ok) return;` DENTRO do try. `return` ali sai do callback
 * inteiro, entao o teto nunca era alcancado quando o GET falhava sempre — que e
 * justamente o caso do cartao: o aluno apagou a row pra escapar do spinner, o
 * GET /api/v1/images/<id> passou a devolver 404, e a tela girou pra sempre.
 *
 * Medido em 23/09 antes de mover, com a estrutura exata do callback:
 *   GET !ok (404/500) ....... teto NAO disparava  (gira pra sempre)
 *   GET 200 + generating .... teto disparava
 *
 * tsc e eslint passaram verdes NOS DOIS lados — compilador nao ve ordem de
 * execucao. Por isso a guarda e textual e mora aqui, e nao no tsc.
 *
 * Rodar: node --test _frank/ferramentas/2026-09-23_teto_do_poll_antes_do_rok.test.cjs
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ARQ = path.join(
  __dirname,
  "..",
  "..",
  "frontend",
  "src",
  "components",
  "image",
  "image-studio.tsx",
);

const fonte = fs.readFileSync(ARQ, "utf8");

const MARCA_TETO = "Date.now() >= deadline";
const MARCA_ROK = "if (!r.ok) return;";

/**
 * ⚠️ RECORTE OBRIGATORIO — esta guarda ja nasceu com um falso positivo.
 * A 1a versao comparou indexOf() no ARQUIVO INTEIRO e reprovou o codigo CERTO:
 * existe um `if (!r.ok) return;` na LINHA 180, em outra funcao, muito antes do
 * poll (linha ~632). O indexOf casava com o da 180 e a conta dava invertida.
 * Medir posicao relativa so faz sentido DENTRO do mesmo bloco — por isso
 * recortamos a funcao poll() antes de comparar qualquer coisa.
 */
function corpoDoPoll(src) {
  const ini = src.indexOf("function poll(");
  assert.ok(ini !== -1, "funcao poll() sumiu de image-studio.tsx — a guarda ficou cega, reescreva-a");
  const fim = src.indexOf("\n  }", src.indexOf("}, 3000);", ini));
  assert.ok(fim !== -1, "nao achei o fim da funcao poll() — a guarda ficou cega, reescreva-a");
  return src.slice(ini, fim);
}

const POLL = corpoDoPoll(fonte);

test("CONTROLE POSITIVO: as duas marcas existem DENTRO da funcao poll", () => {
  // Se o arquivo for refatorado e as marcas sumirem, este teste MORRE em vez de
  // passar em silencio — guarda textual que nao acha o alvo nao esta guardando
  // nada. Mesmo principio do controle positivo do percepcao_travada.cjs.
  assert.ok(
    POLL.includes(MARCA_TETO),
    `marca do teto ("${MARCA_TETO}") sumiu da funcao poll — a guarda ficou cega, reescreva-a`,
  );
  assert.ok(
    POLL.includes(MARCA_ROK),
    `marca do early-return ("${MARCA_ROK}") sumiu da funcao poll — a guarda ficou cega, reescreva-a`,
  );
});

test("CONTROLE DO RECORTE: o recorte pegou o poll, e so ele", () => {
  // Prova que o recorte isolou mesmo o bloco certo: o `if (!r.ok) return;` da
  // linha 180 (outra funcao) NAO pode estar aqui dentro. Se um dia o recorte
  // vazar, esta conta denuncia antes de a guarda voltar a medir errado.
  const ocorrencias = POLL.split(MARCA_ROK).length - 1;
  assert.strictEqual(
    ocorrencias,
    1,
    `o recorte do poll deveria conter exatamente 1 "${MARCA_ROK}", contou ${ocorrencias} — ` +
      "o recorte vazou pra fora da funcao e a comparacao de posicao nao vale mais",
  );
  assert.ok(POLL.includes("}, 3000);"), "o recorte nao alcancou o fim do setInterval");
});

test("o teto do poll vem ANTES do early-return de !r.ok", () => {
  const posTeto = POLL.indexOf(MARCA_TETO);
  const posRok = POLL.indexOf(MARCA_ROK);
  assert.ok(
    posTeto < posRok,
    "REGRESSAO do #477: o teto de 5 min voltou a ficar DEPOIS do `if (!r.ok) return;`. " +
      "Com o GET falhando sempre (404 da row apagada, 500), o teto nunca dispara e a tela " +
      "gira pra sempre com o credito ja debitado. Mova a checagem do teto pro topo do callback.",
  );
});

test("o teto encerra o intervalo e devolve o formulario", () => {
  // Nao basta a ordem: o ramo do teto tem que PARAR o giro e sair do callback,
  // senao ele dispara o aviso e segue pedindo o GET a cada 3s.
  const i = POLL.indexOf(MARCA_TETO);
  const bloco = POLL.slice(i, i + 420);
  assert.ok(bloco.includes("clearInterval"), "o ramo do teto nao limpa o setInterval");
  assert.ok(bloco.includes('setStep("form")'), "o ramo do teto nao devolve o formulario");
  assert.ok(bloco.includes("return"), "o ramo do teto nao sai do callback");
});
