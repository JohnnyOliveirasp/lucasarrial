/**
 * Testes do Vídeo Clone por conta da casa. Sem banco, sem R2, sem GPU:
 *
 *   node --test _frank/ferramentas/video_clone_conta_da_casa.test.cjs
 *
 * O teste central deste arquivo é o LEDGER: `executar()` roda inteiro contra
 * deps falsas que anotam TODA tabela e TODA coluna tocada, e o caso falha se
 * qualquer uma for de crédito. É a única forma honesta de afirmar "não cobra":
 * ler o código e jurar que não cobra é exatamente como os incidentes de
 * crédito deste repo começaram.
 *
 * Os demais casos são armadilhas REAIS — ou já morderam alguém, ou morderiam
 * caladas.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const M = require("./video_clone_conta_da_casa.cjs");

const RAIZ = path.resolve(__dirname, "..", "..");
const CONFIG_TS = path.join(RAIZ, "frontend", "src", "lib", "video-clone", "config.ts");
const WORKFLOW_TS = path.join(RAIZ, "frontend", "src", "lib", "video-clone", "workflow.ts");
const ROUTE_TS = path.join(RAIZ, "frontend", "src", "app", "api", "v1", "video-clone", "route.ts");

/* ══════════════════ 1. REGRA 1 — não toca em crédito ═══════════════════════ */

/** Deps falsas com LEDGER. Tudo que encosta em banco/R2/rede fica anotado. */
function depsFalsas({ statusJob = "COMPLETED", mp4Existe = true, tempoMs = 0 } = {}) {
  const ledger = { leituras: [], escritas: [], r2: [], runpod: [] };
  let relogio = 0;
  return {
    ledger,
    buckets: { generations: "gen-bucket", imagens: "img-bucket", worker: "worker-bucket" },
    uuid: () => "11111111-2222-3333-4444-555555555555",
    agora: () => (relogio += tempoMs),
    hojeISO: () => "2026-09-13T10:00:00.000Z",
    dormir: async () => {},
    log: () => {},
    db: {
      async umaLinha(tabela, colunas) {
        ledger.leituras.push({ tabela, colunas });
        if (tabela === "profiles") {
          return { id: "user-1", email: "aluno@exemplo.com", display_name: "Aluno", access_until: "2026-09-15T12:00:00+00:00" };
        }
        if (tabela === "generations") {
          return { id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", user_id: "user-1", status: "ready", audio_path: "user-1/audio.mp3", duration_seconds: 70.6, name: "Conta da casa — teste" };
        }
        return null;
      },
      async inserir(tabela, linha) {
        ledger.escritas.push({ tabela, linha });
      },
    },
    r2: {
      async head(bucket, key) {
        ledger.r2.push({ op: "head", bucket, key });
        if (key.endsWith(".mp4")) return mp4Existe ? { ContentLength: 4_000_000 } : null;
        return { ContentLength: 1234 };
      },
      async baixar(bucket, key) {
        ledger.r2.push({ op: "get", bucket, key });
        return Buffer.from("imagem-falsa");
      },
      async subir(bucket, key) {
        ledger.r2.push({ op: "put", bucket, key });
      },
      async urlGet(bucket, key) {
        ledger.r2.push({ op: "sign", bucket, key });
        return `https://exemplo/${bucket}/${key}`;
      },
    },
    arquivo: { ler: async () => Buffer.from("local"), escrever: async () => {} },
    imagem: {
      medir: async () => ({ width: 941, height: 1672, format: "png" }),
      recortar: async () => Buffer.from("recortado"),
      previa: async () => Buffer.from("previa"),
      lado_a_lado: async () => Buffer.from("comparativo"),
    },
    medirDuracao: async () => 70.6,
    runpod: {
      async disparar(workflow, timeoutMs) {
        ledger.runpod.push({ op: "run", timeoutMs, temWebhook: "webhook" in M.corpoDoJob(workflow, timeoutMs) });
        return "job-xyz";
      },
      async status() {
        return { status: statusJob, rawError: statusJob === "COMPLETED" ? null : "boom", bruto: {}, executionTimeMs: 1000, delayTimeMs: 10 };
      },
      async cancelar() {
        ledger.runpod.push({ op: "cancel" });
        return true;
      },
    },
  };
}

const ARGS_BASE = {
  aluno: "aluno@exemplo.com",
  imagem: "user-1/images/abc/result.png",
  audio: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  tierId: "480p-v3",
  rotulo: "#369",
  rosto: { x0: 270, y0: 245, x1: 600, y1: 690 },
  fracaoAlvo: 1 / 3,
  headroom: 0.165,
  recorte: null,
  minutos: 90,
  duracao: null,
};

test("REGRA 1: o caminho FELIZ inteiro não toca em NENHUMA tabela de crédito", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, ARGS_BASE);
  const r = await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  assert.equal(r.ok, true, "o caminho feliz tem que entregar");

  const tabelas = [...deps.ledger.leituras.map((x) => x.tabela), ...deps.ledger.escritas.map((x) => x.tabela)];
  for (const t of tabelas) {
    assert.ok(
      !M.TABELAS_DE_CREDITO.includes(t),
      `tabela de crédito TOCADA: ${t}. Este script não pode nem LER crédito.`,
    );
    assert.ok(!/credit|entitle|subscri|ledger/i.test(t), `tabela suspeita de crédito tocada: ${t}`);
  }
  // Tabelas realmente usadas — se esta lista crescer, é decisão consciente.
  assert.deepEqual([...new Set(tabelas)].sort(), ["generations", "profiles", "video_clones"]);
});

