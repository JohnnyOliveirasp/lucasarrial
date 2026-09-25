/**
 * Testes da perna (b) do #485: o Regerar do clipe de cena usa o RESERVA do tier
 * e dispara UMA vez só.
 *
 * Rodar: `npx tsx --test src/lib/video/regen-fallback.test.ts`
 * (nunca `node --test` pelado: o alias `@/` não resolve.)
 *
 * O que precisa ficar travado aqui:
 *  1. o reserva escolhido corresponde ao tier (contra a tabela REAL de tiers);
 *  2. duas chamadas concorrentes disparam UMA vez só (o teste do claim);
 *  3. cena sem reserva definido não quebra — cai no titular;
 *  4. o titular continua sendo o PRIMEIRO a ser tentado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  escolherModeloDoRegen,
  reivindicarCena,
  estaEmVoo,
  type ExecutorDeClaim,
  type ReservaLike,
} from "@/lib/video/regen-fallback";
import { VIDEO_FALLBACK_BY_TIER, getVideoFallback, VIDEO_TIERS } from "@/lib/video/tiers";

// ---------------------------------------------------------------------------
// 1. O reserva escolhido corresponde ao tier
// ---------------------------------------------------------------------------

test("reserva escolhido corresponde ao tier (tabela real)", () => {
  for (const tier of VIDEO_TIERS) {
    const reserva = getVideoFallback(tier.id);
    const escolha = escolherModeloDoRegen({ status: "failed", reserva });

    assert.ok(reserva, `tier ${tier.id} deveria ter reserva na tabela`);
    assert.equal(escolha.usaReserva, true, `tier ${tier.id} deveria ir no reserva`);
    if (!escolha.usaReserva) return;
    assert.equal(
      escolha.reserva.kieModel,
      VIDEO_FALLBACK_BY_TIER[tier.id]?.kieModel,
      `tier ${tier.id} pegou o reserva de outro tier`,
    );
  }
});

test("o reserva NUNCA é o próprio titular que acabou de falhar", () => {
  // O defeito original em uma linha: no Bronze o titular é um PREVIEW
  // (grok-imagine-video-1-5-preview) e o Regerar caía nele de novo.
  for (const tier of VIDEO_TIERS) {
    const reserva = getVideoFallback(tier.id);
    if (!reserva) continue;
    assert.notEqual(
      reserva.kieModel,
      tier.kieModel,
      `tier ${tier.id}: o reserva é o mesmo motor do titular — redespachar nele é o bug`,
    );
  }
});

test("bronze sai do preview do Grok ao regerar", () => {
  const bronze = VIDEO_TIERS.find((t) => t.id === "bronze");
  assert.ok(bronze);
  assert.match(bronze.kieModel, /preview/, "premissa do cartão: o titular do bronze é preview");

  const escolha = escolherModeloDoRegen({ status: "failed", reserva: getVideoFallback("bronze") });
  assert.equal(escolha.usaReserva, true);
  if (!escolha.usaReserva) return;
  assert.doesNotMatch(escolha.reserva.kieModel, /preview/, "o reserva do bronze não pode ser preview");
});

// ---------------------------------------------------------------------------
// 4. O titular continua sendo o primeiro a ser tentado
// ---------------------------------------------------------------------------

test("cena nunca tentada (status null) vai no TITULAR, não no reserva", () => {
  const escolha = escolherModeloDoRegen({ status: null, reserva: getVideoFallback("bronze") });
  assert.equal(escolha.usaReserva, false);
  assert.equal(escolha.motivo, "primeira_tentativa");
});

test("cena ready (aluno editou o prompt e refaz) vai no TITULAR", () => {
  const escolha = escolherModeloDoRegen({ status: "ready", reserva: getVideoFallback("gold") });
  assert.equal(escolha.usaReserva, false);
  assert.equal(escolha.motivo, "primeira_tentativa");
});

test("só o status `failed` promove o reserva", () => {
  const reserva = getVideoFallback("prata");
  for (const status of [null, undefined, "ready", "pending", "generating", "qualquer_coisa"]) {
    const escolha = escolherModeloDoRegen({ status, reserva });
    assert.equal(escolha.usaReserva, false, `status ${String(status)} não deveria promover o reserva`);
  }
  assert.equal(escolherModeloDoRegen({ status: "failed", reserva }).usaReserva, true);
});

// ---------------------------------------------------------------------------
// 3. Cena sem reserva definido não quebra
// ---------------------------------------------------------------------------

test("tier sem reserva definido não quebra — cai no titular", () => {
  for (const reserva of [null, undefined]) {
    const escolha = escolherModeloDoRegen({ status: "failed", reserva });
    assert.equal(escolha.usaReserva, false);
    assert.equal(escolha.motivo, "sem_reserva");
  }
});

test("tier desconhecido não tem reserva e não explode", () => {
  const reserva = getVideoFallback("tier_que_nao_existe");
  assert.equal(reserva, null);
  const escolha = escolherModeloDoRegen({ status: "failed", reserva });
  assert.equal(escolha.usaReserva, false);
  assert.equal(escolha.motivo, "sem_reserva");
});

// ---------------------------------------------------------------------------
// 2. O teste do CLAIM: duas chamadas concorrentes disparam UMA vez só
// ---------------------------------------------------------------------------

/**
 * Simula a linha no Postgres. O compare-and-swap é síncrono DEPOIS do await —
 * é assim que `update ... where video_status = <de>` se comporta: quem chega
 * segundo não acha mais o valor que leu.
 */
