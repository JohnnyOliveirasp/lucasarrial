/**
 * SIMULAÇÃO DA CASA FALANDO POR CIMA DE GENTE (#415) — a prova de que, depois
 * de o caso ser entregue ao time, a Fast fica calada.
 *
 * O caso real que isto reproduz: tuquinha36@hotmail.com, reembolso de
 * R$ 2.712,12. O caso foi entregue ao time às 11:55Z e a casa mandou NOVE
 * mensagens automáticas em 2h50 (12:40, 12:50, 13:25, 13:30 ×2, 13:40, ~14:27,
 * 14:35, 14:45). Uma inventou um WhatsApp de terceiro; outra respondeu por cima
 * de uma correção escrita à mão. A aluna: "isso aí está muito bagunçado".
 *
 * ⚠️ POR QUE A TRAVA DO #259 NÃO PEGAVA ISSO, que é o ponto do arquivo: aquela
 * é por MESSAGE-ID — impede responder duas vezes A MESMA mensagem. Nove
 * mensagens diferentes do mesmo caso são nove Message-IDs diferentes e passam
 * todas. Por isso o teste (a) manda mensagens com Message-ID DIFERENTE: com a
 * trava velha elas seriam respondidas uma a uma.
 *
 * O QUE ESTE ARQUIVO PRECISA PROVAR:
 *   (a) caso entregue ao humano → não responde (o defeito);
 *   (b) caso normal → responde como hoje. Sem isto o "fix" seria calar todo
 *       mundo, que é o dano oposto e pior;
 *   (c) o caso vira "com dono" DURANTE o processamento → não envia (a
 *       re-checagem, espelho de respond.ts:247-253);
 *   (d) a sequência da tuquinha: só a mensagem ANTERIOR à entrega é respondida;
 *   (e) calar deixa RASTRO no chamado (senão a mensagem do aluno some);
 *   (f) chamado FECHADO destrava (a trava não pode ser permanente);
 *   (g) consulta falhando → responde assim mesmo (falha-aberta).
 *
 * Como rodar (precisa do resolvedor de alias + mock de módulo):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/agent/mail-humano-simulacao.test.ts
 *
 * Sem essas flags o arquivo se marca como SKIP em vez de derrubar a suíte.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Enviado = { to: string; subject: string; text: string };
type Nota = { at: string; by: string; note: string; tipo?: string };
type Incidente = {
  id: string;
  numero: number | null;
  status: string;
  affected_emails: string[];
  agent_notes: Nota[];
  last_seen_at?: string;
};

const ALUNA = "tuquinha36@hotmail.com";

const enviados: Enviado[] = [];
const marcados: number[] = [];
let incidentes: Incidente[] = [];
let estado: Record<string, unknown> = {};
let consultaQuebrada = false;
let fila: RawMailFake[] = [];
/**
 * Quantas vezes o cérebro foi chamado. Existe por causa de uma medição: com a
 * checagem de ANTES DE GERAR removida, todos os outros testes deste arquivo
 * continuavam VERDES — a re-checagem de antes do envio segurava tudo sozinha.
 * Ou seja, sem este contador a primeira trava seria código não testado, e o
 * arquivo mentiria dizendo que a cobre. O que ela protege não é a correção
 * (essa a segunda garante), é o CUSTO: uma chamada de modelo e até 20s de
 * busca do fio por mensagem — na rajada da tuquinha, 9 de cada.
 */
let cerebroChamado = 0;
/** Roda no meio do processamento (depois do "cérebro") — é como o teste (c)
 *  simula alguém do time assumindo o caso enquanto a resposta era gerada. */
let duranteOCerebro: (() => void) | null = null;

type RawMailFake = { uid: number; raw: string; oversized?: boolean; sizeBytes?: number };

function emailCru(args: { de: string; assunto: string; messageId: string | null; corpo: string }): string {
  const mid = args.messageId ? `Message-ID: ${args.messageId}\r\n` : "";
  return (
    `From: Tuquinha <${args.de}>\r\n` +
    `Subject: ${args.assunto}\r\n` +
    mid +
    `Content-Type: text/plain; charset=utf-8\r\n` +
    `\r\n` +
    `${args.corpo}\r\n`
  );
}

