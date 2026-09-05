/**
 * Testes do dedupe por QUEIXA dos incidentes de e-mail (correção 20/08).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-incident.test.ts
 *
 * TESTE DE ACEITE (caso Katia): os textos das duas ocorrências abaixo são os
 * REAIS, copiados de produção em 20/08/2026 (incidente
 * ce6e157d-9fdf-4c70-ad24-8ab74d5da998, tabela incidents — title da ocorrência
 * 1 e description/sample_error da ocorrência 2). Não são inventados.
 * A lógica nova TEM que separar a queixa de pacing (20/08 17:05 UTC) do
 * incidente de eco/corte (19/08 12:10 UTC) — era o defeito: as duas caíam na
 * mesma chave `fast-email:tec:katiasalvador32@gmail.com`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyComplaint, incidentSignature } from "./mail-incident.ts";

const KATIA = "katiasalvador32@gmail.com";
const SIG_LEGADA = `fast-email:tec:${KATIA}`;

// Ocorrência 1 (19/08 12:10 UTC) — resumo da Fast que virou o title do ce6e157d.
const QUEIXA_ECO =
  'áudios gerados com a voz "Minha voz" saindo com letras soltas/cortadas ou começando em lugar errado do texto';

// Ocorrência 2 (20/08 17:05 UTC) — resumo da Fast que sobrescreveu a description.
const QUEIXA_PACING =
  'aluna relata que o áudio "Portal da Morgana" (refeito pela equipe em 19/08, 18:07) está saindo robótico, ' +
  "frases sem pontuação/grudadas. Pedir pra equipe revisar o texto usado e regerar com pontuação adequada se necessário.";

// Ocorrência 2 — trecho CRU do e-mail dela (sample_error de produção).
const EXCERPT_PACING =
  "Está como se fosse um robô, as frases estão sem pontuação e algumas muito próximas da outra, " +
  "como se eu não desse espaço entre uma frase e outra.";

// ── TESTE DE ACEITE: a queixa de pacing separa do incidente de eco ──────────

test("ACEITE Katia: eco/corte e pacing classificam em classes DIFERENTES", () => {
  assert.equal(classifyComplaint(QUEIXA_ECO), "corte");
  assert.equal(classifyComplaint(QUEIXA_PACING), "pacing");
  assert.equal(classifyComplaint(QUEIXA_PACING, EXCERPT_PACING), "pacing");
});

test("ACEITE Katia: as assinaturas separam as duas queixas (e nenhuma cai na chave legada)", () => {
  const sigEco = incidentSignature(true, KATIA, classifyComplaint(QUEIXA_ECO));
  const sigPacing = incidentSignature(true, KATIA, classifyComplaint(QUEIXA_PACING, EXCERPT_PACING));
  assert.equal(sigEco, `fast-email:tec:corte:${KATIA}`);
  assert.equal(sigPacing, `fast-email:tec:pacing:${KATIA}`);
  assert.notEqual(sigEco, sigPacing);
  assert.notEqual(sigEco, SIG_LEGADA);
  assert.notEqual(sigPacing, SIG_LEGADA);
});

test("ACEITE Katia: replay 20/08 17:05 — a queixa de pacing NÃO cai no card de eco (ce6e157d)", () => {
  // No momento da queixa de pacing só existia o incidente de eco, gravado sob
  // `fast-email:tec:<email>`. Na chave nova a busca de `abrirChamadoReportado`
  // é por `fast-email:tec:pacing:<email>` — não acha o card de eco, então
  // nasce chamado próprio em vez de virar ocorrência 2 de um card fechado.
  const sigDoCardDeEco = incidentSignature(true, KATIA, classifyComplaint(QUEIXA_ECO));
  const sigBuscadaNaQueixaDePacing = incidentSignature(
    true,
    KATIA,
    classifyComplaint(QUEIXA_PACING, EXCERPT_PACING),
  );
  assert.notEqual(sigBuscadaNaQueixaDePacing, sigDoCardDeEco);
  assert.notEqual(sigBuscadaNaQueixaDePacing, SIG_LEGADA);
});

test("'robótico' no meio da queixa de pacing NÃO desvia pra classe semelhança (ordem dos matchers)", () => {
  // O texto real tem "robô"/"robótico" E "sem pontuação/grudadas" — o sintoma
  // concreto (pacing) tem que vencer o termo genérico.
  assert.equal(classifyComplaint(QUEIXA_PACING), "pacing");
  assert.equal(classifyComplaint("", EXCERPT_PACING), "pacing");
});

// ── TRAVA (b): mesma queixa repetida continua deduplicando em UM incidente ──

test("TRAVA b: mesma classe 3x → mesma assinatura, incidente aberto INCREMENTA (nunca 3 cards)", () => {
  const variantes = [
    "áudio saiu com frases grudadas, sem pausa nenhuma",
    "de novo as frases muito próximas uma da outra, sem espaço",
    "continua tudo grudado, sem pontuação",
  ];
  const sigs = variantes.map((v) => incidentSignature(true, KATIA, classifyComplaint(v)));
  assert.equal(new Set(sigs).size, 1); // as 3 caem na MESMA chave
  assert.equal(sigs[0], `fast-email:tec:pacing:${KATIA}`);
  // Mesma chave = `abrirChamadoReportado` acha o chamado que já existe e soma
  // ocorrência nele (lib/incidents/reportar.ts). 1 card, 3 ocorrências.
});

test("TRAVA b: queixa SEM classe repetida também dedupa (chave legada + card aberto)", () => {
  assert.equal(classifyComplaint("uma coisa esquisita aconteceu na plataforma hoje"), null);
  const sig = incidentSignature(true, KATIA, null);
  assert.equal(sig, SIG_LEGADA); // formato legado continua válido
});

// ── Classificador: casos vizinhos do produto ────────────────────────────────

test("classes vizinhas não se misturam", () => {
  assert.equal(classifyComplaint("a voz não parece comigo, ficou estranha"), "semelhanca");
  assert.equal(classifyComplaint("o áudio veio incompleto, faltando o final"), "corte");
  assert.equal(classifyComplaint("meus créditos não caíram depois da compra"), "credito");
  assert.equal(classifyComplaint("fui cobrada duas vezes no cartão"), "cobranca");
  assert.equal(classifyComplaint("quero cancelar a assinatura e pedir reembolso"), "cobranca");
  assert.equal(classifyComplaint("não consigo entrar na minha conta, o login falha"), "acesso");
  assert.equal(classifyComplaint("o treinamento da minha voz não termina nunca"), "treinamento");
});

test("acentuação não muda a classe (normalização)", () => {
  assert.equal(classifyComplaint("sem pontuacao e tudo grudado"), "pacing");
  assert.equal(classifyComplaint("SEM PONTUAÇÃO E TUDO GRUDADO"), "pacing");
});

test("canal atendimento (technical=false) mantém o prefixo atend na chave", () => {
  assert.equal(
    incidentSignature(false, KATIA, classifyComplaint("quero reembolso da mensalidade")),
    `fast-email:atend:cobranca:${KATIA}`,
  );
});
