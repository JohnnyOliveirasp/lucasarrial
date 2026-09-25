/**
 * Testes de `varredura_pagante_sem_conta.cjs` — sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/varredura_pagante_sem_conta.test.cjs
 *
 * Os 3 casos "conhecidos" usados aqui são os do incidente b6036323/#582, tal
 * como medidos em produção em 25/09 (payload real de `payment_events`, ver
 * `_frank/prova/2026-09-25_rotina_falhas_22h.md`). O dublê de banco replica só
 * a superfície do supabase-js que o script usa (`.from().select()...`,
 * incluindo o comportamento "thenable" da query e o `.maybeSingle()`).
 *
 * ⚠️ Não basta o script RODAR sem erro — o teste 6 é o tripwire: prova que o
 * controle positivo MORDE de verdade (lança quando falta um dos 3), não só
 * decora o arquivo. Sem isso, um `.like()` quebrado silenciosamente passaria
 * limpo por aqui.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  rodar,
  eventoEhPagamento,
  externalIdDoErro,
  lerCompraDoPayload,
  CONHECIDOS_B6036323,
} = require("./varredura_pagante_sem_conta.cjs");

/* ------------------------------------------------------------------ */
/* Dublê de banco — mesma forma do supabase-js usada pelo script.       */
/* ------------------------------------------------------------------ */
function fakeDb(tabelasIniciais, erros = {}) {
  const tabelas = {};
  for (const [nome, linhas] of Object.entries(tabelasIniciais)) {
    tabelas[nome] = linhas.map((l) => ({ ...l }));
  }

  function aplicaFiltros(linhas, filtros) {
    let out = linhas;
    for (const f of filtros) {
      if (f.tipo === "eq") out = out.filter((r) => r[f.col] === f.val);
      else if (f.tipo === "ilike") {
        out = out.filter((r) => String(r[f.col] ?? "").toLowerCase() === String(f.val).toLowerCase());
      } else if (f.tipo === "like") {
        if (f.pattern.endsWith("%")) {
          const prefixo = f.pattern.slice(0, -1);
          out = out.filter((r) => String(r[f.col] ?? "").startsWith(prefixo));
        } else {
          out = out.filter((r) => r[f.col] === f.pattern);
        }
      }
    }
    return out;
  }

  function builder(nomeTabela) {
    const estado = { filtros: [], ordem: null, faixa: null, tetoLimit: null, insertRows: null };

    async function executar(single) {
      if (erros[nomeTabela]) return { data: null, error: erros[nomeTabela] };

      if (estado.insertRows) {
        tabelas[nomeTabela] = tabelas[nomeTabela] || [];
        const inseridas = estado.insertRows.map((r) => ({ ...r }));
        tabelas[nomeTabela].push(...inseridas);
        return { data: inseridas, error: null };
      }

      let linhas = aplicaFiltros(tabelas[nomeTabela] || [], estado.filtros);
      if (estado.ordem) {
        const { col, asc } = estado.ordem;
        linhas = [...linhas].sort((a, b) => {
          if (a[col] < b[col]) return asc ? -1 : 1;
          if (a[col] > b[col]) return asc ? 1 : -1;
          return 0;
        });
      }
      if (estado.faixa) linhas = linhas.slice(estado.faixa[0], estado.faixa[1] + 1);
      if (estado.tetoLimit != null) linhas = linhas.slice(0, estado.tetoLimit);

      if (single) return { data: linhas[0] ? { ...linhas[0] } : null, error: null };
      return { data: linhas.map((r) => ({ ...r })), error: null };
    }

    const api = {
      select() { return api; },
      like(col, pattern) { estado.filtros.push({ tipo: "like", col, pattern }); return api; },
      ilike(col, val) { estado.filtros.push({ tipo: "ilike", col, val }); return api; },
      eq(col, val) { estado.filtros.push({ tipo: "eq", col, val }); return api; },
      order(col, opts) { estado.ordem = { col, asc: opts?.ascending !== false }; return api; },
      range(de, ate) { estado.faixa = [de, ate]; return api; },
      limit(n) { estado.tetoLimit = n; return api; },
      insert(linhaOuLinhas) {
        estado.insertRows = Array.isArray(linhaOuLinhas) ? linhaOuLinhas : [linhaOuLinhas];
        return api;
      },
      maybeSingle() { return executar(true); },
      then(resolve, reject) { executar(false).then(resolve, reject); },
    };
    return api;
  }

  return { from: builder, __tabelas: tabelas };
}

