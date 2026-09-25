/**
 * O que este teste protege, em uma frase: a recusa do gate de admin nunca mais
 * é MUDA nem MENTIROSA.
 *
 * Medido em 21/09: o Johnny levou "Acesso restrito a administradores" três
 * vezes no /admin/sgp e o log de produção tinha ZERO registros da recusa; e o
 * código velho transformava falha de consulta ao banco em "você não é admin"
 * (403), descartando o erro do select legado em silêncio. Aqui se prova:
 *   - papel via env não toca o banco;
 *   - papel via banco (suporte) resolve certo;
 *   - quem não está em lugar nenhum leva 403 com motivo `sem_papel` E log;
 *   - consulta que FALHA leva 503 com o erro no log — nunca 403;
 *   - falha nas DUAS tentativas (inclusive por exceção) também é 503;
 *   - MUTAÇÃO: o código velho (cópia fiel do guard.ts pré-conserto) devolve
 *     null → 403 nesse mesmo cenário, provando que o conserto muda o resultado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirGate,
  resolverPapel,
  type AdminRole,
  type GuardDeps,
  type RespostaSelect,
} from "./guard-pure.ts";

const ok = (data: RespostaSelect["data"]): RespostaSelect => ({ data, error: null });
const falha = (msg: string): RespostaSelect => ({ data: null, error: { message: msg } });

/** Deps fake com CONTADOR de chamadas — pra provar "sem tocar no banco". */
function fakeDeps(over: Partial<GuardDeps>) {
  const chamadas = { comRole: 0, legado: 0 };
  const comRole = over.selectComRole ?? (async () => ok(null));
  const legado = over.selectLegado ?? (async () => ok(null));
  const deps: GuardDeps = {
    isAdminEmail: over.isAdminEmail ?? (() => false),
    selectComRole: async (e) => {
      chamadas.comRole++;
      return comRole(e);
    },
    selectLegado: async (e) => {
      chamadas.legado++;
      return legado(e);
    },
  };
  return { deps, chamadas };
}

const ROTA = "/api/v1/admin/sgp/entrar";

test("1. e-mail na env é admin SEM tocar no banco", async () => {
  const { deps, chamadas } = fakeDeps({ isAdminEmail: (e) => e === "johnny@ex.com" });
  const r = await resolverPapel("Johnny@Ex.com", deps); // case-insensitive + trim
  assert.deepEqual(r, { ok: true, role: "admin", fonte: "env" });
  assert.equal(chamadas.comRole, 0, "env respondeu; o banco não pode ter sido consultado");
  assert.equal(chamadas.legado, 0);

  const d = decidirGate(r, ["admin"], { email: "Johnny@Ex.com", rota: ROTA });
  assert.deepEqual(d, { tipo: "permitir", role: "admin" });
});

test("2. e-mail só no banco com role=suporte resolve suporte (e entra onde SUPORTE_OK)", async () => {
  const { deps } = fakeDeps({
    selectComRole: async () => ok({ email: "karen@ex.com", role: "suporte" }),
  });
  const r = await resolverPapel("karen@ex.com", deps);
  assert.deepEqual(r, { ok: true, role: "suporte", fonte: "banco" });

  const permitido = decidirGate(r, ["admin", "suporte"], { email: "karen@ex.com", rota: ROTA });
  assert.deepEqual(permitido, { tipo: "permitir", role: "suporte" });

  // E onde só admin entra, a recusa diz o motivo CERTO (papel_nao_permitido,
  // não sem_papel) e carrega o log completo.
  const negado = decidirGate(r, ["admin"], { email: "karen@ex.com", rota: "/api/v1/admin/lucro" });
  assert.equal(negado.tipo, "negar_403");
  if (negado.tipo === "negar_403") {
    assert.equal(negado.motivo, "papel_nao_permitido");
    assert.deepEqual(negado.log, {
      email: "karen@ex.com",
      papel: "suporte",
      fonte: "banco",
      rota: "/api/v1/admin/lucro",
      motivo: "papel_nao_permitido",
    });
  }
});

test("3. e-mail em lugar nenhum → null, e o gate nega 403 com motivo sem_papel + log", async () => {
  const { deps } = fakeDeps({});
  const r = await resolverPapel("ninguem@ex.com", deps);
  assert.deepEqual(r, { ok: true, role: null, fonte: "banco" });

  const d = decidirGate(r, ["admin", "suporte"], { email: "ninguem@ex.com", rota: ROTA });
  assert.equal(d.tipo, "negar_403");
  if (d.tipo === "negar_403") {
    assert.equal(d.motivo, "sem_papel");
    assert.deepEqual(d.log, {
      email: "ninguem@ex.com",
      papel: null,
      fonte: "banco",
      rota: ROTA,
      motivo: "sem_papel",
    });
  }
});

