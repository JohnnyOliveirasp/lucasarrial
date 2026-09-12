/**
 * O que este teste protege, em uma frase: o aluno recebe UM e-mail quando o
 * pedido morre, e não um a cada F5 da tela de acompanhamento.
 *
 * `estadoDasEtapas` é chamada pela página /sgp/acompanhar E pela rota
 * /api/v1/sgp/status a CADA carregamento, então "avisa quando falhou" sem
 * cadeado vira bombardeio. O banco falso abaixo imita a semântica REAL do
 * `update(...).neq('status','falhou').select()`: a primeira chamada leva a
 * linha, as seguintes levam nada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarAvisoAoAluno,
  montarErroDoGrupo,
  processarTransicao,
  type DepsTransicao,
  type PedidoFracassado,
} from "./fracasso.ts";
import type { SgpStatus } from "./types.ts";

const PEDIDO: PedidoFracassado = {
  id: "fe00d4e2",
  nome: "Rafael",
  email: "rafaelzan@me.com",
  erro: null,
  status: "processando",
};

/** Banco falso + espiões. `neq('status','falhou')` é o cadeado que imitamos. */
function montarCena(pedido: PedidoFracassado = PEDIDO) {
  const banco = { status: pedido.status as SgpStatus, erro: pedido.erro };
  const emails: Array<{ to: string; assunto: string; texto: string; ref: string }> = [];
  const grupo: Array<{ email: string; motivo: string; dependeDoAluno: boolean }> = [];
  const statusEscritos: SgpStatus[] = [];
  let tentativasDeCarimbo = 0;

  const deps: DepsTransicao = {
    carimbarFracasso: async (patch) => {
      tentativasDeCarimbo++;
      // .neq("status", "falhou") — quem já está 'falhou' não casa e volta vazio.
      if (banco.status === "falhou") return null;
      banco.status = "falhou";
      if (patch.erro !== undefined) banco.erro = patch.erro;
      return { email: pedido.email, nome: pedido.nome };
    },
    carimbarStatus: async (status) => {
      statusEscritos.push(status);
      banco.status = status;
    },
    avisarAluno: async (to, assunto, texto, ref) => {
      emails.push({ to, assunto, texto, ref });
    },
    escalar: async (erro) => {
      grupo.push({ email: erro.email, motivo: erro.motivo, dependeDoAluno: erro.dependeDoAluno });
    },
  };
  // O pedido "relido do banco", como acontece no F5 seguinte.
  const relido = (): PedidoFracassado => ({ ...pedido, status: banco.status, erro: banco.erro });
  return { deps, banco, emails, grupo, statusEscritos, relido, tentativas: () => tentativasDeCarimbo };
}

// (a) a transição pra 'falhou' avisa — aluno E grupo, uma vez.
test("fracasso: primeira transição avisa o aluno e o grupo", async () => {
  const c = montarCena();
  const r = await processarTransicao(PEDIDO, "falhou", "não sabemos listar a pasta", c.deps);

  assert.equal(r, "avisou");
  assert.equal(c.emails.length, 1);
  assert.equal(c.emails[0]!.to, "rafaelzan@me.com");
  assert.equal(c.grupo.length, 1);
  assert.equal(c.banco.status, "falhou");
  // O motivo foi carimbado junto (comportamento do #246 preservado).
  assert.equal(c.banco.erro, "não sabemos listar a pasta");
});

// (b) O PONTO DO CARTÃO: rechamar não pode mandar e-mail de novo.
test("fracasso: segunda chamada NÃO avisa de novo (cadeado)", async () => {
  const c = montarCena();
  await processarTransicao(PEDIDO, "falhou", "falha geral", c.deps);
  const r2 = await processarTransicao(c.relido(), "falhou", "falha geral", c.deps);

  assert.equal(r2, "ja_avisado");
  assert.equal(c.emails.length, 1, "o aluno não pode receber um e-mail por render");
  assert.equal(c.grupo.length, 1, "o grupo não pode ser bombardeado");
  assert.equal(c.tentativas(), 2, "as duas chamadas tentaram; só uma ganhou");
});

test("fracasso: dez renders da tela = um e-mail só", async () => {
  const c = montarCena();
  for (let i = 0; i < 10; i++) {
    await processarTransicao(c.relido(), "falhou", "timeout no treino", c.deps);
  }
  assert.equal(c.emails.length, 1);
  assert.equal(c.grupo.length, 1);
});

