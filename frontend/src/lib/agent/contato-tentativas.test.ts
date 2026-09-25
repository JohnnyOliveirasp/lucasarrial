/**
 * Testes do histórico de contato. Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/contato-tentativas.test.ts
 *
 * O CASO QUE ESTES TESTES RECONSTITUEM é real e está no incidente b32af5ff
 * (valdene_marques@msn.com): dois bounces de caixa cheia em 10/09 e uma
 * terceira tentativa em 13/09 que ENTROU. A ficha continuou pedindo reenvio
 * mesmo assim, e quatro ordens de reenvio nasceram dela. O teste que mais
 * importa aqui é o `nao-reenviar-ja-entrou`: é ele que falha se alguém voltar
 * a tratar a última tentativa como se a primeira ainda fosse a única.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JANELA_VEREDITO_MS,
  blocoDeTentativas,
  descreverTentativa,
  passoDoHistorico,
  reescreverFichaDeBounce,
  resumirContato,
  veredictoDaTentativa,
  type TentativaDeContato,
} from "./contato-tentativas.ts";

const AGORA = Date.parse("2026-09-14T22:00:00.000Z");
const bounce = (enviadoEm: string, bounceEm: string, origem = "sgp-boas-vindas"): TentativaDeContato => ({
  enviadoEm,
  assunto: "Seu Sistema de Geração Pronto: comece por aqui",
  origem,
  bounceEm,
  bounceClasse: "caixa-cheia",
});
const semBounce = (enviadoEm: string, origem = "fast-resposta"): TentativaDeContato => ({
  enviadoEm,
  assunto: "Valdeni, reenviando: sua conta",
  origem,
  bounceEm: null,
  bounceClasse: null,
});

// ---------- veredito de uma tentativa ----------

test("bounce carimbado é NÃO CHEGOU, e isso é prova", () => {
  const t = bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z");
  assert.equal(veredictoDaTentativa(t, AGORA), "nao-chegou");
});

test("envio recente sem bounce ainda NÃO conclui nada", () => {
  const t = semBounce(new Date(AGORA - 5 * 60 * 1000).toISOString());
  assert.equal(veredictoDaTentativa(t, AGORA), "aguardando-veredito");
});

test("passada a janela sem bounce, vira evidência de entrada", () => {
  const t = semBounce(new Date(AGORA - JANELA_VEREDITO_MS - 1000).toISOString());
  assert.equal(veredictoDaTentativa(t, AGORA), "sem-bounce");
});

test("data ilegível NUNCA vira entrega presumida", () => {
  const t = semBounce("data-que-nao-existe");
  assert.equal(veredictoDaTentativa(t, AGORA), "aguardando-veredito");
});

// ---------- a regra de parada (o ponto 3 do card) ----------

test("CASO VALDENI: 2 bounces + 1 entrega ⇒ NÃO REENVIE", () => {
  const r = resumirContato({
    tentativas: [
      bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z"),
      bounce("2026-09-10T22:08:05Z", "2026-09-10T22:08:13Z"),
      semBounce("2026-09-13T22:13:12Z"),
    ],
    fichaDesde: "2026-09-10T12:25:00Z",
    agoraMs: AGORA,
  });
  assert.equal(r.ultimoVeredicto, "sem-bounce");
  assert.equal(r.naoChegaram, 2);
  assert.equal(r.recomendacao, "nao-reenviar-ja-entrou");

  const passo = passoDoHistorico(r, AGORA) ?? "";
  assert.match(passo, /NÃO REENVIE/);
  // A armadilha concreta da 4ª ordem: gerar link novo apagaria a prova.
  assert.match(passo, /recovery_sent_at/);
});

test("2 bounces seguidos sem nenhuma entrada ⇒ pare e use canal externo", () => {
  const r = resumirContato({
    tentativas: [
      bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z"),
      bounce("2026-09-10T22:08:05Z", "2026-09-10T22:08:13Z"),
    ],
    fichaDesde: "2026-09-10T12:25:00Z",
    agoraMs: AGORA,
  });
  assert.equal(r.recomendacao, "parar-por-email-usar-canal-externo");
  const passo = passoDoHistorico(r, AGORA) ?? "";
  assert.match(passo, /PARE DE INSISTIR POR E-MAIL/);
  // Canal externo em nome da casa não é alçada de agente sozinho.
  assert.match(passo, /aval humano/);
});

test("UM bounce só mantém a orientação padrão da classe (não inventa regra)", () => {
  const r = resumirContato({
    tentativas: [bounce("2026-09-14T21:52:31Z", "2026-09-14T21:55:04Z")],
    fichaDesde: "2026-09-14T21:55:00Z",
    agoraMs: AGORA,
  });
  assert.equal(r.recomendacao, "sem-historico");
  assert.equal(passoDoHistorico(r, AGORA), null);
});

test("envio recém-saído manda ESPERAR, não reenviar", () => {
  const r = resumirContato({
    tentativas: [semBounce(new Date(AGORA - 3 * 60 * 1000).toISOString())],
    fichaDesde: "2026-09-14T20:00:00Z",
    agoraMs: AGORA,
  });
  assert.equal(r.recomendacao, "esperar-veredito");
  assert.match(passoDoHistorico(r, AGORA) ?? "", /ESPERE O VEREDITO/);
});

// ---------- o zero cego (a armadilha da migration 108) ----------

test("ficha ANTERIOR ao registro avisa que a lista está incompleta", () => {
  const r = resumirContato({
    tentativas: [],
    fichaDesde: "2026-09-10T12:25:00Z", // antes da migration 108
    agoraMs: AGORA,
  });
  assert.equal(r.cobertura, "parcial");
  const bloco = blocoDeTentativas(r, AGORA).join("\n");
  // O ponto: "nenhuma registrada" NUNCA pode ser lido como "ninguém tentou".
  assert.match(bloco, /sem registro/);
  assert.match(bloco, /migration 108/);
});

test("ficha NASCIDA depois do registro não recebe aviso de cobertura", () => {
  const r = resumirContato({
    tentativas: [],
    fichaDesde: "2026-09-14T20:00:00Z",
    agoraMs: AGORA,
  });
  assert.equal(r.cobertura, "completa");
  // Bloco vazio: melhor calar do que exibir um "0 tentativas" sem sentido.
  assert.deepEqual(blocoDeTentativas(r, AGORA), []);
});

// ---------- o texto que vai pra ficha ----------

test('a linha de "sem bounce" jamais afirma entrega ou leitura', () => {
  const linha = descreverTentativa(semBounce("2026-09-13T22:13:12Z"), 3, AGORA);
  assert.match(linha, /NÃO é prova de leitura/);
  // A doutrina do mail-envio.ts: não existe "entregue" em lugar nenhum.
  assert.doesNotMatch(linha, /ENTREGUE/);
});

test("o bloco numera as tentativas e mostra canal, data e veredito", () => {
  const r = resumirContato({
    tentativas: [
      bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z"),
      semBounce("2026-09-13T22:13:12Z"),
    ],
    fichaDesde: "2026-09-14T20:00:00Z",
    agoraMs: AGORA,
  });
  const bloco = blocoDeTentativas(r, AGORA);
  assert.match(bloco[0], /TENTATIVAS DE CONTATO \(2\)/);
  assert.match(bloco[1], /10\/09 12:22Z/);
  assert.match(bloco[1], /sgp-boas-vindas/);
  assert.match(bloco[1], /NÃO CHEGOU \(caixa-cheia\)/);
  assert.match(bloco[2], /13\/09 22:13Z/);
});

test("tentativas fora de ordem são ordenadas pela data de envio", () => {
  const r = resumirContato({
    tentativas: [semBounce("2026-09-13T22:13:12Z"), bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z")],
    fichaDesde: "2026-09-14T20:00:00Z",
    agoraMs: AGORA,
  });
  // Sem a ordenação, o "último veredito" seria o do bounce de 10/09 e a ficha
  // voltaria a pedir reenvio de uma mensagem que já entrou.
  assert.equal(r.ultimoVeredicto, "sem-bounce");
  assert.equal(r.recomendacao, "nao-reenviar-ja-entrou");
});

// ---------- RECÁLCULO NA LEITURA (o furo da 1ª versão deste conserto) ----------

/**
 * A ficha como o `descrever()` do mail-bounce.ts a grava: o rodapé (assunto,
 * Message-ID, diagnóstico) é o que a reescrita NÃO pode comer.
 */
