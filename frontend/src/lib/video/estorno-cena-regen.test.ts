/**
 * Testes do ESTORNO do clipe de cena (perna `video_clip_regen`) — #485.
 *
 * Rodar (o alias `@/` só existe no bundler; `node --test` pelado não resolve):
 *   cd frontend && npx tsx --test src/lib/video/estorno-cena-regen.test.ts
 *
 * (Este arquivo também roda em `node --test` porque o único import de `@/` é
 * `import type` e some no type-stripping — mas o comando oficial é o de cima.)
 *
 * O QUE ESTÁ COBERTO, e por quê cada um:
 *   A. cena falhada com 1 débito e 0 estornos → credita 1× (o defeito do #485:
 *      301 débitos de regen, ZERO estornos desde 07/07);
 *   B. a MESMA cena falhando de novo, já com estorno casado → NÃO credita de
 *      novo (é a trava contra o #469/b706b32e, "aluno debitado 1× e estornado
 *      2×" — sem este teste o conserto de um vira o defeito do outro);
 *   C. 3 débitos e 1 estorno → devolve no máximo o que falta;
 *   D. cena sem débito casado → não credita nada;
 *   E. estorno falhando (RPC `ok:false` ou leitura do extrato quebrada) →
 *      erro propagado, nada engolido.
 *
 * Além disso, uma prova de MUTAÇÃO do casamento: o módulo tem que filtrar por
 * `ref_type` + `ref_id`, NUNCA por `kind` — o estorno é gravado com
 * `kind='extra_purchase'`, igual a uma recarga comprada.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA: que `failSceneVideo` só chega aqui depois de
 * vencer a transição idempotente da cena. Isso é o claim
 * `.in("video_status", ["pending","generating"]).select(...)` em
 * `video-sync.ts` — verificado por leitura, igual ao que o irmão Animar Imagem
 * faz; testar aquilo exigiria fake da tabela `video_scenes` também.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import {
  decidirEstornoDeRegen,
  estornarRegenDaCena,
  REF_TYPE_DEBITO_REGEN,
  REF_TYPE_ESTORNO_REGEN,
  type Creditar,
} from "./estorno-cena-regen.ts";

const ALUNO = "hercules";
const CENA = "cena-1";

type Linha = {
  user_id: string;
  kind: string;
  amount: number;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
};

function debito(amount: number, created_at: string, extra: Partial<Linha> = {}): Linha {
  return {
    user_id: ALUNO,
    kind: "video",
    amount: -Math.abs(amount),
    ref_type: REF_TYPE_DEBITO_REGEN,
    ref_id: CENA,
    created_at,
    ...extra,
  };
}

function estorno(amount: number, created_at: string, extra: Partial<Linha> = {}): Linha {
  return {
    user_id: ALUNO,
    // O estorno nasce com o MESMO `kind` de uma recarga comprada — é por isso
    // que a idempotência não pode olhar pra `kind`.
    kind: "extra_purchase",
    amount: Math.abs(amount),
    ref_type: REF_TYPE_ESTORNO_REGEN,
    ref_id: CENA,
    created_at,
    ...extra,
  };
}

type Filtro = ["eq" | "lt", string, unknown];

/**
 * Fake do builder do PostgREST que aplica os filtros de verdade (eq/lt/order),
 * porque é justamente o casamento dos filtros que decide se o dinheiro volta.
 */
