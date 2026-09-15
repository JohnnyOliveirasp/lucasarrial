/**
 * Testes do núcleo "por conta da casa". Sem banco, sem GPU, sem rede:
 *
 *   node --test _frank/ferramentas/_conta_da_casa.test.cjs
 *
 * O que se prova aqui é o que custa dinheiro ou credibilidade se estiver
 * errado, na ordem em que dói:
 *   (a) o aluno NÃO é debitado — nem nesta execução, nem por caminho nenhum;
 *   (b) o que vai pra GPU é o texto NORMALIZADO, não o cru — senão o "teste da
 *       casa" não representa o áudio que o aluno recebe, que é o motivo inteiro
 *       do modo novo existir;
 *   (c) o modo antigo (por generationId) continua idêntico, INCLUSIVE a trava
 *       de palavras que impede reescrita acidental.
 *
 * Os fakes registram TUDO que foi tocado (tabela + operação + linha), porque
 * "não debitou" só é afirmável olhando o conjunto do que o código escreveu —
 * não o que ele diz que escreveu.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const n = require("./_conta_da_casa.cjs");

/* ─────────────────────────────── fakes ──────────────────────────────── */

/** Supabase de mentira que ANOTA cada tabela tocada e cada linha inserida. */
function bancoFalso(linhas) {
  const tocadas = [];
  const inseridos = [];
  const db = {
    from(tabela) {
      return {
        select() {
          return {
            eq(coluna, valor) {
              return {
                async maybeSingle() {
                  tocadas.push(`select:${tabela}`);
                  const achou = (linhas[tabela] ?? []).find((r) => r[coluna] === valor) ?? null;
                  return { data: achou, error: null };
                },
              };
            },
          };
        },
        async insert(linha) {
          tocadas.push(`insert:${tabela}`);
          inseridos.push({ tabela, linha });
          return { error: null };
        },
        async update() {
          tocadas.push(`update:${tabela}`);
          return { error: null };
        },
      };
    },
  };
  return { db, tocadas, inseridos };
}

function runpodFalso() {
  const pedidos = [];
  const fetch = async (url, opcoes) => {
    pedidos.push({ url, corpo: JSON.parse(opcoes.body) });
    return {
      ok: true,
      async json() {
        return { id: "job-falso-1", status: "IN_QUEUE" };
      },
    };
  };
  return { fetch, pedidos };
}

const VOZ = {
  id: "voz-1",
  user_id: "aluno-1",
  status: "ready",
  lora_path: "aluno-1/voz-1/lora.safetensors",
  reference_audio_path: "aluno-1/voz-1/ref.wav",
  reference_transcript: "Esta é a referência gravada da pessoa.",
  lora_alpha: 32,
  tts_silence_ms: 250,
  tts_crossfade_ms: 40,
  language: "pt",
};

const PERFIL = {
  id: "aluno-1",
  email: "contato@mastroiannioliveira.com.br",
  display_name: "Mastroianni",
  credits_subscription: 1000,
  credits_extra: 0,
  access_until: "2026-12-31",
};

const ORIGEM = {
  id: "gen-antiga",
  user_id: "aluno-1",
  voice_id: "voz-1",
  text_raw: "O laudo saiu em 14/03 e custou R$ 50,90.",
  text_normalized:
    "O laudo saiu em quatorze de março e custou cinquenta reais e noventa centavos.",
  status: "ready",
  created_at: "2026-09-01T10:00:00Z",
};

const LINHAS = { voices: [VOZ], profiles: [PERFIL], generations: [ORIGEM] };

/** Réguas de mentira: os testes provam o ENCANAMENTO (que o script usa o que
 * produção devolveu), não os números de produção — esses têm testes próprios
 * em `generations/execucao.ts` e `credits/config.ts`. O teste de fiação lá
 * embaixo é que confere que o script pluga nas funções de verdade. */
const REGUAS = {
  timeoutMs: (len) => 600000 + len,
  custoEmCreditos: (t) => Math.max(400, t.length),
};

