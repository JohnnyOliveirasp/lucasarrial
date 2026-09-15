/**
 * Os RASCUNHOS de contato do /admin/sgp e os links que os carregam.
 *
 * O que estes testes protegem, na ordem do estrago que o defeito causa:
 *
 *  1. LINK QUEBRADO. Aluno sem celular tem que devolver `null`, não
 *     `https://wa.me/`. Um `wa.me` vazio ABRE o WhatsApp num número inexistente
 *     e o atendente sai de lá achando que falou com alguém — é o pior defeito
 *     possível aqui, porque ele é silencioso dos dois lados.
 *  2. NORMALIZADOR ÚNICO. As duas abas passam pelo MESMO caminho de dígitos, e
 *     `celularDigitos` (que já saiu do normalizador) tem que voltar igual. Dois
 *     normalizadores divergindo mandariam uma das abas pro número errado.
 *  3. TEXTO POR ETAPA. Quem está em "Enviando as fotos" não pode receber o texto
 *     de quem está em "Gravando o áudio". É o requisito 3 do pedido.
 *  4. NADA DE JARGÃO NEM PLACEHOLDER NO TEXTO DO ALUNO. `(sem nome)` é o que
 *     `montarLinha` grava quando a coluna vem vazia; se vazar pro rascunho, o
 *     aluno recebe "Oi (sem nome), tudo bem?".
 *  5. SEGUNDA PESSOA. O texto é escrito PRO ALUNO. Se alguém um dia colar aqui
 *     o `FALTA_NO_WIZARD` de painel.ts (que é terceira pessoa, escrito pro
 *     atendente), o aluno recebe "peça pra ele apertar o botão".
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/contato.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CANAIS,
  CANAL_ROTULO,
  ehCanal,
  linkEmail,
  linkWhatsapp,
  primeiroNome,
  rascunhoDeCobranca,
} from "./contato.ts";
import { SGP_STATUS } from "./types.ts";
import type { SgpStatus } from "./types.ts";

/* ---------------------------------------------------------------------------
 * 1) LINK QUEBRADO — o defeito silencioso
 * ------------------------------------------------------------------------- */

test("aluno SEM celular não vira link: devolve null, nunca 'wa.me/'", () => {
  for (const vazio of [null, undefined, "", "   ", "—"]) {
    assert.equal(
      linkWhatsapp(vazio, "oi"),
      null,
      `"${String(vazio)}" não pode virar link de WhatsApp`,
    );
  }
});

test("telefone curto demais pra ser telefone também não vira link", () => {
  // `normalizarWhatsapp` recusa < 10 dígitos. Sem isto, "1234" viraria
  // wa.me/551234 e o atendente abriria uma conversa com ninguém.
  assert.equal(linkWhatsapp("1234", "oi"), null);
  assert.equal(linkWhatsapp("(11) 9", "oi"), null);
});

test("aluno SEM e-mail utilizável não vira mailto", () => {
  const r = rascunhoDeCobranca("foto", "Maria");
  for (const vazio of [null, undefined, "", "   ", "—", "nao-e-email"]) {
    assert.equal(linkEmail(vazio, r), null, `"${String(vazio)}" não pode virar mailto`);
  }
});

/* ---------------------------------------------------------------------------
 * 2) NORMALIZADOR ÚNICO — as duas abas pelo mesmo caminho
 * ------------------------------------------------------------------------- */

test("celular com máscara vira dígitos com DDI no link", () => {
  const url = linkWhatsapp("(61) 99310-7338", "oi");
  assert.equal(url?.startsWith("https://wa.me/5561993107338?text="), true, url ?? "sem link");
});

test("celularDigitos (aba 'Todos os compradores') volta IGUAL — a função é idempotente", () => {
  // É isto que deixa as duas abas usarem este mesmo caminho em vez de cada uma
  // ter o seu. Os três números saem de compradores.test.ts, não foram inventados.
  for (const ja of ["5511984263680", "5561999998888", "393498533692"]) {
    const url = linkWhatsapp(ja, "oi");
    assert.equal(url?.startsWith(`https://wa.me/${ja}?text=`), true, `${ja} → ${url}`);
  }
});

