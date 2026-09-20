/**
 * O CLIPE DE CENA DEVOLVE O QUE COBROU? (#485)
 *
 * Este arquivo trava as duas metades do conserto de 20/09, e elas têm garantias
 * OPOSTAS de propósito:
 *
 *   - ESTORNO = exatamente uma vez. Poll e webhook veem a mesma falha; pagar
 *     duas vezes é dinheiro saindo errado. Quem garante isso é o claim atômico
 *     (`.in(["pending","generating"])`).
 *   - CHAMADO = pelo menos uma vez. Da 2ª tentativa em diante a cena já está
 *     `failed` e o claim não casa — se o chamado dependesse dele, o #484
 *     voltaria a ser mudo.
 *
 * A asserção é sobre o EFEITO no banco de mentira (quantos estornos, de quanto,
 * com que ref_type), não sobre função pura: o risco aqui não é a aritmética, é
 * a emenda entre o claim e a devolução. Se alguém um dia tirar o `.in(...)`
 * pra "simplificar", o tsc continua verde e a casa passa a pagar em dobro em
 * silêncio — é exatamente esse silêncio que estes testes quebram.
 *
 * Como rodar:
 *   node --import ./test/alias-loader.mjs --experimental-test-module-mocks \
 *        --test src/lib/video/video-sync.test.ts
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Estorno = { userId: string; amount: number; refType?: string; refId?: string };

const CENA_ID = "c0000000-0000-4000-8000-000000000001";
const USER_ID = "u0000000-0000-4000-8000-000000000002";
const PROJETO = "p0000000-0000-4000-8000-000000000003";

let cena: Record<string, unknown> = {};
let estornos: Estorno[] = [];
let chamados: Record<string, unknown>[] = [];

function resetar(opts: { status: string; custo: number | null }) {
  cena = {
    id: CENA_ID,
    user_id: USER_ID,
    video_project_id: PROJETO,
    idx: 1,
    video_tier: "bronze",
    video_credits_cost: opts.custo,
    video_status: opts.status,
  };
  estornos = [];
  chamados = [];
}

/**
 * Banco de mentira que sabe a ÚNICA coisa que importa aqui: um `update` com
 * `.in("video_status", [...])` só casa se o estado ATUAL da cena estiver na
 * lista. É assim que o Postgres se comporta e é o que faz o claim ser claim.
 */
function admin() {
  const builder = (tabela: string) => {
    let modo: "select" | "update" = "select";
    let patch: Record<string, unknown> = {};
    let exigido: string[] | null = null;

    const api: Record<string, unknown> = {
      update(p: Record<string, unknown>) {
        modo = "update";
        patch = p;
        return api;
      },
      in(_col: string, vals: string[]) {
        exigido = vals;
        return api;
      },
      eq() {
        return api;
      },
      select() {
        if (modo !== "update") return api;
        if (tabela !== "video_scenes") return api;
        const casou = !exigido || exigido.includes(cena.video_status as string);
        if (!casou) return Promise.resolve({ data: [], error: null });
        cena = { ...cena, ...patch };
        return Promise.resolve({ data: [{ ...cena }], error: null });
      },
      maybeSingle() {
        return Promise.resolve({ data: { email: "aluno@exemplo.com" }, error: null });
      },
    };
    return api;
  };
  return { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) };
}

let mod: typeof import("./video-sync.ts") | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => admin() } });
  mock.module("@/lib/credits/service", {
    namedExports: {
      addExtraCredits: async (a: Estorno) => {
        estornos.push(a);
        return { ok: true, balance: 0 };
      },
    },
  });
  mock.module("@/lib/incidents/gravar", {
    namedExports: {
      inserirChamadoUnico: async (_admin: unknown, c: Record<string, unknown>) => {
        chamados.push(c);
      },
    },
  });
  mock.module("@/lib/kie/client", {
    namedExports: {
      kieGetTask: async () => ({ state: "fail", failMsg: "erro", resultUrls: [] }),
      friendlyKieError: (s: string) => `amigavel: ${s}`,
    },
  });
  mock.module("@/lib/r2/client", {
    namedExports: { r2: { send: async () => ({}) }, imagesBucket: () => "bucket" },
  });
  mock.module("@/lib/video/strip-audio", {
    namedExports: { stripAudioTrack: async (b: unknown) => b },
  });
  mock.module("@/lib/video/tiers", {
    namedExports: { getTier: () => ({ id: "bronze", label: "Bronze" }) },
  });
  mod = await import("./video-sync.ts");
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