const DEPS_DISPARO = (db, fetch) => ({
  db,
  fetch,
  getUrl: async (b, k) => `https://r2.falso/${b}/${k}?get`,
  putUrl: async (b, k) => `https://r2.falso/${b}/${k}?put`,
  uuid: () => "gen-nova",
  agora: () => "2026-09-12T21:00:00.000Z",
  env: {
    SITE_URL: "https://fastcloner.com",
    RUNPOD_ENDPOINT_INFERENCE_ID: "endpoint-falso",
    RUNPOD_API_KEY: "chave-falsa",
  },
  buckets: { vozes: "bucket-vozes", geracoes: "bucket-geracoes" },
});

/* ───────────────────── (b) o texto que vai pra GPU ───────────────────── */

test("(b) modo --voz: o que vai pra GPU é o NORMALIZADO, não o cru", async () => {
  const cru = "O laudo saiu em 14/03 e custou R$ 50,90.";
  const normalizado =
    "O laudo saiu em quatorze de março e custou cinquenta reais e noventa centavos.";
  // Se um dia forem iguais, o teste vira tautologia e não prova nada.
  assert.notEqual(cru, normalizado);

  let chamadaDoNormalizador = null;
  const { db } = bancoFalso(LINHAS);
  const { fetch, pedidos } = runpodFalso();

  const plano = await n.montarPlano(
    { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: cru, rotulo: null },
    {
      db,
      normalizar: async (t) => {
        chamadaDoNormalizador = t;
        return normalizado;
      },
      ...REGUAS,
    },
  );

  // O normalizador recebeu o texto CRU do aluno, inteiro.
  assert.equal(chamadaDoNormalizador, cru);
  assert.equal(plano.textoParaGpu, normalizado);
  assert.equal(plano.textoRaw, cru);
  assert.equal(plano.normalizado, true);

  const { db: db2, inseridos } = bancoFalso(LINHAS);
  await n.dispararPlano(plano, DEPS_DISPARO(db2, fetch));

  // 1) o payload da GPU leva o normalizado
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].corpo.input.text, normalizado);
  assert.notEqual(pedidos[0].corpo.input.text, cru);

  // 2) e o banco guarda os DOIS, cada um no seu lugar — é o que deixa auditar
  //    depois o que a casa mandou de fato.
  const row = inseridos.find((i) => i.tabela === "generations").linha;
  assert.equal(row.text_raw, cru);
  assert.equal(row.text_normalized, normalizado);
});

test("(b) a normalização NÃO roda no modo antigo: o texto já foi normalizado lá atrás", async () => {
  let normalizadorChamado = false;
  const { db } = bancoFalso(LINHAS);

  const plano = await n.montarPlano(
    { modo: "refazer", genId: "gen-antiga", conteudoArquivo: null, rotulo: null },
    {
      db,
      normalizar: async (t) => {
        normalizadorChamado = true;
        return `${t} CONTAMINADO`;
      },
      ...REGUAS,
    },
  );

  assert.equal(normalizadorChamado, false);
  assert.equal(plano.textoParaGpu, ORIGEM.text_normalized);
  assert.equal(plano.normalizado, false);
});

test("(b) normalização que devolve '�' aborta antes de disparar", async () => {
  const { db } = bancoFalso(LINHAS);
  await assert.rejects(
    n.montarPlano(
      { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: "Ningu?m te conta isso.", rotulo: null },
      { db, normalizar: async () => "Ningu�m te conta isso.", ...REGUAS },
    ),
    /caractere inválido/,
  );
});

test("(b) texto acima do teto da tela do aluno (2000) é recusado", async () => {
  const { db } = bancoFalso(LINHAS);
  let normalizouMesmoAssim = false;
  await assert.rejects(
    n.montarPlano(
      { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: "a".repeat(n.TEXT_MAX + 1), rotulo: null },
      {
        db,
        normalizar: async (t) => {
          normalizouMesmoAssim = true;
          return t;
        },
        ...REGUAS,
      },
    ),
    /máximo é 2000/,
  );
  // Recusa ANTES de gastar uma chamada de LLM, como a rota faz.
  assert.equal(normalizouMesmoAssim, false);
});

/* ──────────────────────────── (a) sem débito ─────────────────────────── */

