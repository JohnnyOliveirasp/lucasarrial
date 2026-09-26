/**
 * SIMULAÇÃO DO FALLBACK DE CHAVE LEGADA (#410) — a prova de que chamado aberto
 * na assinatura velha volta a somar ocorrência em vez de rachar em dois.
 *
 * O CASO REAL que isto reproduz: o conserto do dedupe por queixa (#23, commit
 * 3b9cb97, na main desde 15/09 03:03Z) trocou a assinatura do e-mail de
 * `fast-email:{canal}:{email}` pra `fast-email:{canal}:{classe}:{email}` e
 * subiu sem cuidar do que já estava gravado. Como a busca casa `signature` por
 * igualdade EXATA, chamado aberto na chave velha nunca mais soma: a queixa
 * seguinte procura a chave nova, não acha, e nasce chamado novo. Medido no
 * banco em 15/09: 23 abertos com 3 segmentos contra 2 com 4, e o racha já
 * consumado uma vez — o #408 nasceu do #356 (reembolso da Maria Teresa,
 * tuquinha36@hotmail.com), e o e-mail dela das 11:52Z não somou no chamado que
 * tem o histórico. Os e-mails e as assinaturas abaixo são os DE PRODUÇÃO.
 *
 * Isto NÃO testa a chave (isso é `agent/mail-incident.test.ts`): testa o
 * caminho de GRAVAÇÃO inteiro, `reportar.ts` + `gravar.ts` de verdade, contra
 * um banco falso que reproduz o índice único PARCIAL da mig 92 (um chamado
 * ABERTO por signature). Sem reproduzir o índice, o caso (3) — o que decide o
 * comportamento na colisão — não teria como acontecer.
 *
 * Como rodar (precisa do resolvedor de alias + mock de módulo):
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/incidents/legado-simulacao.test.ts
 *
 * Sem essas flags o arquivo se marca como SKIP em vez de derrubar a suíte —
 * o resto dos testes da casa roda com `node --test` pelado.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Linha = {
  id: string;
  numero: number | null;
  signature: string;
  status: string;
  occurrences: number;
  affected_emails: string[];
  title: string | null;
  [k: string]: unknown;
};

/** Os mesmos status terminais da mig 92 / closure.ts. */
const FECHADOS = ["fixed", "ignored"];

let banco: Linha[] = [];
let seq = 0;
let proximoNumero = 500;

/**
 * O LIVRO DE OCORRENCIAS (mig 47) — adicionado 26/09 (incidente 4f328521)
 * pra provar que `reportar.ts` agora grava aqui tambem (antes so `ingest.ts`
 * escrevia, e o relato de gente ficava fora do livro pela metade). Tabela
 * SEPARADA de `banco`: antes deste conserto o `from()` abaixo ignorava o
 * nome da tabela e tratava tudo como a mesma coisa — inofensivo enquanto
 * `reportar.ts` so escrevia em `incidents`, mas passaria a misturar as duas
 * tabelas no mesmo array assim que a escrita em `incident_occurrences`
 * entrasse. `from()` agora roteia pelo nome.
 */
type LinhaOcorrencia = {
  kind: string;
  ref_id: string;
  incident_id: string;
  at: string;
  email: string | null;
  error: string | null;
};
let ocorrencias: LinhaOcorrencia[] = [];

/**
 * A corrida do caso (3'): entre o SELECT e o UPDATE alguém CRIA o chamado da
 * chave nova. Guarda a signature que deve nascer no meio do caminho.
 */
let corridaNaMigracao: string | null = null;

function novaLinha(l: Partial<Linha> & { signature: string }): Linha {
  const linha: Linha = {
    id: `id-${++seq}`,
    numero: ++proximoNumero,
    status: "open",
    occurrences: 1,
    affected_emails: [],
    title: null,
    ...l,
  };
  banco.push(linha);
  return linha;
}