const FICHA_DA_CLASSE = [
  "A resposta do suporte@ para valdene_marques@msn.com NÃO foi entregue: a caixa do destinatário está sem espaço (falha temporária).",
  "",
  'O 250 do SMTP só disse "aceitei pra entrega" — a recusa veio depois, por bounce, e a fila',
  "considerou o aluno respondido. Ele está em silêncio SEM saber, e não adianta esperar retorno dele.",
  "",
  "PRÓXIMO PASSO: Tentar de novo mais tarde costuma funcionar. Se persistir, avisar por outro canal — ele não recebe NADA enquanto estiver cheia.",
  "",
  "Assunto que não chegou: Seu Sistema de Geração Pronto: comece por aqui",
  "Message-ID do envio: <abc@fastcloner.com>",
  "Diagnóstico cru do servidor: 554 5.2.2 mailbox full",
].join("\n");

const resumoDe = (tentativas: TentativaDeContato[]) =>
  resumirContato({ tentativas, fichaDesde: "2026-09-14T20:00:00Z", agoraMs: AGORA });

const B1 = bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z");
const B2 = bounce("2026-09-10T22:08:05Z", "2026-09-10T22:08:13Z");
const OK3 = semBounce("2026-09-13T22:13:12Z");

test("O FURO QUE O GERENTE PEGOU: reenvio que DEU CERTO vira NÃO REENVIE na leitura, sem bounce novo", () => {
  // 1) Como a ficha ficou gravada no 2º bounce (10/09): pare de insistir.
  const gravada = reescreverFichaDeBounce(FICHA_DA_CLASSE, resumoDe([B1, B2]), AGORA);
  assert.match(gravada, /PARE DE INSISTIR POR E-MAIL/);

  // 2) 13/09 22:13Z: a 3ª tentativa ENTRA. Nenhum bounce chega, então NADA
  //    reescreve a ficha no banco — ela continua com o texto de (1). É aqui que
  //    a 1ª versão deste conserto parava, e é por isso que quatro ordens de
  //    reenvio nasceram. Agora a LEITURA refaz a conta:
  const lida = reescreverFichaDeBounce(gravada, resumoDe([B1, B2, OK3]), AGORA);
  assert.match(lida, /NÃO REENVIE POR E-MAIL/);
  assert.doesNotMatch(lida, /PARE DE INSISTIR POR E-MAIL/);
  assert.doesNotMatch(lida, /Tentar de novo mais tarde/);

  // Um passo só: a reescrita SUBSTITUI a região, não empilha conselho novo em
  // cima do velho — duas orientações contraditórias na mesma ficha seriam pior
  // que a ficha errada.
  assert.equal(lida.split("\n").filter((l) => l.startsWith("PRÓXIMO PASSO: ")).length, 1);
  assert.equal(lida.split("\n").filter((l) => l.startsWith("TENTATIVAS DE CONTATO")).length, 1);

  // O rodapé de diagnóstico sobrevive inteiro.
  assert.match(lida, /Message-ID do envio: <abc@fastcloner\.com>/);
  assert.match(lida, /Diagnóstico cru do servidor: 554 5\.2\.2 mailbox full/);
  // E o cabeçalho também.
  assert.match(lida, /^A resposta do suporte@ para valdene_marques@msn\.com NÃO foi entregue/);
});

