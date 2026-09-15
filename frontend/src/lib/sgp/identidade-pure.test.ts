/**
 * As travas do nome do aluno no SGP (#377) — os testes que FALHAM antes do
 * conserto.
 *
 * O que cada bloco protege, em ordem de gravidade:
 *  1. (c) o `display_name` de quem JÁ era cliente não pode ser trocado pelo que
 *     foi digitado no wizard — é a perna que estraga cadastro bom e a que tinha
 *     150 pedidos de exposição;
 *  2. (a) e-mail digitado no campo "nome" tem que ser recusado na porta, senão
 *     o endereço vira o nome da pessoa;
 *  3. (d) preencher campo VAZIO continua valendo — o conserto não pode virar um
 *     congelamento que impede a casa de completar cadastro;
 *  4. (e) conta NOVA não muda nada: o wizard continua sendo a fonte do nome;
 *  5. (B) tripwire de fonte: a decisão pura não pode ficar órfã. Se alguém
 *     reescrever o route ou o `processar` com a lógica antiga, isto acusa. O
 *     alias "@/" não resolve em `node --test`, então se lê o fonte — mesmo
 *     padrão do `anexar.test.ts` e do `finalize-training.test.ts`.
 *
 * Rodar (Node >= 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/sgp/identidade-pure.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  camposDoPerfil,
  problemaNoNome,
  NOME_CURTO,
  NOME_EH_EMAIL,
  type EntradaPerfil,
} from "./identidade-pure.ts";

const USER = "3f1a6b02-0000-4000-8000-aaaaaaaaaaaa";
const EMAIL = "aluno-de-teste@example.com";

function entrada(e: Partial<EntradaPerfil> = {}): EntradaPerfil {
  return {
    userId: USER,
    email: EMAIL,
    contaCriada: false,
    nome: "Nome Do Wizard",
    whatsapp: "5541999999999",
    atual: null,
    ...e,
  };
}

// ------------------------------------------------- (a) e (b) validação do nome

test("(a) nome com formato de e-mail é recusado", () => {
  // O caso real: os 2 pedidos medidos em 13/09 tinham o endereço no campo nome.
  for (const nome of [
    "aluno@gmail.com",
    "  ALUNO@GMAIL.COM  ",
    "maria.souza+curso@outlook.com.br",
  ]) {
    assert.equal(problemaNoNome(nome), NOME_EH_EMAIL, `passou reto: ${nome}`);
  }
});

test("(b) nome normal de 3+ caracteres continua passando", () => {
  for (const nome of [
    "Ana Paula Cristina",
    "Ana",
    "  Ana Paula  ",
    "José da Silva Júnior",
    // Não é e-mail: sem @. Nome com ponto é comum e tem que passar.
    "A.P. Cristina",
  ]) {
    assert.equal(problemaNoNome(nome), null, `recusou nome bom: ${nome}`);
  }
});

test("(b2) nome curto/vazio continua com a mensagem de sempre", () => {
  for (const nome of ["", "  ", "Jo", null, undefined]) {
    assert.equal(problemaNoNome(nome), NOME_CURTO);
  }
});

// ----------------------------------------- (c) (d) (e) gravação em `profiles`

test("(c) conta JÁ EXISTENTE com display_name preenchido NÃO tem o valor trocado", () => {
  const campos = camposDoPerfil(
    entrada({
      contaCriada: false,
      nome: "aluno@gmail.com", // o pior caso: as duas pernas juntas
      atual: { display_name: "Ana Paula Cristina", whatsapp: "5541988887777" },
    }),
  );
  // A chave TEM que sumir do upsert: presente com o valor antigo também
  // "preservaria", mas mascararia uma corrida (outro processo gravando entre o
  // SELECT e o UPSERT). Ausente = PostgREST não toca na coluna.
  assert.equal("display_name" in campos, false, "o nome do wizard foi gravado por cima");
  assert.equal("whatsapp" in campos, false, "o whatsapp do wizard foi gravado por cima");
  assert.deepEqual(campos, { id: USER, email: EMAIL });
});

test("(d) conta existente com display_name vazio RECEBE o valor", () => {
  for (const vazio of [null, "", "   "]) {
    const campos = camposDoPerfil(
      entrada({
        contaCriada: false,
        nome: "Ana Paula Cristina",
        whatsapp: "5541999999999",
        atual: { display_name: vazio, whatsapp: vazio },
      }),
    );
    assert.equal(campos.display_name, "Ana Paula Cristina", `não preencheu sobre ${JSON.stringify(vazio)}`);
    assert.equal(campos.whatsapp, "5541999999999");
  }
});

test("(d2) preenche campo a campo — nome cheio e whatsapp vazio", () => {
  const campos = camposDoPerfil(
    entrada({
      contaCriada: false,
      nome: "Nome Do Wizard",
      whatsapp: "5541999999999",
      atual: { display_name: "Nome Da Casa", whatsapp: null },
    }),
  );
  assert.equal("display_name" in campos, false, "sobrescreveu o nome bom");
  assert.equal(campos.whatsapp, "5541999999999", "deixou de preencher o whatsapp vazio");
});

test("(e) conta NOVA continua sendo criada com o nome do wizard", () => {
  const campos = camposDoPerfil(entrada({ contaCriada: true, nome: "Ana Paula Cristina" }));
  assert.deepEqual(campos, {
    id: USER,
    email: EMAIL,
    display_name: "Ana Paula Cristina",
    whatsapp: "5541999999999",
  });
});

test("(e2) conta do auth SEM linha em profiles é preenchida (não há o que preservar)", () => {
  const campos = camposDoPerfil(entrada({ contaCriada: false, atual: null }));
  assert.equal(campos.display_name, "Nome Do Wizard");
  assert.equal(campos.whatsapp, "5541999999999");
});

test("(f) wizard em branco nunca apaga campo bom", () => {
  const campos = camposDoPerfil(
    entrada({
      contaCriada: true,
      nome: "   ",
      whatsapp: null,
      atual: { display_name: "Nome Da Casa", whatsapp: "5541988887777" },
    }),
  );
  assert.equal("display_name" in campos, false);
  assert.equal("whatsapp" in campos, false);
});

// ------------------------------------------------------------- (B) tripwires

const AQUI = import.meta.dirname;

test("(B1) o route do início realmente aplica a trava do nome", () => {
  const fonte = readFileSync(
    join(AQUI, "..", "..", "app", "api", "v1", "sgp", "inicio", "route.ts"),
    "utf8",
  );
  assert.match(fonte, /problemaNoNome\(/, "a trava do nome não está sendo chamada");
  assert.doesNotMatch(
    fonte,
    /nome\.length\s*<\s*3/,
    "voltou a checagem solta de tamanho — ela não recusa e-mail no campo nome",
  );
});

test("(B2) o processar não grava mais o nome do wizard cegamente", () => {
  const fonte = readFileSync(join(AQUI, "processar.ts"), "utf8");
  assert.match(fonte, /camposDoPerfil\(/, "o upsert não passa mais pela decisão");
  assert.doesNotMatch(
    fonte,
    /display_name:\s*pedido\.nome/,
    "voltou o upsert cego — é exatamente a perna 2 do #377",
  );
});
