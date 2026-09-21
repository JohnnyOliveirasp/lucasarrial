/**
 * `npx tsx --test src/lib/admin/nav.test.ts`
 *
 * O que estes testes protegem: QUEM VÊ O QUÊ no /admin (a fonte da verdade é
 * `roles` em nav.ts). Em 21/09 o Johnny liberou Usuários pro suporte — junto
 * de Falhas, SGP e Agente. Tudo que tem dinheiro (visão geral, campanhas,
 * cortesias, históricos, admins) CONTINUA admin-only; se um teste daqui
 * quebrar, ou o suporte perdeu uma tela de trabalho, ou ganhou uma tela de
 * dinheiro — os dois são incidente, não detalhe.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN_NAV, canOpen, homeFor, navFor, type AdminNavItem } from "./nav.ts";

const hrefs = (role: "admin" | "suporte") => navFor(role).map((i) => i.href);

test("suporte vê Usuários (21/09) e continua com Falhas, SGP e Agente", () => {
  const nav = hrefs("suporte");
  assert.ok(nav.includes("/admin/usuarios"), "Usuários liberado em 21/09");
  assert.ok(nav.includes("/admin/falhas"));
  assert.ok(nav.includes("/admin/sgp"));
  assert.ok(nav.includes("/admin/agente"));
});

test("suporte NÃO ganhou nenhuma área de dinheiro junto", () => {
  const nav = hrefs("suporte");
  for (const fechado of [
    "/admin", // visão geral = caixa/lucro/faturamento
    "/admin/campanhas",
    "/admin/cortesias",
    "/admin/historico",
    "/admin/admins",
  ]) {
    assert.ok(!nav.includes(fechado), `${fechado} tem que continuar admin-only`);
  }
  // Cinto e suspensório: a lista do suporte é EXATAMENTE estas 4 telas.
  assert.deepEqual(nav, ["/admin/usuarios", "/admin/falhas", "/admin/sgp", "/admin/agente"]);
});

test("canOpen: suporte abre /admin/usuarios, não abre /admin/campanhas", () => {
  assert.equal(canOpen("suporte", "/admin/usuarios"), true);
  assert.equal(canOpen("suporte", "/admin/campanhas"), false);
  // URL com locale na frente também respeita a regra
  assert.equal(canOpen("suporte", "/pt-BR/admin/usuarios"), true);
  assert.equal(canOpen("suporte", "/pt-BR/admin/campanhas"), false);
  // rota sem item de menu continua só admin
  assert.equal(canOpen("suporte", "/admin/retiradas"), false);
});

test("admin continua vendo a lista inteira", () => {
  assert.deepEqual(
    hrefs("admin"),
    ADMIN_NAV.map((i) => i.href),
    "todo item do menu tem que aparecer pro admin",
  );
});

test("home do suporte continua sendo Falhas (Usuários entrou no menu, não virou o pouso)", () => {
  // Usuários vem ANTES de Falhas na lista; sem a trava no homeFor, o redirect
  // do /admin e o link "Ir para Falhas" passariam a mandar pra Usuários.
  assert.equal(homeFor("suporte"), "/admin/falhas");
  assert.equal(homeFor("admin"), "/admin");
});

test("MUTAÇÃO: o código VELHO (usuarios sem roles) reprova no teste 1", () => {
  // Reproduz o navFor sobre uma cópia do menu com a mudança de 21/09 desfeita:
  // /admin/usuarios de volta SEM `roles` (nasce admin-only). Se este filtro
  // deixasse o suporte ver Usuários mesmo assim, o teste 1 não estaria
  // testando nada — aqui provamos que a linha do nav.ts é o que decide.
  const velho: readonly AdminNavItem[] = ADMIN_NAV.map((i) =>
    i.href === "/admin/usuarios" ? { href: i.href, label: i.label, exact: i.exact } : i,
  );
  const navVelho = velho.filter((i) => (i.roles ?? ["admin"]).includes("suporte"));
  assert.ok(
    !navVelho.some((i) => i.href === "/admin/usuarios"),
    "sem roles no item, o suporte NÃO vê Usuários — logo o teste 1 pega regressão",
  );
  // E o mesmo item mutado continua visível pro admin (mutação não esconde de admin).
  const navVelhoAdmin = velho.filter((i) => (i.roles ?? ["admin"]).includes("admin"));
  assert.ok(navVelhoAdmin.some((i) => i.href === "/admin/usuarios"));
});
