/**
 * Testes dos CONTATOS OFICIAIS da Fast. Rodar (Node ≥ 22.18):
 *   node --import ./test/alias-loader.mjs --test src/lib/agent/manual-contatos.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (#414, 15/09):
 * às 12:50:25Z a Fast respondeu a uma aluna mandando ela cobrar o reembolso dos
 * cursos no WhatsApp "(41) 9 8878-6342". Às 13:28:54Z a aluna testou e respondeu
 * "esta dando para outro comercio" — o número era de um comércio qualquer. Às
 * 13:30:52Z a própria Fast admitiu por escrito que os dados estavam errados, e
 * NÃO passou o certo. Era um reembolso de R$ 2.712,12.
 *
 * A CAUSA NÃO FOI ATENDIMENTO, FOI CONFIGURAÇÃO (medido por grep em 15/09):
 *   - "8878-6342" não existe em frontend/src nem em _frank. Foi INVENTADO.
 *   - "(41) 99148-1573", o número certo, existia hardcoded a três arquivos de
 *     distância: payments/sgp-boas-vindas.ts:100 (WHATSAPP_SUPORTE_CURSO) e
 *     sgp/fracasso.ts:27 (wa.me/5541991481573).
 *   - manual.ts tinha UM único contato (suporte@fastcloner.com), NENHUM contato
 *     da equipe de cursos e NENHUMA regra proibindo emitir telefone.
 * Sem nada pra citar, o modelo preenche o vazio. É a 4ª instância da mesma
 * família (#175, #178, #209), todas curadas neste mesmo arquivo.
 *
 * O QUE ESTES TESTES PROTEGEM, e por que cada um existe:
 *   1. o manual não pode DIVERGIR do número que a casa realmente publica —
 *      por isso ele IMPORTA a constante em vez de reescrever a string;
 *   2. se alguém trocar a importação de volta por um literal, o teste cai
 *      (é assim que duas cópias da mesma verdade nascem e apodrecem);
 *   3. NENHUM telefone/e-mail fora da lista pode aparecer no prompt — este é o
 *      teste que teria pegado o 8878-6342 antes de chegar na aluna.
 *
 * Aqui se importa o MÓDULO (não se lê o fonte, como faz manual.test.ts): o
 * número entra por interpolação, então só o prompt RENDERIZADO prova o que a
 * Fast realmente recebe. Daí o --import ./test/alias-loader.mjs no comando.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildAgentSystem, PLATFORM_MANUAL } from "@/lib/agent/manual";
import { WHATSAPP_SUPORTE_CURSO } from "@/lib/payments/sgp-boas-vindas";

/** Relógio fixo: blocoHoje() injeta a data e ela não pode variar o resultado. */
const PROMPT = buildAgentSystem(new Date("2026-09-15T12:00:00Z"));

const FONTE = readFileSync(
  fileURLToPath(new URL("./manual.ts", import.meta.url)),
  "utf8",
);

/** Os ÚNICOS contatos que podem sair no prompt. */
const EMAILS_OFICIAIS = ["suporte@fastcloner.com", "suporte@lucasarrial.com"];

/** Só os dígitos — é assim que dois telefones se comparam sem brigar por máscara. */
const so = (s: string) => s.replace(/\D/g, "");

/**
 * Acha qualquer coisa com CARA DE TELEFONE no texto e devolve os dígitos.
 *
 * ⚠️ NÃO troque isto por um regex de máscara fixa. A primeira versão deste
 * teste usava `\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}` e passava VERDE com o
 * número do #414 injetado no manual: a Fast escreveu "(41) 9 8878-6342", com o
 * nono dígito SEPARADO, e a máscara não casa com isso. Um teste que não pega o
 * caso que motivou o teste não vale nada. Por isso aqui a conta é: tira data,
 * pega qualquer corrida de dígitos com separador, e COMPARA NORMALIZADO.
 *
 * As datas saem antes porque "2026-09-15" vira 8 dígitos e seria falso positivo
 * (o prompt leva a data de hoje via blocoHoje).
 */
function telefonesNo(texto: string): string[] {
  const semDatas = texto
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
  return (semDatas.match(/\+?\d[\d\s()+.-]{6,}\d/g) ?? [])
    .map(so)
    // 8 a 13 dígitos = de "8878-6342" (local) a "+55 41 9…" (com país).
    .filter((d) => d.length >= 8 && d.length <= 13);
}

/** O oficial, tolerando o "55" do país e a citação sem DDD. */
function ehOficial(digitos: string): boolean {
  const alvo = so(WHATSAPP_SUPORTE_CURSO);
  const d = digitos.replace(/^55/, "");
  return d === alvo || alvo.endsWith(d) || d.endsWith(alvo);
}

test("o WhatsApp do manual é O MESMO que a casa publica (não uma cópia)", () => {
  // Esta é a asserção que o cartão pediu: falha se o manual divergir de
  // WHATSAPP_SUPORTE_CURSO. Hoje divergir é impossível por construção (o manual
  // interpola a constante) — e o teste seguinte é o que mantém assim.
  assert.ok(
    PROMPT.includes(WHATSAPP_SUPORTE_CURSO),
    `o prompt da Fast não traz o WhatsApp oficial (${WHATSAPP_SUPORTE_CURSO}) — ` +
      "sem ele a Fast não tem o que citar e inventa, que foi o #414",
  );
});