test("número estrangeiro não ganha 55 na frente", () => {
  // O `checkout_phone` real tem italiano no meio. Prefixar 55 mandaria o time
  // pra um número brasileiro que não é de ninguém.
  const url = linkWhatsapp("393498533692", "oi");
  assert.equal(url?.includes("wa.me/393498533692"), true, url ?? "sem link");
  assert.equal(url?.includes("wa.me/55393498533692"), false);
});

test("o texto vai ESCAPADO na URL — acento e quebra não quebram o link", () => {
  const url = linkWhatsapp("5561993107338", "Oi João, tudo bem? Falta só a foto & o áudio");
  assert.equal(url?.includes(" "), false, "espaço cru na URL");
  assert.equal(url?.includes("&"), false, "'&' cru cortaria o texto no meio");
  assert.equal(decodeURIComponent(url!.split("?text=")[1]), "Oi João, tudo bem? Falta só a foto & o áudio");
});

test("mailto leva assunto e corpo escapados, e o endereço CRU", () => {
  const r = rascunhoDeCobranca("foto", "Maria");
  const url = linkEmail("  Maria@Exemplo.com  ", r)!;
  assert.equal(url.startsWith("mailto:Maria@Exemplo.com?"), true, url);
  const q = new URLSearchParams(url.split("?")[1]);
  assert.equal(q.get("subject"), r.assunto);
  assert.equal(q.get("body"), r.corpo);
});

/* ---------------------------------------------------------------------------
 * 3) TEXTO POR ETAPA — o requisito 3
 * ------------------------------------------------------------------------- */

test("cada etapa tem um texto PRÓPRIO: nenhum par de etapas repete corpo ou assunto", () => {
  const corpos = new Map<string, string>();
  const assuntos = new Map<string, string>();
  for (const s of SGP_STATUS) {
    const r = rascunhoDeCobranca(s, "Maria");
    const jaCorpo = corpos.get(r.corpo);
    assert.equal(jaCorpo, undefined, `"${s}" tem o mesmo corpo de "${jaCorpo}"`);
    const jaAssunto = assuntos.get(r.assunto);
    assert.equal(jaAssunto, undefined, `"${s}" tem o mesmo assunto de "${jaAssunto}"`);
    corpos.set(r.corpo, s);
    assuntos.set(r.assunto, s);
  }
  // E quem nunca abriu o portal (sem pedido) também é um texto à parte.
  const nunca = rascunhoDeCobranca(null, "Maria");
  assert.equal(corpos.has(nunca.corpo), false, "'nunca começou' repete o texto de uma etapa");
  assert.equal(assuntos.has(nunca.assunto), false);
});

test("o texto fala da coisa certa: fotos pra quem parou na foto, áudio pra quem parou no áudio", () => {
  assert.match(rascunhoDeCobranca("foto", "Maria").corpo, /fotos/i);
  assert.doesNotMatch(rascunhoDeCobranca("foto", "Maria").corpo, /áudio/i);
  assert.match(rascunhoDeCobranca("audio", "Maria").corpo, /áudio/i);
  assert.doesNotMatch(rascunhoDeCobranca("audio", "Maria").corpo, /fotos/i);
  assert.match(rascunhoDeCobranca(null, "Maria").corpo, /compra|começ/i);
});

test("etapa diferente => link com texto diferente, nas duas pontas", () => {
  const foto = rascunhoDeCobranca("foto", "Maria");
  const audio = rascunhoDeCobranca("audio", "Maria");
  assert.notEqual(linkWhatsapp("5561993107338", foto.corpo), linkWhatsapp("5561993107338", audio.corpo));
  assert.notEqual(linkEmail("m@x.com", foto), linkEmail("m@x.com", audio));
});

test("pedido que DEU ERRO não promete prazo nem empurra contorno pro aluno", () => {
  const r = rascunhoDeCobranca("falhou", "Maria");
  // Regra do Johnny/Lucas: nunca prometer prazo. E o aluno não tem que se virar
  // com defeito nosso — a frase diz que estamos cuidando, e só.
  assert.doesNotMatch(r.corpo, /\b\d+\s*(h|hora|dia|minuto|semana)/i, r.corpo);
  assert.doesNotMatch(r.corpo, /amanhã|até (o fim|sexta|segunda)|em breve estará/i, r.corpo);
});

/* ---------------------------------------------------------------------------
 * 4) NADA DE PLACEHOLDER NEM JARGÃO NO TEXTO QUE O ALUNO LÊ
 * ------------------------------------------------------------------------- */