/* ------------------------------------------------------------------ */
/* Fixtures — os 3 casos reais do b6036323/#582 + o payload cru real.   */
/* ------------------------------------------------------------------ */
const PAYLOAD_JOSEPH = {
  data: { purchase: { price: { value: 97, currency_value: "BRL" }, status: "COMPLETED", transaction: "HP3853197065" } },
};
const PAYLOAD_ISAIAS = {
  data: { purchase: { price: { value: 97, currency_value: "BRL" }, status: "APPROVED", transaction: "HP1333444226" } },
};
const PAYLOAD_EZ = {
  data: { purchase: { price: { value: 20, currency_value: "USD" }, status: "APPROVED", transaction: "HP0936618681" } },
};
const PAYLOAD_TRIAL = {
  data: { purchase: { price: { value: 0, currency_value: "BRL" }, status: "APPROVED", transaction: "HP0000000000" } },
};
const PAYLOAD_NOVO = {
  data: { purchase: { price: { value: 147, currency_value: "BRL" }, status: "COMPLETED", transaction: "HP9999999999" } },
};

const EVENTOS_CONHECIDOS = [
  { id: "e1", event_id: "evt-joseph", event_type: "PURCHASE_COMPLETE", provider: "hotmart", buyer_email: "josephgois@hotmail.com", error: "compra órfã paga sem aviso novo (motivo: ja_avisado): josephgois@hotmail.com [74A6IGVU]", payload: PAYLOAD_JOSEPH, received_at: "2026-09-25T17:50:07.060618+00:00", processed_at: "2026-09-25T17:50:08.229+00:00" },
  { id: "e2", event_id: "evt-isaias", event_type: "PURCHASE_APPROVED", provider: "hotmart", buyer_email: "isaias.enf@gmail.com", error: "compra órfã sem canal de aviso: isaias.enf@gmail.com [877A2RHB]", payload: PAYLOAD_ISAIAS, received_at: "2026-09-18T13:45:33.232472+00:00", processed_at: "2026-09-18T13:45:45.007+00:00" },
  { id: "e3", event_id: "evt-ez", event_type: "PURCHASE_APPROVED", provider: "hotmart", buyer_email: "ezwaymotors@gmail.com", error: "compra órfã paga sem aviso novo (motivo: ja_avisado): ezwaymotors@gmail.com [7D9WG7J8]", payload: PAYLOAD_EZ, received_at: "2026-09-25T13:59:49.785535+00:00", processed_at: "2026-09-25T13:59:50.996+00:00" },
  { id: "e4", event_id: "evt-trial", event_type: "PURCHASE_APPROVED", provider: "hotmart", buyer_email: "trial.zero@example.com", error: "compra órfã sem canal de aviso: trial.zero@example.com [TRIALZERO]", payload: PAYLOAD_TRIAL, received_at: "2026-09-03T15:31:26.687140+00:00", processed_at: "2026-09-03T15:31:27+00:00" },
];

const EVENTO_NOVO = { id: "e5", event_id: "evt-novo", event_type: "PURCHASE_COMPLETE", provider: "hotmart", buyer_email: "novo.pagante@example.com", error: "compra órfã paga sem aviso novo (motivo: ja_avisado): novo.pagante@example.com [NOVOEXT1]", payload: PAYLOAD_NOVO, received_at: "2026-09-25T20:00:00+00:00", processed_at: "2026-09-25T20:00:01+00:00" };

const INCIDENTES_COBRINDO_OS_3 = [
  { id: "i582", numero: 582, status: "investigating", signature: "frank:pagante-sem-conta-aviso-calado-2026-09-25", affected_emails: ["josephgois@hotmail.com", "isaias.enf@gmail.com", "ezwaymotors@gmail.com"] },
  { id: "i100", numero: 100, status: "fixed", signature: "outra-coisa", affected_emails: ["ninguem@example.com"] },
];