test("o manual IMPORTA o número em vez de reescrever a string", () => {
  // Se alguém colar o número literal aqui, nasce a segunda cópia — e é assim
  // que daqui a um mês uma delas fica velha sem ninguém perceber.
  assert.match(
    FONTE,
    /import\s*\{[^}]*WHATSAPP_SUPORTE_CURSO[^}]*\}\s*from\s*"@\/lib\/payments\/sgp-boas-vindas"/,
    "manual.ts parou de importar WHATSAPP_SUPORTE_CURSO — o número virou cópia solta",
  );
  assert.doesNotMatch(
    FONTE,
    /\(41\)\s*9\s*9148-1573/,
    "o número foi hardcoded no manual; ele tem que vir da constante, não de uma string",
  );
  assert.match(
    PLATFORM_MANUAL,
    /CONTATOS OFICIAIS/,
    "a seção CONTATOS OFICIAIS sumiu — a regra 8 aponta pra ela",
  );
});

test("NENHUM telefone fora da lista aparece no prompt (o teste do #414)", () => {
  const forasteiros = [...new Set(telefonesNo(PROMPT))].filter((d) => !ehOficial(d));
  assert.deepEqual(
    forasteiros,
    [],
    "apareceu telefone que não é o oficial no prompt da Fast. Todo número aqui " +
      "vira cobrança na mão de estranho (#414: R$ 2.712,12 no zap de um comércio). " +
      "Se for número novo e legítimo, exporte-o como constante e cite a constante.",
  );
});

test("o detector de telefone pega o número do #414 (teste do teste)", () => {
  // Guarda o GUARDA: se alguém afrouxar telefonesNo()/ehOficial(), o teste de
  // cima fica verde por não enxergar nada — foi exatamente o que aconteceu com
  // a primeira versão deste arquivo. Aqui os formatos reais são exercitados.
  for (const forma of [
    "(41) 9 8878-6342", // o formato EXATO que a Fast mandou pra aluna
    "(41) 98878-6342",
    "41 98878-6342",
    "8878-6342",
    "+55 41 98878-6342",
  ]) {
    const achados = telefonesNo(`chame no WhatsApp ${forma} que resolvem`);
    assert.notDeepEqual(achados, [], `o detector ficou cego pra "${forma}"`);
    assert.ok(
      achados.some((d) => !ehOficial(d)),
      `"${forma}" é número de terceiro e passou como oficial`,
    );
  }
  // E o oficial, nas máscaras em que ele legitimamente aparece, NÃO é acusado.
  for (const ok of [
    WHATSAPP_SUPORTE_CURSO,
    "+55 41 99148-1573",
    "wa.me/5541991481573",
  ]) {
    const achados = telefonesNo(`fale com o time no ${ok}`);
    assert.ok(
      achados.length > 0 && achados.every(ehOficial),
      `o número oficial escrito como "${ok}" foi tratado como forasteiro`,
    );
  }
});

test("NENHUM e-mail fora da lista aparece no prompt", () => {
  const achados = [...new Set(PROMPT.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [])];
  const forasteiros = achados.filter((e) => !EMAILS_OFICIAIS.includes(e));
  assert.deepEqual(
    forasteiros,
    [],
    `só estes e-mails podem sair pro aluno: ${EMAILS_OFICIAIS.join(", ")}`,
  );
});

test("os dois canais de CURSO estão no manual, com o dono certo", () => {
  // O #414 era pedido de reembolso de CURSO — produto que não é nosso. Sem o
  // canal do Lucas escrito aqui, a Fast não tinha pra onde mandar a aluna.
  assert.match(PLATFORM_MANUAL, /suporte@lucasarrial\.com/);
  assert.match(
    PLATFORM_MANUAL,
    /Sistema de Geração Pronto|SGP/,
    "o manual precisa nomear os produtos de curso, senão a Fast não sabe rotear",
  );
  assert.match(
    PLATFORM_MANUAL,
    /suporte@fastcloner\.com/,
    "o canal da plataforma continua sendo o nosso",
  );
});

test("a regra dura proíbe, com todas as letras, inventar contato", () => {
  const regras = PROMPT.slice(
    PROMPT.indexOf("REGRAS DURAS:"),
    PROMPT.indexOf("# FastCloner — manual da plataforma"),
  );
  assert.ok(regras.length > 0, "o bloco REGRAS DURAS sumiu do prompt");
  assert.match(
    regras,
    /NUNCA INVENTE TELEFONE, WHATSAPP OU E-MAIL/,
    "sumiu a proibição explícita de inventar contato (regra 8, #414)",
  );
  assert.match(
    regras,
    /MELHOR NÃO DAR CONTATO NENHUM DO QUE DAR O DE UM TERCEIRO/,
    "sumiu a saída segura da regra 8 — sem ela o modelo escolhe chutar um número",
  );
});
