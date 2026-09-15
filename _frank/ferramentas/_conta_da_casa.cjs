/**
 * NÚCLEO do "por conta da casa" — a parte que os DOIS modos de
 * `refazer_audio_conta_da_casa.cjs` compartilham.
 *
 * Saiu de dentro do script em 12/09 porque nasceu um segundo modo (gerar com
 * TEXTO NOVO a partir de `--voz`) e o payload da GPU passaria a existir em dois
 * lugares. Payload duplicado é o defeito que o cabeçalho de
 * `generations/execucao.ts` já descreve pra régua de timeout: dois cálculos
 * separados saem do ar um do outro no primeiro ajuste. Aqui é pior, porque o
 * que sai do ar é o áudio que o aluno recebe.
 *
 * REGRA DESTE ARQUIVO: nada aqui faz I/O por conta própria. Banco, rede,
 * relógio, UUID, normalização e presign entram por `deps`. É o que deixa o
 * comportamento inteiro (inclusive "não houve débito") ser provado em teste
 * sem banco e sem GPU — ver `_conta_da_casa.test.cjs`.
 */

/* ────────────────────────────── argumentos ────────────────────────────── */

const COM_VALOR = new Set(["--voz", "--texto-arquivo", "--nome"]);
const BOOLEANOS = new Set(["--confirmar", "--teste"]);

/**
 * Mora aqui, e não no script, porque é onde os dois modos se separam — e um
 * modo escolhido errado é o tipo de defeito que só aparece com um job já
 * disparado. Testável sem banco: joga `argv.slice(2)` e confere o veredito.
 *
 * ⚠️ `--voz` NÃO existia antes, e `GEN_ID` era `process.argv[2]` cru. Com o
 * parser antigo, `--voz <id>` viraria o generationId "--voz" e o script iria
 * consultar o banco por ele. Por isso posicional aqui é o que sobra depois de
 * consumir as flags, nunca uma posição fixa.
 */
