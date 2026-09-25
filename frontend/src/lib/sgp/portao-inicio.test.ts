/**
 * O que este teste protege, em uma frase: pessoa SEM compra confirmada do SGP
 * não começa o wizard — e pessoa que JÁ estava dentro não é expulsa.
 *
 * O texto do barrado chega CRU nos olhos do aluno (`step-dados-form.tsx` joga
 * `error.message` direto no estado), então a mensagem é o produto, não detalhe:
 * ela precisa dizer o que fazer e não pode acusar (a compra pode existir noutro
 * e-mail — caso Marco Lovison, 23/09).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MENSAGEM_SEM_COMPRA, portaoDoInicio } from "./portao-inicio.ts";

test("com compra confirmada ENTRA — é a porta normal do comprador", () => {
  assert.deepEqual(
    portaoDoInicio({ temCompraSgp: true, temPedidoAnterior: false }),
    { acao: "entrar" },
  );
  // Compra manda mesmo quando também há pedido (o caso comum de quem volta).
  assert.deepEqual(
    portaoDoInicio({ temCompraSgp: true, temPedidoAnterior: true }),
    { acao: "entrar" },
  );
});

test("sem compra mas COM pedido anterior ENTRA — ninguém que já estava dentro é expulso", () => {
  // O caso real: 12 pessoas no portal sem compra registrada porque o webhook
  // ficou cego pro 7283229 entre 09/06 e 04/09 (cabeçalho de compradores.ts).
  // Expulsá-las seria punir comprador de verdade por defeito NOSSO de registro.
  assert.deepEqual(
    portaoDoInicio({ temCompraSgp: false, temPedidoAnterior: true }),
    { acao: "entrar" },
  );
});

test("sem compra e sem pedido BARRA — o portão que o Johnny mandou fechar (24/09)", () => {
  const r = portaoDoInicio({ temCompraSgp: false, temPedidoAnterior: false });
  assert.equal(r.acao, "barrar");
});

test("a mensagem do barrado diz O QUE FAZER e não acusa", () => {
  const r = portaoDoInicio({ temCompraSgp: false, temPedidoAnterior: false });
  assert.equal(r.acao, "barrar");
  const m = r.acao === "barrar" ? r.mensagem : "";
  assert.equal(m, MENSAGEM_SEM_COMPRA);
  // 1. aponta a saída mais comum: a compra feita com OUTRO e-mail;
  assert.match(m, /outro e-mail/i);
  assert.match(m, /MESMO e-mail/);
  // 2. aponta o suporte pro caso que a régua não alcança;
  assert.match(m, /suporte@fastcloner\.com/);
  // 3. não acusa: "não encontramos" (fato nosso), nunca "você não tem/não comprou".
  assert.equal(/você não tem|você não comprou|sem permissão|negado/i.test(m), false, m);
});

test("TRIPWIRE: a rota /sgp/inicio chama o portão de verdade", () => {
  // Lição de 24/09 (worktrees em /tmp): regra que vive só na intenção não é
  // regra. Este teste lê o FONTE da rota e quebra se um refactor remover a
  // chamada do portão — gate deletado e gate passando limpo não podem imprimir
  // a mesma coisa (lição da ronda de 22-23/09).
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const rota = readFileSync(
    path.join(aqui, "..", "..", "app", "api", "v1", "sgp", "inicio", "route.ts"),
    "utf8",
  );
  assert.match(rota, /portaoDoInicio\s*\(/, "a rota tem que consultar o portão");
  // E a recusa tem que sair como badRequest com a mensagem do portão — é ela
  // que o step-dados-form joga na tela; um 403 mudo violaria o pedido.
  assert.match(rota, /badRequest\(\s*portao\.mensagem\s*\)/, "barrado leva a mensagem do portão, não um erro seco");
  // O portão decide ANTES de mandar o código: barrado não recebe e-mail.
  const posPortao = rota.indexOf("portaoDoInicio(");
  const posEnvio = rota.indexOf("enviarCodigo(");
  assert.ok(posPortao > 0 && posEnvio > posPortao, "o portão vem antes do envio do código");
});