test("reler sem nada ter mudado devolve a MESMA ficha (idempotente)", () => {
  const r = resumoDe([B1, B2, OK3]);
  const uma = reescreverFichaDeBounce(FICHA_DA_CLASSE, r, AGORA);
  assert.equal(reescreverFichaDeBounce(uma, r, AGORA), uma);
});

test("sem histórico que mande algo, o passo GRAVADO da classe é preservado", () => {
  // Um bounce só: `passoDoHistorico` devolve null. A orientação da classe
  // continua correta pro primeiro bounce e não pode ser apagada.
  const lida = reescreverFichaDeBounce(FICHA_DA_CLASSE, resumoDe([B1]), AGORA);
  assert.match(lida, /Tentar de novo mais tarde costuma funcionar/);
  assert.match(lida, /TENTATIVAS DE CONTATO \(1\)/);
});

test("descrição fora do formato volta INTACTA (não adivinha onde enfiar o bloco)", () => {
  const estranha = "chamado aberto na mão pelo formulário da aba Falhas, sem passo nenhum";
  assert.equal(reescreverFichaDeBounce(estranha, resumoDe([B1, B2, OK3]), AGORA), estranha);
  assert.equal(reescreverFichaDeBounce("", resumoDe([B1]), AGORA), "");
});

// ---------- A SEGUNDA FONTE: o cartão desmente o silêncio do ledger ----------
//
// Os dois casos abaixo são REAIS e foram medidos em 25/09 contra produção. O
// que eles têm em comum: `bounce_em` NULL no ledger e o cartão da ficha
// disparado DEPOIS do envio. Antes deste conserto os dois liam "NÃO REENVIE,
// entrou" — sobre gente que não recebeu carta nenhuma.