test("REGRA 1: nenhuma COLUNA de crédito é sequer selecionada (profiles tem credits_*)", async () => {
  const deps = depsFalsas();
  await M.planejar(deps, ARGS_BASE);
  for (const { tabela, colunas } of deps.ledger.leituras) {
    assert.ok(
      !/credit/i.test(colunas),
      `select em ${tabela} pede coluna de crédito: "${colunas}". Regra 1 proíbe até ler saldo.`,
    );
  }
  const profiles = deps.ledger.leituras.find((x) => x.tabela === "profiles");
  assert.ok(profiles, "profiles tem que ser lido (é onde mora o e-mail do aluno)");
});

test("REGRA 1: a ÚNICA escrita no banco é um insert em video_clones", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, ARGS_BASE);
  await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  assert.equal(deps.ledger.escritas.length, 1);
  assert.equal(deps.ledger.escritas[0].tabela, "video_clones");
});

test("REGRA 1: a linha nasce com credits_cost = 0", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, ARGS_BASE);
  await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  assert.equal(deps.ledger.escritas[0].linha.credits_cost, 0);
});

/* ══════════════════ 2. REGRA 2 — nunca passar webhook ══════════════════════ */

test("REGRA 2: o corpo do job NÃO tem webhook", () => {
  const corpo = M.corpoDoJob({ "1": {} }, 123);
  assert.ok(!("webhook" in corpo), "webhook no corpo dispara finalizeVideoClone/handleTechFailure");
  assert.deepEqual(Object.keys(corpo).sort(), ["input", "policy"]);
  assert.equal(corpo.policy.executionTimeout, 123);
});

test("REGRA 2: a rota de produção PASSA webhook — é a diferença deliberada", () => {
  const src = fs.readFileSync(ROUTE_TS, "utf8");
  assert.ok(
    /webhook:\s*webhookUrlFor\("generation"\)/.test(src),
    "se a rota parou de passar webhook, o motivo desta ferramenta mudou — revisar a regra 2",
  );
});

/* ══════════════════ 3. REGRA 3 — linha só depois do MP4 ════════════════════ */

test("REGRA 3: job FALHOU => nenhuma linha criada", async () => {
  const deps = depsFalsas({ statusJob: "FAILED" });
  const plano = await M.planejar(deps, ARGS_BASE);
  const r = await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "job_falhou");
  assert.equal(deps.ledger.escritas.length, 0, "linha órfã de job falho é exatamente o que não pode existir");
});

test("REGRA 5: COMPLETED mas SEM MP4 no R2 => nenhuma linha criada", async () => {
  const deps = depsFalsas({ statusJob: "COMPLETED", mp4Existe: false });
  const plano = await M.planejar(deps, ARGS_BASE);
  const r = await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "sem_arquivo");
  assert.equal(deps.ledger.escritas.length, 0, "'status=ready + video_path' não pode voltar a mentir");
});

test("REGRA 3: a linha nasce 'ready' (nunca pending) — pending trancaria o aluno e acordaria o sweeper", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, ARGS_BASE);
  await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  const linha = deps.ledger.escritas[0].linha;
  assert.equal(linha.status, "ready");
  assert.ok(linha.video_path.endsWith("/result.mp4"));
  assert.ok(linha.name.startsWith("Conta da casa — "), "prefixo é contrato com o detector do #125");
});

