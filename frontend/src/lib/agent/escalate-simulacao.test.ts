/**
 * SIMULAÇÃO DE ESCALAÇÃO — a prova dos TRÊS pontos do corte de 04/09 (Lucas):
 *   (a) NENHUMA mensagem sai pro grupo de WhatsApp do time;
 *   (b) o E-MAIL da escalação CONTINUA saindo;
 *   (c) o CHAMADO CONTINUA sendo aberto.
 * Provar só o (a) não serve: quebrar o (b) ou o (c) deixaria o time CEGO, que é
 * o oposto do que o Lucas pediu (ele mandou o time olhar o painel).
 *
 * Como rodar (precisa do resolvedor de alias + mock de módulo):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/agent/escalate-simulacao.test.ts
 *
 * Sem essas flags o arquivo se marca como SKIP em vez de derrubar a suíte —
 * o resto dos testes da casa roda com `node --test` pelado.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Zap = { jid: string; texto: string };

const zaps: Zap[] = [];
const emails: Array<{ to: string[]; subject: string }> = [];
const chamados: Array<{ signature: string; categoria: string }> = [];

let escalate: typeof import("./escalate.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/agent/provider", {
    namedExports: {
      sendAgentText: async (jid: string, texto: string) => {
        zaps.push({ jid, texto });
        return "wa-msg-id";
      },
    },
  });
  mock.module("@/lib/email/resend", {
    namedExports: {
      sendEmail: async (m: { to: string[]; subject: string }) => {
        emails.push({ to: m.to, subject: m.subject });
        return true;
      },
      escapeHtml: (s: string) => s,
    },
  });
  mock.module("@/lib/incidents/reportar", {
    namedExports: {
      abrirChamadoReportado: async (c: { signature: string; categoria: string }) => {
        chamados.push({ signature: c.signature, categoria: c.categoria });
        return 777;
      },
    },
  });
  escalate = await import("@/lib/agent/escalate");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

/** Aluno no privado, o caso mais comum de escalação. */
const chat = {
  id: "chat-simulado",
  name: "Aluno de Teste",
  wa_phone: "5511900000000",
  wa_jid: "5511900000000@s.whatsapp.net",
  kind: "private",
} as never;

const escalacao = {
  chat,
  reason: "quer falar com uma pessoa sobre a cobrança",
  lastUserText: "oi, preciso de um humano",
};

function limpar() {
  zaps.length = 0;
  emails.length = 0;
  chamados.length = 0;
}

test("escalação simulada: zap NÃO sai, e-mail SAI, chamado ABRE", pular, async () => {
  limpar();
  delete process.env.AGENT_ESCALATION_WHATSAPP; // o padrão de produção

  await escalate!.notifyTeamEscalation(escalacao);
  const numero = await escalate!.abrirChamadoDaEscalacao({ ...escalacao, senderJid: null });

  // (a) nenhuma mensagem pro grupo do time
  assert.deepEqual(zaps, [], "saiu zap pro grupo do time — o corte de 04/09 não pegou");
  // (b) o e-mail continua
  assert.equal(emails.length, 1, "o e-mail da escalação parou de sair");
  assert.ok(emails[0].to.includes("johnny.oliveirasp@gmail.com"));
  assert.match(emails[0].subject, /precisa de atendimento humano/);
  // (c) o chamado continua nascendo
  assert.equal(numero, 777, "o chamado não foi aberto");
  assert.equal(chamados.length, 1);
  assert.equal(chamados[0].categoria, "atendimento");
});

test("escalação TÉCNICA: mesma coisa — sem zap, com e-mail e com chamado", pular, async () => {
  limpar();
  delete process.env.AGENT_ESCALATION_WHATSAPP;

  await escalate!.notifyTeamEscalation({ ...escalacao, technical: true });
  const numero = await escalate!.abrirChamadoDaEscalacao({ ...escalacao, senderJid: null, technical: true });

  assert.deepEqual(zaps, []);
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /erro técnico/);
  assert.equal(numero, 777);
  assert.equal(chamados[0].categoria, "tecnico");
});

test("é CHAVE, não deleção: ligando a env o zap volta pro grupo", pular, async () => {
  limpar();
  process.env.AGENT_ESCALATION_WHATSAPP = "1";
  try {
    await escalate!.notifyTeamEscalation(escalacao);
    assert.equal(zaps.length, 1, "a volta atrás não funciona — o canal foi perdido, não desligado");
    assert.equal(zaps[0].jid, "120363428193217427@g.us");
    assert.match(zaps[0].texto, /aluno pedindo humano/);
    assert.equal(emails.length, 1, "ligar o zap não pode duplicar nem sumir com o e-mail");
  } finally {
    delete process.env.AGENT_ESCALATION_WHATSAPP;
  }
});