/** Cliente Supabase falso: só o que `reportar.ts`/`gravar.ts` de fato chamam. */
function fakeAdmin() {
  return {
    from(tabela: string) {
      if (tabela === "incident_occurrences") {
        return {
          insert: (p: Record<string, unknown>) => {
            ocorrencias.push(p as unknown as LinhaOcorrencia);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      const filtros: Array<(l: Linha) => boolean> = [];
      let op: "select" | "insert" | "update" = "select";
      let payload: Record<string, unknown> = {};
      const casar = () => banco.filter((l) => filtros.every((f) => f(l)));

      /** O índice único PARCIAL da mig 92: um chamado ABERTO por signature. */
      const abertoCom = (sig: string, exceto?: Linha) =>
        banco.some((o) => o !== exceto && o.signature === sig && !FECHADOS.includes(o.status));

      const executar = async (): Promise<{ data: unknown; error: { code: string } | null }> => {
        if (op === "insert") {
          const p = payload as unknown as Linha;
          if (abertoCom(p.signature)) return { data: null, error: { code: "23505" } };
          const linha = novaLinha(p);
          return { data: { id: linha.id, numero: linha.numero }, error: null };
        }
        if (op === "update") {
          // A corrida: o concorrente insere ANTES deste update encostar no banco.
          if (corridaNaMigracao && payload.signature === corridaNaMigracao) {
            novaLinha({ signature: corridaNaMigracao, title: "chamado do concorrente" });
            corridaNaMigracao = null;
          }
          for (const l of casar()) {
            const statusDepois = String(payload.status ?? l.status);
            const sigDepois =
              payload.signature === undefined ? l.signature : String(payload.signature);
            if (!FECHADOS.includes(statusDepois) && abertoCom(sigDepois, l)) {
              return { data: null, error: { code: "23505" } };
            }
            Object.assign(l, payload);
          }
          return { data: null, error: null };
        }
        return { data: casar()[0] ?? null, error: null };
      };

      const b = {
        select: () => b,
        insert: (p: Record<string, unknown>) => ((op = "insert"), (payload = p), b),
        update: (p: Record<string, unknown>) => ((op = "update"), (payload = p), b),
        eq: (col: string, val: unknown) => (filtros.push((l) => l[col] === val), b),
        not: (col: string, operador: string, lista: string) => {
          assert.equal(operador, "in", "o filtro de status mudou de operador");
          const valores = lista.replace(/[()"]/g, "").split(",");
          filtros.push((l) => !valores.includes(String(l[col])));
          return b;
        },
        order: () => b,
        limit: () => b,
        maybeSingle: async () => executar(),
        single: async () => executar(),
        then: (ok: (v: unknown) => unknown, falhou?: (e: unknown) => unknown) =>
          executar().then(ok, falhou),
      };
      return b;
    },
  };
}

let reportar: typeof import("./reportar.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => fakeAdmin() } });
  reportar = await import("@/lib/incidents/reportar");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

// ── as assinaturas REAIS de produção ────────────────────────────────────────
const MARIA = "tuquinha36@hotmail.com";
const SIG_LEGADA = `fast-email:atend:${MARIA}`;
const SIG_NOVA = `fast-email:atend:cobranca:${MARIA}`;

/** Uma queixa já classificada, no formato que `mail-respond.ts` monta. */
function queixa(signature: string, title = "aluna cobra o reembolso de novo") {
  return {
    signature,
    title,
    description: "aluna voltou a escrever sobre o reembolso",
    reportedBy: "fast",
    affectedEmails: [MARIA],
    categoria: "atendimento" as const,
  };
}

function preparar() {
  banco = [];
  ocorrencias = [];
  seq = 0;
  proximoNumero = 500;
  corridaNaMigracao = null;
}

// ── (1) legado ABERTO adota a queixa e migra a própria chave ────────────────

test("1) legado ABERTO soma a ocorrência E passa a viver na chave de 4 segmentos", pular, async () => {
  preparar();
  const legado = novaLinha({
    signature: SIG_LEGADA,
    numero: 356,
    occurrences: 3,
    title: "aluna pede reembolso de R$712,12",
  });

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  // Somou no chamado que tem o histórico — não nasceu chamado novo.
  assert.equal(numero, 356, "a queixa tinha que cair no #356, não num chamado novo");
  assert.equal(banco.length, 1, "nasceu chamado novo: o racha do #410 continua");
  assert.equal(legado.occurrences, 4);
  // E se migrou: da próxima vez a busca EXATA já acha, sem fallback nenhum.
  assert.equal(legado.signature, SIG_NOVA);
  assert.equal(legado.status, "open");
  // O título velho não some em silêncio (trava do #213).
  assert.match(String(legado.description), /aluna pede reembolso de R\$712,12/);
});

test("1') migrado UMA VEZ, a queixa seguinte entra pela chave exata (idempotente)", pular, async () => {
  preparar();
  novaLinha({ signature: SIG_LEGADA, numero: 356, occurrences: 3, title: "reembolso" });

  await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));
  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  assert.equal(numero, 356);
  assert.equal(banco.length, 1, "a segunda queixa abriu chamado duplicado");
  assert.equal(banco[0].occurrences, 5, "3 + as duas queixas");
  assert.equal(banco[0].signature, SIG_NOVA);
});

// ── (2) legado FECHADO não ressuscita ───────────────────────────────────────

test("2) legado FECHADO NÃO é adotado — nasce chamado novo", pular, async () => {
  preparar();
  const fechado = novaLinha({
    signature: SIG_LEGADA,
    numero: 356,
    occurrences: 3,
    status: "fixed",
    title: "reembolso já resolvido",
    resolved_at: "2026-09-01T10:00:00.000Z",
  });

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  assert.equal(banco.length, 2, "tinha que nascer chamado novo");
  assert.notEqual(numero, 356);
  // O fechado continua fechado, com o carimbo dele intacto: reabrir por uma
  // chave que nem é mais a dele seria ressurreição, e não foi pedido.
  assert.equal(fechado.status, "fixed");
  assert.equal(fechado.occurrences, 3);
  assert.equal(fechado.signature, SIG_LEGADA);
  assert.equal(fechado.resolved_at, "2026-09-01T10:00:00.000Z");
  const novo = banco[1];
  assert.equal(novo.signature, SIG_NOVA);
  assert.equal(novo.occurrences, 1);
});

test("2') 'ignored' também é fechado — mesma regra que 'fixed'", pular, async () => {
  preparar();
  novaLinha({ signature: SIG_LEGADA, numero: 356, status: "ignored", title: "descartado" });

  await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  assert.equal(banco.length, 2);
  assert.equal(banco[0].status, "ignored");
  assert.equal(banco[0].signature, SIG_LEGADA);
});

// ── (3) a colisão: legado aberto E chamado novo já existindo ────────────────

test("3) legado aberto + chamado NOVO já aberto: quem recebe é o NOVO, sem violar a unicidade", pular, async () => {
  preparar();
  // Exatamente o estado de produção em 15/09: #356 (legado) e #408 (novo),
  // ambos ABERTOS, mesmo aluno.
  const legado = novaLinha({ signature: SIG_LEGADA, numero: 356, occurrences: 3, title: "reembolso" });
  const novo = novaLinha({ signature: SIG_NOVA, numero: 408, occurrences: 1, title: "reembolso" });

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  // A busca EXATA acha o #408 primeiro e o fallback nem roda.
  assert.equal(numero, 408);
  assert.equal(novo.occurrences, 2);
  assert.equal(banco.length, 2, "não pode nascer um terceiro chamado");
  // O legado fica INTACTO: fundir #356 com #408 é decidir qual histórico morre,
  // e isso é decisão de dono, não desta função. Ele não é tocado nem migrado.
  assert.equal(legado.occurrences, 3);
  assert.equal(legado.signature, SIG_LEGADA);
  // E a invariante da mig 92 continua de pé: um ABERTO por signature.
  const abertas = banco.filter((l) => !FECHADOS.includes(l.status)).map((l) => l.signature);
  assert.equal(new Set(abertas).size, abertas.length);
});

test("3') corrida: o chamado da chave nova nasce ENTRE o SELECT e o UPDATE", pular, async () => {
  preparar();
  const legado = novaLinha({ signature: SIG_LEGADA, numero: 356, occurrences: 3, title: "reembolso" });
  corridaNaMigracao = SIG_NOVA; // o concorrente insere no meio do caminho

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  // A migração é recusada pelo índice — e a ocorrência NÃO se perde junto.
  assert.equal(numero, 356);
  assert.equal(legado.occurrences, 4, "a ocorrência sumiu com a migração recusada");
  assert.equal(legado.signature, SIG_LEGADA, "migrou por cima de uma chave que já tem dono");
  const abertas = banco.filter((l) => !FECHADOS.includes(l.status)).map((l) => l.signature);
  assert.equal(new Set(abertas).size, abertas.length, "dois ABERTOS com a mesma signature");
});

// ── (4) regressão: o caminho normal de 4 segmentos não mudou ────────────────

test("4) chamado de 4 segmentos continua somando como antes (nenhum fallback no meio)", pular, async () => {
  preparar();
  const atual = novaLinha({ signature: SIG_NOVA, numero: 408, occurrences: 1, title: "reembolso" });

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  assert.equal(numero, 408);
  assert.equal(atual.occurrences, 2);
  assert.equal(banco.length, 1);
});

test("4') chamado de 4 segmentos FECHADO continua REABRINDO (chave exata, regra antiga)", pular, async () => {
  preparar();
  const fechado = novaLinha({
    signature: SIG_NOVA,
    numero: 408,
    occurrences: 1,
    status: "fixed",
    title: "reembolso",
    resolved_at: "2026-09-01T10:00:00.000Z",
    resolved_by: "liz",
    resolved_commit: "abc123",
  });

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  // Esta é a diferença deliberada entre as duas buscas: chave EXATA reabre,
  // chave legada não. Se o fallback tivesse sido escrito sem filtro de status,
  // este teste passaria e o (2) quebraria.
  assert.equal(numero, 408);
  assert.equal(fechado.status, "open");
  assert.equal(fechado.occurrences, 2);
  assert.equal(fechado.resolved_at, null, "reabriu carregando o carimbo do fechamento");
  assert.equal(fechado.resolved_by, null);
  assert.equal(fechado.resolved_commit, null);
  assert.equal(banco.length, 1);
});

test("4'') assinatura de OUTRA família (help:) não ganha fallback nenhum", pular, async () => {
  preparar();
  const doChat = novaLinha({ signature: `help:atend:${MARIA}`, numero: 300, title: "dúvida" });

  await reportar!.abrirChamadoReportado(queixa(`help:atend:${MARIA}`, "outra dúvida"));

  assert.equal(doChat.occurrences, 2);
  assert.equal(doChat.signature, `help:atend:${MARIA}`, "mexeu na chave de outra família");
  assert.equal(banco.length, 1);
});

// ── (5) o split por classe do #23 continua valendo ──────────────────────────

test("5) duas CLASSES do mesmo aluno continuam sendo dois chamados", pular, async () => {
  preparar();
  const legado = novaLinha({ signature: SIG_LEGADA, numero: 356, occurrences: 3, title: "reembolso" });

  // Queixa de cobrança: adota o legado e migra a chave dele.
  const nCobranca = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));
  // Queixa de ACESSO, mesmo aluno: o legado já virou o chamado de cobrança, e
  // a chave de acesso não tem legado nenhum pra achar → chamado PRÓPRIO.
  const sigAcesso = `fast-email:atend:acesso:${MARIA}`;
  const nAcesso = await reportar!.abrirChamadoReportado(queixa(sigAcesso, "não consegue entrar"));

  assert.equal(nCobranca, 356);
  assert.equal(legado.signature, SIG_NOVA);
  assert.notEqual(nAcesso, nCobranca, "a queixa de acesso caiu no chamado de cobrança (bug do #23)");
  assert.equal(banco.length, 2);
  assert.equal(banco[1].signature, sigAcesso);
  assert.equal(banco[1].occurrences, 1);
});

test("5') o legado só é adotado UMA vez — a segunda classe não o rouba", pular, async () => {
  preparar();
  novaLinha({ signature: SIG_LEGADA, numero: 356, occurrences: 3, title: "reembolso" });

  // Ordem inversa: quem chega primeiro é a queixa de acesso.
  const sigAcesso = `fast-email:atend:acesso:${MARIA}`;
  const nAcesso = await reportar!.abrirChamadoReportado(queixa(sigAcesso, "não consegue entrar"));
  const nCobranca = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  // O legado é adotado pela PRIMEIRA queixa que chegar — é o melhor que dá pra
  // fazer sem adivinhar a classe dele, e é por isso que a migration em SQL foi
  // recusada. A segunda queixa não acha mais legado e abre chamado próprio.
  assert.equal(nAcesso, 356);
  assert.equal(banco[0].signature, sigAcesso);
  assert.notEqual(nCobranca, 356);
  assert.equal(banco.length, 2);
  assert.equal(banco[1].signature, SIG_NOVA);
});

// ── (6) incidente 4f328521 (26/09): reabertura grava rastro ─────────────────
//
// Antes deste conserto, a reabertura automática (chamado ABERTO POR GENTE
// que volta depois de fixed/ignored) não empurrava nota nenhuma em
// `agent_notes` — a mesma doença que `ingest.ts` já tinha resolvido pro
// lado da falha crua — e `incident_occurrences` só recebia linha de
// `ingest.ts`, nunca de um relato de gente. Os testes abaixo travam os dois.

test("6) REABERTURA por relato novo empilha nota de sistema em agent_notes e LIMPA o carimbo do fechamento", pular, async () => {
  preparar();
  const fechado = novaLinha({
    signature: SIG_NOVA,
    numero: 408,
    occurrences: 1,
    status: "fixed",
    title: "reembolso",
    resolved_at: "2026-09-01T10:00:00.000Z",
    resolved_by: "liz",
    resolved_commit: "abc123",
    agent_notes: [{ at: "2026-08-30T10:00:00Z", by: "frank", note: "resolvido, credito devolvido" }],
  });

  const numero = await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  assert.equal(numero, 408);
  assert.equal(fechado.status, "open");
  assert.equal(fechado.resolved_at, null, "reabertura continua limpando o carimbo (comportamento antigo intocado)");
  const notas = fechado.agent_notes as Array<{ by: string; note: string }>;
  assert.equal(notas.length, 2, "a nota antiga fica, a de reabertura entra em cima");
  assert.equal(notas[0].note, "resolvido, credito devolvido", "nota antiga preservada, nao sobrescrita");
  assert.equal(notas[1].by, "system");
  assert.match(notas[1].note, /^REABERTURA: novo relato \(fast\) apontou pra este chamado após status "fixed" — reaberto\.$/);
});

test("6') a nota de reabertura NAO é a de ingest.ts (\"REINCIDÊNCIA: falha voltou\") — gatilhos diferentes, textos diferentes", pular, async () => {
  preparar();
  novaLinha({ signature: SIG_NOVA, numero: 408, status: "fixed", agent_notes: [] });

  await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  const nota = (banco[0].agent_notes as Array<{ note: string }>)[0].note;
  assert.doesNotMatch(nota, /REINCID[ÊE]NCIA/i, "essa frase é do gatilho de falha crua (ingest.ts), não do relato de gente");
  assert.match(nota, /REABERTURA/);
});

test("6'') bump comum (SEM reabrir) não ganha nota nenhuma — só a reabertura de verdade escreve", pular, async () => {
  preparar();
  const aberto = novaLinha({ signature: SIG_NOVA, numero: 408, status: "open", occurrences: 1, agent_notes: [] });

  await reportar!.abrirChamadoReportado(queixa(SIG_NOVA));

  assert.equal(aberto.status, "open");
  assert.deepEqual(aberto.agent_notes, [], "bump comum não é reabertura: nenhuma nota escrita");
});

test("6''') incident_occurrences recebe UMA linha por chamada — bump, reabertura E criação (o livro cobre a fila inteira)", pular, async () => {
  preparar();

  // (a) chamado novo -> 1 linha.
  const nNovo = await reportar!.abrirChamadoReportado(queixa(`fast-email:atend:sinal:${MARIA}`, "sinal novo"));
  assert.equal(ocorrencias.length, 1, "chamado criado do zero também vira linha no livro");
  assert.equal(ocorrencias[0].incident_id, banco.find((l) => l.numero === nNovo)!.id);
  assert.equal(ocorrencias[0].kind, "reported");
  assert.equal(ocorrencias[0].email, MARIA);

  // (b) bump comum no mesmo chamado -> +1 linha.
  await reportar!.abrirChamadoReportado(queixa(`fast-email:atend:sinal:${MARIA}`, "sinal novo"));
  assert.equal(ocorrencias.length, 2, "bump comum também deixa rastro — antes ficava fora do livro");

  // (c) fecha e reabre -> +1 linha (a reabertura TAMBÉM é uma ocorrência).
  const linha = banco.find((l) => l.numero === nNovo)!;
  linha.status = "fixed";
  await reportar!.abrirChamadoReportado(queixa(`fast-email:atend:sinal:${MARIA}`, "sinal novo"));
  assert.equal(ocorrencias.length, 3);
  assert.equal(linha.status, "open", "confirma que este terceiro chamado foi de fato a reabertura");
  assert.ok(new Set(ocorrencias.map((o) => o.ref_id)).size === 3, "cada linha tem ref_id próprio, sem colidir na PK (kind, ref_id)");
});
