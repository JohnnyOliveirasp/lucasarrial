/**
 * SIMULAÇÃO DA RESPOSTA EM DOBRO (#259) — a prova de que a mesma mensagem
 * reentregue com uid NOVO recebe UMA resposta só.
 *
 * O caso real que isto reproduz: katiasalvador32@gmail.com recebeu CINCO
 * respostas com o mesmo assunto — enviados uid 641, 644, 645 (04/09, três em
 * cinco minutos) e uid 1055, 1056 (05/09, no dia seguinte). Os uids são
 * diferentes; a MENSAGEM é a mesma. É por isso que o teste entrega o mesmo
 * Message-ID em uids diferentes: é exatamente a forma do defeito.
 *
 * O QUE ESTE ARQUIVO PRECISA PROVAR, e por que cada ponto existe:
 *   (a) reentrega da MESMA mensagem → 1 envio (o defeito);
 *   (b) mensagem DIFERENTE do mesmo aluno → 2 envios. Sem isto o "fix" seria
 *       calar o aluno que escreve duas vezes, que é o dano oposto e pior;
 *   (c) envio que FALHA → a reserva é liberada e a próxima varredura tenta de
 *       novo. Senão um erro de SMTP viraria silêncio permanente;
 *   (d) mensagem SEM Message-ID → responde (não dá pra deduplicar, e o padrão
 *       tem que ser falar, não calar);
 *   (e) o caminho de ANEXO GRANDE também deduplica — foi por ele que a Katia
 *       passou quando reenviou os 31MB;
 *   (f) leitura do estado FALHANDO → responde assim mesmo (falha-aberta).
 *
 * Como rodar (precisa do resolvedor de alias + mock de módulo):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/agent/mail-dedupe-simulacao.test.ts
 *
 * Sem essas flags o arquivo se marca como SKIP em vez de derrubar a suíte —
 * o resto dos testes da casa roda com `node --test` pelado.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Enviado = { to: string; subject: string; text: string };

const enviados: Enviado[] = [];
const marcados: number[] = [];
/** O `agent_state` de verdade, em memória. */
let estado: Record<string, unknown> = {};
/** Liga o modo "banco caindo" pra provar a falha-aberta do item (f). */
let leituraQuebrada = false;
let smtpQuebrado = false;
let fila: RawMailFake[] = [];

type RawMailFake = { uid: number; raw: string; oversized?: boolean; sizeBytes?: number };

/** E-mail cru mínimo, no formato que o `header()` do mail-respond entende. */
function emailCru(args: { de: string; assunto: string; messageId: string | null; corpo: string }): string {
  const mid = args.messageId ? `Message-ID: ${args.messageId}\r\n` : "";
  return (
    `From: Katia <${args.de}>\r\n` +
    `Subject: ${args.assunto}\r\n` +
    mid +
    `Content-Type: text/plain; charset=utf-8\r\n` +
    `\r\n` +
    `${args.corpo}\r\n`
  );
}

/**
 * Cliente de banco de mentira. Só precisa atender o que o caminho testado usa:
 * `agent_state` (a trava), `profiles` (conta não encontrada) e o `claim_alert`.
 */
function admin() {
  const builder = (tabela: string) => {
    const q: Record<string, unknown> = {};
    const api: Record<string, unknown> = {
      select() {
        return api;
      },
      eq() {
        return api;
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
          if (leituraQuebrada) return Promise.resolve({ data: null, error: { message: "banco fora do ar" } });
          return Promise.resolve({ data: estado.fast_mail_replied ? { value: estado.fast_mail_replied } : null, error: null });
        }
        // profiles: aluno sem conta na plataforma (não muda nada no que é testado)
        return Promise.resolve({ data: null, error: null });
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
    void q;
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
    },
  });
  mock.module("./mail-smtp", {
    namedExports: {
      sendSupportMail: async (m: Enviado) => {
        if (smtpQuebrado) throw new Error("SMTP fora do ar");
        enviados.push({ to: m.to, subject: m.subject, text: m.text });
      },
    },
  });
  mock.module("./brain", {
    namedExports: {
      buildAgentReply: async () => "Oi, Katia! Recebi seu recado.\n\nAbraço,\nFast",
      AGENT_MODEL: "teste",
    },
  });
  mock.module("./respond", { namedExports: { agentEnabled: async () => true } });
  mock.module("./account", { namedExports: { buildAccountContext: async () => null } });
  mock.module("./mail-anexos", { namedExports: { guardarPrints: async () => [] } });
  mock.module("./mail-bounce-registro", { namedExports: { tratarSeForBounce: async () => null } });
  mock.module("@/lib/incidents/espera", { namedExports: { reabrirPorRespostaDoAluno: async () => undefined } });
  mock.module("@/lib/incidents/reportar", { namedExports: { abrirChamadoReportado: async () => 1 } });
  mock.module("@/lib/incidents/entregar", { namedExports: { entregarAoTime: async () => undefined } });
  mock.module("@/lib/winback/conversation", {
    namedExports: { winbackContextByEmail: async () => null, applyWinbackMarkers: async () => ({ clean: "", creditou: 0 }) },
  });
  mailRespond = await import("./mail-respond.ts");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