test("o sweeper só varre pending/generating — é o que torna a linha 'ready' invisível pra ele", () => {
  const src = fs.readFileSync(
    path.join(RAIZ, "frontend", "src", "app", "api", "v1", "agent", "sweep-clones", "route.ts"),
    "utf8",
  );
  assert.ok(
    /\.in\("status",\s*\["pending",\s*"generating"\]\)/.test(src),
    "se o sweeper passar a varrer outros status, a regra 3 precisa ser reavaliada",
  );
});

test("a trava clone_in_progress olha pending/generating — por isso não criamos linha in-flight", () => {
  const src = fs.readFileSync(ROUTE_TS, "utf8");
  assert.ok(/clone_in_progress/.test(src));
  assert.ok(/\.in\("status",\s*\["pending",\s*"generating"\]\)/.test(src));
});

/* ══════════════════ 4. REGRA 4 — prazo próprio, sem laço infinito ══════════ */

test("REGRA 4: estourado o NOSSO prazo, o job é CANCELADO e nada é gravado", async () => {
  // tempoMs alto faz o relógio falso passar do prazo já na 1ª volta.
  const deps = depsFalsas({ statusJob: "IN_PROGRESS", tempoMs: 60 * 60 * 1000 });
  const plano = await M.planejar(deps, ARGS_BASE);
  const r = await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "sem_resposta");
  assert.equal(r.cancelado, true, "GPU não pode ficar rodando depois que desistimos");
  assert.equal(deps.ledger.escritas.length, 0);
});

test("REGRA 4: o teto do RunPod é o da produção (55,5min pra 70,6s no Padrão 2.0)", () => {
  const tier = M.TIERS["480p-v3"];
  assert.equal(M.tetoDeExecucaoMs(tier, 70.6), (20 * 60 + 71 * 30) * 1000);
  assert.equal(M.tetoDeExecucaoMs(tier, 70.6) / 60000, 55.5);
});

/* ══════════════════ 5. num_frames DERIVADO, não chutado ═══════════════════ */

test("num_frames bate EXATO com a linha real 480p-v3 do aluno do #369 (24,73s -> 625)", () => {
  assert.equal(M.numeroDeFrames("v3", 24.73), 625);
});

test("num_frames v2 dá 1252 pra 49,08s — e a linha real tem 1253: a diferença é ARREDONDAMENTO, não fórmula", () => {
  // duration_seconds é gravado com Math.round(d*100)/100, mas o workflow é
  // montado com a duração CRUA; ceil() amplia a casa decimal perdida. Se a
  // duração crua fosse 49,081 o resultado seria 1253 — como na linha real.
  assert.equal(M.numeroDeFrames("v2", 49.08), 1252);
  assert.equal(M.numeroDeFrames("v2", 49.081), 1253);
  // No v3 isso não acontece: floor() engole a diferença.
  assert.equal(M.numeroDeFrames("v3", 24.73), M.numeroDeFrames("v3", 24.739));
});

test("num_frames do caso #369: 70,6s no Padrão 2.0 = 1775", () => {
  assert.equal(M.numeroDeFrames("v3", 70.6), 1775);
});

test("as fórmulas são as MESMAS de workflow.ts (se lá mudar, isto falha)", () => {
  const src = fs.readFileSync(WORKFLOW_TS, "utf8");
  assert.ok(
    /Math\.floor\(args\.durationSeconds\)\s*\*\s*CLONE_FPS\s*\+\s*CLONE_FPS/.test(src),
    "fórmula v3 mudou em workflow.ts",
  );
  assert.ok(
    /Math\.max\(50,\s*Math\.ceil\(args\.durationSeconds\s*\*\s*CLONE_FPS\)\s*\+\s*25\)/.test(src),
    "fórmula v2 mudou em workflow.ts",
  );
});

/* ══════════════════ 6. espelho do config.ts ═══════════════════════════════ */