function bancoFake(linhas: Linha[], opcoes: { erroNa?: "debitos" | "estornos" } = {}) {
  const consultas: Array<{ colunas: string; filtros: Filtro[] }> = [];
  const valorDe = (l: Linha, c: string) => (l as unknown as Record<string, unknown>)[c];

  const admin = {
    from(tabela: string) {
      assert.equal(tabela, "credit_transactions", "só o extrato é lido aqui");
      return {
        select(colunas: string) {
          const filtros: Filtro[] = [];
          consultas.push({ colunas, filtros });
          let ordem: { coluna: string; ascending: boolean } | null = null;

          const executar = () => {
            const ehDebitos = filtros.some(([op, c]) => op === "lt" && c === "amount");
            const alvo = ehDebitos ? "debitos" : "estornos";
            if (opcoes.erroNa === alvo) {
              return { data: null, error: { message: "PostgREST caiu" } };
            }
            let achadas = linhas.filter((l) =>
              filtros.every(([op, c, v]) =>
                op === "eq" ? valorDe(l, c) === v : (valorDe(l, c) as number) < (v as number),
              ),
            );
            if (ordem) {
              const k = ordem.coluna;
              achadas = [...achadas].sort((a, b) => {
                const x = String(valorDe(a, k));
                const y = String(valorDe(b, k));
                return ordem!.ascending ? x.localeCompare(y) : y.localeCompare(x);
              });
            }
            return { data: achadas.map((l) => ({ amount: l.amount })), error: null };
          };

          const builder = {
            eq(c: string, v: unknown) {
              filtros.push(["eq", c, v]);
              return builder;
            },
            lt(c: string, v: unknown) {
              filtros.push(["lt", c, v]);
              return builder;
            },
            order(c: string, o?: { ascending?: boolean }) {
              ordem = { coluna: c, ascending: o?.ascending !== false };
              return builder;
            },
            then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
              return Promise.resolve(executar()).then(resolve, reject);
            },
          };
          return builder;
        },
      };
    },
  };

  return { admin: admin as unknown as SupabaseClient<Database>, consultas };
}

/** Fake do `addExtraCredits`: registra as chamadas e permite simular `ok:false`. */
function creditadorFake(ok = true) {
  const chamadas: Array<{ userId: string; amount: number; refType?: string; refId?: string }> = [];
  const creditar: Creditar = async (a) => {
    chamadas.push(a);
    return { ok };
  };
  return { creditar, chamadas };
}

/* ═════════════════════════ A DECISÃO (pura) ═════════════════════════ */

test("A/pura: 1 débito e nenhum estorno → devolve o débito inteiro", () => {
  const d = decidirEstornoDeRegen({ debitos: [{ amount: -1320 }], estornos: [] });
  assert.equal(d.estornar, true);
  assert.equal(d.valor, 1320);
  assert.equal(d.cobrado, 1320);
  assert.equal(d.devolvido, 0);
});

test("B/pura: mesma cena com estorno já casado → NÃO devolve de novo (#469)", () => {
  const d = decidirEstornoDeRegen({ debitos: [{ amount: -1320 }], estornos: [{ amount: 1320 }] });
  assert.equal(d.estornar, false, "débito 1× não pode virar estorno 2×");
  assert.equal(d.valor, 0);
  assert.match(d.motivo, /já aplicado/);
});

test("C/pura: 3 débitos e 1 estorno → devolve no máximo o que falta", () => {
  // Cobrado 3.960, devolvido 1.320 → pendente 2.640; a tentativa vale 1.320.
  const d = decidirEstornoDeRegen({
    debitos: [{ amount: -1320 }, { amount: -1320 }, { amount: -1320 }],
    estornos: [{ amount: 1320 }],
  });
  assert.equal(d.estornar, true);
  assert.equal(d.valor, 1320, "uma falha devolve uma tentativa, não o pendente inteiro");
});

test("C/pura: o PENDENTE é teto — tentativa cara não devolve mais do que se deve", () => {
  // Tier mudou entre as tentativas: cobrado 1.320+660 = 1.980, já devolvido
  // 1.320 → pendente 660. A tentativa mais recente (índice 0) vale 1.320.
  const d = decidirEstornoDeRegen({
    debitos: [{ amount: -1320 }, { amount: -660 }],
    estornos: [{ amount: 1320 }],
  });
  assert.equal(d.estornar, true);
  assert.equal(d.valor, 660, "o teto é o saldo pendente, não o valor da tentativa");
});

