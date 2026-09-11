/**
 * Testes de `entitlementDaPlataforma` — incidente #2d0509b4 (08/09/2026).
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/acesso-regra.test.ts
 *
 * OS CASOS SÃO REAIS, medidos em produção em 08/09/2026:
 *   - 15 entitlements `active` com `access_until` NULL (vitalício) nos produtos
 *     de CURSO 7283335 (Fábrica de Conteúdo Invisível, 11 linhas) e 7283229
 *     (Sistema de Geração Pronto, 4 linhas), todos criados em 09/06 — antes de
 *     o webhook ter o roteamento por produto. 12 pessoas distintas.
 *   - `drfabiovilhena29@gmail.com` criou conta em 30/08 e hoje tem
 *     `access_until = 2030-01-01` e 100.000 créditos com ZERO entitlement do
 *     produto 7851642 (a plataforma). O único que ele tem é o vitalício do
 *     curso 7283335.
 *   - O produto legítimo 7851642 tem 794 linhas `active` e ZERO vitalícios:
 *     vitalício em produto de curso é anomalia, não regra.
 *
 * O que o `reconcileUserEntitlements` fazia: casava TODA órfã do e-mail sem
 * olhar `product_code`, e o `recomputeProfileAccess` seguinte virava isso em
 * `plan=pro` + acesso + crédito. Os outros 11 estavam a UM login de distância.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  entitlementDaPlataforma,
  produtosDeCurso,
  PRODUTOS_DE_CURSO_PADRAO,
} from "./acesso-regra.ts";

const PLATAFORMA = "7851642";
const SGP = "7283229";
const FABRICA = "7283335";

test("produto da plataforma: adota, como sempre", () => {
  assert.equal(entitlementDaPlataforma(PLATAFORMA), true);
});

test("Sistema de Geração Pronto é CURSO: não dá a plataforma", () => {
  assert.equal(entitlementDaPlataforma(SGP), false);
});

test("Fábrica de Conteúdo Invisível é CURSO: não dá a plataforma", () => {
  assert.equal(entitlementDaPlataforma(FABRICA), false);
});

test("os dois produtos de curso medidos em 09/06 estão na lista padrão", () => {
  assert.deepEqual([...PRODUTOS_DE_CURSO_PADRAO].sort(), [SGP, FABRICA].sort());
});

test("sem product_code NÃO é curso: ausência de informação não retira nada", () => {
  // Mesmo princípio da guarda do #222: na dúvida, não se desvincula ninguém.
  assert.equal(entitlementDaPlataforma(null), true);
  assert.equal(entitlementDaPlataforma(undefined), true);
  assert.equal(entitlementDaPlataforma(""), true);
  assert.equal(entitlementDaPlataforma("   "), true);
});

test("product_code com espaço em volta ainda é reconhecido como curso", () => {
  assert.equal(entitlementDaPlataforma(` ${SGP} `), false);
});

test("produto desconhecido é adotado: a lista é de EXCLUSÃO, não de permissão", () => {
  // Fechar por allowlist tiraria acesso de produto novo que ninguém cadastrou
  // aqui ainda — o oposto do que este conserto se propõe.
  assert.equal(entitlementDaPlataforma("788921"), true);
});

test("a lista de cursos é injetável (o SGP é sobrescrevível por ambiente)", () => {
  assert.equal(entitlementDaPlataforma("999", ["999"]), false);
  assert.equal(entitlementDaPlataforma(SGP, ["999"]), true);
});

/* ────────────────────────────────────────────────────────────────────────────
 * `produtosDeCurso()` — a lista VIGENTE, e a trava contra a divergência que o
 * Frank achou revisando este patch antes de mergear (ronda de 11/09 20hZ).
 *
 * O defeito era latente, não vivo: o conserto (`reconcileUserEntitlements`)
 * usava a lista com o env, e o detector (`sgp/reconciliacao.ts`) chamava
 * `entitlementDaPlataforma` com o PADRÃO. Coincidem hoje, então nada quebrava —
 * mas um `HOTMART_SGP_PRODUCT_ID` novo faria o conserto pular a órfã por ser
 * curso e o detector contá-la como plataforma, abrindo "sobrou compra paga sem
 * dono" exatamente na linha que o conserto decidiu não ligar.
 * ──────────────────────────────────────────────────────────────────────────── */

test("o padrão do SGP copiado aqui é o MESMO de sgp-boas-vindas (trava da cópia)", async () => {
  // `acesso-regra.ts` é zero-import de propósito (é o que o deixa rodável em
  // `node --test`), então o id do SGP está repetido lá como literal. Este teste
  // é o que impede a cópia de virar defeito silencioso: se as duas divergirem,
  // quebra aqui em vez de no dinheiro de alguém.
  const { SGP_PRODUCT_ID_PADRAO } = await import("./sgp-boas-vindas.ts");
  assert.equal(SGP, SGP_PRODUCT_ID_PADRAO);
  assert.ok(
    PRODUTOS_DE_CURSO_PADRAO.includes(SGP_PRODUCT_ID_PADRAO as (typeof PRODUTOS_DE_CURSO_PADRAO)[number]),
    "o SGP padrão precisa estar na lista de curso, senão reconcile e detector divergem",
  );
});

test("sem env, a lista vigente é exatamente a padrão", () => {
  assert.deepEqual(produtosDeCurso({}).sort(), [...PRODUTOS_DE_CURSO_PADRAO].sort());
});

test("env vazio/espaço não apaga o padrão do SGP", () => {
  // `?? ` sozinho deixaria passar string vazia e tiraria o 7283229 da lista.
  assert.deepEqual(produtosDeCurso({ HOTMART_SGP_PRODUCT_ID: "" }).sort(), [...PRODUTOS_DE_CURSO_PADRAO].sort());
  assert.deepEqual(produtosDeCurso({ HOTMART_SGP_PRODUCT_ID: "   " }).sort(), [...PRODUTOS_DE_CURSO_PADRAO].sort());
});

test("SGP novo no ambiente ENTRA na lista sem derrubar os padrões", () => {
  const lista = produtosDeCurso({ HOTMART_SGP_PRODUCT_ID: "999001" });
  assert.ok(lista.includes("999001"));
  for (const p of PRODUTOS_DE_CURSO_PADRAO) assert.ok(lista.includes(p));
  assert.equal(entitlementDaPlataforma("999001", lista), false);
});

test("CONTROLE DA DIVERGÊNCIA: com SGP novo, a lista padrão e a vigente discordam", () => {
  // Prova que o conserto não é tautológico: com um SGP de ambiente, chamar
  // `entitlementDaPlataforma` com o PADRÃO (o que o detector fazia) responde
  // "é plataforma" para a MESMA linha que a lista vigente recusa. É exatamente
  // o par de respostas contraditórias que abriria o chamado falso.
  const vigente = produtosDeCurso({ HOTMART_SGP_PRODUCT_ID: "999001" });
  assert.equal(entitlementDaPlataforma("999001", PRODUTOS_DE_CURSO_PADRAO), true);
  assert.equal(entitlementDaPlataforma("999001", vigente), false);
});
