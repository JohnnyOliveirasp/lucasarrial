/**
 * Regressão do falso negativo de 12/09: `listUsers` sem laço de paginação
 * enxergava 1.000 das 2.542 contas e devolvia "conta não encontrada" pra quem
 * existe (`ederonline1@gmail.com`, `smilefastrio@gmail.com`).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/db/auth-users.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_PAGE_SIZE, fetchAllAuthUsers, fetchAuthEmailsById } from "./auth-users.ts";

type FakeUser = { id: string; email: string | null };

/** Base falsa que respeita o teto de `perPage` do GoTrue, igual ao servidor. */
function fakeAdmin(base: FakeUser[], opts: { erroNaPagina?: number } = {}) {
  const chamadas: Array<{ page: number; perPage: number }> = [];
  const admin = {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
          chamadas.push({ page, perPage });
          if (opts.erroNaPagina === page) {
            return { data: null, error: { message: "upstream caiu" } };
          }
          const ini = (page - 1) * perPage;
          return { data: { users: base.slice(ini, ini + perPage) }, error: null };
        },
      },
    },
  };
  // O helper só usa `auth.admin.listUsers`; o resto do SupabaseClient não entra.
  return { admin: admin as never, chamadas };
}

function base(n: number, extras: FakeUser[] = []): FakeUser[] {
  const users: FakeUser[] = Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    email: `u${i}@ex.com`,
  }));
  users.push(...extras);
  return users;
}

test("base menor que uma página: uma chamada só", async () => {
  const { admin, chamadas } = fakeAdmin(base(37));
  const users = await fetchAllAuthUsers(admin);
  assert.equal(users.length, 37);
  assert.equal(chamadas.length, 1);
  assert.deepEqual(chamadas[0], { page: 1, perPage: AUTH_PAGE_SIZE });
});

test("2.542 contas (a base real de 12/09): lê as 2.542, não 1.000", async () => {
  const { admin, chamadas } = fakeAdmin(base(2542));
  const users = await fetchAllAuthUsers(admin);
  assert.equal(users.length, 2542);
  assert.equal(chamadas.length, 3);
  assert.deepEqual(
    chamadas.map((c) => c.page),
    [1, 2, 3],
  );
});

test("PROVA do incidente: acha quem mora depois da primeira página", async () => {
  // As duas contas que voltaram "não encontrada" pro Frank ficam no fim da base.
  const reais: FakeUser[] = [
    { id: "68bb3d3f-256a-472b-a14c-76f5ceba8fd6", email: "ederonline1@gmail.com" },
    { id: "dad39108-6dfe-45e4-ade3-3caec90a27f1", email: "smilefastrio@gmail.com" },
  ];
  const { admin } = fakeAdmin(base(2540, reais));
  const users = await fetchAllAuthUsers(admin);

  const achar = (email: string) => users.find((u) => u.email === email);
  assert.equal(achar("ederonline1@gmail.com")?.id, reais[0].id);
  assert.equal(achar("smilefastrio@gmail.com")?.id, reais[1].id);

  // E a contraprova: com uma página só (o código antigo) as duas somem.
  const umaPagina = users.slice(0, AUTH_PAGE_SIZE);
  assert.equal(
    umaPagina.some((u) => u.email === "ederonline1@gmail.com"),
    false,
  );
});

test("base com exatamente uma página cheia: confirma com a página seguinte vazia", async () => {
  const { admin, chamadas } = fakeAdmin(base(AUTH_PAGE_SIZE));
  const users = await fetchAllAuthUsers(admin);
  assert.equal(users.length, AUTH_PAGE_SIZE);
  // Página cheia nunca é prova de fim: tem que pedir a próxima.
  assert.equal(chamadas.length, 2);
});

test("erro no meio ABORTA — nunca devolve a base pela metade", async () => {
  const { admin } = fakeAdmin(base(2542), { erroNaPagina: 2 });
  await assert.rejects(
    () => fetchAllAuthUsers(admin, "teste"),
    (e: Error) => {
      assert.match(e.message, /teste/);
      assert.match(e.message, /página 2/);
      assert.match(e.message, /upstream caiu/);
      return true;
    },
  );
});

test("servidor devolvendo página sempre cheia: aborta no teto, sem laço infinito", async () => {
  const sempreCheia = {
    auth: {
      admin: {
        listUsers: async ({ perPage }: { page: number; perPage: number }) => ({
          data: { users: base(perPage) },
          error: null,
        }),
      },
    },
  } as never;
  await assert.rejects(
    () => fetchAllAuthUsers(sempreCheia, "teto"),
    /passou de 50000 contas/,
  );
});

test("fetchAuthEmailsById mapeia a base inteira e ignora conta sem e-mail", async () => {
  const { admin } = fakeAdmin([
    { id: "a", email: "a@ex.com" },
    { id: "b", email: null },
    { id: "c", email: "c@ex.com" },
  ]);
  const mapa = await fetchAuthEmailsById(admin);
  assert.equal(mapa.size, 2);
  assert.equal(mapa.get("a"), "a@ex.com");
  assert.equal(mapa.get("c"), "c@ex.com");
  assert.equal(mapa.has("b"), false);
});

test("fetchAuthEmailsById também aborta quando a leitura falha", async () => {
  const { admin } = fakeAdmin(base(2542), { erroNaPagina: 3 });
  await assert.rejects(() => fetchAuthEmailsById(admin, "mapa"), /mapa/);
});
