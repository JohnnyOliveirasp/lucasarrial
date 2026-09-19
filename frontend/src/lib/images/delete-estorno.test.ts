/**
 * Testes do estorno NO MOMENTO DO DELETE do histórico de imagens.
 *
 * Rodar:
 *   npx tsx --test src/lib/images/delete-estorno.test.ts
 * (NUNCA `node --test` pelado em arquivo que importe `@/` — o alias não
 * resolve. Este módulo não importa nada, então os dois rodam; o comando
 * canônico do cartão é o tsx.)
 *
 * O defeito coberto (caso cesarsantos.gestor 19/09, geração 508e6d11): o
 * DELETE não olhava `status` e hard-deletava a row em voo — a única capaz de
 * devolver o crédito. Aluno cobrado (-525 cr), sem imagem, sem estorno, e sem
 * a prova de que a casa devia.
 *
 * A ORDEM (estorna → confere no extrato → só então apaga) é a regra de
 * dinheiro, então ela é testada aqui pelo `registro` de chamadas, não só pelo
 * veredito final: "creditou" e "creditou ANTES de apagar" são garantias
 * diferentes, e só a segunda protege a prova.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apagarDoHistorico,
  conferirDepoisDoEstorno,
  decidirAoApagar,
  emVoo,
  estornoConfirmado,
  idsQuePrecisamEstorno,
  planoDeApagar,
  type ExtratoDoRef,
  type LinhaParaApagar,
} from "./delete-estorno.ts";

// ── Banco de mentira ───────────────────────────────────────────────────────
type EstadoFake = {
  /** status por id; id ausente = row já sumiu. */
  rows: Record<string, string | null>;
  /** extrato por ref_id. */
  extrato: Record<string, ExtratoDoRef>;
  /** true = a RPC de crédito está fora do ar (handleTechFailure engole e some). */
  estornoQuebrado?: boolean;
  /** true = leitura do extrato falha. */
  extratoIlegivel?: boolean;
};

function bancoFake(estado: EstadoFake) {
  const registro: string[] = [];
  const portas = {
    async lerExtrato(refIds: string[]) {
      registro.push(`lerExtrato(${refIds.join("|")})`);
      if (estado.extratoIlegivel) throw new Error("extrato fora do ar");
      const saida: Record<string, ExtratoDoRef | undefined> = {};
      for (const id of refIds) saida[id] = estado.extrato[id];
      return saida;
    },
    async estornar(refId: string) {
      registro.push(`estornar(${refId})`);
      if (estado.estornoQuebrado) return; // best-effort: NÃO lança, só não credita
      // Espelha failImageGeneration: o claim só pega pending/generating.
      const status = estado.rows[refId];
      if (status !== "pending" && status !== "generating") return;
      estado.rows[refId] = "failed";
      // E o refundOriginalDebit só devolve enquanto débitos > estornos.
      const e = (estado.extrato[refId] ??= { debitos: 0, estornos: 0 });
      if (e.estornos < e.debitos) e.estornos++;
    },
    async lerStatusAgora(ids: string[]) {
      registro.push(`lerStatusAgora(${ids.join("|")})`);
      const saida: Record<string, string | null | undefined> = {};
      for (const id of ids) saida[id] = estado.rows[id];
      return saida;
    },
    async apagar(ids: string[]) {
      registro.push(`apagar(${ids.join("|")})`);
      for (const id of ids) delete estado.rows[id];
      return ids.length;
    },
  };
  return { portas, registro };
}

const linha = (id: string, status: string | null): LinhaParaApagar => ({ id, status });

// ── Os cinco testes obrigatórios do cartão ─────────────────────────────────

test("pending COM débito e SEM estorno → credita 1x e SÓ ENTÃO apaga", async () => {
  const estado: EstadoFake = {
    rows: { g1: "pending" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("g1", "pending")], portas);

  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.estornados, ["g1"]);
  assert.equal(estado.extrato.g1.estornos, 1, "creditou exatamente uma vez");
  assert.equal(estado.rows.g1, undefined, "a row foi apagada depois");
  // A ordem é a garantia: estornar → conferir → apagar.
  assert.deepEqual(registro, [
    "lerExtrato(g1)",
    "estornar(g1)",
    "lerExtrato(g1)",
    "lerStatusAgora(g1)",
    "apagar(g1)",
  ]);
  assert.ok(
    registro.indexOf("estornar(g1)") < registro.indexOf("apagar(g1)"),
    "o crédito volta ANTES de a prova sumir",
  );
});

test("apagar DUAS vezes / row que já tem estorno casado → NÃO credita de novo", async () => {
  // 1ª passada: row viva, débito, sem estorno.
  const estado: EstadoFake = {
    rows: { g1: "pending" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
  };
  const primeira = bancoFake(estado);
  await apagarDoHistorico([linha("g1", "pending")], primeira.portas);
  assert.equal(estado.extrato.g1.estornos, 1);

  // 2ª passada: o lote é reenviado (retry do aluno / clique duplo). O extrato
  // já mostra estorno casado por ref_id → nada de novo crédito.
  const segunda = bancoFake(estado);
  const r = await apagarDoHistorico([linha("g1", "pending")], segunda.portas);

  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.estornados, [], "nenhum estorno novo emitido");
  assert.equal(estado.extrato.g1.estornos, 1, "continua UM estorno — não pagou em dobro");
  assert.ok(
    !segunda.registro.some((c) => c.startsWith("estornar(")),
    "nem chegou a chamar o caminho de estorno",
  );
});