test("falha depois do despacho: devolve o custo DAQUELA cena, e só ele", pular, async () => {
  resetar({ status: "generating", custo: 1320 });
  await mod!.failSceneVideo(CENA_ID, "code=429", { cobrado: true });

  assert.equal(estornos.length, 1, "deveria ter estornado exatamente uma vez");
  assert.equal(estornos[0].amount, 1320, "valor tem que ser o video_credits_cost da cena");
  assert.equal(estornos[0].refType, "video_clip_refund");
  assert.equal(estornos[0].refId, CENA_ID, "ref_id é a CENA, nunca o projeto (senão volta o lote)");
  assert.equal(estornos[0].userId, USER_ID);
  assert.equal(cena.video_status, "failed");
});

test("corrida poll × webhook: UM estorno só, mas o chamado abre nas duas", pular, async () => {
  resetar({ status: "pending", custo: 1320 });

  // As duas vias enxergam a mesma falha. A segunda chega com a cena já `failed`.
  await mod!.failSceneVideo(CENA_ID, "code=429", { cobrado: true });
  await mod!.failSceneVideo(CENA_ID, "code=429", { cobrado: true });

  assert.equal(estornos.length, 1, "PAGOU EM DOBRO: o claim atômico não está segurando");
  assert.equal(
    chamados.length,
    2,
    "o chamado não pode depender do claim — é o que mantém o #484 audível",
  );
});

test("conta da casa (custo 0): não estorna nada", pular, async () => {
  resetar({ status: "generating", custo: 0 });
  await mod!.failSceneVideo(CENA_ID, "timeout", { cobrado: true });

  assert.equal(estornos.length, 0, "nada foi cobrado, então não há o que devolver");
  assert.equal(chamados.length, 1, "mas a falha continua tendo que aparecer pra casa");
});

test("custo nulo (linha antiga): não estorna nada", pular, async () => {
  resetar({ status: "generating", custo: null });
  await mod!.failSceneVideo(CENA_ID, "timeout", { cobrado: true });

  assert.equal(estornos.length, 0);
});

test("cena que JÁ estava failed: não devolve de novo, mas ainda avisa", pular, async () => {
  resetar({ status: "failed", custo: 1320 });
  await mod!.failSceneVideo(CENA_ID, "falha na criação", { cobrado: false });

  assert.equal(estornos.length, 0, "não houve débito novo nesta tentativa");
  assert.equal(chamados.length, 1, "2ª tentativa em diante é justamente o caso do #484");
});

test("retentativa que volta pra pending e falha de novo: devolve de novo", pular, async () => {
  resetar({ status: "pending", custo: 1320 });
  await mod!.failSceneVideo(CENA_ID, "code=429", { cobrado: true });

  // O aluno mandou regerar: o redespacho põe a cena de volta em pending e
  // cobra de novo (video_clip_regen). Falhando outra vez, tem que devolver.
  cena.video_status = "pending";
  await mod!.failSceneVideo(CENA_ID, "code=429", { cobrado: true });

  assert.equal(estornos.length, 2, "o aluno pagou duas vezes; tem que receber duas");
  assert.equal(
    estornos.reduce((s, e) => s + e.amount, 0),
    2640,
  );
});

test("falha de CRIAÇÃO com a cena ainda pending: não devolve débito em voo", pular, async () => {
  // Cenário do `startSceneVideo`: a tentativa anterior está EM VOO (pending,
  // já cobrada) e o aluno manda regerar; o Kie recusa a criação nova. Nada foi
  // cobrado agora, e o débito que existe ainda pode ser entregue — devolver
  // aqui seria dar o vídeo de graça. Por isso `cobrado: false`.
  resetar({ status: "pending", custo: 1320 });
  await mod!.failSceneVideo(CENA_ID, "Kie recusou", { cobrado: false });

  assert.equal(estornos.length, 0, "estornou um débito que ainda estava em voo");
  assert.equal(chamados.length, 1, "mas a recusa de criação continua visível");
});
