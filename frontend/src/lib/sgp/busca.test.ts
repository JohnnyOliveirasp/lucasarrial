/**
 * Régua da BUSCA de /admin/sgp (nome, e-mail, WhatsApp — nas duas abas).
 *
 * O que estes testes protegem, na ordem do risco de o time não achar o aluno:
 *  1. TELEFONE. É o caso de uso número 1 (o aluno chamou no WhatsApp e o time
 *     vai buscar por ele) e é o mais fácil de quebrar: o banco guarda
 *     "5511999998888" e a tela mostra "(11) 99999-8888". Precisa achar colando
 *     do WhatsApp, digitando com parêntese e digitando só o final.
 *  2. ACENTO. "conceicao" tem que achar "Conceição" — ninguém digita acento no
 *     meio do atendimento.
 *  3. DUAS PALAVRAS SOLTAS. "joao pinheiro" tem que achar "João Gomes Pinheiro",
 *     que uma busca por pedaço contínuo NÃO acha.
 *  4. SEM TELEFONE NÃO PODE VIRAR CORINGA. O vazio vira "—" na tela; se ele
 *     entrasse na comparação, todo mundo sem telefone casaria com tudo — o
 *     defeito silencioso mais perigoso aqui, porque a lista *parece* filtrada.
 *  5. CAMPO VAZIO NÃO ESCONDE NINGUÉM.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/busca.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buscaVazia,
  casaBusca,
  filtrarBusca,
  normalizarTexto,
  palavrasDaBusca,
  soDigitos,
  type AlvoBusca,
} from "./busca.ts";

/** Uma aluna de verdade, no formato em que as duas abas guardam. */
const CONCEICAO: AlvoBusca = {
  nome: "Maria da Conceição Pinheiro",
  email: "Maria.Conceicao@Gmail.com",
  telefone: "5511999998888",
};

const SEM_TELEFONE: AlvoBusca = {
  nome: "Otniel Ramos",
  email: "otniel@exemplo.com",
  // Como a fila entrega quando não há telefone.
  telefone: "—",
};

// ───────────────────────── 1. TELEFONE ─────────────────────────

test("telefone: acha colando o número como o WhatsApp mostra", () => {
  assert.equal(casaBusca("+55 11 99999-8888", CONCEICAO), true);
});

test("telefone: acha digitado com parêntese, sem o DDI", () => {
  assert.equal(casaBusca("(11) 99999-8888", CONCEICAO), true);
});

test("telefone: acha só pelo final, que é o que o time lembra", () => {
  assert.equal(casaBusca("99998888", CONCEICAO), true);
});

test("telefone: número de outra pessoa não casa", () => {
  assert.equal(casaBusca("(21) 98888-7777", CONCEICAO), false);
});

// ───────────────────────── 2. ACENTO E CAIXA ─────────────────────────

test("nome: acha sem acento", () => {
  assert.equal(casaBusca("conceicao", CONCEICAO), true);
});

test("nome: acha COM acento também (quem copia e cola do cadastro)", () => {
  assert.equal(casaBusca("Conceição", CONCEICAO), true);
});

test("e-mail: acha ignorando a caixa (o cadastro tem maiúscula)", () => {
  assert.equal(casaBusca("maria.conceicao@gmail", CONCEICAO), true);
});

// ───────────────────────── 3. PALAVRAS SOLTAS ─────────────────────────

test("duas palavras não vizinhas acham o nome do meio", () => {
  // "joao pinheiro" contra "João Gomes Pinheiro": busca por pedaço contínuo
  // falharia aqui, e é justamente como o time lembra do aluno.
  assert.equal(
    casaBusca("maria pinheiro", CONCEICAO),
    true,
    "cada palavra pode casar num ponto diferente do nome",
  );
});

test("palavras casam em campos DIFERENTES da mesma pessoa", () => {
  assert.equal(casaBusca("maria 99998888", CONCEICAO), true, "uma no nome, outra no telefone");
});

test("é E, não OU: uma palavra que não existe derruba a linha", () => {
  assert.equal(
    casaBusca("maria sobrenomequenaoexiste", CONCEICAO),
    false,
    "senão a busca traz gente demais e o time volta a varrer com o olho",
  );
});