test("ready → não credita nada (foi entregue; isto é limpeza de galeria)", async () => {
  const estado: EstadoFake = {
    rows: { g1: "ready" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("g1", "ready")], portas);

  assert.equal(r.ok, true);
  assert.equal(estado.extrato.g1.estornos, 0, "trabalho entregue não se devolve");
  assert.equal(estado.rows.g1, undefined, "apaga normalmente");
  assert.deepEqual(registro, ["apagar(g1)"], "nem lê o extrato: não há dúvida a resolver");
});

test("pending SEM débito casado (equipe/admin/bypass) → não credita nada", async () => {
  const estado: EstadoFake = { rows: { g1: "pending" }, extrato: {} };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("g1", "pending")], portas);

  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.estornados, []);
  assert.equal(estado.extrato.g1, undefined, "não inventou crédito pra quem não foi cobrado");
  assert.equal(estado.rows.g1, undefined);
  assert.deepEqual(registro, ["lerExtrato(g1)", "apagar(g1)"]);
});

test("estorno falha → a row CONTINUA no banco (a prova não some com o dinheiro)", async () => {
  const estado: EstadoFake = {
    rows: { g1: "pending" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
    estornoQuebrado: true,
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("g1", "pending")], portas);

  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "estorno_nao_confirmado");
  assert.deepEqual(!r.ok && r.bloqueados, ["g1"]);
  assert.equal(estado.rows.g1, "pending", "a row segue viva");
  assert.equal(estado.extrato.g1.estornos, 0);
  assert.ok(!registro.some((c) => c.startsWith("apagar(")), "apagar() nunca foi chamado");
});

// ── Cercas em volta ────────────────────────────────────────────────────────

test("lote misto: um card trava o lote INTEIRO, nada é apagado", async () => {
  // Abortar o lote todo (em vez de apagar os saudáveis) é seguro porque o
  // estorno é idempotente: a segunda tentativa não paga em dobro.
  const estado: EstadoFake = {
    rows: { bom: "ready", ruim: "pending" },
    extrato: { ruim: { debitos: 1, estornos: 0 } },
    estornoQuebrado: true,
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("bom", "ready"), linha("ruim", "pending")], portas);

  assert.equal(r.ok, false);
  assert.equal(estado.rows.bom, "ready", "nem o card saudável saiu");
  assert.ok(!registro.some((c) => c.startsWith("apagar(")));
});

test("retry depois da RPC voltar: credita 1x no total, aí sim apaga", async () => {
  const estado: EstadoFake = {
    rows: { g1: "pending" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
    estornoQuebrado: true,
  };
  const primeira = await apagarDoHistorico([linha("g1", "pending")], bancoFake(estado).portas);
  assert.equal(primeira.ok, false);

  estado.estornoQuebrado = false; // RPC voltou
  const segunda = await apagarDoHistorico([linha("g1", "pending")], bancoFake(estado).portas);

  assert.equal(segunda.ok, true);
  assert.equal(estado.extrato.g1.estornos, 1, "UM estorno no total, não dois");
  assert.equal(estado.rows.g1, undefined);
});

test("virou ready na corrida: claim perdido não é estorno falho — apaga sem creditar", async () => {
  // O card entra no plano como pending, mas o webhook/poll entrega no
  // milissegundo seguinte. failImageGeneration não consegue o claim, logo não
  // há linha de estorno — e ler SÓ o extrato leria isso como "estorno falhou",
  // prendendo pra sempre o delete de uma imagem ENTREGUE.
  const estado: EstadoFake = {
    rows: { g1: "pending" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
  };
  const { portas } = bancoFake(estado);
  const portasComCorrida = {
    ...portas,
    async estornar(refId: string) {
      estado.rows[refId] = "ready"; // entregou antes do claim
      return portas.estornar(refId);
    },
  };

  const r = await apagarDoHistorico([linha("g1", "pending")], portasComCorrida);

  assert.equal(r.ok, true);
  assert.equal(estado.extrato.g1.estornos, 0, "entregue = nada devido");
  assert.equal(estado.rows.g1, undefined, "apagou normalmente");
});

test("extrato ilegível → aborta sem apagar (não se apaga no escuro)", async () => {
  const estado: EstadoFake = {
    rows: { g1: "pending" },
    extrato: { g1: { debitos: 1, estornos: 0 } },
    extratoIlegivel: true,
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("g1", "pending")], portas);

  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "extrato_ilegivel");
  assert.equal(estado.rows.g1, "pending");
  assert.ok(!registro.some((c) => c.startsWith("apagar(")));
});