function zerar() {
  enviados.length = 0;
  marcados.length = 0;
  estado = {};
  leituraQuebrada = false;
  smtpQuebrado = false;
  fila = [];
}

/** Roda uma varredura com a fila dada. */
async function varrer(mensagens: RawMailFake[]) {
  fila = mensagens;
  process.env.AGENT_MAIL_ENABLED = "1";
  return mailRespond!.sweepSupportMail();
}

const MID_KATIA = "<CAF=abc123@mail.gmail.com>";
const CORPO = "Oi, o audio da minha voz saiu cortado, podem ver?";

test("(a) a MESMA mensagem reentregue com uid novo recebe UMA resposta só", pular, async () => {
  zerar();
  // 04/09: chega e é respondida.
  await varrer([{ uid: 641, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  assert.equal(enviados.length, 1, "a primeira entrega tem que ser respondida");

  // 05/09: o servidor reentrega a MESMA mensagem — uid novo, não lida.
  await varrer([{ uid: 1055, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);

  assert.equal(
    enviados.length,
    1,
    `reentrega NÃO pode gerar segunda resposta — foi assim que a Katia recebeu 5. Enviados: ${JSON.stringify(enviados.map((e) => e.subject))}`,
  );
  assert.ok(marcados.includes(1055), "a cópia reentregue tem que ser marcada como lida, senão trava a fila pra sempre");
});

test("(a2) a trava aguenta a rajada: 3 reentregas seguidas, 1 resposta", pular, async () => {
  zerar();
  for (const uid of [641, 644, 645]) {
    await varrer([{ uid, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  }
  assert.equal(enviados.length, 1, "os uids 641/644/645 do caso real são a MESMA mensagem");
});

test("(a3) o Message-ID é comparado sem caixa e sem <> — servidor reentrega variando isso", pular, async () => {
  zerar();
  await varrer([{ uid: 1, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  await varrer([
    { uid: 2, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: "CAF=ABC123@Mail.Gmail.Com", corpo: CORPO }) },
  ]);
  assert.equal(enviados.length, 1, "mesma mensagem com caixa/sinais diferentes continua sendo a mesma mensagem");
});

test("(b) mensagem DIFERENTE do mesmo aluno é respondida — a trava não pode calar ninguém", pular, async () => {
  zerar();
  await varrer([{ uid: 10, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  await varrer([
    {
      uid: 11,
      raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: "<outro-999@mail.gmail.com>", corpo: "Oi, tem novidade?" }),
    },
  ]);
  assert.equal(enviados.length, 2, "duas perguntas legítimas = duas respostas; deduplicar por remetente+assunto criaria silêncio");
});

test("(c) se o ENVIO falha, a reserva é liberada e a próxima varredura responde", pular, async () => {
  zerar();
  smtpQuebrado = true;
  await varrer([{ uid: 20, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  assert.equal(enviados.length, 0, "o envio falhou de propósito");
  assert.ok(!marcados.includes(20), "mensagem não respondida NÃO pode ser marcada como lida");

  smtpQuebrado = false;
  await varrer([{ uid: 21, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  assert.equal(enviados.length, 1, "falha de SMTP não pode virar silêncio permanente — a reserva tem que ter sido liberada");
});

test("(d) mensagem SEM Message-ID é respondida (não dá pra deduplicar, e o padrão é falar)", pular, async () => {
  zerar();
  await varrer([{ uid: 30, raw: emailCru({ de: "alguem@gmail.com", assunto: "Ajuda", messageId: null, corpo: CORPO }) }]);
  assert.equal(enviados.length, 1);
});

test("(e) o caminho de ANEXO GRANDE também deduplica", pular, async () => {
  zerar();
  const pesado: RawMailFake = {
    uid: 40,
    raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Print do erro", messageId: "<pesado-1@mail.gmail.com>", corpo: "" }),
    oversized: true,
    sizeBytes: 31_000_000,
  };
  // Este caminho manda DOIS e-mails por natureza: o aviso pro aluno e o
  // encaminhamento pros revisores (`encaminharParaRevisao`). Só o primeiro é
  // "responder o aluno" — contar os dois mediria a coisa errada.
  const proAluno = () => enviados.filter((e) => e.to === "katiasalvador32@gmail.com");

  await varrer([pesado]);
  assert.equal(proAluno().length, 1, "a primeira vez avisa o ALUNO que o anexo é grande demais");
  assert.match(proAluno()[0].text, /anexo grande demais/i);

  await varrer([{ ...pesado, uid: 41 }]);
  assert.equal(proAluno().length, 1, "reentrega do e-mail pesado não pode render um segundo aviso pro aluno");
});

test("(f) se a LEITURA do estado falha, a Fast responde assim mesmo (falha-aberta)", pular, async () => {
  zerar();
  leituraQuebrada = true;
  await varrer([{ uid: 50, raw: emailCru({ de: "katiasalvador32@gmail.com", assunto: "Voz cortada", messageId: MID_KATIA, corpo: CORPO }) }]);
  assert.equal(enviados.length, 1, "entre responder 2x e deixar o aluno mudo, o silêncio é o dano pior — banco fora do ar não pode calar a Fast");
});
