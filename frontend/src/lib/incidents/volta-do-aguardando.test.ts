/**
 * A VOLTA DO "AGUARDANDO O ALUNO" NO CHAT DO APP (#570, 25/09).
 *
 * O DEFEITO em duas metades, cada uma com sua trava aqui:
 *
 *  1. O chat do app (help/route.ts) era o ÚNICO dos três canais da Fast sem a
 *     válvula `reabrirPorRespostaDoAluno` — o e-mail chama (mail-respond.ts)
 *     e o zap chama (respond.ts). Resultado: 21 cartões `help:*` estacionados
 *     em `aguardando_aluno` com o aluno falando no chat e ninguém vendo. É a
 *     QUARTA vez desta família ("quem escreveu o caminho de um canal não
 *     replicou no outro" — Viviana 19/08, Carol 22/08, Zethe 27/08).
 *
 *  2. A reabertura por ocorrência nova (reportar.ts) só conhecia
 *     `fixed`/`ignored`. Cartão em `aguardando_aluno` recebendo ocorrência
 *     nova só somava `occurrences` e ficava parado num limbo que NENHUMA
 *     contagem varre: não é aberto (open/investigating) nem fechado.
 *
 * Como rodar:
 *   · os testes DE FONTE rodam com `node --test` pelado;
 *   · os de SIMULAÇÃO precisam das mesmas flags do legado-simulacao.test.ts:
 *     node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *          --test src/lib/incidents/volta-do-aguardando.test.ts
 *     Sem elas se marcam SKIP em vez de derrubar a suíte.
 *
 * Os testes de fonte existem pelo mesmo motivo do ponte-help.test.ts: o alvo
 * é uma rota Next (auth + Supabase + LLM no caminho), cara demais pra
 * instanciar, e o que precisa ser travado é a EXISTÊNCIA da chamada e a
 * posição dela — antes de gerar a resposta.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 1 — FONTE: o chat do app chama a válvula (metade 1 do #570)
// ═══════════════════════════════════════════════════════════════════════════

const ROTA = resolve(AQUI, "../../app/api/v1/help/route.ts");
const fonte = readFileSync(ROTA, "utf8");

test("o chat do app CHAMA reabrirPorRespostaDoAluno quando o aluno escreve", () => {
  assert.ok(
    fonte.includes('import { reabrirPorRespostaDoAluno } from "@/lib/incidents/espera"'),
    "a rota do help parou de importar a válvula de @/lib/incidents/espera — " +
      "é o buraco do #570 de volta: aluno responde no chat e o cartão fica em aguardando_aluno pra sempre",
  );
  assert.ok(
    /void reabrirPorRespostaDoAluno\(\{ email: auth\.email, trecho: /.test(fonte),
    "a chamada sumiu ou mudou de forma. Ela espelha mail-respond.ts:402 de propósito " +
      "(`void` + { email, trecho }): fire-and-forget que nunca derruba a resposta ao aluno, " +
      "casando o cartão por affected_emails",
  );
});

test("a válvula vem ANTES de gerar a resposta da Fast", () => {
  // Se a Fast resolver sozinha, o time ainda precisa ver que o aluno voltou a
  // falar — foi assim que a resposta do Luciano caiu no vazio (#95). E se a
  // LLM falhar (o catch retorna 500), a reabertura já disparou mesmo assim.
  const iValvula = fonte.indexOf("void reabrirPorRespostaDoAluno(");
  const iCerebro = fonte.indexOf("await buildAgentReply(");
  assert.ok(iValvula > 0 && iCerebro > 0, "sumiu a válvula ou a chamada do cérebro");
  assert.ok(
    iValvula < iCerebro,
    "a válvula foi parar DEPOIS do buildAgentReply: se a LLM falhar, a resposta do aluno " +
      "volta a cair no vazio — a reabertura tem que disparar antes de qualquer coisa que possa falhar",
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 2 — SIMULAÇÃO: reportar.ts reabre de aguardando_aluno (metade 2),
// o bounce do Robério continua barrado, e fixed segue reabrindo como sempre.
// Banco falso no mesmo molde do legado-simulacao.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

type Linha = {
  id: string;
  numero: number | null;
  signature: string;
  status: string;
  occurrences: number;
  affected_emails: string[];
  title: string | null;
  agent_notes?: Array<{ at: string; by: string; note: string }> | null;
  [k: string]: unknown;
};

/** Os mesmos status terminais da mig 92 / closure.ts. */
const FECHADOS = ["fixed", "ignored"];

