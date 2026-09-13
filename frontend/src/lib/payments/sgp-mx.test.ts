/**
 * Testes da consulta de DNS de verdade (13/09/2026). Rodar:
 *   node --test src/lib/payments/sgp-mx.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO: em `sgp-boas-vindas.test.ts` quem
 * responde DNS é um dublê, então aqueles testes provam o ORQUESTRADOR e não
 * provam nada sobre a consulta real. Foi pra essa consulta poder ser exercitada
 * que ela saiu do `-canal.ts` (que importa `@/`, e o `node --test` não resolve
 * alias) e virou `sgp-mx.ts`, que só importa `node:dns`.
 *
 * DOIS TIPOS DE TESTE AQUI, e a diferença importa:
 *
 *  1. COM RESOLVER FALSO — determinísticos, rodam offline, e cobrem os códigos
 *     de erro que DECIDEM tudo (ENODATA × ENOTFOUND × SERVFAIL) e que não dá
 *     pra provocar de propósito contra o DNS público.
 *  2. CONTRA O DNS DE VERDADE — são os que provam que o `gmail.com.br` do caso
 *     real é mesmo detectado. Eles PULAM (não falham) quando não há rede: um
 *     teste que quebra a suíte inteira em máquina sem internet vira teste que
 *     alguém desliga. Quando pulam, dizem isso em voz alta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classificarMx,
  entregaImpossivel,
  dominioDoEmail,
} from "./sgp-boas-vindas.ts";
import {
  codigoDoErro,
  comTeto,
  resolverDnsDoDominio,
  TIMEOUT_DNS_MS,
  type ResolvedorMinimo,
} from "./sgp-mx.ts";

/** Um erro de DNS como o c-ares entrega: `Error` com `.code`. */
function erroDns(code: string): Error {
  return Object.assign(new Error(`query ${code}`), { code });
}

/** Resolver falso: cada consulta é um valor pronto ou um erro pra lançar. */
function resolvedorFalso(r: {
  mx?: { exchange: string; priority: number }[] | Error;
  v4?: string[] | Error;
  v6?: string[] | Error;
}): () => ResolvedorMinimo {
  const devolver = async <T>(v: T | Error | undefined, vazio: T): Promise<T> => {
    if (v instanceof Error) throw v;
    return v ?? vazio;
  };
  return () =>
    ({
      resolveMx: async () => devolver(r.mx, []),
      resolve4: async () => devolver(r.v4, []),
      resolve6: async () => devolver(r.v6, []),
    }) as unknown as ResolvedorMinimo;
}

// ── 1. códigos de erro: o que é RESPOSTA e o que é FALHA ──────────────────

test("ENODATA no MX (domínio existe, não publica MX) é resposta, não falha", async () => {
  // Sem MX e sem endereço → `sem_mx`.
  const semNada = await resolverDnsDoDominio(
    "x.test",
    resolvedorFalso({ mx: erroDns("ENODATA"), v4: erroDns("ENODATA"), v6: erroDns("ENODATA") }),
  );
  assert.deepEqual(semNada, { mx: [], temEndereco: false });
  assert.equal(classificarMx(semNada), "sem_mx");

  // Sem MX mas COM endereço → MX implícito (RFC 5321) → NÃO é entrega impossível.
  const comA = await resolverDnsDoDominio(
    "x.test",
    resolvedorFalso({ mx: erroDns("ENODATA"), v4: ["1.2.3.4"] }),
  );
  assert.deepEqual(comA, { mx: [], temEndereco: true });
  assert.equal(classificarMx(comA), "sem_mx_com_a");
  assert.equal(entregaImpossivel(classificarMx(comA)), false);
});

test("ENOTFOUND (NXDOMAIN) curto-circuita: não gasta consulta de A/AAAA", async () => {
  let perguntouA = false;
  const resposta = await resolverDnsDoDominio("nao-existe.test", () => {
    return {
      resolveMx: async () => {
        throw erroDns("ENOTFOUND");
      },
      resolve4: async () => {
        perguntouA = true;
        return [];
      },
      resolve6: async () => [],
    } as unknown as ResolvedorMinimo;
  });
  assert.deepEqual(resposta, { mx: [], temEndereco: false });
  assert.equal(classificarMx(resposta), "sem_mx");
  assert.equal(perguntouA, false, "domínio que não existe não precisa de mais consulta");
});

test("SERVFAIL/REFUSED/timeout SOBEM — não viram 'não entrega'", async () => {
  // Este é o teste que protege o requisito mais importante do card: falso
  // negativo do DNS não pode deixar de mandar e-mail pra quem receberia.
  for (const codigo of ["ESERVFAIL", "EREFUSED", "ETIMEOUT", "ECONNREFUSED"]) {
    await assert.rejects(
      () => resolverDnsDoDominio("x.test", resolvedorFalso({ mx: erroDns(codigo) })),
      (e: unknown) => codigoDoErro(e) === codigo,
      `${codigo} foi engolido e virou uma resposta — isso inventa entrega impossível`,
    );
  }
  // E falha na consulta de A/AAAA também sobe (não vira `sem_mx` silencioso).
  await assert.rejects(() =>
    resolverDnsDoDominio(
      "x.test",
      resolvedorFalso({ mx: erroDns("ENODATA"), v4: erroDns("ESERVFAIL") }),
    ),
  );
});

