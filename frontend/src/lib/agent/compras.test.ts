/**
 * Testes da linha COMPRAS NA HOTMART. Rodar (Node ≥ 22.18):
 *   node --test src/lib/agent/compras.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE: `linhaDasCompras` é a única coisa que impede a
 * Fast de prometer crédito a quem comprou curso, e é uma linha que ela é
 * mandada OBEDECER. Errar aqui não quebra nada — o e-mail sai bonito, educado
 * e mentiroso, exatamente como saiu pro Hugo em 08/09. É o mesmo formato do
 * #198 e do #265: defeito silencioso em texto que decide dinheiro.
 *
 * OS IDS SÃO REAIS, conferidos em `payment_events` em 08/09/2026:
 *   7851642 (FastCloner)                    — 1.145 compradores APPROVED
 *   7283229 (Sistema de Geração Pronto)     — 103 compradores APPROVED
 *   7283335 (Fábrica de Conteúdo Invisível) — 12 compradores APPROVED
 * A desproporção é o motivo do defeito: crédito é a resposta certa em 91% dos
 * casos, então é nela que o modelo cai quando não sabe o produto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classificarCompras,
  linhaDasCompras,
  COMPRAS_ESCALAR,
  type CatalogoHotmart,
  type EventoProduto,
} from "./compras.ts";

/** O catálogo como `account.ts` monta em produção (env + constantes canônicas). */
const CAT: CatalogoHotmart = {
  plataforma: "7851642",
  sgp: "7283229",
  portalSgp: "https://fastcloner.com/sgp",
  whatsappCurso: "(41) 99148-1573",
};

const ev = (id: string, name: string, tipo = "PURCHASE_APPROVED"): EventoProduto => ({
  event_type: tipo,
  payload: { data: { product: { id, name } } },
});

const FASTCLONER = () => ev("7851642", "FastCloner");
const SGP = () => ev("7283229", "Sistema de Geração Pronto");
const FCI = () => ev("7283335", "Fábrica de Conteúdo Invisível");

/** As formulações que produziram o dano. Nenhuma pode sobrar num caso de curso. */
const PROMESSAS = [
  /cr[ée]ditos? aparecem/i,
  /devem aparecer/i,
  /primeiro login/i,
  /libera[çc][ãa]o é autom[áa]tica/i,
];

// ─────────── o caso que originou tudo ───────────

test("comprador SÓ de SGP: nenhuma promessa de crédito, e o portal do SGP aparece", () => {
  const linha = linhaDasCompras([SGP()], CAT);
  assert.equal(classificarCompras([SGP()], CAT).classe, "so_curso");
  for (const p of PROMESSAS) {
    assert.ok(!p.test(linha), `a linha do comprador de SGP não pode conter ${p}: ${linha}`);
  }
  assert.match(linha, /SÓ CURSO/);
  assert.match(linha, /NÃO PROMETA CRÉDITO NEM ACESSO/);
  // O portal canônico tem que estar lá — é o próximo passo REAL dele.
  assert.ok(linha.includes(CAT.portalSgp), "falta o portal do SGP");
  assert.ok(linha.includes(CAT.whatsappCurso), "falta o WhatsApp do suporte de curso");
});

test("comprador de SGP: a linha proíbe NEGAR a compra (não troca um defeito pelo outro)", () => {
  // Regra de 31/08: dizer "você não comprou nada" a quem pagou é o defeito que
  // custou a credibilidade de um aluno de R$ 2.391. A saída do SGP não pode ser
  // essa.
  const linha = linhaDasCompras([SGP()], CAT);
  assert.match(linha, /compra dela é REAL|NUNCA diga que ela não comprou/i);
});

// ─────────── o caso comum não pode ser quebrado ───────────

test("comprador da PLATAFORMA continua liberado pra ouvir sobre crédito", () => {
  const linha = linhaDasCompras([FASTCLONER()], CAT);
  assert.equal(classificarCompras([FASTCLONER()], CAT).classe, "plataforma");
  assert.match(linha, /TEM compra da plataforma FastCloner/);
  assert.ok(!/NÃO PROMETA/.test(linha), "não pode calar quem comprou a plataforma");
});