test("TIERS espelha config.ts (preço e resolução)", () => {
  const src = fs.readFileSync(CONFIG_TS, "utf8");
  for (const t of Object.values(M.TIERS)) {
    const bloco = src.slice(src.indexOf(`id: "${t.id}"`));
    const preco = Number(/creditsPerSecond:\s*(\d+)/.exec(bloco)[1]);
    const w = Number(/width:\s*(\d+)/.exec(bloco)[1]);
    const h = Number(/height:\s*(\d+)/.exec(bloco)[1]);
    assert.equal(preco, t.creditsPerSecond, `creditsPerSecond do ${t.id} divergiu`);
    assert.equal(w, t.width, `width do ${t.id} divergiu`);
    assert.equal(h, t.height, `height do ${t.id} divergiu`);
  }
  assert.equal(Number(/CLONE_FPS = (\d+)/.exec(src)[1]), M.CLONE_FPS);
  assert.equal(Number(/CLONE_MAX_AUDIO_SECONDS = (\d+)/.exec(src)[1]), M.CLONE_MAX_AUDIO_SECONDS);
  assert.equal(Number(/CLONE_MIN_BILLED_SECONDS = (\d+)/.exec(src)[1]), M.CLONE_MIN_BILLED_SECONDS);
});

test("custo do caso #369 = 7.455 cr (calculado pra IMPRIMIR, nunca debitado)", () => {
  assert.equal(M.custoQueNaoSeraCobrado(M.TIERS["480p-v3"], 70.6), 7455);
});

/* ══════════════════ 7. o recorte ══════════════════════════════════════════ */

const IMG = { width: 941, height: 1672 };
const ROSTO = { x0: 270, y0: 245, x1: 600, y1: 690 }; // lido na imagem real do #369
const ASPECTO = 480 / 832;

test("o recorte sai na proporção do tier (senão o nó 171 corta de novo, por cima)", () => {
  const c = M.enquadrarCabecaEOmbros({ imagem: IMG, rosto: ROSTO, aspecto: ASPECTO });
  assert.ok(Math.abs(c.width / c.height - ASPECTO) < 0.001, `proporção ${c.width / c.height} != ${ASPECTO}`);
});

test("o rosto fica na fração pedida da altura", () => {
  const c = M.enquadrarCabecaEOmbros({ imagem: IMG, rosto: ROSTO, aspecto: ASPECTO, fracaoAlvo: 1 / 3 });
  assert.ok(Math.abs(c.fracaoReal - 1 / 3) < 0.005, `fração real ${c.fracaoReal}`);
});

test("o recorte do #369 cabe na imagem e é o que eu conferi de olho", () => {
  const c = M.enquadrarCabecaEOmbros({ imagem: IMG, rosto: ROSTO, aspecto: ASPECTO, fracaoAlvo: 1 / 3, headroom: 0.165 });
  assert.deepEqual(
    { left: c.left, top: c.top, width: c.width, height: c.height },
    { left: 50, top: 25, width: 770, height: 1335 },
  );
  // Fecha em 1360, logo ACIMA das mãos (que começam por volta de y=1380 na
  // foto original): cortar mãos ao meio foi o que reprovou os outros
  // candidatos que eu renderizei e olhei antes de escolher este.
  assert.equal(c.top + c.height, 1360);
  assert.ok(c.left + c.width <= IMG.width);
  assert.ok(c.top + c.height <= IMG.height);
  assert.deepEqual(c.limites, [], "este recorte não devia bater em borda nenhuma");
});

test("recorte maior que a imagem ENCOLHE mantendo a proporção, e AVISA", () => {
  // rosto minúsculo => o alvo pediria um quadro maior que a foto.
  const c = M.enquadrarCabecaEOmbros({
    imagem: IMG,
    rosto: { x0: 400, y0: 800, x1: 460, y1: 860 },
    aspecto: ASPECTO,
    fracaoAlvo: 1 / 3,
  });
  assert.ok(c.width <= IMG.width && c.height <= IMG.height, "nunca pode pedir pixel que não existe");
  assert.ok(Math.abs(c.width / c.height - ASPECTO) < 0.001, "encolher não pode entortar a proporção");
});

test("quando o recorte bate na borda, o desvio é REPORTADO (quadro torto silencioso é o defeito)", () => {
  const c = M.enquadrarCabecaEOmbros({
    imagem: IMG,
    rosto: { x0: 0, y0: 0, x1: 200, y1: 300 }, // rosto colado no canto
    aspecto: ASPECTO,
    fracaoAlvo: 1 / 3,
    headroom: 0.2,
  });
  assert.ok(c.limites.length > 0, "bateu na borda e não avisou");
  assert.ok(c.left >= 0 && c.top >= 0);
});

test("--recorte fora da imagem ABORTA em vez de ser 'consertado' em silêncio", () => {
  assert.throws(
    () => M.conferirRecorteExplicito({ left: 800, top: 0, width: 400, height: 693 }, IMG),
    /sai da imagem/,
  );
});

