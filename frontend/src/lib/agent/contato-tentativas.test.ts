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