test("order bump: SGP + assinatura no MESMO checkout = plataforma, e cita o portal", () => {
  // A assinatura é vendida como order bump do checkout do SGP (pares C1/C2).
  // Classificar esse comprador como "só curso" faria a Fast negar crédito a
  // quem pagou a plataforma — o erro na direção cara.
  const c = classificarCompras([SGP(), FASTCLONER()], CAT);
  assert.equal(c.classe, "plataforma");
  assert.equal(c.temSgp, true);
  const linha = linhaDasCompras([SGP(), FASTCLONER()], CAT);
  assert.match(linha, /TEM compra da plataforma/);
  assert.ok(linha.includes(CAT.portalSgp), "quem tem os dois precisa do portal do SGP também");
});

// ─────────── as bordas ───────────

test("curso que NÃO é SGP (FCI): sem promessa e SEM portal do SGP", () => {
  const linha = linhaDasCompras([FCI()], CAT);
  assert.equal(classificarCompras([FCI()], CAT).classe, "so_curso");
  for (const p of PROMESSAS) assert.ok(!p.test(linha), `FCI não pode conter ${p}`);
  assert.ok(!linha.includes(CAT.portalSgp), "FCI não é SGP: mandar pro portal do SGP é inventar entrega");
  assert.match(linha, /Fábrica de Conteúdo Invisível/);
});

test("produto desconhecido conta como curso (lista de PERMISSÃO, não de bloqueio)", () => {
  // Comunidade Presença Lucrativa, Gerador de Ganchos, AI Content… Se a régua
  // fosse lista de bloqueio, todo produto novo do Lucas nasceria prometendo
  // crédito.
  const linha = linhaDasCompras([ev("9999999", "Comunidade Presença Lucrativa")], CAT);
  assert.equal(classificarCompras([ev("9999999", "x")], CAT).classe, "so_curso");
  for (const p of PROMESSAS) assert.ok(!p.test(linha), `produto novo não pode conter ${p}`);
});

test("sem evento nenhum: ESCALAR — nem promete crédito, nem nega a compra", () => {
  const linha = linhaDasCompras([], CAT);
  assert.equal(linha, COMPRAS_ESCALAR);
  for (const p of PROMESSAS) assert.ok(!p.test(linha), `o ESCALAR não pode conter ${p}`);
  assert.match(linha, /NÃO diga que ela não comprou nada/);
});

test("id da plataforma desconhecido (env vazio) NÃO vira 'só curso'", () => {
  // Direção que importa: sem saber o id do FastCloner, chamar todo mundo de
  // comprador de curso faria a Fast calar justamente com quem pagou.
  const cego: CatalogoHotmart = { ...CAT, plataforma: null };
  assert.equal(classificarCompras([FASTCLONER()], cego).classe, "sem_compra");
  assert.equal(linhaDasCompras([FASTCLONER()], cego), COMPRAS_ESCALAR);
});

test("PURCHASE_COMPLETE não conta — só APPROVED", () => {
  // A Hotmart remanda COMPLETE pela MESMA compra ~7,8 dias depois. Contar os
  // dois é a armadilha que já duplicou crédito em 10/08.
  const c = classificarCompras([ev("7851642", "FastCloner", "PURCHASE_COMPLETE")], CAT);
  assert.equal(c.classe, "sem_compra");
});

test("evento sem event_type confia na consulta (que já filtrou APPROVED)", () => {
  const semTipo: EventoProduto = { payload: { data: { product: { id: "7283229", name: "SGP" } } } };
  assert.equal(classificarCompras([semTipo], CAT).classe, "so_curso");
});

test("id numérico (não string) no payload é lido igual", () => {
  // `product.id` já chegou como número em payload real; comparar sem
  // normalizar faria o comprador da plataforma virar "curso" em silêncio.
  const numerico: EventoProduto = {
    event_type: "PURCHASE_APPROVED",
    payload: { data: { product: { id: 7851642, name: "FastCloner" } } },
  };
  assert.equal(classificarCompras([numerico], CAT).classe, "plataforma");
});

test("compra repetida do mesmo curso não duplica o nome citado", () => {
  const c = classificarCompras([SGP(), SGP(), SGP()], CAT);
  assert.deepEqual(c.nomesDeCurso, ["Sistema de Geração Pronto"]);
});