function silencioso() { /* log mudo pros testes não poluir a saída */ }

/* ------------------------------------------------------------------ */
/* 1) Funções puras                                                    */
/* ------------------------------------------------------------------ */
test("eventoEhPagamento: valor>0 + status pago = true", () => {
  assert.equal(eventoEhPagamento(97, "APPROVED"), true);
  assert.equal(eventoEhPagamento(97, "COMPLETE"), true);
  assert.equal(eventoEhPagamento(97, "COMPLETED"), true);
  assert.equal(eventoEhPagamento("97", "approved"), true); // string numérica, case-insensitive
});

test("eventoEhPagamento: trial R$0 nunca é pagamento, mesmo com status pago", () => {
  assert.equal(eventoEhPagamento(0, "APPROVED"), false);
  assert.equal(eventoEhPagamento(null, "APPROVED"), false);
  assert.equal(eventoEhPagamento(undefined, "COMPLETE"), false);
});

test("eventoEhPagamento: OVERDUE com valor>0 NÃO é pagamento (lição de 18/08)", () => {
  assert.equal(eventoEhPagamento(97, "OVERDUE"), false);
  assert.equal(eventoEhPagamento(97, "BILLET_PRINTED"), false);
});

test("externalIdDoErro: extrai o código entre colchetes no fim da frase", () => {
  assert.equal(externalIdDoErro("compra órfã sem canal de aviso: a@b.com [877A2RHB]"), "877A2RHB");
  assert.equal(externalIdDoErro("compra órfã paga sem aviso novo (motivo: ja_avisado): x@y.com [7D9WG7J8]"), "7D9WG7J8");
});

test("externalIdDoErro: sem colchete no fim, devolve null (não adivinha)", () => {
  assert.equal(externalIdDoErro("erro qualquer sem colchete"), null);
  assert.equal(externalIdDoErro(""), null);
  assert.equal(externalIdDoErro(null), null);
});

test("lerCompraDoPayload: lê valor/moeda/status/transação do payload 2.0 real", () => {
  const r = lerCompraDoPayload(PAYLOAD_JOSEPH);
  assert.equal(r.valor, 97);
  assert.equal(r.moeda, "BRL");
  assert.equal(r.status, "COMPLETED");
  assert.equal(r.transacao, "HP3853197065");
});

test("lerCompraDoPayload: payload sem 'purchase' não inventa valor (null, não 0)", () => {
  const r = lerCompraDoPayload({ data: {} });
  assert.equal(r.valor, null);
  assert.equal(r.status, "");
  assert.equal(r.transacao, null);
});

/* ------------------------------------------------------------------ */
/* 2) Controle positivo — passa quando os 3 estão presentes             */
/* ------------------------------------------------------------------ */
test("rodar(): controle positivo passa com os 3 conhecidos presentes e pagos", async () => {
  const db = fakeDb({
    payment_events: EVENTOS_CONHECIDOS,
    profiles: [],
    entitlements: [
      { external_id: "74A6IGVU", user_id: null, status: "active", access_until: "2026-10-17T12:00:00+00:00" },
      { external_id: "877A2RHB", user_id: null, status: "active", access_until: "2026-10-18T12:00:00+00:00" },
      { external_id: "7D9WG7J8", user_id: null, status: "active", access_until: "2026-10-25T12:00:00+00:00" },
    ],
    incidents: INCIDENTES_COBRINDO_OS_3,
  });
  const r = await rodar(db, { confirmar: true, log: silencioso });
  // os 3 já estão cobertos pelo #582 -> nada novo é aberto
  assert.equal(r.abertos, 0);
  assert.equal(r.resumo.length, 3);
  assert.ok(r.resumo.every((x) => x.acao.includes("já em #582")));
});