/** Cria o chamado de atendimento como `abrirChamadoReportado` criaria. */
function abrirChamado(email: string): Incidente {
  const inc: Incidente = {
    id: `inc-${incidentes.length + 1}`,
    numero: 415,
    status: "open",
    affected_emails: [email],
    agent_notes: [],
  };
  incidentes.push(inc);
  return inc;
}

/** Faz o que o `entregarAoTime` de verdade faz: status + a nota COM `tipo`. */
function entregarDeVerdade(inc: Incidente) {
  inc.status = "investigating";
  inc.agent_notes.push({
    at: new Date().toISOString(),
    by: "carol",
    note: "Time avisado no grupo do WhatsApp…",
    tipo: "entregue_humano",
  });
}

/**
 * Banco de mentira. Atende `incidents` (a trava), `agent_state` (dedupe do
 * #259), `profiles` e o `claim_alert`.
 */
function admin() {
  const builder = (tabela: string) => {
    let modo: "select" | "update" = "select";
    let payload: Record<string, unknown> = {};
    let alvoId: string | null = null;
    const api: Record<string, unknown> = {
      select() {
        modo = "select";
        return api;
      },
      update(p: Record<string, unknown>) {
        modo = "update";
        payload = p;
        return api;
      },
      eq(col: string, val: unknown) {
        if (col === "id") alvoId = String(val);
        if (modo === "update" && tabela === "incidents") {
          const inc = incidentes.find((i) => i.id === alvoId);
          if (inc) Object.assign(inc, payload);
          return Promise.resolve({ error: null });
        }
        return api;
      },
      /** É por aqui que `casoComHumano` pergunta. */
      contains(_col: string, valores: string[]) {
        if (consultaQuebrada) return Promise.resolve({ data: null, error: { message: "banco fora do ar" } });
        const alvo = valores[0];
        return Promise.resolve({
          data: incidentes.filter((i) => i.affected_emails.includes(alvo)),
          error: null,
        });
      },
      ilike() {
        return api;
      },
      gte() {
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return Promise.resolve({ data: [], error: null });
      },
      maybeSingle() {
        if (tabela === "agent_state") {
          return Promise.resolve({
            data: estado.fast_mail_replied ? { value: estado.fast_mail_replied } : null,
            error: null,
          });
        }
        if (tabela === "incidents") {
          return Promise.resolve({ data: incidentes.find((i) => i.id === alvoId) ?? null, error: null });
        }
        return Promise.resolve({ data: null, error: null }); // profiles: sem conta
      },
      upsert(row: { key: string; value: unknown }) {
        estado[row.key] = row.value;
        return Promise.resolve({ error: null });
      },
      delete() {
        return api;
      },
      then: undefined,
    };
    return api;
  };
  return {
    from: (t: string) => builder(t),
    rpc: async (nome: string) => (nome === "claim_alert" ? { data: true, error: null } : { data: null, error: null }),
  };
}