test("com MX presente, A/AAAA nem é consultado", async () => {
  let perguntouA = false;
  const r = await resolverDnsDoDominio("x.test", () => {
    return {
      resolveMx: async () => [{ exchange: "mx.x.test", priority: 10 }],
      resolve4: async () => {
        perguntouA = true;
        return [];
      },
      resolve6: async () => [],
    } as unknown as ResolvedorMinimo;
  });
  assert.equal(r.temEndereco, null, "null = não perguntamos, e é o que tem que estar aqui");
  assert.equal(perguntouA, false);
  assert.equal(classificarMx(r), "ok");
});

test("NULL MX chega inteiro até a classificação", async () => {
  const r = await resolverDnsDoDominio(
    "x.test",
    resolvedorFalso({ mx: [{ exchange: "", priority: 0 }] }),
  );
  assert.equal(classificarMx(r), "null_mx");
  assert.equal(entregaImpossivel(classificarMx(r)), true);
});

// ── 2. o teto de tempo ────────────────────────────────────────────────────

test("comTeto: consulta pendurada vira erro dentro do teto (não pendura o webhook)", async () => {
  const comecou = process.hrtime.bigint();
  await assert.rejects(
    () => comTeto(new Promise<never>(() => {}), 120, "MX de travado.test"),
    /timeout de 120ms em MX de travado\.test/,
  );
  const ms = Number(process.hrtime.bigint() - comecou) / 1e6;
  assert.ok(ms < 2_000, `o teto não cortou: levou ${ms.toFixed(0)}ms`);
});

test("comTeto: consulta que responde não é cortada, e o alarme não segura o processo", async () => {
  assert.equal(await comTeto(Promise.resolve("ok"), 5_000, "x"), "ok");
});

test("um DNS pendurado NÃO leva o resolverDnsDoDominio junto pra sempre", async () => {
  const comecou = process.hrtime.bigint();
  await assert.rejects(() =>
    resolverDnsDoDominio("travado.test", () => {
      return {
        resolveMx: () => new Promise(() => {}),
        resolve4: async () => [],
        resolve6: async () => [],
      } as unknown as ResolvedorMinimo;
    }),
  );
  const ms = Number(process.hrtime.bigint() - comecou) / 1e6;
  assert.ok(
    ms < TIMEOUT_DNS_MS + 1_500,
    `passou do teto de ${TIMEOUT_DNS_MS}ms: levou ${ms.toFixed(0)}ms`,
  );
});

// ── 3. contra o DNS DE VERDADE (pulam sem rede) ───────────────────────────

/** Tem rede/DNS? Se não tiver, os testes abaixo PULAM em vez de quebrar. */
async function temDns(): Promise<boolean> {
  try {
    const r = await resolverDnsDoDominio("gmail.com");
    return r.mx.length > 0;
  } catch {
    return false;
  }
}

test("DNS REAL: gmail.com.br (o caso da Sheila) é NULL MX e entrega é impossível", async (t) => {
  if (!(await temDns())) {
    t.skip("sem DNS nesta máquina — o teste contra a rede foi PULADO, não aprovado");
    return;
  }
  const dominio = dominioDoEmail("compradora@gmail.com.br");
  assert.equal(dominio, "gmail.com.br");

  const r = await resolverDnsDoDominio(dominio!);
  assert.deepEqual(r.mx, [{ exchange: "", priority: 0 }], "o `0 .` da RFC 7505 em carne e osso");
  assert.equal(classificarMx(r), "null_mx");
  assert.equal(entregaImpossivel(classificarMx(r)), true);
});

test("DNS REAL: os candidatos que PARECEM erro de digitação entregam normalmente", async (t) => {
  if (!(await temDns())) {
    t.skip("sem DNS nesta máquina — o teste contra a rede foi PULADO, não aprovado");
    return;
  }
  // O card mediu isto e é o que impede este PR de virar caça às bruxas:
  // `.com.br` da Microsoft é MX de verdade, e `gmail.com.` é FQDN válido.
  for (const dominio of ["gmail.com", "outlook.com.br", "hotmail.com.br"]) {
    const r = await resolverDnsDoDominio(dominio);
    assert.equal(classificarMx(r), "ok", `${dominio} foi classificado errado`);
  }
  // O ponto final não pode virar falso positivo: o normalizador tira o ponto e
  // o domínio resolve igual ao sem ponto.
  const comPonto = await resolverDnsDoDominio(dominioDoEmail("a@gmail.com.")!);
  assert.equal(classificarMx(comPonto), "ok");
});

test("DNS REAL: domínio que não existe é detectado como sem_mx", async (t) => {
  if (!(await temDns())) {
    t.skip("sem DNS nesta máquina — o teste contra a rede foi PULADO, não aprovado");
    return;
  }
  const r = await resolverDnsDoDominio("dominio-que-nao-existe-abc123xyz.test");
  assert.deepEqual(r, { mx: [], temEndereco: false });
  assert.equal(classificarMx(r), "sem_mx");
});