// (c) pedido que não falhou não dispara nada.
test("fracasso: pedido que não falhou não avisa ninguém", async () => {
  // Parte de 'enviado' pra que os dois desfechos sejam mudança de verdade.
  const enviado: PedidoFracassado = { ...PEDIDO, status: "enviado" };
  for (const status of ["processando", "pronto"] as const) {
    const c = montarCena(enviado);
    const r = await processarTransicao(enviado, status, null, c.deps);
    assert.equal(r, "status_atualizado");
    assert.equal(c.emails.length, 0, `${status} não pode avisar aluno`);
    assert.equal(c.grupo.length, 0, `${status} não pode chamar o grupo`);
    assert.deepEqual(c.statusEscritos, [status]);
  }
});

test("fracasso: status igual ao do banco não escreve nada", async () => {
  const c = montarCena();
  const r = await processarTransicao(PEDIDO, "processando", null, c.deps);
  assert.equal(r, "sem_mudanca");
  assert.deepEqual(c.statusEscritos, []);
  assert.equal(c.emails.length, 0);
});

test("fracasso: motivo já gravado nunca é sobrescrito", async () => {
  const comErro = { ...PEDIDO, erro: "o áudio tem menos de 20 minutos" };
  const c = montarCena(comErro);
  await processarTransicao(comErro, "falhou", "motivo novo e diferente", c.deps);

  assert.equal(c.banco.erro, "o áudio tem menos de 20 minutos");
  // e o e-mail fala do motivo REAL, não do que veio depois
  assert.match(c.emails[0]!.texto, /menos de 20 minutos/);
});

// A régua de culpa: o texto muda conforme o dono do erro.
test("fracasso: erro do ALUNO pede ação; erro NOSSO diz pra não fazer nada", async () => {
  const doAluno = montarAvisoAoAluno({ nome: "Rafael" }, "a pasta do Drive está privada");
  assert.equal(doAluno.dono, "aluno");
  assert.match(doAluno.texto, /O que precisamos de você/);

  const nosso = montarAvisoAoAluno({ nome: "Rafael" }, "timeout no treino da voz");
  assert.equal(nosso.dono, "nosso");
  assert.match(nosso.texto, /não precisa fazer nada/);
  assert.match(nosso.texto, /problema NOSSO/);
  assert.doesNotMatch(nosso.texto, /O que precisamos de você/);
});

test("fracasso: todo e-mail de aluno oferece o WhatsApp do suporte", async () => {
  for (const motivo of ["a pasta do Drive está privada", "timeout no treino"]) {
    const a = montarAvisoAoAluno({ nome: null }, motivo);
    assert.match(a.texto, /\(41\) 99148-1573/, `faltou o WhatsApp em "${motivo}"`);
    assert.match(a.texto, /wa\.me\/5541991481573/);
  }
});

test("fracasso: o grupo recebe o ID do pedido e o dono do erro", async () => {
  const e = montarErroDoGrupo({ id: "fe00d4e2", email: "a@b.com" }, "falha geral", "nosso");
  assert.equal(e.linha, null);
  assert.match(e.etapa, /fe00d4e2/);
  assert.equal(e.dependeDoAluno, false);
});

// A rede de segurança: e-mail quebrado não pode calar o humano.
test("fracasso: e-mail que explode ainda assim escala pro grupo", async () => {
  const c = montarCena();
  c.deps.avisarAluno = async () => {
    throw new Error("SMTP fora do ar");
  };
  const r = await processarTransicao(PEDIDO, "falhou", "falha geral", c.deps);

  assert.equal(r, "avisou");
  assert.equal(c.grupo.length, 1, "o grupo é a última rede: não pode cair com o SMTP");
});

test("fracasso: pedido sem e-mail ainda escala pro grupo", async () => {
  const semEmail = { ...PEDIDO, email: null };
  const c = montarCena(semEmail);
  const r = await processarTransicao(semEmail, "falhou", "falha geral", c.deps);

  assert.equal(r, "avisou");
  assert.equal(c.emails.length, 0);
  assert.equal(c.grupo.length, 1);
  assert.match(c.grupo[0]!.email, /sem e-mail/);
});
