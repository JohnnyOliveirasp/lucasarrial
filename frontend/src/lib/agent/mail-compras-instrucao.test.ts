/**
 * Guarda da INSTRUÇÃO de crédito no canal de e-mail. Rodar (Node ≥ 22.18):
 *   node --test src/lib/agent/mail-compras-instrucao.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (caso Hugo Correa, 08/09/2026): a instrução
 * "CRÉDITOS/ACESSO NÃO LIBERADO após compra" em `mail-respond.ts` era
 * INCONDICIONAL — mandava a Fast dizer que os créditos aparecem no primeiro
 * login, sem nunca perguntar QUAL produto a pessoa comprou. Um comprador do
 * Sistema de Geração Pronto (R$ 597) recebeu exatamente isso; SGP não dá
 * crédito nem acesso por regra comercial, então ele entraria, veria zero e
 * confirmaria que tinha sido enganado.
 *
 * `compras.test.ts` protege a linha que informa o produto. Este arquivo
 * protege o outro lado: que a instrução CONSUMA essa linha em vez de voltar a
 * afirmar sozinha. Uma coisa não substitui a outra — o dado certo com a
 * instrução incondicional produz o mesmo e-mail errado.
 *
 * NOTA DE EXECUÇÃO: `mail-respond.ts` importa por alias ("@/lib/db/admin"),
 * que o runner nativo do Node não resolve sem loader. Por isso o teste lê o
 * FONTE, igual `manual.test.ts` faz pelo mesmo motivo — o trecho protegido é
 * texto literal, sem interpolação, então ler o fonte mede exatamente o que vai
 * pro prompt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MAIL = readFileSync(new URL("./mail-respond.ts", import.meta.url), "utf8");
const MANUAL = readFileSync(new URL("./manual.ts", import.meta.url), "utf8");

/** Só o corpo da instrução, sem os comentários que explicam o incidente. */
const semComentarios = (s: string) =>
  s
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");

test("a instrução de crédito do e-mail é CONDICIONADA ao produto comprado", () => {
  const linha = semComentarios(MAIL)
    .split("\n")
    .find((l) => l.includes("CRÉDITOS/ACESSO NÃO LIBERADO"));
  assert.ok(linha, "a instrução de crédito sumiu do mail-respond.ts");
  assert.match(linha, /COMPRAS NA HOTMART/, "a instrução precisa mandar obedecer a linha do produto");
  assert.match(linha, /SÓ se|SÓ quando/, "a permissão de falar em crédito precisa ser condicional");
  assert.match(linha, /SÓ CURSO/, "a instrução precisa cobrir o caso do comprador de curso");
});

test("a promessa de crédito NÃO pode voltar a ser incondicional", () => {
  // A régua é a ORDEM: a menção ao produto tem que vir ANTES da promessa,
  // senão o modelo lê a promessa primeiro e a condição vira ressalva.
  const linha = semComentarios(MAIL)
    .split("\n")
    .find((l) => l.includes("CRÉDITOS/ACESSO NÃO LIBERADO"))!;
  const condicao = linha.indexOf("COMPRAS NA HOTMART");
  const promessa = linha.indexOf("primeiro login");
  assert.ok(condicao >= 0 && promessa >= 0);
  assert.ok(condicao < promessa, "a condição do produto tem que vir ANTES da promessa de crédito");
});

test("o manual não manda mais afirmar liberação automática sem olhar o produto", () => {
  // Mesmo defeito, outro canal: a regra de COMPROVANTE DE PAGAMENTO (regra 6)
  // vale pro WhatsApp e pra ajuda no site, não só pro e-mail.
  const linha = semComentarios(MANUAL)
    .split("\n")
    .find((l) => l.includes("Comprovante de pagamento"));
  assert.ok(linha, "a regra do comprovante sumiu do manual.ts");
  assert.match(linha, /COMPRAS NA HOTMART/, "a regra do comprovante precisa consultar o produto");
  assert.match(linha, /não negue a compra|NÃO prometa/i);
});

test("o bloco da conta injeta a linha COMPRAS junto da GARANTIA", () => {
  const account = readFileSync(new URL("./account.ts", import.meta.url), "utf8");
  assert.match(account, /linhaComprasHotmart/, "account.ts precisa calcular a linha do produto");
  // As duas linhas entram no MESMO array do contexto: se alguém remover a
  // `compras` de lá, a Fast volta a ser cega pro produto com conta na mão.
  assert.match(account, /garantia,\s*\n\s*compras,/, "a linha `compras` saiu do bloco da conta");
});