test("--recorte válido passa intacto", () => {
  const c = { left: 50, top: 25, width: 771, height: 1336 };
  assert.deepEqual(M.conferirRecorteExplicito(c, IMG), c);
});

test("parâmetros absurdos de enquadramento são recusados", () => {
  assert.throws(() => M.enquadrarCabecaEOmbros({ imagem: IMG, rosto: ROSTO, aspecto: ASPECTO, fracaoAlvo: 0 }), /rosto-fracao/);
  assert.throws(() => M.enquadrarCabecaEOmbros({ imagem: IMG, rosto: ROSTO, aspecto: ASPECTO, headroom: 1 }), /headroom/);
  assert.throws(() => M.enquadrarCabecaEOmbros({ imagem: IMG, rosto: { x0: 5, y0: 5, x1: 1, y1: 1 }, aspecto: ASPECTO }), /caixa de rosto/);
});

/* ══════════════════ 8. argumentos ═════════════════════════════════════════ */

test("sem --confirmar o padrão é ENSAIO", () => {
  const a = M.interpretarArgumentos(["--aluno", "x@y.com", "--imagem", "k", "--audio", "k2"]);
  assert.equal(a.confirmar, false);
});

test("--rosto e --recorte juntos são recusados (duas formas de dizer a mesma coisa)", () => {
  assert.throws(
    () => M.interpretarArgumentos(["--aluno", "x@y.com", "--imagem", "k", "--audio", "k2", "--rosto", "1,2,3,4", "--recorte", "1,2,3,4"]),
    /Escolha uma/,
  );
});

test("argumento desconhecido estoura em vez de ser ignorado", () => {
  assert.throws(() => M.interpretarArgumentos(["--aluno", "x@y.com", "--imagem", "k", "--audio", "k2", "--confirma"]), /desconhecido/);
});

test("flag com valor faltando não engole a flag seguinte", () => {
  assert.throws(() => M.interpretarArgumentos(["--aluno", "--imagem", "k"]), /--aluno exige um valor/);
});

test("--rosto com 3 números é recusado", () => {
  assert.throws(() => M.interpretarArgumentos(["--aluno", "a", "--imagem", "k", "--audio", "k2", "--rosto", "1,2,3"]), /4 números/);
});

test("--tier inválido é recusado antes de qualquer I/O", () => {
  assert.throws(() => M.interpretarArgumentos(["--aluno", "a", "--imagem", "k", "--audio", "k2", "--tier", "720p"]), /tier inválido/);
});

test("faltando --aluno/--imagem/--audio, estoura com a mensagem do que falta", () => {
  assert.throws(() => M.interpretarArgumentos([]), /--aluno/);
  assert.throws(() => M.interpretarArgumentos(["--aluno", "a"]), /--imagem/);
  assert.throws(() => M.interpretarArgumentos(["--aluno", "a", "--imagem", "k"]), /--audio/);
});

/* ══════════════════ 9. segurança do alvo ══════════════════════════════════ */

test("áudio de OUTRO aluno é recusado (nunca gerar a voz de um na conta de outro)", async () => {
  const deps = depsFalsas();
  deps.db.umaLinha = async (tabela, colunas) => {
    deps.ledger.leituras.push({ tabela, colunas });
    if (tabela === "profiles") return { id: "user-1", email: "a@b.com", display_name: "A", access_until: null };
    return { id: "g1", user_id: "OUTRO-USER", status: "ready", audio_path: "p", duration_seconds: 10 };
  };
  await assert.rejects(() => M.planejar(deps, ARGS_BASE), /é de OUTRO usuário/);
});

test("áudio acima do teto do produto (90s) é recusado", async () => {
  const deps = depsFalsas();
  deps.db.umaLinha = async (tabela) => {
    if (tabela === "profiles") return { id: "user-1", email: "a@b.com", display_name: "A", access_until: null };
    return { id: "g1", user_id: "user-1", status: "ready", audio_path: "p", duration_seconds: 120 };
  };
  await assert.rejects(() => M.planejar(deps, ARGS_BASE), /teto do produto/);
});

test("a imagem recortada vai pra chave _casa/ — NUNCA sobrescreve a do aluno", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, ARGS_BASE);
  assert.ok(plano.imagemFinalChave.startsWith("_casa/"));
  assert.notEqual(plano.imagemFinalChave, ARGS_BASE.imagem);
  await M.executar(deps, plano, { bytesRecortados: Buffer.from("x") });
  const puts = deps.ledger.r2.filter((x) => x.op === "put");
  assert.equal(puts.length, 1);
  assert.ok(puts[0].key.startsWith("_casa/"), "put fora de _casa/ pode pisar em arquivo do aluno");
});