test("D/pura: sem débito casado → não devolve nada", () => {
  const d = decidirEstornoDeRegen({ debitos: [], estornos: [] });
  assert.equal(d.estornar, false);
  assert.equal(d.valor, 0);
  assert.match(d.motivo, /nada cobrado/);
});

test("pura: dado sujo (mais estorno que débito) não vira crédito novo", () => {
  const d = decidirEstornoDeRegen({ debitos: [{ amount: -1320 }], estornos: [{ amount: 5000 }] });
  assert.equal(d.estornar, false);
  assert.equal(d.valor, 0);
});

test("pura: linha com sinal trocado é ignorada dos dois lados", () => {
  const d = decidirEstornoDeRegen({
    debitos: [{ amount: 1320 }, { amount: -660 }],
    estornos: [{ amount: -100 }],
  });
  assert.equal(d.cobrado, 660, "débito positivo não conta como cobrança");
  assert.equal(d.devolvido, 0, "estorno negativo não conta como devolução");
  assert.equal(d.valor, 660);
});

/* ═══════════════════ A FIAÇÃO (lê extrato → credita) ═══════════════════ */

test("A: cena com 1 débito de regen e 0 estornos → credita 1×", async () => {
  const { admin } = bancoFake([debito(1320, "2026-09-19T23:00:00Z")]);
  const { creditar, chamadas } = creditadorFake();

  const r = await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA });

  assert.equal(r.aplicado, true);
  assert.deepEqual(chamadas, [
    { userId: ALUNO, amount: 1320, refType: REF_TYPE_ESTORNO_REGEN, refId: CENA },
  ]);
});

test("B: MESMA cena falhando de novo, já com estorno casado → NÃO credita segunda vez", async () => {
  const { admin } = bancoFake([
    debito(1320, "2026-09-19T23:00:00Z"),
    estorno(1320, "2026-09-19T23:00:05Z"),
  ]);
  const { creditar, chamadas } = creditadorFake();

  const r = await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA });

  assert.equal(r.aplicado, false);
  assert.deepEqual(chamadas, [], "este é o teste que impede repetir o #469");
});

test("C: 3 débitos e 1 estorno → credita no máximo o que falta", async () => {
  const { admin } = bancoFake([
    debito(1320, "2026-09-19T23:00:00Z"),
    debito(1320, "2026-09-19T23:10:00Z"),
    debito(660, "2026-09-19T23:20:00Z"), // mais recente: tier barato
    estorno(1320, "2026-09-19T23:11:00Z"),
  ]);
  const { creditar, chamadas } = creditadorFake();

  const r = await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA });

  assert.equal(r.cobrado, 3300);
  assert.equal(r.devolvido, 1320);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].amount, 660, "a tentativa mais recente é a de 660 (ordem DESC)");
});

test("C: quando a tentativa é maior que o pendente, devolve só o pendente", async () => {
  const { admin } = bancoFake([
    debito(660, "2026-09-19T23:00:00Z"),
    debito(1320, "2026-09-19T23:20:00Z"), // mais recente
    estorno(1320, "2026-09-19T23:05:00Z"),
  ]);
  const { creditar, chamadas } = creditadorFake();

  await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA });

  assert.equal(chamadas[0].amount, 660, "pendente = 1980 − 1320");
});

test("D: cena sem débito casado → não credita nada", async () => {
  const { admin } = bancoFake([
    // Débito de OUTRA cena e débito da perna agregada `video_clips` (que este
    // conserto não cobre de propósito): nenhum dos dois pode virar estorno aqui.
    debito(1320, "2026-09-19T23:00:00Z", { ref_id: "outra-cena" }),
    debito(6600, "2026-09-19T22:00:00Z", { ref_type: "video_clips", ref_id: "projeto-1" }),
  ]);
  const { creditar, chamadas } = creditadorFake();

  const r = await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA });

  assert.equal(r.aplicado, false);
  assert.deepEqual(chamadas, []);
});