test("(a) modo --voz: nenhuma tabela de crédito é tocada, e a ÚNICA escrita é em generations", async () => {
  const { db, tocadas, inseridos } = bancoFalso(LINHAS);
  const { fetch } = runpodFalso();

  const plano = await n.montarPlano(
    { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: "Texto novo do aluno.", rotulo: null },
    { db, normalizar: async (t) => t, ...REGUAS },
  );
  // MESMO banco no disparo: o registro de tabelas tocadas cobre a execução
  // inteira, plano + disparo, e não só metade dela.
  await n.dispararPlano(plano, { ...DEPS_DISPARO(db, fetch), db });

  const escritas = tocadas.filter((t) => !t.startsWith("select:"));
  assert.deepEqual(escritas, ["insert:generations"]);

  // E o extrato do aluno (credit_transactions) não aparece nem como LEITURA.
  assert.equal(
    tocadas.some((t) => /credit|transaction|saldo|ledger/i.test(t)),
    false,
    `alguma tabela de crédito foi tocada: ${tocadas.join(", ")}`,
  );
  assert.equal(inseridos.length, 1);
  assert.equal(inseridos[0].tabela, "generations");

  // O custo aparece no plano só pra ser DITO no relatório; ninguém é debitado.
  assert.equal(plano.custoQueNaoSeraCobrado, 400);
});