function interpretarArgumentos(argv) {
  const out = {
    posicionais: [],
    vozId: null,
    textoArquivo: null,
    rotulo: null,
    confirmar: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (COM_VALOR.has(a)) {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} exige um valor`);
      if (a === "--voz") out.vozId = v;
      if (a === "--texto-arquivo") out.textoArquivo = v;
      if (a === "--nome") out.rotulo = v;
    } else if (BOOLEANOS.has(a)) {
      if (a === "--confirmar") out.confirmar = true;
    } else if (a.startsWith("--")) {
      throw new Error(`argumento desconhecido: ${a}`);
    } else {
      out.posicionais.push(a);
    }
  }

  const genId = out.posicionais[0] ?? null;
  if (out.vozId && genId) {
    throw new Error(
      `ambíguo: veio --voz ${out.vozId} E o generationId ${genId}. São modos diferentes — escolha um.`,
    );
  }
  if (out.vozId && !out.textoArquivo) {
    throw new Error("--voz exige --texto-arquivo <arquivo.txt> (é o texto novo que vai ser gerado).");
  }
  if (!out.vozId && !genId) throw new Error("faltou o generationId (ou --voz <voiceId>).");

  return {
    modo: out.vozId ? "texto-novo" : "refazer",
    genId,
    vozId: out.vozId,
    textoArquivo: out.textoArquivo,
    rotulo: out.rotulo,
    confirmar: out.confirmar,
  };
}

/** Espelha TEXT_MAX de `app/api/v1/voices/[id]/generate/route.ts`. Acima disso
 * o stop-predictor do VoxCPM fica instável em single-shot. A casa não tem
 * licença pra mandar pra GPU o que a rota do aluno recusaria. */
const TEXT_MAX = 2000;

/** Palavras comparáveis: só letras/dígitos, minúsculas, sem pontuação nem
 * espaço. É a trava do modo REFORMATAR — reformatar mantém a sequência de
 * palavras idêntica; reescrever, não. */
function palavras(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Trava do modo REFORMATAR (`<generationId> --texto-arquivo`): o conteúdo
 * FALADO tem que ser o mesmo. Sem ela, um erro de copiar/colar manda um texto
 * diferente pra GPU e o aluno recebe um áudio que ele não escreveu.
 *
 * ⚠️ NÃO se aplica ao modo `--voz` (texto novo): lá o texto diferente é o
 * pedido, não o acidente.
 */
function conferirReformatacao(original, arquivo) {
  const a = palavras(original);
  const b = palavras(arquivo);
  if (a.join(" ") === b.join(" ")) return;
  const i = a.findIndex((w, k) => w !== b[k]);
  throw new Error(
    `--texto-arquivo NÃO é reformatação: a sequência de palavras mudou ` +
      `(original ${a.length} palavras, arquivo ${b.length}; 1ª diferença na posição ${i}: ` +
      `"${a[i] ?? "(fim)"}" vs "${b[i] ?? "(fim)"}"). Abortei sem disparar nada. ` +
      `Se a intenção era gerar um texto NOVO, use --voz <voiceId> --texto-arquivo <arquivo>.`,
  );
}

/**
 * O webhook TEM que ser o de PRODUÇÃO. Na máquina local
 * NEXT_PUBLIC_SITE_URL=http://localhost:3000 — a rota da API usa essa
 * precedência porque roda NO servidor, mas um script operacional roda daqui:
 * com localhost o RunPod recusa o job ("invalid webhook url", 400) e, se
 * aceitasse, o callback nunca chegaria e a geração ficaria pendente pra sempre.
 * Por isso preferimos SITE_URL e descartamos qualquer coisa local.
 */
function resolverSite(env) {
  const candidatos = [env.SITE_URL, env.NEXT_PUBLIC_SITE_URL, "https://fastcloner.com"];
  const site = candidatos.find(
    (u) => u && /^https:\/\//i.test(u) && !/localhost|127\.0\.0\.1/i.test(u),
  );
  if (!site) throw new Error("nenhuma URL pública de site disponível pro webhook");
  return site.replace(/\/$/, "");
}

/**
 * Recusa o que a rota do aluno também recusaria. Espelha route.ts:96-99 e
 * :180-184 — inclusive a ORDEM: o tamanho é do texto CRU (é o que a rota
 * mede), e o "�" é conferido DEPOIS de normalizar (o normalizador reconstrói
 * "Ningu�m" -> "Ninguém"; só o que sobrar é que reprova).
 */
function conferirTextoCru(texto) {
  if (!texto) throw new Error("texto vazio");
  if (texto.length > TEXT_MAX) {
    throw new Error(
      `texto tem ${texto.length} chars e o máximo é ${TEXT_MAX} (mesmo teto da tela do aluno). ` +
        `Corte o texto ou gere em duas partes.`,
    );
  }
}

function conferirTextoNormalizado(texto) {
  if (texto.includes("�")) {
    throw new Error(
      "o texto tem um caractere inválido (aparece como ▯ ou �) que o normalizador não " +
        "conseguiu reconstruir. Peça o texto de novo a partir da origem. " +
        "Abortei sem disparar nada.",
    );
  }
}

/**
 * O payload da GPU. Réplica do `params` + URLs assinadas de
 * `POST /api/v1/voices/[id]/generate` (route.ts:215-287), menos o que é da
 * sessão do aluno (auth) e menos a telemetria de fase (segredo por job).
 *
 * ⚠️ Divergência CONHECIDA e PRÉ-EXISTENTE em relação à rota: `speech_rate_wps`
 * (régua de ritmo gravada na voz) NÃO vai daqui. Sem ela o worker mede a
 * própria referência, que é o comportamento de antes da mig 96. Fica
 * registrado de propósito — não é esquecimento, é escopo.
 */
function montarInput({ voz, texto, outputUploadUrl, loraUrl, refUrl }) {
  const input = {
    type: "inference",
    text: texto,
    output_upload_url: outputUploadUrl,
    // Alpha gravado no treino daquela voz (16 p/ antigas, 32 p/ novas).
    lora_alpha: typeof voz.lora_alpha === "number" ? voz.lora_alpha : 16,
    // 1.6 e 15: os mesmos defaults da rota. Ver route.ts:224-229.
    cfg_value: 1.6,
    inference_timesteps: 15,
    language: voz.language || "pt",
  };
  if (loraUrl) input.lora_url = loraUrl;
  if (refUrl) {
    input.prompt_wav_url = refUrl;
    const t = (voz.reference_transcript ?? "").trim();
    if (t) input.prompt_text = t;
  }
  if (typeof voz.tts_silence_ms === "number") input.chunk_silence_ms = voz.tts_silence_ms;
  if (typeof voz.tts_crossfade_ms === "number") input.chunk_crossfade_ms = voz.tts_crossfade_ms;
  return input;
}

/**
 * #125 (24/08): geração da equipe SEM débito precisa ser reconhecível no banco
 * — sem nome, o detector de "entregue e não cobrada" a confunde com vazamento
 * de receita (28% falso). O prefixo "Conta da casa —" é OBRIGATÓRIO.
 */
function nomeContaDaCasa(dataISO, rotulo) {
  return `Conta da casa — ${dataISO.slice(0, 10)}${rotulo ? ` — ${rotulo}` : ""}`;
}

/** Lê uma linha só, sempre conferindo `error` — consulta que erra volta
 * data:null e o script imprime "undefined" alegremente (armadilha 1 do
 * 03_ROTINA). */
async function um(db, tabela, colunas, id, oQueE) {
  const { data, error } = await db.from(tabela).select(colunas).eq("id", id).maybeSingle();
  if (error) throw new Error(`consulta ${tabela}: ${error.message}`);
  if (!data) throw new Error(`${oQueE} não encontrada(o)`);
  return data;
}

const COLUNAS_VOZ =
  "id, user_id, status, lora_path, reference_audio_path, reference_transcript, lora_alpha, tts_silence_ms, tts_crossfade_ms, language";
// A coluna é `display_name`; `full_name` NÃO existe nesta tabela.
const COLUNAS_PERFIL = "email, display_name, credits_subscription, credits_extra, access_until";

/**
 * Decide TUDO antes de qualquer efeito: quem é o aluno, qual voz, qual texto
 * vai pra GPU e quanto NÃO será cobrado. Não dispara nada e não grava nada —
 * é o que o ensaio (sem `--confirmar`) imprime.
 *
 * deps: { db, normalizar, timeoutMs, custoEmCreditos }
 */
async function montarPlano({ modo, genId, vozId, conteudoArquivo, rotulo }, deps) {
  let origem = null;
  let voz;
  let textoRaw;
  let textoParaGpu;
  let normalizado = false;

  if (modo === "refazer") {
    origem = await um(
      deps.db,
      "generations",
      "id, user_id, voice_id, text_raw, text_normalized, status, created_at",
      genId,
      "geração de origem",
    );
    voz = await um(deps.db, "voices", COLUNAS_VOZ, origem.voice_id, "voz");

    // Reaproveita o `text_normalized` JÁ GRAVADO: é o texto que de fato foi
    // pra GPU (a normalização já rodou lá atrás). Renormalizar aqui mudaria o
    // texto de uma geração que a casa está refazendo IGUAL de propósito.
    const textoOriginal = (origem.text_normalized || origem.text_raw || "").trim();
    if (!textoOriginal) throw new Error("geração de origem sem texto");

    textoParaGpu = textoOriginal;
    if (conteudoArquivo !== null && conteudoArquivo !== undefined) {
      const reformatado = conteudoArquivo.trim();
      if (!reformatado) throw new Error("--texto-arquivo vazio");
      conferirReformatacao(textoOriginal, reformatado);
      textoParaGpu = reformatado;
    }
    // Mantém o texto cru da geração original: o que mudou foi a formatação do
    // que vai pra GPU, não o que o aluno escreveu.
    textoRaw = origem.text_raw;
  } else if (modo === "texto-novo") {
    voz = await um(deps.db, "voices", COLUNAS_VOZ, vozId, "voz");

    textoRaw = (conteudoArquivo ?? "").trim();
    conferirTextoCru(textoRaw);

    // MESMA normalização da rota de produção (`normalizeTextForTTS`, de
    // `frontend/src/lib/llm/normalize.ts`, chamada em route.ts:175). Sem isto o
    // teste da casa NÃO representa o que o aluno recebe: é ela que expande
    // número, moeda e abreviação, tira rubrica de roteiro e limpa markdown.
    textoParaGpu = (await deps.normalizar(textoRaw)).trim();
    if (!textoParaGpu) throw new Error("normalização devolveu texto vazio");
    conferirTextoNormalizado(textoParaGpu);
    normalizado = true;
  } else {
    throw new Error(`modo desconhecido: ${modo}`);
  }

  if (voz.status !== "ready" || !voz.lora_path) {
    throw new Error(`voz não está pronta (status=${voz.status})`);
  }

  const perfil = await um(deps.db, "profiles", COLUNAS_PERFIL, voz.user_id, "perfil do aluno");

  return {
    modo,
    origem,
    voz,
    perfil,
    rotulo: rotulo ?? null,
    textoRaw,
    textoParaGpu,
    normalizado,
    // Custo pela MESMA régua da rota (`generationCreditCost`): nº de
    // caracteres do texto CRU, mínimo 400. Aqui é só pra dizer no relatório o
    // que a casa está bancando — ninguém é debitado.
    custoQueNaoSeraCobrado: deps.custoEmCreditos(textoRaw ?? ""),
    // Mesma régua da rota (`inferenceExecutionTimeoutMs`), medida sobre o
    // texto que vai pra GPU.
    timeoutMs: deps.timeoutMs(textoParaGpu.length),
  };
}

/**
 * O efeito: assina as URLs, manda o job pro RunPod e grava a row.
 *
 * ⚠️ NÃO existe caminho de débito aqui, e é de propósito — esta função é o
 * único lugar do script que escreve no banco, e a única tabela que ela toca é
 * `generations`. `credit_transactions` não é importada, mencionada nem
 * alcançável a partir daqui.
 *
 * ⚠️ REGRA 8 (efeito colateral conhecido): se o job FALHAR, o estorno
 * automático credita o valor mesmo sem ter havido débito — o aluno ganha
 * crédito que nunca pagou. Em compensação por erro nosso isso é aceito DE
 * PROPÓSITO. Quem chama é responsável por registrar isso no relatório.
 *
 * deps: { db, fetch, putUrl, getUrl, uuid, agora, env, buckets }
 */
async function dispararPlano(plano, deps) {
  const { voz, perfil } = plano;
  const novoId = deps.uuid();
  const userId = voz.user_id;
  const outputKey = `${userId}/${novoId}.wav`;
  const refKey = (voz.reference_audio_path ?? "").trim();

  const input = montarInput({
    voz,
    texto: plano.textoParaGpu,
    outputUploadUrl: await deps.putUrl(deps.buckets.geracoes, outputKey, "audio/wav"),
    loraUrl: await deps.getUrl(deps.buckets.vozes, voz.lora_path),
    refUrl: refKey ? await deps.getUrl(deps.buckets.vozes, refKey) : null,
  });

  const site = resolverSite(deps.env);
  const endpoint = deps.env.RUNPOD_ENDPOINT_INFERENCE_ID || deps.env.RUNPOD_ENDPOINT_TRAIN_ID;

  const res = await deps.fetch(`https://api.runpod.ai/v2/${endpoint}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${deps.env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      webhook: `${site}/api/v1/webhooks/runpod`,
      policy: { executionTimeout: plano.timeoutMs },
    }),
  });
  if (!res.ok) throw new Error(`RunPod ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const job = await res.json();

  const { error: eIns } = await deps.db.from("generations").insert({
    id: novoId,
    user_id: userId,
    voice_id: voz.id,
    text_raw: plano.textoRaw,
    text_normalized: plano.textoParaGpu,
    reference_audio_path: refKey || null,
    reference_transcript: (voz.reference_transcript ?? "").trim() || null,
    audio_path: outputKey,
    runpod_job_id: job.id,
    name: nomeContaDaCasa(deps.agora(), plano.rotulo),
  });
  if (eIns) throw new Error(`insert generations: ${eIns.message} (job ${job.id} JÁ disparado)`);

  return { novoId, jobId: job.id, jobStatus: job.status, outputKey, email: perfil.email };
}

module.exports = {
  TEXT_MAX,
  interpretarArgumentos,
  palavras,
  conferirReformatacao,
  conferirTextoCru,
  conferirTextoNormalizado,
  resolverSite,
  montarInput,
  nomeContaDaCasa,
  montarPlano,
  dispararPlano,
};
