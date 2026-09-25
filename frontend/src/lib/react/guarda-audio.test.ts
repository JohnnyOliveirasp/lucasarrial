/**
 * GUARDA DO ÁUDIO na rota do Vídeo React (defeito 24/09, incidente #544).
 *
 * O que quebrou em produção: corpo sem `audio_url` passava pela validação
 * (que só olhava viralId/layout/roteiro/fotoUrl), a rota CRIAVA o job,
 * DEBITAVA o aluno (pelo preço ESTIMADO por palavras, já que não há áudio pra
 * medir) e só então morria no ramo `!audioKey` — estorno automático + churn
 * de débito/estorno + alarme falso de rajada. Medido: aluno
 * samuelanjos237, 3 jobs em 10min, cada um -3.975 e +3.975 de volta.
 *
 * O conserto é UMA guarda no bloco de validação, ANTES do insert e do
 * debitCredits — idêntica em forma à do `!fotoUrl` ao lado. Estes testes
 * provam o comportamento, não o texto do fonte:
 *
 *   1. corpo SEM audio_url → 400 com a mensagem que a tela já conhece,
 *      ZERO insert em react_jobs, ZERO debitCredits, ZERO contingência
 *      (sem estorno reivindicado, sem handleTechFailure — é isso que mata
 *      o alarme falso de rajada);
 *   2. controle positivo: corpo COM audio_url passa pela guarda e segue o
 *      caminho normal (1 insert, 1 débito, resposta ok) — prova que a
 *      guarda não bloqueia pedido válido E que os fakes estão ligados de
 *      verdade (sem este caso, o teste 1 passaria até com a rota quebrada
 *      inteira).
 *
 * Se alguém remover a guarda, o teste 1 REPROVA: o corpo sem áudio volta a
 * inserir + debitar antes do badRequest (o fluxo antigo devolve a MESMA
 * mensagem, então a asserção decisiva é a de efeitos, não a do texto).
 *
 * Rodar (o route.ts importa via alias "@/", daí o loader; o mock de módulo
 * pede a 1ª flag; e um import transitivo da rota usa parameter property de
 * constructor, que o strip-only não engole — daí a 2ª):
 *   cd frontend && node --import ./test/alias-loader.mjs \
 *        --experimental-test-module-mocks --experimental-transform-types \
 *        --test src/lib/react/guarda-audio.test.ts
 *
 * Sem as flags os casos são PULADOS com o motivo no nome (mesmo padrão do
 * video-sync.test.ts) — confira o rodapé: # skipped > 0 aqui significa que
 * este arquivo não provou nada.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const ALUNO = "u0000000-0000-4000-8000-000000000001";
const VIRAL = "v0000000-0000-4000-8000-000000000002";
const JOB_ID = "j0000000-0000-4000-8000-000000000003";

type Debito = { userId: string; amount: number; refType: string; refId: string; note?: string };

/** Registro dos EFEITOS — é sobre ele que as asserções falam. */
const reg = {
  inserts: [] as { tabela: string; row: Record<string, unknown> }[],
  debitos: [] as Debito[],
  reivindicacoes: 0,
  falhasTecnicas: 0,
};
function zerar() {
  reg.inserts = [];
  reg.debitos = [];
  reg.reivindicacoes = 0;
  reg.falhasTecnicas = 0;
}

/**
 * Banco de mentira mínimo: encadeável, registra INSERTs, e responde às três
 * consultas que o caminho feliz do POST faz (viral existe, nenhum job em voo,
 * viral já baixado). Um `await` num encadeado de update resolve via `then`.
 */
function adminFake() {
  return {
    from(tabela: string) {
      const api: Record<string, unknown> = {
        select: () => api,
        eq: () => api,
        in: () => api,
        order: () => api,
        limit: () => api,
        update: () => api,
        insert(row: Record<string, unknown>) {
          reg.inserts.push({ tabela, row });
          return api;
        },
        maybeSingle() {
          if (tabela === "viral_videos") {
            return Promise.resolve({
              data: { id: VIRAL, url: "https://exemplo.com/viral.mp4", duracao_seg: 15 },
            });
          }
          // react_jobs (job em voo?) e viral_user_videos: nada ainda —
          // viral_user_videos vazio força o baixarViral fake, também coberto.
          return Promise.resolve({ data: null });
        },
        single: () => Promise.resolve({ data: { id: JOB_ID }, error: null }),
        then(resolve: (r: { data: null; error: null }) => void) {
          resolve({ data: null, error: null });
        },
      };
      return api;
    },
  };
}

type Resposta = { status: number; body: Record<string, unknown> };

let rota: { POST: (req: unknown) => Promise<unknown> } | null = null;
let motivoSkip = "";