test("D: débito de OUTRO aluno na mesma cena não é lido", async () => {
  const { admin } = bancoFake([
    debito(1320, "2026-09-19T23:00:00Z", { user_id: "outro-aluno" }),
  ]);
  const { creditar, chamadas } = creditadorFake();

  assert.equal(
    (await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA })).aplicado,
    false,
  );
  assert.deepEqual(chamadas, []);
});

/* ═══════════════════ E: nada de sumir em silêncio ═══════════════════ */

test("E: crédito que volta ok:false LANÇA (nada engolido)", async () => {
  const { admin } = bancoFake([debito(1320, "2026-09-19T23:00:00Z")]);
  const { creditar, chamadas } = creditadorFake(false);

  await assert.rejects(
    () => estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA }),
    (e: Error) => {
      assert.match(e.message, /1320/, "o valor tem que estar no erro pra dar pra consertar à mão");
      assert.match(e.message, new RegExp(CENA));
      return true;
    },
  );
  assert.equal(chamadas.length, 1, "tentou creditar — o que falhou foi o RPC");
});

test("E: leitura dos DÉBITOS que falha LANÇA e não credita às cegas", async () => {
  const { admin } = bancoFake([debito(1320, "2026-09-19T23:00:00Z")], { erroNa: "debitos" });
  const { creditar, chamadas } = creditadorFake();

  await assert.rejects(() =>
    estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA }),
  );
  assert.deepEqual(chamadas, []);
});

test("E: leitura dos ESTORNOS que falha LANÇA — senão estornaria por cima", async () => {
  // Este é o caso perigoso: sem a lista de estornos, "ninguém devolveu ainda"
  // parece verdade e o aluno recebe duas vezes.
  const { admin } = bancoFake(
    [debito(1320, "2026-09-19T23:00:00Z"), estorno(1320, "2026-09-19T23:00:05Z")],
    { erroNa: "estornos" },
  );
  const { creditar, chamadas } = creditadorFake();

  await assert.rejects(() =>
    estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA }),
  );
  assert.deepEqual(chamadas, []);
});

/* ═════════════════ MUTAÇÃO: o casamento é por ref_type ═════════════════ */

test("o extrato é lido por user_id + ref_type + ref_id, e NUNCA por kind", async () => {
  const { admin, consultas } = bancoFake([debito(1320, "2026-09-19T23:00:00Z")]);
  const { creditar } = creditadorFake();

  await estornarRegenDaCena({ admin, creditar }, { userId: ALUNO, sceneId: CENA });

  assert.equal(consultas.length, 2, "uma leitura pros débitos, outra pros estornos");
  for (const c of consultas) {
    const colunas = c.filtros.map(([, coluna]) => coluna);
    assert.ok(!colunas.includes("kind"), "filtrar por kind confunde estorno com recarga comprada");
    assert.deepEqual(
      c.filtros.filter(([op]) => op === "eq").map(([, coluna, valor]) => [coluna, valor]),
      [
        ["user_id", ALUNO],
        ["ref_type", c === consultas[0] ? REF_TYPE_DEBITO_REGEN : REF_TYPE_ESTORNO_REGEN],
        ["ref_id", CENA],
      ],
    );
  }
  // O lado do débito ainda pede `amount < 0` (linha positiva com esse ref_type
  // seria um ajuste manual, não uma cobrança).
  assert.ok(consultas[0].filtros.some(([op, c]) => op === "lt" && c === "amount"));
});

test("o ref_type do estorno é o combinado — trocá-lo cega a idempotência", () => {
  assert.equal(REF_TYPE_DEBITO_REGEN, "video_clip_regen");
  assert.equal(REF_TYPE_ESTORNO_REGEN, "video_clip_regen_refund");
});