test("4. consulta ao banco FALHA (as duas devolvem error) → NÃO vira null: gate 503 e o erro está no log", async () => {
  const { deps } = fakeDeps({
    selectComRole: async () => falha("FetchError: ECONNREFUSED db.supabase.co"),
    selectLegado: async () => falha("FetchError: ECONNREFUSED db.supabase.co"),
  });
  const r = await resolverPapel("johnny.oliveirasp@gmail.com", deps);
  assert.equal(r.ok, false, "falha de consulta não pode virar resposta de papel");

  const d = decidirGate(r, ["admin", "suporte"], {
    email: "johnny.oliveirasp@gmail.com",
    rota: ROTA,
  });
  assert.equal(d.tipo, "negar_503", "erro de consulta responde 503, nunca 403");
  if (d.tipo === "negar_503") {
    assert.equal(d.log.motivo, "erro_consulta");
    assert.equal(d.log.fonte, "erro_consulta");
    assert.equal(d.log.rota, ROTA);
    assert.match(d.log.erro ?? "", /ECONNREFUSED/, "o erro real da consulta tem que estar no log");
  }
});

test("5. as duas tentativas LANÇAM exceção → 503 também (hoje isso morria em silêncio)", async () => {
  const { deps } = fakeDeps({
    selectComRole: async () => {
      throw new Error("TypeError: fetch failed");
    },
    selectLegado: async () => {
      throw new Error("TypeError: fetch failed");
    },
  });
  const r = await resolverPapel("karen@ex.com", deps);
  assert.equal(r.ok, false);
  const d = decidirGate(r, ["admin", "suporte"], { email: "karen@ex.com", rota: ROTA });
  assert.equal(d.tipo, "negar_503");
  if (d.tipo === "negar_503") assert.match(d.log.erro ?? "", /fetch failed/);
});

/**
 * 6. MUTAÇÃO — cópia FIEL da lógica velha (guard.ts@d5b7db1d, linhas 22-47,
 * pré-conserto), com o defeito preservado: o erro do select legado é
 * DESCARTADO (`const { data: legado }` sem olhar error). Prova que, no mesmo
 * cenário do teste 4, o código velho devolvia null → o gate velho respondia
 * 403 "Acesso restrito a administradores" pra um admin de verdade.
 */
async function adminRoleAntigo(
  email: string | null | undefined,
  deps: GuardDeps,
): Promise<AdminRole | null> {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (deps.isAdminEmail(e)) return "admin";
  const { data, error } = await deps.selectComRole(e);
  if (error) {
    const { data: legado } = await deps.selectLegado(e); // ← o defeito: erro descartado
    return legado ? "admin" : null;
  }
  if (!data) return null;
  return (data as { role?: string }).role === "suporte" ? "suporte" : "admin";
}

test("6. MUTAÇÃO: no cenário do teste 4 o código VELHO devolve null → 403; o novo, 503", async () => {
  const depsQuebradas: GuardDeps = {
    isAdminEmail: () => false,
    selectComRole: async () => falha("ECONNREFUSED"),
    selectLegado: async () => falha("ECONNREFUSED"),
  };

  // Código velho: banco fora do ar vira "não é admin".
  const velho = await adminRoleAntigo("johnny.oliveirasp@gmail.com", depsQuebradas);
  assert.equal(velho, null, "o código velho tinha que devolver null aqui (é o defeito)");
  // E o gate velho era `if (!role) return forbidden(...)` → 403.

  // Código novo: mesmo cenário, 503.
  const novo = await resolverPapel("johnny.oliveirasp@gmail.com", depsQuebradas);
  assert.equal(novo.ok, false);
  const d = decidirGate(novo, ["admin", "suporte"], {
    email: "johnny.oliveirasp@gmail.com",
    rota: ROTA,
  });
  assert.equal(d.tipo, "negar_503");
});

// ——— Guardas de NÃO-REGRESSÃO do fallback pré-mig 95 (comportamento que tem
// que sobreviver ao conserto; sem eles o painel sumiria num deploy adiantado) ———

test("fallback mig 95: select com role falha, legado ACHA a linha → admin (não 503)", async () => {
  const { deps } = fakeDeps({
    selectComRole: async () => falha('column admin_emails.role does not exist'),
    selectLegado: async () => ok({ email: "johnny.oliveirasp@gmail.com" }),
  });
  const r = await resolverPapel("johnny.oliveirasp@gmail.com", deps);
  assert.deepEqual(r, { ok: true, role: "admin", fonte: "banco" });
});

test("fallback mig 95: select com role falha, legado responde VAZIO → null (não é admin, não 503)", async () => {
  const { deps } = fakeDeps({
    selectComRole: async () => falha('column admin_emails.role does not exist'),
    selectLegado: async () => ok(null),
  });
  const r = await resolverPapel("ninguem@ex.com", deps);
  assert.deepEqual(r, { ok: true, role: null, fonte: "banco" });
});

test("sem e-mail autenticado (api key sem e-mail) → 403 sem_papel com fonte sem_email, não 503", async () => {
  const { deps, chamadas } = fakeDeps({});
  const r = await resolverPapel(null, deps);
  assert.deepEqual(r, { ok: true, role: null, fonte: null });
  assert.equal(chamadas.comRole, 0);
  const d = decidirGate(r, ["admin"], { email: null, rota: ROTA });
  assert.equal(d.tipo, "negar_403");
  if (d.tipo === "negar_403") assert.equal(d.log.fonte, "sem_email");
});

test("linha no banco SEM papel continua admin (como sempre foi)", async () => {
  const { deps } = fakeDeps({
    selectComRole: async () => ok({ email: "lucas@ex.com", role: null }),
  });
  const r = await resolverPapel("lucas@ex.com", deps);
  assert.deepEqual(r, { ok: true, role: "admin", fonte: "banco" });
});