test("'(sem nome)' NUNCA vaza pro texto do aluno", () => {
  // É o placeholder que `montarLinha` grava quando a coluna vem vazia.
  const r = rascunhoDeCobranca("foto", "(sem nome)");
  assert.doesNotMatch(r.corpo, /sem nome/i, r.corpo);
  assert.equal(r.corpo.startsWith("Oi, tudo bem?"), true, r.corpo);
});

test("nome vazio/nulo cai na saudação sem nome, sem 'Oi undefined'", () => {
  for (const nome of [null, undefined, "", "   "]) {
    const r = rascunhoDeCobranca("foto", nome);
    assert.equal(r.corpo.startsWith("Oi, tudo bem?"), true, `${String(nome)} → ${r.corpo}`);
  }
});

test("só o PRIMEIRO nome entra na saudação", () => {
  assert.equal(primeiroNome("Stella Maris Gomes Pereira Pontes Pinheiro"), "Stella");
  assert.equal(primeiroNome("  maria   da   conceição  "), "maria");
  assert.equal(primeiroNome("(sem nome)"), "");
  const r = rascunhoDeCobranca("dados", "Stella Maris Gomes Pereira Pontes Pinheiro");
  assert.equal(r.corpo.startsWith("Oi Stella, tudo bem?"), true, r.corpo);
});

test("nenhum rascunho carrega jargão de sistema — quem lê é o ALUNO", () => {
  const jargao =
    /\.tsx|\.ts\b|sgp_pedidos|status ?=|user_id|cobrado_em|migration|endpoint|null|undefined|\bSGP\b/i;
  const todos: Array<SgpStatus | null> = [...SGP_STATUS, null];
  for (const s of todos) {
    const r = rascunhoDeCobranca(s, "Maria");
    assert.doesNotMatch(r.corpo, jargao, `corpo de "${String(s)}": ${r.corpo}`);
    assert.doesNotMatch(r.assunto, jargao, `assunto de "${String(s)}": ${r.assunto}`);
  }
});

/* ---------------------------------------------------------------------------
 * 5) SEGUNDA PESSOA — a armadilha de colar o texto do ATENDENTE aqui
 * ------------------------------------------------------------------------- */

test("o rascunho fala COM o aluno, não SOBRE ele", () => {
  // `FALTA_NO_WIZARD` (painel.ts) é terceira pessoa e é lido pelo ATENDENTE:
  // "peça pra ele apertar o botão — o material dele já está todo lá". Colar
  // aquele texto aqui manda o aluno ler uma instrução sobre si mesmo.
  const terceiraPessoa = /\bpeça pra ele\b|\bpra ele\b|\bdele\b|\bo aluno\b|\bcobrar o aluno\b/i;
  const todos: Array<SgpStatus | null> = [...SGP_STATUS, null];
  for (const s of todos) {
    const r = rascunhoDeCobranca(s, "Maria");
    assert.doesNotMatch(r.corpo, terceiraPessoa, `corpo de "${String(s)}": ${r.corpo}`);
  }
});

test("todo rascunho abre com saudação e tem corpo e assunto não vazios", () => {
  const todos: Array<SgpStatus | null> = [...SGP_STATUS, null];
  for (const s of todos) {
    const r = rascunhoDeCobranca(s, "Maria");
    assert.equal(r.corpo.startsWith("Oi Maria, tudo bem?"), true, `"${String(s)}": ${r.corpo}`);
    assert.equal(r.assunto.trim().length > 0, true, `assunto vazio em "${String(s)}"`);
  }
});

/* ---------------------------------------------------------------------------
 * O CANAL
 * ------------------------------------------------------------------------- */

test("ehCanal só aceita os dois canais reais", () => {
  assert.equal(ehCanal("whatsapp"), true);
  assert.equal(ehCanal("email"), true);
  for (const lixo of ["WhatsApp", "e-mail", "sms", "", null, undefined, 1, {}]) {
    assert.equal(ehCanal(lixo), false, `"${String(lixo)}" não é canal`);
  }
});

test("todo canal tem rótulo de tela", () => {
  for (const c of CANAIS) {
    assert.equal(typeof CANAL_ROTULO[c], "string");
    assert.equal(CANAL_ROTULO[c].length > 0, true);
  }
});