/** #250 — andy.silvestre@icloud.com, 21 dias parado, pagante de R$ 733,60. */
const ENVIO_250 = "2026-09-14T19:45:25.000Z";
const CARTAO_250 = "2026-09-14T19:50:04.856Z"; // 4,7 min depois do envio

test("CASO #250: cartão disparou 4,7min depois do envio ⇒ a carta NÃO chegou", () => {
  const r = resumirContato({
    tentativas: [semBounce(ENVIO_250, "reconciliado-da-pasta")],
    fichaDesde: "2026-09-04T17:20:03Z",
    fichaVistaEm: CARTAO_250,
    agoraMs: AGORA,
  });
  assert.equal(r.ultimoVeredicto, "bounce-sem-registro");
  assert.equal(r.recomendacao, "cartao-disparou-depois-do-envio");
  // Uma falha comprovada, mesmo sem carimbo: é isso que a regra de parada conta.
  assert.equal(r.naoChegaram, 1);

  const passo = passoDoHistorico(r, AGORA) ?? "";
  assert.match(passo, /NÃO CHEGOU/);
  // O que não pode voltar NUNCA: a frase que segurou o caso por 21 dias.
  assert.doesNotMatch(passo, /NÃO REENVIE POR E-MAIL/);
  assert.doesNotMatch(passo, /evidência de que ela ENTROU/);
});

test("CASO #250: a linha da tentativa diz que foi o LEDGER que falhou, não o aluno", () => {
  const r = resumirContato({
    tentativas: [semBounce(ENVIO_250, "reconciliado-da-pasta")],
    fichaDesde: "2026-09-04T17:20:03Z",
    fichaVistaEm: CARTAO_250,
    agoraMs: AGORA,
  });
  const bloco = blocoDeTentativas(r, AGORA).join("\n");
  assert.match(bloco, /NÃO CHEGOU/);
  assert.match(bloco, /o ledger não carimbou bounce/);
  assert.match(bloco, /dentro da janela/);
  // A lista e o passo não podem discordar: era o risco de recalcular o veredito
  // na hora de imprimir.
  assert.doesNotMatch(bloco, /evidência de que entrou/);
});

