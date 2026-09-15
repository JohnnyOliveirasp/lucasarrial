/**
 * A ENTREGA GRAVA A MARCA? (#415)
 *
 * Este arquivo cobre a emenda entre as duas metades do conserto: a trava do
 * e-mail só funciona se `entregarAoTime` de fato carimbar o chamado. Se um dia
 * alguém reescrever essa nota e deixar o `tipo` cair, a trava para de existir
 * EM SILÊNCIO — a Fast volta a responder por cima do time e nenhum teste de
 * regra pura percebe, porque a regra continua correta; o que sumiu foi o dado.
 * Por isso a asserção é sobre a ESCRITA no banco, não sobre a função pura.
 *
 * Cobre também a metade que protege o aluno: quando NENHUM grupo recebe o
 * aviso, a entrega não aconteceu, e aí o chamado NÃO pode ser carimbado —
 * senão a casa calaria num caso que ninguém do time sabe que existe (aluno sem
 * resposta E time sem aviso, que é o pior dos dois mundos).
 *
 * Como rodar:
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/incidents/entregar-marca.test.ts
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Nota = { at: string; by: string; note: string; tipo?: string };

let gravado: Record<string, unknown> | null = null;
let grupoRecebe = true;

/**
 * Lê o último `update` que chegou no banco de mentira.
 *
 * Existe por causa do compilador, não por estilo: a escrita em `gravado`
 * acontece DENTRO do fake, e o controle de fluxo do tsc não enxerga isso — ele
 * estreita a variável pra `null` depois do `gravado = null` de cada teste e
 * qualquer leitura vira `Property ... does not exist on type 'never'`. Dentro
 * de uma função o tipo declarado volta a valer.
 */
function ultimoUpdate(): { status?: string; agent_notes?: Nota[] } | null {
  return gravado as { status?: string; agent_notes?: Nota[] } | null;
}

function admin() {
  const builder = () => {
    let modo: "select" | "update" = "select";
    const api: Record<string, unknown> = {
      select() {
        modo = "select";
        return api;
      },
      update(p: Record<string, unknown>) {
        modo = "update";
        gravado = p;
        return api;
      },
      eq() {
        if (modo === "update") return Promise.resolve({ error: null });
        return api;
      },
      maybeSingle() {
        return Promise.resolve({ data: { id: "inc-1", agent_notes: [] }, error: null });
      },
      then: undefined,
    };
    return api;
  };
  return { from: () => builder(), rpc: async () => ({ data: null, error: null }) };
}

let entregar: typeof import("./entregar.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => admin() } });
  mock.module("@/lib/agent/provider", { namedExports: { sendAgentText: async () => grupoRecebe } });
  mock.module("@/lib/support/grupo", { namedExports: { gruposDoTime: () => ["grupo-1@g.us"] } });
  entregar = await import("./entregar.ts");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

const ENTREGA = {
  numero: 415,
  canal: "e-mail",
  aluno: "tuquinha36@hotmail.com",
  resumo: "aluna pede reembolso de R$ 2.712,12",
  texto: "quero meu dinheiro de volta",
};

test("a entrega carimba o chamado com tipo=entregue_humano", pular, async () => {
  gravado = null;
  grupoRecebe = true;

  const ok = await entregar!.entregarAoTime(ENTREGA);
  assert.equal(ok, true);

  const notas = ultimoUpdate()?.agent_notes ?? [];
  assert.equal(notas.length, 1);
  assert.equal(
    notas[0].tipo,
    "entregue_humano",
    "sem este carimbo a trava do e-mail não existe e a Fast volta a falar por cima do time",
  );
});

test("o texto/at/by da nota NÃO mudaram — o painel e as rondas leem isso", pular, async () => {
  gravado = null;
  grupoRecebe = true;

  await entregar!.entregarAoTime(ENTREGA);

  const nota = (ultimoUpdate()?.agent_notes ?? [])[0];
  assert.equal(nota.by, "carol", "quem lê `by` continua vendo o mesmo");
  assert.match(nota.note, /Time avisado no grupo do WhatsApp/, "o texto da nota é o de sempre");
  assert.match(nota.note, /FICA ABERTO até alguém responder o aluno/);
  assert.ok(nota.at, "a nota continua auditável");
  assert.equal(ultimoUpdate()?.status, "investigating", "o status da entrega não mudou");
});

test("se NENHUM grupo recebe o aviso, o chamado não é carimbado", pular, async () => {
  gravado = null;
  grupoRecebe = false; // sendAgentText devolve false pra todo grupo

  const ok = await entregar!.entregarAoTime(ENTREGA);

  assert.equal(ok, false, "sem aviso não houve entrega");
  assert.equal(
    ultimoUpdate(),
    null,
    "carimbar aqui calaria a Fast num caso que ninguém do time sabe que existe — aluno mudo E time sem aviso",
  );
});