try {
  mock.module("@/lib/react/gate", {
    namedExports: {
      gateReact: async () => ({ auth: { user_id: ALUNO, email: "aluno@exemplo.com" } }),
    },
  });
  mock.module("@/lib/react/preco", {
    namedExports: {
      custoDoReact: (_motor: string, segundos: number) => 300 + segundos * 105,
      semSaldo: () => "sem saldo",
    },
  });
  mock.module("@/lib/react/estorno", {
    namedExports: {
      REACT_DEBIT_REF_TYPE: "react_job",
      REACT_REFUND_REF_TYPE: "react_refund",
      reivindicarFalhaDoReact: async () => {
        reg.reivindicacoes += 1;
        return true;
      },
    },
  });
  mock.module("@/lib/support/failure-alert", {
    namedExports: {
      handleTechFailure: async () => {
        reg.falhasTecnicas += 1;
      },
    },
  });
  mock.module("@/lib/credits/access", { namedExports: { bypassesBilling: () => false } });
  mock.module("@/lib/credits/service", {
    namedExports: {
      getBalance: async () => ({ total: 1_000_000 }),
      debitCredits: async (d: Debito) => {
        reg.debitos.push(d);
        return { ok: true };
      },
    },
  });
  // Respostas viram objetos simples pra asserção não depender do next/server.
  mock.module("@/lib/api/responses", {
    namedExports: {
      badRequest: (message: string): Resposta => ({ status: 400, body: { message } }),
      jsonError: (code: string, message: string, status = 400): Resposta => ({
        status,
        body: { code, message },
      }),
      jsonOk: (data: Record<string, unknown>, status = 200): Resposta => ({ status, body: data }),
      serverError: (message: string): Resposta => ({ status: 500, body: { message } }),
    },
  });
  mock.module("@/lib/db/admin", { namedExports: { getAdmin: () => adminFake() } });
  mock.module("@/lib/r2/client", { namedExports: { R2_BUCKETS: { generations: "gen" } } });
  mock.module("@/lib/r2/delete", { namedExports: { deleteByPrefix: async () => {} } });
  mock.module("@/lib/r2/presigned", {
    namedExports: { createPresignedGet: async () => "https://exemplo.com/presigned" },
  });
  mock.module("@/lib/virais/download", {
    namedExports: {
      baixarViral: async () => ({ r2Key: "viral/baixado.mp4" }),
      marcarDownload: async () => {},
    },
  });
  mock.module("@/lib/virais/pessoal", { namedExports: { marcarUsado: async () => {} } });
  mock.module("@/lib/react/gerar", {
    namedExports: {
      dispararClone: async () => "clone-job-1",
      dispararCloneHeygen: async () => "heygen-job-1",
      ehJobHeygen: () => false,
      estadoCloneHeygen: async () => ({ status: "COMPLETED" }),
      duracaoDeUrl: async () => 10,
      estadoClone: async () => ({ status: "COMPLETED" }),
      cloneJaNoR2: async () => false,
      montarEEnviar: async () => "final.mp4",
      trazerParaR2: async (_url: string, key: string) => key,
    },
  });
  mock.module("@/lib/video/subtitle-presets", {
    namedExports: {
      SUBTITLE_PRESET_IDS: ["none"],
      SUBTITLE_POSITIONS: ["bottom"],
      SUBTITLE_SIZES: ["md"],
    },
  });
  rota = (await import("../../app/api/v1/react/gerar/route.ts")) as unknown as {
    POST: (req: unknown) => Promise<unknown>;
  };
} catch (e) {
  motivoSkip = `precisa de --import ./test/alias-loader.mjs --experimental-test-module-mocks (${e instanceof Error ? e.message : e})`;
}

const pular = motivoSkip ? { skip: motivoSkip } : {};

/** Corpo válido em tudo, menos no que o caso quiser tirar. */
function corpo(extra: Record<string, unknown> = {}) {
  return {
    viral_id: VIRAL,
    layout: "recorte",
    roteiro: "um roteiro com bem mais de vinte caracteres pra passar na régua",
    foto_url: "https://exemplo.com/foto.png",
    audio_url: "https://exemplo.com/fala.mp3",
    ...extra,
  };
}

function requisicao(body: Record<string, unknown>) {
  return { json: async () => body };
}

test("SEM audio_url → 400 antes de qualquer gasto: zero insert, zero débito, zero contingência", pular, async () => {
  zerar();
  const res = (await rota!.POST(requisicao(corpo({ audio_url: undefined })))) as Resposta;

  assert.equal(res.status, 400);
  assert.equal(
    res.body.message,
    "Gere o áudio antes (passo da voz).",
    "a mensagem tem que ser a MESMA do caminho tardio — a tela do aluno não muda de texto",
  );
  // As asserções que pegam a regressão: o fluxo antigo devolvia esse MESMO
  // texto, só que depois de inserir, debitar e estornar.
  assert.equal(reg.inserts.length, 0, "job criado sem áudio = o defeito #544 de volta");
  assert.equal(reg.debitos.length, 0, "débito por job que já nasce morto");
  assert.equal(reg.reivindicacoes, 0, "não pode nem chegar no claim de falha");
  assert.equal(reg.falhasTecnicas, 0, "alarme falso de rajada era exatamente isto");
});

test("controle positivo: COM audio_url a guarda deixa passar (1 insert, 1 débito, resposta ok)", pular, async () => {
  zerar();
  const res = (await rota!.POST(requisicao(corpo()))) as Resposta;

  assert.equal(res.status, 200, `esperava ok, veio ${JSON.stringify(res.body)}`);
  assert.equal(res.body.job_id, JOB_ID);
  assert.equal(res.body.status, "clonando");
  const jobs = reg.inserts.filter((i) => i.tabela === "react_jobs");
  assert.equal(jobs.length, 1, "o caminho feliz tem que continuar criando o job");
  assert.equal(jobs[0].row.audio_url, "https://exemplo.com/fala.mp3");
  assert.equal(reg.debitos.length, 1, "e cobrando — a guarda não pode barrar pedido válido");
  // 10s medidos + 0,35 de folga → 11s → 300 + 11×105.
  assert.equal(reg.debitos[0].amount, 300 + 11 * 105, "preço pelo áudio MEDIDO, não estimado");
  assert.equal(reg.debitos[0].refId, JOB_ID);
  assert.equal(reg.reivindicacoes, 0);
  assert.equal(reg.falhasTecnicas, 0);
});