/** #460 — thallitamachado@hotmail.com: 1 bounce carimbado + 1 sem registro. */
test("CASO #460: carimbado + sem-registro somam 2 falhas ⇒ canal externo", () => {
  const r = resumirContato({
    tentativas: [
      bounce("2026-09-17T21:48:47Z", "2026-09-17T21:50:04Z", "ronda-manual"),
      semBounce("2026-09-18T15:27:54Z", "reconciliado-da-pasta"),
    ],
    fichaDesde: "2026-09-17T21:50:04Z",
    fichaVistaEm: "2026-09-18T15:30:04.644Z", // 2,2 min depois do reenvio
    agoraMs: Date.parse("2026-09-25T20:00:00.000Z"),
  });
  assert.deepEqual(r.vereditos, ["nao-chegou", "bounce-sem-registro"]);
  assert.equal(r.naoChegaram, 2);
  assert.equal(r.recomendacao, "parar-por-email-usar-canal-externo");
  assert.match(passoDoHistorico(r, Date.parse("2026-09-25T20:00:00.000Z")) ?? "", /canal externo/);
});

test("disparo LONGE do envio não finge precisão que não tem", () => {
  // #447 (elianecaurim@ig.com.br): o cartão disparou 48h depois da carta. Isso
  // prova que existe bounce que o ledger não conhece — NÃO prova que foi ESTA
  // carta que bateu. O texto tem que dizer a coisa mais fraca.
  const agora = Date.parse("2026-09-25T20:00:00.000Z");
  const r = resumirContato({
    tentativas: [semBounce("2026-09-15T11:27:48Z", "ronda-manual-retroativo")],
    fichaDesde: "2026-09-17T11:35:05Z",
    fichaVistaEm: "2026-09-17T11:35:05.762Z",
    agoraMs: agora,
  });
  assert.equal(r.ultimoVeredicto, "bounce-sem-registro");
  const bloco = blocoDeTentativas(r, agora).join("\n");
  assert.match(bloco, /FORA da janela/);
  assert.match(bloco, /a lista acima está incompleta/);
  // Não pode afirmar que foi esta carta.
  assert.doesNotMatch(bloco, /É o bounce DESTA carta/);
});

// ---------- os controles: o conserto não pode disparar sozinho ----------

test("CONTROLE #338 (Valdeni): cartão visto ANTES da última carta segue NÃO REENVIE", () => {
  // É o caso original do módulo, e ele tem que continuar passando. O cartão
  // dela parou em 10/09; as cartas de 15/09 e 23/09 são POSTERIORES ao último
  // disparo, então o silêncio delas é evidência legítima de entrada.
  const agora = Date.parse("2026-09-25T20:00:00.000Z");
  const r = resumirContato({
    tentativas: [
      bounce("2026-09-10T12:22:03Z", "2026-09-10T12:22:12Z"),
      bounce("2026-09-10T22:08:05Z", "2026-09-10T22:08:13Z"),
      semBounce("2026-09-15T23:26:22Z"),
      semBounce("2026-09-23T22:06:53Z"),
    ],
    fichaDesde: "2026-09-10T12:25:04Z",
    fichaVistaEm: "2026-09-10T22:10:04.701Z",
    agoraMs: agora,
  });
  assert.equal(r.ultimoVeredicto, "sem-bounce");
  assert.equal(r.recomendacao, "nao-reenviar-ja-entrou");
  assert.match(passoDoHistorico(r, agora) ?? "", /NÃO REENVIE POR E-MAIL/);
});