let mailRespond: typeof import("./mail-respond.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => admin() } });
  mock.module("./mail-imap", {
    namedExports: {
      supportMailConfigured: () => true,
      fetchUnseen: async () => fila,
      markSeen: async (uid: number) => {
        marcados.push(uid);
      },
      fetchThread: async () => [],
    },
  });
  mock.module("./mail-smtp", {
    namedExports: {
      sendSupportMail: async (m: Enviado) => {
        enviados.push({ to: m.to, subject: m.subject, text: m.text });
      },
    },
  });
  mock.module("./brain", {
    namedExports: {
      buildAgentReply: async () => {
        cerebroChamado += 1;
        // A janela real entre a checagem de cima e o envio: aqui é onde o time
        // assume o caso no teste (c).
        if (duranteOCerebro) duranteOCerebro();
        return "Oi! Recebi seu pedido.\n\n[ESCALAR: aluna pede reembolso de R$ 2.712,12]\n\nAbraço,\nFast";
      },
      AGENT_MODEL: "teste",
    },
  });
  mock.module("./respond", { namedExports: { agentEnabled: async () => true } });
  mock.module("./account", { namedExports: { buildAccountContext: async () => null } });
  mock.module("./mail-anexos", { namedExports: { guardarPrints: async () => [] } });
  mock.module("./mail-bounce-registro", { namedExports: { tratarSeForBounce: async () => null } });
  mock.module("@/lib/incidents/espera", { namedExports: { reabrirPorRespostaDoAluno: async () => [] } });
  mock.module("@/lib/incidents/reportar", {
    namedExports: {
      abrirChamadoReportado: async () => {
        const existente = incidentes.find((i) => i.affected_emails.includes(ALUNA));
        return (existente ?? abrirChamado(ALUNA)).numero;
      },
    },
  });
  mock.module("@/lib/incidents/entregar", {
    namedExports: {
      // Espelha o efeito do entregarAoTime real: marca o chamado como entregue.
      entregarAoTime: async () => {
        const inc = incidentes.find((i) => i.affected_emails.includes(ALUNA));
        if (inc) entregarDeVerdade(inc);
        return true;
      },
    },
  });
  mock.module("@/lib/winback/conversation", {
    namedExports: {
      winbackContextByEmail: async () => null,
      applyWinbackMarkers: async () => ({ clean: "", creditou: 0 }),
    },
  });
  mailRespond = await import("./mail-respond.ts");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

function zerar() {
  enviados.length = 0;
  marcados.length = 0;
  incidentes = [];
  estado = {};
  consultaQuebrada = false;
  duranteOCerebro = null;
  cerebroChamado = 0;
  fila = [];
}

async function varrer(mensagens: RawMailFake[]) {
  fila = mensagens;
  process.env.AGENT_MAIL_ENABLED = "1";
  return mailRespond!.sweepSupportMail();
}

/** Uma mensagem NOVA da aluna (Message-ID sempre diferente — é o ponto). */
function daAluna(uid: number, corpo: string): RawMailFake {
  return {
    uid,
    raw: emailCru({
      de: ALUNA,
      assunto: "Reembolso",
      messageId: `<msg-${uid}@hotmail.com>`,
      corpo,
    }),
  };
}

test("(a) caso ENTREGUE ao humano → a Fast não responde", pular, async () => {
  zerar();
  entregarDeVerdade(abrirChamado(ALUNA));

  await varrer([daAluna(1, "e aí, alguma novidade do meu reembolso?")]);

  assert.equal(
    enviados.length,
    0,
    `com o caso na mão do time a casa tem que ficar calada. Saiu: ${JSON.stringify(enviados)}`,
  );
  assert.ok(marcados.includes(1), "mesmo calada, a mensagem é marcada como lida — senão trava a fila pra sempre");
  assert.equal(
    cerebroChamado,
    0,
    "com dono conhecido ANTES de gerar, nem o cérebro nem a busca do fio deviam ter rodado",
  );
});

test("(a3) a trava de antes de gerar existe pra não pagar o cérebro à toa", pular, async () => {
  zerar();
  entregarDeVerdade(abrirChamado(ALUNA));

  for (let uid = 1; uid <= 9; uid++) await varrer([daAluna(uid, `mensagem ${uid}`)]);

  assert.equal(
    cerebroChamado,
    0,
    "a rajada inteira tem que sair de graça: 9 chamadas de modelo + 9 buscas de fio (até 20s cada) é o desperdício que a primeira trava evita",
  );
});

test("(a2) a rajada da tuquinha: 9 mensagens NOVAS, nenhuma resposta", pular, async () => {
  zerar();
  entregarDeVerdade(abrirChamado(ALUNA));

  for (let uid = 1; uid <= 9; uid++) {
    await varrer([daAluna(uid, `mensagem ${uid} — e o meu dinheiro?`)]);
  }

  assert.equal(
    enviados.length,
    0,
    "são 9 Message-IDs DIFERENTES: a trava do #259 deixaria passar as 9, que é exatamente o que aconteceu",
  );
});

test("(b) aluno SEM caso entregue é respondido normalmente", pular, async () => {
  zerar();
  await varrer([daAluna(10, "oi, o áudio saiu cortado")]);
  assert.equal(enviados.length, 1, "a trava não pode calar quem não tem caso com dono — silêncio é o dano pior");
  assert.equal(enviados[0].to, ALUNA);
});

test("(b2) outro aluno não é afetado pelo caso da tuquinha", pular, async () => {
  zerar();
  entregarDeVerdade(abrirChamado(ALUNA));

  await varrer([
    { uid: 11, raw: emailCru({ de: "outro@gmail.com", assunto: "Ajuda", messageId: "<o-1@x>", corpo: "meu vídeo falhou" }) },
  ]);

  assert.equal(enviados.length, 1, "a trava é POR ALUNO (affected_emails), não global");
  assert.equal(enviados[0].to, "outro@gmail.com");
});

test("(c) o time assume DURANTE o processamento → não envia (re-checagem)", pular, async () => {
  zerar();
  const inc = abrirChamado(ALUNA);
  // Na primeira checagem o caso ainda não tem dono; alguém assume enquanto o
  // cérebro gera a resposta. É a janela do fio (até 20s) + modelo.
  duranteOCerebro = () => entregarDeVerdade(inc);

  await varrer([daAluna(20, "por favor me respondam")]);

  assert.equal(
    enviados.length,
    0,
    "checar só no começo deixaria escapar justamente a resposta mais lenta, que é a mais perigosa",
  );
  assert.ok(marcados.includes(20), "a mensagem continua sendo marcada como lida");
});

test("(d) a sequência real: responde ANTES da entrega, cala DEPOIS", pular, async () => {
  zerar();

  // 1ª mensagem: não existe caso ainda. A Fast responde E escala — e é a
  // escalação que entrega o caso ao time (entregarAoTime).
  await varrer([daAluna(30, "quero meu dinheiro de volta, R$ 2.712,12")]);
  assert.equal(enviados.length, 1, "o primeiro contato tem que ser respondido");

  // 2ª e 3ª: o caso já tem dono.
  await varrer([daAluna(31, "e aí?")]);
  await varrer([daAluna(32, "isso aí está muito bagunçado")]);

  assert.equal(
    enviados.length,
    1,
    `só o tratamento ANTERIOR à entrega responde. Saiu: ${JSON.stringify(enviados.map((e) => e.text.slice(0, 40)))}`,
  );
});

test("(e) calar deixa RASTRO no chamado — a mensagem do aluno não pode sumir", pular, async () => {
  zerar();
  const inc = abrirChamado(ALUNA);
  entregarDeVerdade(inc);
  const antes = inc.agent_notes.length;

  await varrer([daAluna(40, "isso aí está muito bagunçado")]);

  assert.equal(inc.agent_notes.length, antes + 1, "o silêncio tem que virar nota no chamado");
  const nota = inc.agent_notes[inc.agent_notes.length - 1];
  assert.match(nota.note, /isso aí está muito bagunçado/, "o que ele disse vai na nota, senão o time reabre às cegas");
  assert.match(nota.note, /O QUE FAZER/, "formato da casa: o que fazer primeiro");
  assert.ok(inc.last_seen_at, "o caso sobe na fila em vez de envelhecer parado");
});

test("(f) chamado FECHADO destrava a Fast", pular, async () => {
  zerar();
  const inc = abrirChamado(ALUNA);
  entregarDeVerdade(inc);
  inc.status = "fixed"; // alguém do time respondeu e fechou

  await varrer([daAluna(50, "oi, tenho outra dúvida")]);

  assert.equal(
    enviados.length,
    1,
    "fechar o chamado é o que solta a trava — sem isso a aluna ficaria muda pra sempre",
  );
});

test("(g) se a consulta FALHA, a Fast responde assim mesmo (falha-aberta)", pular, async () => {
  zerar();
  entregarDeVerdade(abrirChamado(ALUNA));
  consultaQuebrada = true;

  await varrer([daAluna(60, "alguma novidade?")]);

  assert.equal(
    enviados.length,
    1,
    "banco fora do ar atinge todo mundo: falhar fechado calaria a casa inteira, inclusive pra quem não tem chamado",
  );
});