function linhaFalsa(statusInicial: string | null) {
  const linha = { status: statusInicial, trocas: 0 };
  const executor: ExecutorDeClaim = async ({ de, para }) => {
    // Cede o turno ANTES de comparar: força o interleaving das duas chamadas.
    await new Promise((r) => setImmediate(r));
    if (linha.status !== de) return 0; // outra via já levou
    linha.status = para;
    linha.trocas += 1;
    return 1;
  };
  return { linha, executor };
}

test("CLAIM: duas chamadas concorrentes na MESMA cena failed disparam uma vez só", async () => {
  const { linha, executor } = linhaFalsa("failed");
  let despachos = 0;

  // Os dois cliques leem a cena ANTES de qualquer um escrever — ambos veem
  // "failed". É exatamente o cenário do josimocerqueira@.
  const doisCliques = [1, 2].map(async () => {
    const r = await reivindicarCena({ sceneId: "cena-1", statusAtual: "failed", executor });
    if (r.ok) despachos += 1; // só quem ganhou chama o Kie e debita
    return r;
  });

  const [a, b] = await Promise.all(doisCliques);

  assert.equal(despachos, 1, "dois cliques concorrentes cobraram/dispararam mais de uma vez");
  assert.equal(linha.trocas, 1, "a linha foi tomada mais de uma vez");
  assert.equal(linha.status, "pending");
  assert.equal([a.ok, b.ok].filter(Boolean).length, 1, "exatamente um clique deveria vencer");
  const perdedor = [a, b].find((r) => !r.ok);
  assert.equal(perdedor && !perdedor.ok && perdedor.motivo, "perdeu_corrida");
});

test("CLAIM: dez chamadas concorrentes ainda disparam uma vez só", async () => {
  const { linha, executor } = linhaFalsa("failed");
  const rs = await Promise.all(
    Array.from({ length: 10 }, () =>
      reivindicarCena({ sceneId: "cena-1", statusAtual: "failed", executor }),
    ),
  );
  assert.equal(rs.filter((r) => r.ok).length, 1);
  assert.equal(linha.trocas, 1);
});

test("CLAIM: cena nunca gerada (status null) também é tomada atomicamente", async () => {
  const { linha, executor } = linhaFalsa(null);
  const rs = await Promise.all(
    [1, 2].map(() => reivindicarCena({ sceneId: "cena-1", statusAtual: null, executor })),
  );
  assert.equal(rs.filter((r) => r.ok).length, 1, "o CAS a partir de NULL precisa valer também");
  assert.equal(linha.trocas, 1);
  assert.equal(linha.status, "pending");
});

test("CLAIM: cena já EM VOO é recusada sem nem tocar no banco", async () => {
  for (const status of ["pending", "generating"]) {
    let chamouBanco = false;
    const executor: ExecutorDeClaim = async () => {
      chamouBanco = true;
      return 1;
    };
    const r = await reivindicarCena({ sceneId: "cena-1", statusAtual: status, executor });
    assert.equal(r.ok, false, `status ${status} não pode ser redespachado`);
    assert.equal(r.ok === false && r.motivo, "em_voo");
    assert.equal(chamouBanco, false, "nem precisa ir ao banco: o despacho já está em voo");
  }
});

test("CLAIM: cena tomada por outra via não vira segunda cobrança", async () => {
  // A linha já virou `pending` entre o SELECT e o UPDATE deste pedido.
  const { linha, executor } = linhaFalsa("pending");
  const r = await reivindicarCena({ sceneId: "cena-1", statusAtual: "failed", executor });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motivo, "perdeu_corrida");
  assert.equal(linha.trocas, 0);
});

test("estaEmVoo cobre só pending/generating", () => {
  assert.equal(estaEmVoo("pending"), true);
  assert.equal(estaEmVoo("generating"), true);
  for (const s of [null, undefined, "ready", "failed", ""]) {
    assert.equal(estaEmVoo(s), false, `${String(s)} não está em voo`);
  }
});

// ---------------------------------------------------------------------------
// Forma do reserva: o que vai pro Kie tem de estar completo
// ---------------------------------------------------------------------------

test("todo reserva tem modelo, duração e resolução preenchidos", () => {
  for (const tier of VIDEO_TIERS) {
    const r: ReservaLike | null = getVideoFallback(tier.id);
    if (!r) continue;
    assert.ok(r.kieModel.length > 0, `${tier.id}: reserva sem kieModel`);
    assert.ok(r.durationSeconds > 0, `${tier.id}: reserva sem durationSeconds`);
    assert.ok(r.resolution.length > 0, `${tier.id}: reserva sem resolution`);
  }
});