test("palavra com dígito tenta o e-mail também, não só o telefone", () => {
  const joao: AlvoBusca = { nome: "João", email: "joao2010@exemplo.com", telefone: null };
  assert.equal(casaBusca("joao2010", joao), true);
});

// ───────────────────── 4. SEM TELEFONE NÃO É CORINGA ─────────────────────

test("linha sem telefone NÃO casa com busca por número", () => {
  assert.equal(
    casaBusca("99999", SEM_TELEFONE),
    false,
    'o "—" não tem dígito e não pode virar coringa',
  );
});

test("linha sem telefone continua achável pelo nome", () => {
  assert.equal(casaBusca("otniel", SEM_TELEFONE), true);
});

test("telefone nulo (planilha, celularDigitos null) não casa com número", () => {
  assert.equal(casaBusca("11", { nome: "Ana", email: "ana@x.com", telefone: null }), false);
});

// ───────────────────── 5. CAMPO VAZIO NÃO ESCONDE ─────────────────────

test("campo vazio casa com todo mundo", () => {
  assert.equal(casaBusca("", CONCEICAO), true);
  assert.equal(casaBusca("   ", CONCEICAO), true);
  assert.equal(casaBusca(null, SEM_TELEFONE), true);
});

test("buscaVazia reconhece o campo em branco e só ele", () => {
  assert.equal(buscaVazia(""), true);
  assert.equal(buscaVazia("   \t "), true);
  assert.equal(buscaVazia(null), true);
  assert.equal(buscaVazia("a"), false);
  assert.equal(buscaVazia("("), false, "parêntese vira palavra de texto, não some");
  assert.equal(buscaVazia("11"), false);
});

test("espaço sobrando no fim do campo não zera a lista", () => {
  // Quem digita rápido deixa espaço; se ele virasse uma palavra vazia, o
  // `every` cobraria que a linha casasse com "" e o resultado seria vazio.
  assert.equal(casaBusca("maria  ", CONCEICAO), true);
});

// ───────────────────────── AS PEÇAS SOLTAS ─────────────────────────

test("normalizarTexto tira acento, caixa e espaço das pontas", () => {
  assert.equal(normalizarTexto("  Conceição  "), "conceicao");
  assert.equal(normalizarTexto("JOÃO"), "joao");
  assert.equal(normalizarTexto(null), "");
  assert.equal(normalizarTexto(undefined), "");
});

test("soDigitos guarda só número", () => {
  assert.equal(soDigitos("(11) 99999-8888"), "11999998888");
  assert.equal(soDigitos("—"), "");
  assert.equal(soDigitos(null), "");
});

test("palavrasDaBusca guarda as duas leituras de cada palavra", () => {
  assert.deepEqual(palavrasDaBusca("joao (11)"), [
    { texto: "joao", digitos: "" },
    { texto: "(11)", digitos: "11" },
  ]);
});

// ───────────────────────── O FILTRO NA LISTA ─────────────────────────

test("filtrarBusca devolve a lista inteira quando o campo está vazio", () => {
  const lista = [CONCEICAO, SEM_TELEFONE];
  const r = filtrarBusca("", lista, (l) => l);
  assert.equal(r.length, 2);
});

test("filtrarBusca não devolve o MESMO array (a lista de origem não é mexida)", () => {
  const lista = [CONCEICAO, SEM_TELEFONE];
  const r = filtrarBusca("  ", lista, (l) => l);
  assert.notEqual(r, lista, "copia: ordenar/filtrar depois não pode mexer no estado de origem");
  assert.deepEqual(r, lista);
});

test("filtrarBusca recorta pelo alvo que a aba souber montar", () => {
  type LinhaDaPlanilha = { nome: string; email: string; celularDigitos: string | null };
  const linhas: LinhaDaPlanilha[] = [
    { nome: "Maria da Conceição", email: "m@x.com", celularDigitos: "5511999998888" },
    { nome: "Otniel", email: "o@x.com", celularDigitos: null },
  ];
  const r = filtrarBusca("99998888", linhas, (l) => ({
    nome: l.nome,
    email: l.email,
    telefone: l.celularDigitos,
  }));
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, "Maria da Conceição");
});
