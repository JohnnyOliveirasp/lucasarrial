/**
 * Testes da guarda de bounce PRÉ-ENVIO. Sem banco, sem rede, sem SMTP:
 *
 *   npx tsx --test _frank/ferramentas/_bounce_guarda.test.cjs
 *
 * O caso que manda aqui é o da LUCIANA (`bounce permanente SEGUIDO de envio
 * sem bounce → LIBERA`): sem ele, o conserto vira regressão e a casa passa a
 * calar com aluno cuja caixa funciona. Metade dos casos abaixo existe pra
 * provar o que a guarda **NÃO** bloqueia — porque o dano de errar pro lado
 * fechado (aluno sem resposta) é pior que o de errar pro lado aberto.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const G = require("./_bounce_guarda.cjs");

const HORA = 3600000;
/** "Agora" fixo: 20/09, o dia em que a timeline da Luciana foi medida. */
const AGORA = Date.parse("2026-09-20T12:00:00.000Z");

const envio = (enviado_em, extra = {}) => ({ enviado_em, bounce_em: null, bounce_classe: null, origem: "ronda-manual", ...extra });
const quicou = (enviado_em, bounce_em, classe) => ({ enviado_em, bounce_em, bounce_classe: classe, origem: "sgp-codigo" });

test("sem histórico nenhum: libera (o caso mais comum de todos)", () => {
  const d = G.decidirPorBounce({ historico: [], verificacoes: [] }, { agora: AGORA });
  assert.equal(d.bloqueia, false);
  assert.equal(d.bounce, null);
});

test("bounce permanente é a ÚLTIMA notícia: bloqueia", () => {
  const d = G.decidirPorBounce(
    { historico: [quicou("2026-09-17T01:04:00Z", "2026-09-17T01:05:03Z", "inexistente")] },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true);
  assert.equal(d.bounce.classe, "inexistente");
  assert.equal(d.sinais.length, 0);
});

