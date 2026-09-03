/**
 * `node --test src/lib/onboarding/registrar-aviso.test.ts`
 *
 * O que estes testes protegem: o registro NUNCA pode derrubar o e-mail do
 * aluno. A migration 104 não está aplicada, então em produção o insert VAI
 * falhar — e isso tem que ser inofensivo.
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaDoAviso, registrarAviso } from "./registrar-aviso.ts";

/** Cliente falso no formato que `registrarAviso` usa: .from().insert() */
function fakeAdmin(insert: (row: unknown) => unknown) {
  const chamadas: unknown[] = [];
  const admin = {
    from(tabela: string) {
      return {
        insert(row: unknown) {
          chamadas.push({ tabela, row });
          return Promise.resolve(insert(row));
        },
      };
    },
  };
  return { admin, chamadas };
}

const base = {
  email: "celsoslompo@gmail.com",
  aviso: "onboarding_ok_mas_assine" as const,
  assunto: "Seus arquivos estão prontos — falta só o acesso",
};

test("linhaDoAviso mapeia os campos e normaliza os ausentes pra null", () => {
  const linha = linhaDoAviso({ ...base, ok: true });
  assert.equal(linha.email, "celsoslompo@gmail.com");
  assert.equal(linha.aviso, "onboarding_ok_mas_assine");
  assert.equal(linha.assunto, base.assunto);
  assert.equal(linha.ok, true);
  assert.equal(linha.user_id, null);
  assert.equal(linha.referencia, null);
  assert.equal(linha.erro, null);
});

test("erro é descartado quando ok=true (não polui a tabela)", () => {
  const linha = linhaDoAviso({ ...base, ok: true, erro: "sobra de tentativa anterior" });
  assert.equal(linha.erro, null);
});

test("erro é guardado quando ok=false e truncado em 500 chars", () => {
  const curto = linhaDoAviso({ ...base, ok: false, erro: "SMTP esperava 250, veio 550" });
  assert.equal(curto.erro, "SMTP esperava 250, veio 550");

  const gigante = linhaDoAviso({ ...base, ok: false, erro: "x".repeat(900) });
  assert.equal(String(gigante.erro).length, 500);
});

test("erro vazio em falha vira null, não string vazia", () => {
  const linha = linhaDoAviso({ ...base, ok: false });
  assert.equal(linha.erro, null);
});

test("userId e referencia chegam ao banco quando o caller sabe", () => {
  const linha = linhaDoAviso({
    ...base,
    ok: true,
    userId: "11111111-2222-3333-4444-555555555555",
    referencia: "voz ready, avatares 5/5",
  });
  assert.equal(linha.user_id, "11111111-2222-3333-4444-555555555555");
  assert.equal(linha.referencia, "voz ready, avatares 5/5");
});

test("grava na tabela avisos_enviados", async () => {
  const { admin, chamadas } = fakeAdmin(() => ({ error: null }));
  await registrarAviso(admin as never, { ...base, ok: true });
  assert.equal(chamadas.length, 1);
  assert.equal((chamadas[0] as { tabela: string }).tabela, "avisos_enviados");
});

test("NÃO lança quando a tabela não existe (migration 104 não aplicada)", async () => {
  const { admin } = fakeAdmin(() => ({
    error: { message: 'relation "public.avisos_enviados" does not exist' },
  }));
  await registrarAviso(admin as never, { ...base, ok: true });
});

test("NÃO lança quando o cliente estoura (rede/credencial)", async () => {
  const admin = {
    from() {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
    },
  };
  await registrarAviso(admin as never, { ...base, ok: true });
});

test("NÃO lança quando o insert rejeita a promise", async () => {
  const admin = {
    from() {
      return { insert: () => Promise.reject(new Error("socket hang up")) };
    },
  };
  await registrarAviso(admin as never, { ...base, ok: true });
});