/* ------------------------------------------------------------------ */
/* 3) Abre incidente NOVO para um caso não coberto, e é idempotente     */
/* ------------------------------------------------------------------ */
test("rodar(): abre incidente para pagante novo não coberto por nenhum card existente", async () => {
  const db = fakeDb({
    payment_events: [...EVENTOS_CONHECIDOS, EVENTO_NOVO],
    profiles: [],
    entitlements: [
      { external_id: "74A6IGVU", user_id: null, status: "active" },
      { external_id: "877A2RHB", user_id: null, status: "active" },
      { external_id: "7D9WG7J8", user_id: null, status: "active" },
      { external_id: "NOVOEXT1", user_id: null, status: "active" },
    ],
    incidents: INCIDENTES_COBRINDO_OS_3,
  });

  const r1 = await rodar(db, { confirmar: true, log: silencioso });
  assert.equal(r1.abertos, 1);
  const aberto = r1.resumo.find((x) => x.email === "novo.pagante@example.com");
  assert.ok(aberto, "deveria ter uma linha de resumo pro pagante novo");
  assert.match(aberto.acao, /^ABERTO #\d+/);

  const gravado = db.__tabelas.incidents.find((i) => i.affected_emails?.includes("novo.pagante@example.com"));
  assert.ok(gravado, "o incidente novo tem que estar de fato gravado na tabela");
  assert.equal(gravado.status, "open");
  assert.equal(gravado.categoria, "tecnico");
  assert.equal(gravado.cause, "bug");
  assert.equal(gravado.signature, "frank:pagante-sem-conta-orfao:evt-novo");
  assert.equal(gravado.numero, 583); // max(582,100)+1
  assert.match(gravado.title, /novo\.pagante@example\.com/);
  assert.match(gravado.title, /147 BRL/);
  assert.equal(gravado.sample_error, EVENTO_NOVO.error);

  // -------------------------------------------------------------
  // IDEMPOTÊNCIA: rodar de novo no MESMO banco (já mutado) não duplica
  // -------------------------------------------------------------
  const totalAntes = db.__tabelas.incidents.length;
  const r2 = await rodar(db, { confirmar: true, log: silencioso });
  assert.equal(r2.abertos, 0, "a segunda corrida não pode abrir de novo o mesmo caso");
  const totalDepois = db.__tabelas.incidents.length;
  assert.equal(totalDepois, totalAntes, "nenhuma linha nova deveria ter sido inserida na segunda corrida");
  const pulou = r2.resumo.find((x) => x.email === "novo.pagante@example.com");
  assert.match(pulou.acao, /pulado/);
});

/* ------------------------------------------------------------------ */
/* 4) Ensaio (sem --confirmar) não grava nada                          */
/* ------------------------------------------------------------------ */
test("rodar(): sem --confirmar é só ensaio, não escreve em incidents", async () => {
  const db = fakeDb({
    payment_events: [...EVENTOS_CONHECIDOS, EVENTO_NOVO],
    profiles: [],
    entitlements: [
      { external_id: "74A6IGVU", user_id: null, status: "active" },
      { external_id: "877A2RHB", user_id: null, status: "active" },
      { external_id: "7D9WG7J8", user_id: null, status: "active" },
      { external_id: "NOVOEXT1", user_id: null, status: "active" },
    ],
    incidents: INCIDENTES_COBRINDO_OS_3,
  });
  const totalAntes = db.__tabelas.incidents.length;
  const r = await rodar(db, { confirmar: false, log: silencioso });
  assert.equal(db.__tabelas.incidents.length, totalAntes, "ensaio não pode gravar");
  const ensaio = r.resumo.find((x) => x.email === "novo.pagante@example.com");
  assert.match(ensaio.acao, /^ensaio: abriria #/);
});

/* ------------------------------------------------------------------ */
/* 5) Já tem conta ou dono AGORA -> não abre, mesmo tendo pago          */
/* ------------------------------------------------------------------ */
test("rodar(): pagante que JÁ tem conta agora (resolvido depois do evento) não abre incidente", async () => {
  // O controle positivo roda incondicionalmente (ver teste 6) — os 3
  // conhecidos entram no dataset também, já cobertos por um incidente vivo,
  // pra isolar só o comportamento sob teste: "novo.pagante" pagou, mas já
  // tem profiles.id AGORA (resolveu-se sozinho depois do evento).
  const db = fakeDb({
    payment_events: [...EVENTOS_CONHECIDOS, EVENTO_NOVO],
    profiles: [{ id: "u1", email: "novo.pagante@example.com" }], // conta já existe AGORA
    entitlements: [
      { external_id: "74A6IGVU", user_id: null, status: "active" },
      { external_id: "877A2RHB", user_id: null, status: "active" },
      { external_id: "7D9WG7J8", user_id: null, status: "active" },
      { external_id: "NOVOEXT1", user_id: null, status: "active" },
    ],
    incidents: INCIDENTES_COBRINDO_OS_3,
  });
  const totalAntes = db.__tabelas.incidents.length;
  const r = await rodar(db, { confirmar: true, log: silencioso });
  // os 3 conhecidos: pulados por já estarem cobertos. o novo: pulado por já
  // ter conta agora. Em nenhum caso deveria aparecer no resumo de aberturas.
  assert.equal(r.abertos, 0);
  assert.ok(!r.resumo.some((x) => x.email === "novo.pagante@example.com"));
  assert.equal(db.__tabelas.incidents.length, totalAntes, "nada novo deveria ter sido gravado");
});

/* ------------------------------------------------------------------ */
/* 6) TRIPWIRE — controle positivo tem que MORDER, não só decorar       */
/* ------------------------------------------------------------------ */
test("rodar(): ABORTA (lança) quando falta um dos 3 casos conhecidos — instrumento cego", async () => {
  // Mesmo dataset da 1a linha de defesa, mas SEM o Isaías (simula coluna
  // sumida / payload mudou de formato / .like() quebrado).
  const semIsaias = EVENTOS_CONHECIDOS.filter((e) => e.buyer_email !== "isaias.enf@gmail.com");
  assert.equal(semIsaias.length, EVENTOS_CONHECIDOS.length - 1);

  const db = fakeDb({
    payment_events: semIsaias,
    profiles: [],
    entitlements: [
      { external_id: "74A6IGVU", user_id: null, status: "active" },
      { external_id: "7D9WG7J8", user_id: null, status: "active" },
    ],
    incidents: INCIDENTES_COBRINDO_OS_3,
  });

  await assert.rejects(
    () => rodar(db, { confirmar: true, log: silencioso }),
    (err) => {
      assert.match(err.message, /CONTROLE POSITIVO FALHOU/);
      assert.match(err.message, /isaias\.enf@gmail\.com/);
      return true;
    },
  );
  // nada pode ter sido gravado quando o controle positivo falha
  assert.equal(db.__tabelas.incidents.length, INCIDENTES_COBRINDO_OS_3.length);
});

test("CONHECIDOS_B6036323 continua sendo exatamente os 3 do b6036323/#582", () => {
  assert.deepEqual(
    [...CONHECIDOS_B6036323].sort(),
    ["ezwaymotors@gmail.com", "isaias.enf@gmail.com", "josephgois@hotmail.com"].sort(),
  );
});

/* ------------------------------------------------------------------ */
/* 7) Falha de leitura no Supabase tem que LANÇAR, nunca virar "zero"   */
/* ------------------------------------------------------------------ */
test("rodar(): erro na leitura de payment_events lança, não silencia como zero linhas", async () => {
  const db = fakeDb(
    { payment_events: [], profiles: [], entitlements: [], incidents: [] },
    { payment_events: { message: "column error does not exist" } },
  );
  await assert.rejects(
    () => rodar(db, { confirmar: true, log: silencioso }),
    /column error does not exist/,
  );
});

test("rodar(): erro lendo profiles (checagem de conta) lança, não vira 'sem conta' de graça", async () => {
  const db = fakeDb(
    {
      payment_events: EVENTOS_CONHECIDOS,
      profiles: [],
      entitlements: [
        { external_id: "74A6IGVU", user_id: null, status: "active" },
        { external_id: "877A2RHB", user_id: null, status: "active" },
        { external_id: "7D9WG7J8", user_id: null, status: "active" },
      ],
      incidents: INCIDENTES_COBRINDO_OS_3,
    },
    { profiles: { message: "boom" } },
  );
  await assert.rejects(() => rodar(db, { confirmar: true, log: silencioso }), /profiles.*boom/s);
});