let banco: Linha[] = [];
let seq = 0;
let proximoNumero = 500;

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

/** Cliente Supabase falso: o que reportar.ts/gravar.ts E espera.ts chamam. */
function fakeAdmin() {
  return {
    from() {
      const filtros: Array<(l: Linha) => boolean> = [];
      let op: "select" | "insert" | "update" = "select";
      let payload: Record<string, unknown> = {};
      let selectLista = false;
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
        return { data: selectLista ? casar() : (casar()[0] ?? null), error: null };
      };

      const b = {
        select: () => ((selectLista = true), b),
        insert: (p: Record<string, unknown>) => ((op = "insert"), (payload = p), b),
        update: (p: Record<string, unknown>) => ((op = "update"), (payload = p), b),
        eq: (col: string, val: unknown) => (filtros.push((l) => l[col] === val), b),
        contains: (col: string, vals: unknown[]) => (
          filtros.push((l) => vals.every((v) => (l[col] as unknown[])?.includes?.(v))), b
        ),
        like: (col: string, padrao: string) => (
          filtros.push((l) =>
            new RegExp(`^${padrao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`).test(
              String(l[col]),
            ),
          ),
          b
        ),
        not: (col: string, operador: string, lista: string) => {
          assert.equal(operador, "in", "o filtro de status mudou de operador");
          const valores = lista.replace(/[()"]/g, "").split(",");
          filtros.push((l) => !valores.includes(String(l[col])));
          return b;
        },
        order: () => b,
        limit: () => ((selectLista = false), b),
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
let espera: typeof import("./espera.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => fakeAdmin() } });
  reportar = await import("@/lib/incidents/reportar");
  espera = await import("@/lib/incidents/espera");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

const ALUNO = "aluno.esperando@example.com";
const SIG_HELP = `help:atend:${ALUNO}`;

/** Ocorrência nova no formato que help/route.ts monta (abrirChamadoDoChat). */
function ocorrenciaDoChat(title = "aluno voltou a pedir humano") {
  return {
    signature: SIG_HELP,
    title,
    description: "o aluno escreveu de novo no chat do app",
    reportedBy: "fast-help",
    affectedEmails: [ALUNO],
    categoria: "atendimento" as const,
  };
}

function preparar() {
  banco = [];
  seq = 0;
  proximoNumero = 500;
}

// ── (a) aluno responde → cartão em aguardando_aluno VOLTA PRA FILA ──────────

test("a) reabrirPorRespostaDoAluno: cartão em aguardando_aluno volta pra 'open' quando o aluno fala", pular, async () => {
  preparar();
  const cartao = novaLinha({
    signature: SIG_HELP,
    numero: 570,
    status: "aguardando_aluno",
    affected_emails: [ALUNO],
    agent_notes: [{ at: "2026-09-14T10:00:00.000Z", by: "liz", note: "mandei e-mail, esperando" }],
  });
  // Um cartão de OUTRO aluno em espera não pode voltar junto.
  const alheio = novaLinha({
    signature: "help:atend:outro@example.com",
    numero: 571,
    status: "aguardando_aluno",
    affected_emails: ["outro@example.com"],
  });

  const reabertos = await espera!.reabrirPorRespostaDoAluno({
    email: ALUNO,
    trecho: "oi, alguém me responde?",
  });

  assert.deepEqual(reabertos, [570], "tinha que reabrir exatamente o cartão do aluno que falou");
  assert.equal(cartao.status, "open", "o cartão não voltou pra fila — o buraco do #570 continua");
  assert.equal(alheio.status, "aguardando_aluno", "reabriu cartão de aluno que não falou nada");
  // A nota registra O QUE ele disse — sem isso o time reabre às cegas.
  const notas = cartao.agent_notes ?? [];
  assert.equal(notas.length, 2, "a nota da reabertura não foi CONCATENADA (ou sobrescreveu as antigas)");
  assert.match(notas[1].note, /o aluno respondeu/i);
  assert.match(notas[1].note, /alguém me responde\?/);
});

// ── (a') ocorrência nova via reportar.ts também tira da espera ──────────────

test("a') abrirChamadoReportado: ocorrência nova em cartão aguardando_aluno REABRE (e limpa carimbo órfão)", pular, async () => {
  preparar();
  const cartao = novaLinha({
    signature: SIG_HELP,
    numero: 570,
    status: "aguardando_aluno",
    occurrences: 2,
    affected_emails: [ALUNO],
    title: "aluno pedindo humano",
    // Carimbo órfão de um fechamento antigo: a reabertura tem que limpar
    // (sexto conserto da família closure.ts — não vamos plantar o sétimo).
    resolved_at: "2026-09-01T10:00:00.000Z",
  });

  const numero = await reportar!.abrirChamadoReportado(ocorrenciaDoChat());

  assert.equal(numero, 570, "a ocorrência tinha que somar no cartão que já existe");
  assert.equal(banco.length, 1, "nasceu cartão duplicado");
  assert.equal(
    cartao.status,
    "open",
    "cartão em aguardando_aluno recebeu ocorrência nova e FICOU PARADO — a metade 2 do #570 voltou: " +
      "esse status não aparece em contagem nenhuma (não é aberto nem fechado), o aluno some de vista",
  );
  assert.equal(cartao.occurrences, 3);
  assert.equal(cartao.resolved_at, null, "reabriu carregando carimbo de fechamento — regressão do closure.ts");
});

// ── (b) o bounce do Robério CONTINUA barrado ────────────────────────────────

test("b) bounce obsoleto (nasceIgnorado) NÃO ressuscita o 'ignored' — o fantasma do Robério continua morto", pular, async () => {
  preparar();
  // O cenário do comentário da linha ~166 de reportar.ts: o chamado do bounce
  // nasceu `ignored` (endereço obsoleto), e o MESMO endereço quica de novo.
  const fantasma = novaLinha({
    signature: "fast-bounce:obsoleto:roberio@example.com",
    numero: 480,
    status: "ignored",
    occurrences: 1,
    title: "[endereço obsoleto] resposta quicou",
    resolved_at: "2026-09-17T10:00:00.000Z",
  });

  const numero = await reportar!.abrirChamadoReportado({
    signature: "fast-bounce:obsoleto:roberio@example.com",
    title: "[endereço obsoleto] resposta quicou de novo",
    description: "segundo bounce do mesmo endereço que não é mais o do cadastro",
    reportedBy: "fast",
    categoria: "atendimento",
    nasceIgnorado: true,
    notaDeFechamento: "endereço obsoleto — caso fantasma",
  });

  assert.equal(numero, 480, "o segundo bounce tinha que somar no chamado que já existe");
  assert.equal(
    fantasma.status,
    "ignored",
    "o segundo bounce REABRIU o ignored: é exatamente o chamado fantasma na fila que a guarda " +
      "!c.nasceIgnorado existe pra impedir — a inclusão de aguardando_aluno na lista não podia tocar nisso",
  );
  assert.equal(fantasma.occurrences, 2, "a ocorrência do bounce tem que ser registrada mesmo sem reabrir");
  assert.equal(
    fantasma.resolved_at,
    "2026-09-17T10:00:00.000Z",
    "o carimbo do fechamento legítimo foi apagado sem reabertura",
  );
});

// ── (c) fixed continua reabrindo como sempre ────────────────────────────────

test("c) cartão 'fixed' continua REABRINDO com ocorrência nova (comportamento antigo, intocado)", pular, async () => {
  preparar();
  const resolvido = novaLinha({
    signature: SIG_HELP,
    numero: 570,
    status: "fixed",
    occurrences: 4,
    affected_emails: [ALUNO],
    title: "aluno pedindo humano",
    resolved_at: "2026-09-20T10:00:00.000Z",
  });

  const numero = await reportar!.abrirChamadoReportado(ocorrenciaDoChat("aluno voltou depois do fechamento"));

  assert.equal(numero, 570);
  assert.equal(resolvido.status, "open", "pedido novo depois de fixed tem que REABRIR — regra desde o #150");
  assert.equal(resolvido.occurrences, 5);
  assert.equal(resolvido.resolved_at, null, "reabriu sem limpar o carimbo do fechamento anterior");
});