test("sem recorte, a imagem do aluno é usada como está (nenhum put no R2)", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, { ...ARGS_BASE, rosto: null });
  assert.equal(plano.recorte, null);
  assert.equal(plano.imagemFinalChave, ARGS_BASE.imagem);
  await M.executar(deps, plano, { bytesRecortados: null });
  assert.equal(deps.ledger.r2.filter((x) => x.op === "put").length, 0);
});

test("o s3Key segue a convenção da rota (é o que faz o histórico do aluno achar o MP4)", async () => {
  const deps = depsFalsas();
  const plano = await M.planejar(deps, ARGS_BASE);
  assert.equal(plano.s3Key, `user-1/video-clone/${plano.cloneId}/result.mp4`);
  const src = fs.readFileSync(ROUTE_TS, "utf8");
  assert.ok(
    /const s3Key = `\$\{auth\.user_id\}\/video-clone\/\$\{created\.id\}\/result\.mp4`/.test(src),
    "a convenção do s3Key mudou na rota — o histórico deixaria de achar o MP4",
  );
});

test("bucketDaImagem espelha a regra do GET da rota", () => {
  const b = { generations: "G", imagens: "I" };
  assert.equal(M.bucketDaImagem("u/video-clone/uploads/x.png", b), "G");
  assert.equal(M.bucketDaImagem("u/images/abc/result.png", b), "I");
  assert.equal(M.bucketDaImagem("_casa/video-clone-conta-da-casa/x/imagem.png", b), "I");
  const src = fs.readFileSync(ROUTE_TS, "utf8");
  assert.ok(/includes\("\/video-clone\/uploads\/"\)\s*\?\s*R2_BUCKETS\.generations\s*:\s*imagesBucket\(\)/.test(src));
});

/* ══════════════════ 10. o workflow montado ════════════════════════════════ */

test("o workflow v3 recebe imagem, áudio, s3_key e num_frames nos nós certos", () => {
  const { workflow, numFrames } = M.montarWorkflow({
    imageUrl: "https://img",
    audioUrl: "https://aud",
    s3Key: "chave.mp4",
    tier: M.TIERS["480p-v3"],
    duracaoSegundos: 70.6,
    seed: 1,
  });
  assert.equal(workflow["133"].inputs.url, "https://img");
  assert.equal(workflow["125"].inputs.url, "https://aud");
  assert.equal(workflow["900"].inputs.s3_key, "chave.mp4");
  assert.equal(workflow["194"].inputs.num_frames, 1775);
  assert.equal(numFrames, 1775);
  assert.equal(workflow["194"].inputs.fps, 25, "o FPS do fluxo é 25 fixo — os '25,5 fps' do relatório eram artefato da fórmula");
});

test("montar o workflow NÃO altera o template em disco (require devolve o mesmo objeto)", () => {
  const a = M.montarWorkflow({ imageUrl: "A", audioUrl: "a", s3Key: "s", tier: M.TIERS["480p-v3"], duracaoSegundos: 10, seed: 1 });
  const b = M.montarWorkflow({ imageUrl: "B", audioUrl: "b", s3Key: "t", tier: M.TIERS["480p-v3"], duracaoSegundos: 10, seed: 1 });
  assert.equal(a.workflow["133"].inputs.url, "A", "o 1º workflow foi contaminado pelo 2º — faltou clonar o template");
  assert.equal(b.workflow["133"].inputs.url, "B");
});

test("o nó 171 do template v3 corta pra 480x832 — é por isso que o recorte sai na proporção do tier", () => {
  const tpl = require(path.join(RAIZ, "frontend", "src", "lib", "video-clone", "infinitetalk-v3-template.json"));
  assert.equal(tpl["171"].inputs.keep_proportion, "crop");
  assert.equal(tpl["171"].inputs.width, 480);
  assert.equal(tpl["171"].inputs.height, 832);
});

/* ══════════════════ 11. nome da linha ═════════════════════════════════════ */

test("nomeDaLinha mantém o prefixo do #125 e carimba a data", () => {
  assert.equal(M.nomeDaLinha("#369 teste prometido", "2026-09-13T10:00:00Z"), "Conta da casa — 2026-09-13 — #369 teste prometido");
  assert.equal(M.nomeDaLinha(null, "2026-09-13T10:00:00Z"), "Conta da casa — 2026-09-13");
});