test("failed apaga sem estorno: failImageGeneration já devolveu na hora da falha", async () => {
  const estado: EstadoFake = {
    rows: { g1: "failed" },
    extrato: { g1: { debitos: 1, estornos: 1 } },
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico([linha("g1", "failed")], portas);

  assert.equal(r.ok, true);
  assert.equal(estado.extrato.g1.estornos, 1, "não estorna de novo por cima");
  assert.deepEqual(registro, ["apagar(g1)"]);
});

test("lote grande de ready não consulta o extrato (nada muda pra limpeza de galeria)", async () => {
  const ids = ["a", "b", "c", "d"];
  const estado: EstadoFake = {
    rows: Object.fromEntries(ids.map((i) => [i, "ready"])),
    extrato: Object.fromEntries(ids.map((i) => [i, { debitos: 1, estornos: 0 }])),
  };
  const { portas, registro } = bancoFake(estado);

  const r = await apagarDoHistorico(
    ids.map((i) => linha(i, "ready")),
    portas,
  );

  assert.equal(r.ok && r.apagados, 4);
  assert.deepEqual(registro, ["apagar(a|b|c|d)"]);
  for (const i of ids) assert.equal(estado.extrato[i].estornos, 0);
});

// ── Unidades puras ─────────────────────────────────────────────────────────

test("emVoo: só pending e generating", () => {
  assert.equal(emVoo("pending"), true);
  assert.equal(emVoo("generating"), true);
  assert.equal(emVoo("ready"), false);
  assert.equal(emVoo("failed"), false);
  assert.equal(emVoo(null), false);
  assert.equal(emVoo(undefined), false);
  assert.equal(emVoo("status_que_nao_existe"), false);
});

test("decidirAoApagar cobre as quatro saídas", () => {
  assert.equal(
    decidirAoApagar({ status: "generating", debitos: 1, estornos: 0 }),
    "estornar_antes_de_apagar",
  );
  assert.equal(decidirAoApagar({ status: "pending", debitos: 1, estornos: 1 }), "ja_estornado");
  assert.equal(decidirAoApagar({ status: "pending", debitos: 0, estornos: 0 }), "sem_debito");
  assert.equal(decidirAoApagar({ status: "ready", debitos: 1, estornos: 0 }), "apagar_sem_estorno");
  assert.equal(decidirAoApagar({ status: "failed", debitos: 1, estornos: 0 }), "apagar_sem_estorno");
  assert.equal(decidirAoApagar({ status: null, debitos: 1, estornos: 0 }), "apagar_sem_estorno");
});

test("idempotência por CONTAGEM, não por existência: 2 débitos e 1 estorno ainda deve", () => {
  // Mesmo mecanismo do refundOriginalDebit (failure-alert.ts:90-96).
  assert.equal(
    decidirAoApagar({ status: "pending", debitos: 2, estornos: 1 }),
    "estornar_antes_de_apagar",
  );
  assert.equal(decidirAoApagar({ status: "pending", debitos: 2, estornos: 2 }), "ja_estornado");
  assert.equal(estornoConfirmado({ debitos: 2, estornosDepois: 1 }), false);
  assert.equal(estornoConfirmado({ debitos: 2, estornosDepois: 2 }), true);
  assert.equal(estornoConfirmado({ debitos: 0, estornosDepois: 0 }), true);
});

test("planoDeApagar / idsQuePrecisamEstorno separam o lote", () => {
  const rows = [
    linha("a", "pending"),
    linha("b", "ready"),
    linha("c", "generating"),
    linha("d", "pending"),
  ];
  const extrato = {
    a: { debitos: 1, estornos: 0 },
    b: { debitos: 1, estornos: 0 },
    c: { debitos: 1, estornos: 1 },
    // d não tem linha nenhuma no extrato
  };
  assert.deepEqual(planoDeApagar(rows, extrato), [
    { id: "a", decisao: "estornar_antes_de_apagar" },
    { id: "b", decisao: "apagar_sem_estorno" },
    { id: "c", decisao: "ja_estornado" },
    { id: "d", decisao: "sem_debito" },
  ]);
  assert.deepEqual(idsQuePrecisamEstorno(planoDeApagar(rows, extrato)), ["a"]);
});

test("conferirDepoisDoEstorno: ready ganha do extrato", () => {
  assert.equal(
    conferirDepoisDoEstorno({ statusAgora: "ready", debitos: 1, estornosDepois: 0 }),
    "entregue_no_ultimo_instante",
  );
  assert.equal(
    conferirDepoisDoEstorno({ statusAgora: "failed", debitos: 1, estornosDepois: 1 }),
    "pode_apagar",
  );
  assert.equal(
    conferirDepoisDoEstorno({ statusAgora: "failed", debitos: 1, estornosDepois: 0 }),
    "estorno_nao_confirmado",
  );
  // Row já sumiu (outra via apagou) e o estorno saiu: pode seguir.
  assert.equal(
    conferirDepoisDoEstorno({ statusAgora: undefined, debitos: 1, estornosDepois: 1 }),
    "pode_apagar",
  );
});