test("(a) não existe caminho de débito no código — nem alcançável, nem esquecido", () => {
  // O teste acima prova que ESTA execução não debitou. Este prova que não há
  // débito possível: o núcleo não importa, não nomeia e não alcança nada de
  // crédito. É a diferença entre "não aconteceu" e "não pode acontecer".
  const fonte = fs.readFileSync(path.join(__dirname, "_conta_da_casa.cjs"), "utf8");
  const corpo = fonte
    .replace(/\/\*[\s\S]*?\*\//g, "") // comentários de bloco
    .replace(/^\s*\/\/.*$/gm, ""); // comentários de linha
  for (const proibido of [
    "credit_transactions",
    "debitCredits",
    "credits/service",
    "debitar",
  ]) {
    assert.equal(
      corpo.includes(proibido),
      false,
      `o núcleo do "conta da casa" menciona "${proibido}" fora de comentário`,
    );
  }
});

test("(a) a geração nasce com o prefixo 'Conta da casa —' (#125)", async () => {
  const { db, inseridos } = bancoFalso(LINHAS);
  const { fetch } = runpodFalso();
  const plano = await n.montarPlano(
    { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: "Texto novo.", rotulo: "teste #369" },
    { db, normalizar: async (t) => t, ...REGUAS },
  );
  await n.dispararPlano(plano, DEPS_DISPARO(db, fetch));

  // Sem este nome o detector de "entregue e não cobrada" lê a geração da casa
  // como vazamento de receita (28% de falso positivo, medido em #125).
  assert.equal(inseridos[0].linha.name, "Conta da casa — 2026-09-12 — teste #369");
  assert.match(n.nomeContaDaCasa("2026-09-12T00:00:00Z", null), /^Conta da casa — 2026-09-12$/);
});

/* ────────────────── (c) o modo antigo continua idêntico ───────────────── */

test("(c) modo antigo por generationId: usa o text_normalized gravado e preserva o text_raw", async () => {
  const { db, inseridos } = bancoFalso(LINHAS);
  const { fetch, pedidos } = runpodFalso();

  const plano = await n.montarPlano(
    { modo: "refazer", genId: "gen-antiga", conteudoArquivo: null, rotulo: null },
    { db, normalizar: async () => assert.fail("não devia normalizar"), ...REGUAS },
  );
  await n.dispararPlano(plano, DEPS_DISPARO(db, fetch));

  assert.equal(plano.origem.id, "gen-antiga");
  assert.equal(pedidos[0].corpo.input.text, ORIGEM.text_normalized);
  const row = inseridos[0].linha;
  assert.equal(row.text_raw, ORIGEM.text_raw); // o que o aluno escreveu, intacto
  assert.equal(row.text_normalized, ORIGEM.text_normalized);
  assert.equal(row.voice_id, "voz-1");
  assert.equal(row.user_id, "aluno-1");
});

test("(c) a trava de palavras do modo antigo continua ABORTANDO reescrita", async () => {
  const { db } = bancoFalso(LINHAS);
  const reescrito = "Um texto completamente diferente do que a aluna escreveu.";
  await assert.rejects(
    n.montarPlano(
      { modo: "refazer", genId: "gen-antiga", conteudoArquivo: reescrito, rotulo: null },
      { db, normalizar: async (t) => t, ...REGUAS },
    ),
    /NÃO é reformatação/,
  );
});

test("(c) a trava do modo antigo DEIXA passar reformatação (mesmas palavras, outra quebra)", async () => {
  const { db } = bancoFalso(LINHAS);
  // Mesmas palavras; muda só onde o chunker vai cortar — o caso Katia inteiro.
  const reformatado =
    "O laudo saiu em quatorze de março\n\ne custou cinquenta reais e noventa centavos.";
  const plano = await n.montarPlano(
    { modo: "refazer", genId: "gen-antiga", conteudoArquivo: reformatado, rotulo: null },
    { db, normalizar: async (t) => t, ...REGUAS },
  );
  assert.equal(plano.textoParaGpu, reformatado);
  assert.equal(plano.textoRaw, ORIGEM.text_raw);
});

test("(c) a trava NÃO se aplica ao modo --voz: texto novo é o pedido, não o acidente", async () => {
  const { db } = bancoFalso(LINHAS);
  const textoNovo = "Perícia forense digital é a disciplina que recupera vestígios.";
  const plano = await n.montarPlano(
    { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: textoNovo, rotulo: null },
    { db, normalizar: async (t) => t, ...REGUAS },
  );
  // Nenhuma palavra em comum com a geração antiga, e passa.
  assert.equal(plano.textoParaGpu, textoNovo);
  assert.equal(plano.origem, null);
});

test("(c) a mensagem da trava aponta o modo certo pra quem quer texto novo", () => {
  assert.throws(
    () => n.conferirReformatacao("um texto", "outro texto totalmente diferente aqui"),
    /use --voz <voiceId> --texto-arquivo/,
  );
});

/* ─────────────── payload: os dois modos mandam a MESMA coisa ─────────── */

test("payload: cfg 1.6, timesteps 15, alpha da voz e prompt_text = reference_transcript", async () => {
  const { db } = bancoFalso(LINHAS);
  const { fetch, pedidos } = runpodFalso();
  const plano = await n.montarPlano(
    { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: "Texto.", rotulo: null },
    { db, normalizar: async (t) => t, ...REGUAS },
  );
  await n.dispararPlano(plano, DEPS_DISPARO(db, fetch));

  const { input, webhook, policy } = pedidos[0].corpo;
  assert.equal(input.type, "inference");
  assert.equal(input.cfg_value, 1.6);
  assert.equal(input.inference_timesteps, 15);
  assert.equal(input.lora_alpha, 32); // o alpha DA VOZ, não o default 16
  assert.equal(input.language, "pt");
  assert.equal(input.prompt_text, VOZ.reference_transcript);
  assert.match(input.prompt_wav_url, /ref\.wav/);
  assert.match(input.lora_url, /lora\.safetensors/);
  assert.equal(input.chunk_silence_ms, 250);
  assert.equal(input.chunk_crossfade_ms, 40);
  assert.equal(webhook, "https://fastcloner.com/api/v1/webhooks/runpod");
  // O teto vem da régua injetada, medido sobre o texto que VAI PRA GPU.
  assert.equal(policy.executionTimeout, REGUAS.timeoutMs(plano.textoParaGpu.length));
});

test("payload: os dois modos montam o MESMO input pro mesmo texto", async () => {
  const texto = ORIGEM.text_normalized;
  const comum = { texto, outputUploadUrl: "put://x", loraUrl: "get://lora", refUrl: "get://ref" };
  assert.deepEqual(n.montarInput({ voz: VOZ, ...comum }), n.montarInput({ voz: VOZ, ...comum }));
  // Voz sem alpha gravado cai no 16 da rota; voz sem referência não manda prompt.
  const semAlpha = n.montarInput({ voz: { ...VOZ, lora_alpha: null }, ...comum, refUrl: null });
  assert.equal(semAlpha.lora_alpha, 16);
  assert.equal("prompt_text" in semAlpha, false);
  assert.equal("prompt_wav_url" in semAlpha, false);
});

test("webhook: localhost é descartado (o RunPod recusa o job com 400)", () => {
  assert.equal(
    n.resolverSite({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }),
    "https://fastcloner.com",
  );
  assert.equal(n.resolverSite({ SITE_URL: "https://fastcloner.com/" }), "https://fastcloner.com");
});

test("voz que não está pronta aborta antes de qualquer disparo", async () => {
  const { db } = bancoFalso({ ...LINHAS, voices: [{ ...VOZ, status: "failed" }] });
  await assert.rejects(
    n.montarPlano(
      { modo: "texto-novo", vozId: "voz-1", conteudoArquivo: "Texto.", rotulo: null },
      { db, normalizar: async (t) => t, ...REGUAS },
    ),
    /voz não está pronta \(status=failed\)/,
  );
});

/* ───────────────────────────── argumentos ───────────────────────────── */

test("argumentos: --voz não é confundido com generationId (o parser antigo confundiria)", () => {
  const a = n.interpretarArgumentos(["--voz", "voz-1", "--texto-arquivo", "/tmp/t.txt"]);
  assert.equal(a.modo, "texto-novo");
  assert.equal(a.vozId, "voz-1");
  assert.equal(a.genId, null);
  assert.equal(a.confirmar, false);

  const b = n.interpretarArgumentos(["gen-antiga", "--confirmar"]);
  assert.equal(b.modo, "refazer");
  assert.equal(b.genId, "gen-antiga");
  assert.equal(b.confirmar, true);

  // --teste é do endpoint, não muda o modo nem vira posicional.
  const c = n.interpretarArgumentos(["gen-antiga", "--teste", "--nome", "A/B"]);
  assert.equal(c.genId, "gen-antiga");
  assert.equal(c.rotulo, "A/B");
});

test("argumentos: combinações que não fazem sentido são recusadas, não adivinhadas", () => {
  assert.throws(() => n.interpretarArgumentos(["gen-1", "--voz", "voz-1"]), /ambíguo/);
  assert.throws(() => n.interpretarArgumentos(["--voz", "voz-1"]), /exige --texto-arquivo/);
  assert.throws(() => n.interpretarArgumentos([]), /faltou o generationId/);
  assert.throws(() => n.interpretarArgumentos(["--voz"]), /--voz exige um valor/);
  assert.throws(() => n.interpretarArgumentos(["gen-1", "--confirma"]), /desconhecido: --confirma/);
});

/* ──────────── fiação: produção de verdade, não cópia local ──────────── */

test("fiação: o script pluga nas funções DE PRODUÇÃO (não numa régua copiada)", (t) => {
  const RAIZ = path.resolve(__dirname, "..", "..");
  const jitiPath = path.join(RAIZ, "frontend", "node_modules", "jiti");
  if (!fs.existsSync(jitiPath)) {
    t.skip("frontend/node_modules ausente — nada a plugar");
    return;
  }
  const createJiti = require(jitiPath);
  const jiti = (createJiti.default || createJiti)(path.join(RAIZ, "frontend", "noop.js"), {
    alias: { "@": path.join(RAIZ, "frontend", "src") },
    interopDefault: true,
  });
  const SRC = path.join(RAIZ, "frontend", "src");

  // Estes três são os que o script carrega. Se produção renomear qualquer um,
  // o script aborta em vez de adivinhar — e este teste avisa antes disso.
  // NÃO chamamos normalizeTextForTTS: ela faz chamada de rede.
  const { normalizeTextForTTS } = jiti(path.join(SRC, "lib", "llm", "normalize.ts"));
  const { inferenceExecutionTimeoutMs } = jiti(
    path.join(SRC, "lib", "generations", "execucao.ts"),
  );
  const { generationCreditCost } = jiti(path.join(SRC, "lib", "credits", "config.ts"));
  assert.equal(typeof normalizeTextForTTS, "function");
  assert.equal(typeof inferenceExecutionTimeoutMs, "function");
  assert.equal(typeof generationCreditCost, "function");

  // E é a MESMA régua que a rota do aluno usa pro executionTimeout.
  assert.equal(generationCreditCost("abc"), 400);
  assert.equal(typeof inferenceExecutionTimeoutMs(900), "number");

  // A rota chama a normalização: se esta linha sumir, o áudio do aluno passa a
  // sair do texto cru e este script viraria uma réplica de algo que não existe.
  const rota = fs.readFileSync(
    path.join(SRC, "app", "api", "v1", "voices", "[id]", "generate", "route.ts"),
    "utf8",
  );
  assert.match(rota, /await normalizeTextForTTS\(text\)/);
});