test("LUCIANA — bounce permanente SEGUIDO de envio sem bounce: LIBERA", () => {
  // Timeline real medida em 20/09. Sem este caso o conserto vira regressão:
  // a caixa dela FUNCIONA e a guarda ingênua a teria calado.
  const d = G.decidirPorBounce(
    {
      historico: [
        quicou("2026-09-16T13:04:43Z", "2026-09-16T13:50:04Z", "inexistente"),
        envio("2026-09-16T13:15:29Z", { origem: "sgp-codigo" }),
        envio("2026-09-20T11:28:29Z"),
      ],
      verificacoes: [],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false, "a caixa da Luciana funciona — barrar aqui é o dano");
  assert.ok(d.sinais.some((s) => s.tipo === "envio-sem-bounce"));
});

test("LUCIANA — o carimbo do código (13:15:47) LIBERA, apesar de ser anterior ao bounce_em", () => {
  // ESTE É O CASO QUE DERRUBOU O PRIMEIRO DESENHO desta guarda.
  // O carimbo é POSTERIOR à carta que falhou (13:04:43) e ANTERIOR à
  // descoberta do bounce (13:50:04). Medindo contra a descoberta, a prova de
  // que a caixa funciona é jogada fora e a aluna é calada. A âncora certa é a
  // tentativa que falhou — ver `ancoraDoBounce`.
  const d = G.decidirPorBounce(
    {
      historico: [quicou("2026-09-16T13:04:43Z", "2026-09-16T13:50:04Z", "inexistente")],
      verificacoes: ["2026-09-16T13:15:47Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false, "o código foi confirmado DEPOIS da carta que quicou");
  assert.equal(d.sinais[0].forca, "prova");
});

test("a âncora é o enviado_em da carta que falhou, não o bounce_em da descoberta", () => {
  // Bounce descoberto 50 h depois do envio: tudo que aconteceu no meio é
  // notícia legítima sobre a caixa, e só a âncora certa enxerga isso.
  const entrada = {
    historico: [quicou("2026-09-10T00:00:00Z", "2026-09-12T02:00:00Z", "inexistente")],
    verificacoes: ["2026-09-11T00:00:00Z"], // entre o envio e a descoberta
  };
  assert.equal(G.decidirPorBounce(entrada, { agora: AGORA }).bloqueia, false);
  // E o que for anterior à própria tentativa continua sem valer.
  const antes = {
    historico: entrada.historico,
    verificacoes: ["2026-09-09T00:00:00Z"],
  };
  assert.equal(G.decidirPorBounce(antes, { agora: AGORA }).bloqueia, true);
});

test("bounce permanente SEGUIDO de email_verificado_at posterior: LIBERA (prova)", () => {
  const d = G.decidirPorBounce(
    {
      historico: [quicou("2026-09-16T13:04:43Z", "2026-09-16T13:50:04Z", "inexistente")],
      verificacoes: ["2026-09-16T14:30:00Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
  assert.equal(d.sinais[0].tipo, "codigo-confirmado");
  assert.equal(d.sinais[0].forca, "prova");
});

test("email_verificado_at ANTERIOR à tentativa que falhou não salva", () => {
  // Carimbo velho não reabre porta: a caixa pode ter morrido DEPOIS dele, e
  // foi exatamente isso que o bounce provou.
  const d = G.decidirPorBounce(
    {
      historico: [quicou("2026-09-16T13:04:43Z", "2026-09-16T13:50:04Z", "inexistente")],
      verificacoes: ["2026-09-01T09:00:00Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true);
});

test("caixa-cheia nunca bloqueia, mesmo sendo a última notícia", () => {
  const d = G.decidirPorBounce(
    { historico: [quicou("2026-09-17T21:48:00Z", "2026-09-17T21:50:04Z", "caixa-cheia")] },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
  assert.equal(d.bounce, null);
});

test("temporaria nunca bloqueia", () => {
  const d = G.decidirPorBounce(
    { historico: [quicou("2026-09-17T00:00:00Z", "2026-09-17T01:00:03Z", "temporaria")] },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
});

test("desconhecida NÃO bloqueia — não-reconhecido não é veredito", () => {
  // 3 dos 11 bounces reais da base são desta classe (guitaschetti x2,
  // alinedutra_) e nenhum indica endereço inválido. Bloquear aqui seria
  // transformar ignorância em sentença.
  const d = G.decidirPorBounce(
    { historico: [quicou("2026-09-20T10:22:00Z", "2026-09-20T10:25:04Z", "desconhecida")] },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
});

test("--forcar passa mesmo com bounce permanente sendo a última notícia", () => {
  const d = G.decidirPorBounce(
    { historico: [quicou("2026-09-17T01:04:00Z", "2026-09-17T01:05:03Z", "inexistente")] },
    { agora: AGORA, forcar: true },
  );
  assert.equal(d.bloqueia, false);
  assert.equal(d.forcado, true);
  // Forçar não apaga o achado: quem força precisa VER o que está atropelando.
  assert.equal(d.bounce.classe, "inexistente");
  assert.ok(d.motivo);
});

test("--forcar passa também quando já estava liberado (não inventa bloqueio)", () => {
  const d = G.decidirPorBounce({ historico: [] }, { agora: AGORA, forcar: true });
  assert.equal(d.bloqueia, false);
});

test("envio posterior AINDA VERDE não conta como vida, e sai listado à parte", () => {
  // A armadilha que se auto-destrói: logo depois do envio, "sem bounce" quer
  // dizer "o bounce ainda não chegou". Se isso liberasse, bastava insistir uma
  // vez pra desarmar a guarda pra sempre.
  const d = G.decidirPorBounce(
    {
      historico: [
        quicou("2026-09-19T10:00:00Z", "2026-09-19T10:05:00Z", "inexistente"),
        envio("2026-09-20T11:00:00Z"), // 1 h atrás: verde
      ],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true, "carta de 1h atrás não prova entrega nenhuma");
  assert.equal(d.sinais.length, 0);
  assert.equal(d.verdes.length, 1);
});

test("o mesmo envio, já maduro (>24h), passa a contar como vida", () => {
  const d = G.decidirPorBounce(
    {
      historico: [
        quicou("2026-09-17T10:00:00Z", "2026-09-17T10:05:00Z", "inexistente"),
        envio("2026-09-19T10:00:00Z"), // 26 h atrás
      ],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
  assert.equal(d.sinais[0].forca, "indicio");
});

test("maturação é regulável e maturacaoHoras=0 faz qualquer envio posterior contar", () => {
  const entrada = {
    historico: [
      quicou("2026-09-19T10:00:00Z", "2026-09-19T10:05:00Z", "inexistente"),
      envio("2026-09-20T11:00:00Z"),
    ],
  };
  assert.equal(G.decidirPorBounce(entrada, { agora: AGORA, maturacaoHoras: 0 }).bloqueia, false);
  assert.equal(G.decidirPorBounce(entrada, { agora: AGORA, maturacaoHoras: 48 }).bloqueia, true);
});

test("segundo bounce permanente DEPOIS do sinal de vida fecha de novo", () => {
  // A caixa reviveu e voltou a morrer. Vale a notícia mais RECENTE, sempre.
  const d = G.decidirPorBounce(
    {
      historico: [
        quicou("2026-09-10T10:00:00Z", "2026-09-10T10:05:00Z", "inexistente"),
        envio("2026-09-12T10:00:00Z"),
        quicou("2026-09-18T10:00:00Z", "2026-09-18T10:05:00Z", "inexistente"),
      ],
      verificacoes: ["2026-09-12T11:00:00Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true);
  assert.equal(d.bounce.at, "2026-09-18T10:05:00Z");
});

test("bounce_em ilegível NÃO atrapalha: o enviado_em legível ainda ancora", () => {
  const d = G.decidirPorBounce(
    {
      historico: [
        quicou("2026-09-10T10:00:00Z", "data-que-nao-da-pra-ler", "inexistente"),
        envio("2026-09-12T10:00:00Z"),
      ],
      verificacoes: ["2026-09-13T10:00:00Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
  assert.equal(d.bounce.dataIlegivel, false);
});

test("SEM NENHUMA data legível o bounce fecha: nada se prova posterior a ele", () => {
  // Fecha de propósito. Se não dá pra dizer QUANDO a entrega falhou, não dá
  // pra dizer que o sinal de vida veio depois — e supor que veio é o erro que
  // manda carta pra endereço morto.
  const d = G.decidirPorBounce(
    {
      historico: [
        { enviado_em: "sem-data", bounce_em: "tambem-sem-data", bounce_classe: "inexistente" },
        envio("2026-09-12T10:00:00Z"),
      ],
      verificacoes: ["2026-09-13T10:00:00Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true);
  assert.equal(d.bounce.dataIlegivel, true);
});

test("o bounce ilegível VENCE outro permanente datado (o mais restritivo manda)", () => {
  const d = G.decidirPorBounce(
    {
      historico: [
        quicou("2026-09-10T10:00:00Z", "2026-09-10T10:05:00Z", "inexistente"),
        { enviado_em: "sem-data", bounce_em: "sem-data", bounce_classe: "inexistente" },
      ],
      verificacoes: ["2026-09-13T10:00:00Z"],
    },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true);
  assert.equal(d.bounce.dataIlegivel, true);
});

test("spam-saida e bloqueio-destino também fecham (reenviar não resolve)", () => {
  for (const classe of ["spam-saida", "bloqueio-destino"]) {
    const d = G.decidirPorBounce(
      { historico: [quicou("2026-09-17T01:04:00Z", "2026-09-17T01:05:03Z", classe)] },
      { agora: AGORA },
    );
    assert.equal(d.bloqueia, true, `${classe} deveria fechar`);
  }
});

test("classe vem com caixa/espaço diferente e ainda é reconhecida", () => {
  const d = G.decidirPorBounce(
    { historico: [quicou("2026-09-17T01:04:00Z", "2026-09-17T01:05:03Z", " INEXISTENTE ")] },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, true);
});

test("linha com bounce_classe nula não é tratada como permanente", () => {
  const d = G.decidirPorBounce(
    { historico: [{ enviado_em: "2026-09-17T01:04:00Z", bounce_em: "2026-09-17T01:05:03Z", bounce_classe: null }] },
    { agora: AGORA },
  );
  assert.equal(d.bloqueia, false);
});

test("entrada vazia/indefinida não explode", () => {
  assert.equal(G.decidirPorBounce().bloqueia, false);
  assert.equal(G.decidirPorBounce({}, {}).bloqueia, false);
  assert.equal(G.decidirPorBounce({ historico: [null, undefined] }, { agora: AGORA }).bloqueia, false);
});
