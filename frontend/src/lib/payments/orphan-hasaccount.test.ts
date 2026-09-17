/**
 * Tripwire da guarda `hasAccount` do convite de compra órfã. Rodar:
 *   node --test src/lib/payments/orphan-hasaccount.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (#306 / `18bf275c`, nomeado em 08/09/2026 e
 * medido ainda vivo em 17/09).
 *
 * A guarda decide quem é "órfão" — quem recebe o e-mail "crie sua conta com
 * EXATAMENTE este e-mail". Ela já regrediu em DUAS direções opostas, e as duas
 * doem:
 *
 *  - LER DE MENOS (falso positivo): o teto silencioso de 1000 linhas do
 *    PostgREST mandou o convite pra 105 clientes ATIVOS (72a4c9db, 04–19/08).
 *    Consertado no `c5f67bd` com paginação.
 *  - COMPARAR STRING CRUA (o #306): o Gmail ignora ponto no nome e ignora o
 *    `+tag`, então `herysilva.27@gmail.com` (a compra, entitlement PPEVZBRG,
 *    `user_id` NULL) e `herysilva27@gmail.com` (a conta, plan pro, criada em
 *    21/07) são a MESMA pessoa — e a casa escreveu pra dona da conta pedindo
 *    que ela criasse a conta que já tinha.
 *
 * `orphan-outreach.ts` importa por alias `@/`, que o runner nativo do Node não
 * resolve sem loader (é a razão dos `ERR_MODULE_NOT_FOUND` conhecidos da casa),
 * então aqui se lê o FONTE — padrão do `account-extrato.test.ts` / `manual.test.ts`.
 * A regra pura em si é testada de verdade em `email-normalizado.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FONTE = readFileSync(
  fileURLToPath(new URL("./orphan-outreach.ts", import.meta.url)),
  "utf8",
);

/**
 * O FONTE sem comentário nenhum.
 *
 * Isto NÃO é detalhe: o arquivo explica o próprio defeito em prosa, e a frase
 * que documenta o #306 cita `.in("email", ...)` literalmente. Sem tirar os
 * comentários, o teste que exige a AUSÊNCIA dessa chamada quebra por causa da
 * explicação — e, pior, os testes que exigem a PRESENÇA da normalização
 * passariam com a linha só mencionada num comentário, com o código errado.
 * Tripwire tem que ler CÓDIGO.
 *
 * Tira bloco `/* *\/` e linha que começa com `//`. Não tenta ser um parser de
 * TypeScript: comentário no fim de linha de código fica, e tudo bem, porque
 * nenhuma asserção daqui depende disso.
 */
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

test("a guarda normaliza os DOIS lados da comparação", () => {
  // Só normalizar um lado não conserta nada: o Set e a pergunta precisam falar
  // a mesma língua.
  assert.match(
    CODIGO,
    /hasAccount\.add\(normalizarEmailParaComparacao\(/,
    "o Set de perfis precisa ser montado com e-mail NORMALIZADO",
  );
  assert.match(
    CODIGO,
    /hasAccount\.has\(normalizarEmailParaComparacao\(/,
    "a pergunta 'já tem conta?' precisa ser feita com e-mail NORMALIZADO",
  );
});

test("a guarda NÃO voltou a comparar e-mail por igualdade de string", () => {
  // `.in("email", ...)` é a assinatura exata do defeito #306: o banco não
  // conhece a forma normalizada, então filtrar por ela no servidor é cegueira.
  assert.doesNotMatch(
    CODIGO,
    /\.in\("email"/,
    'a guarda voltou a usar .in("email", ...) — é o #306 de novo (alias do Gmail invisível)',
  );
});

test("a leitura de profiles pagina até o fim, com ordem estável", () => {
  assert.match(CODIGO, /\.range\(from, from \+ PAGE_PROFILES - 1\)/, "faltou .range()");
  assert.match(CODIGO, /\.order\("id", \{ ascending: true \}\)/, "paginação sem ordem estável pula linha");
  assert.match(
    CODIGO,
    /if \(!data \|\| data\.length < PAGE_PROFILES\) break;/,
    "a parada tem que ser 'página incompleta', não um número fixo de voltas",
  );
});

test("erro e teto ABORTAM — nunca seguem com lista pela metade", () => {
  // Set incompleto é exatamente o que transforma cliente ativo em "órfão".
  assert.match(
    CODIGO,
    /throw new Error\(`\[orphan-outreach\] guarda hasAccount falhou/,
    "erro na consulta da guarda tem que derrubar a varredura",
  );
  assert.match(CODIGO, /TETO_PROFILES/, "faltou o teto de segurança da paginação");
  assert.match(
    CODIGO,
    /if \(from >= TETO_PROFILES\) \{\s*throw new Error\(/,
    "o teto tem que ABORTAR com throw, nunca truncar em silêncio",
  );
});