test("CONTROLE: carta que JÁ tem carimbo não é reclassificada pelo disparo", () => {
  // #464 (pc.sul157@gmail.com): o cartão disparou no mesmo minuto do bounce
  // carimbado. Sobrescrever o carimbo perderia a CLASSE do bounce, que é o que
  // diz qual é o defeito.
  const agora = Date.parse("2026-09-25T20:00:00.000Z");
  const r = resumirContato({
    tentativas: [bounce("2026-09-16T10:49:49Z", "2026-09-18T10:55:04Z", "ronda-manual")],
    fichaDesde: "2026-09-18T10:55:06Z",
    fichaVistaEm: "2026-09-18T10:55:06.117Z",
    agoraMs: agora,
  });
  assert.deepEqual(r.vereditos, ["nao-chegou"]);
  assert.match(blocoDeTentativas(r, agora).join("\n"), /caixa-cheia/);
});

test("CONTROLE: o disparo acusa UMA carta, não todas as anteriores", () => {
  // Cartão disparado ENTRE duas cartas: a primeira é acusada, a segunda tem o
  // próprio veredito pelo tempo. Sem esta atribuição, um disparo condenaria
  // cartas que comprovadamente entraram e a lista viraria ficção.
  const agora = Date.parse("2026-09-25T20:00:00.000Z");
  const r = resumirContato({
    tentativas: [semBounce("2026-09-18T10:00:00Z"), semBounce("2026-09-20T10:00:00Z")],
    fichaDesde: "2026-09-18T09:00:00Z",
    fichaVistaEm: "2026-09-18T10:02:00Z",
    agoraMs: agora,
  });
  assert.deepEqual(r.vereditos, ["bounce-sem-registro", "sem-bounce"]);
  assert.equal(r.recomendacao, "nao-reenviar-ja-entrou");
});

test("CONTROLE: sem fichaVistaEm, o comportamento é EXATAMENTE o de antes", () => {
  // O conserto não pode inventar veredito a partir de informação ausente —
  // quem não passa a última notícia do cartão recebe o módulo velho.
  const r = resumirContato({
    tentativas: [semBounce(ENVIO_250, "reconciliado-da-pasta")],
    fichaDesde: "2026-09-04T17:20:03Z",
    agoraMs: AGORA,
  });
  assert.equal(r.ultimoVeredicto, "sem-bounce");
  assert.equal(r.recomendacao, "nao-reenviar-ja-entrou");
  assert.equal(r.fichaVistaEm, null);
});

test("CONTROLE: fichaVistaEm ilegível não vira acusação", () => {
  const r = resumirContato({
    tentativas: [semBounce(ENVIO_250, "reconciliado-da-pasta")],
    fichaDesde: "2026-09-04T17:20:03Z",
    fichaVistaEm: "carimbo-que-nao-existe",
    agoraMs: AGORA,
  });
  assert.equal(r.ultimoVeredicto, "sem-bounce");
  assert.equal(r.recomendacao, "nao-reenviar-ja-entrou");
});

test("a ficha gravada do #250 deixa de mandar NÃO REENVIE ao ser relida", () => {
  const ficha = [
    "A resposta do suporte@ para andy.silvestre@icloud.com NÃO foi entregue: a caixa do destinatário está sem espaço (falha temporária).",
    "",
    "PRÓXIMO PASSO: Tentar de novo mais tarde costuma funcionar.",
    "",
    "Assunto que não chegou: Anderson, 4a tentativa: sua conta do Sistema de Geracao Pronto",
  ].join("\n");
  const r = resumirContato({
    tentativas: [semBounce(ENVIO_250, "reconciliado-da-pasta")],
    fichaDesde: "2026-09-04T17:20:03Z",
    fichaVistaEm: CARTAO_250,
    agoraMs: AGORA,
  });
  const lida = reescreverFichaDeBounce(ficha, r, AGORA);
  assert.match(lida, /PRÓXIMO PASSO: A ÚLTIMA MENSAGEM NÃO CHEGOU/);
  assert.doesNotMatch(lida, /NÃO REENVIE POR E-MAIL/);
  // O rodapé da ficha (o diagnóstico cru) segue intacto.
  assert.match(lida, /Assunto que não chegou:/);
});
