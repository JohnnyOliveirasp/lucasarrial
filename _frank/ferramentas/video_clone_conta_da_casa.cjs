/**
 * 13/09 — VÍDEO CLONE **POR CONTA DA CASA**: gera um clone em nome do aluno,
 * sem cobrar, quando a casa PROMETEU por escrito e não existe caminho de
 * produto pra cumprir a promessa.
 *
 * ── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
 * Incidente #369 (contato@mastroiannioliveira.com.br): o suporte prometeu DUAS
 * VEZES, por escrito, um Vídeo Clone de teste por conta da casa — foto
 * recortada + a narração que a casa já gerou. O aluno aceitou ("pode usar
 * neste vídeo de teste") e respondeu "No aguardo" em 12/09 23:57Z. Nada saiu, e
 * ele mandou 8 e-mails em 3h.
 *
 * O aluno NÃO consegue fazer isso sozinho nem querendo: o job custaria 7.455
 * créditos e ele tem 874. É o mesmo buraco do caso Katia no áudio (19/08), que
 * gerou o `refazer_audio_conta_da_casa.cjs`: promessa dada sem dono, porque
 * "gerar em nome do aluno" só existia dentro da rota da API, que exige a
 * sessão dele.
 *
 * Existe uma SEGUNDA aluna presa pelo mesmo caminho (alicearnaldo@gmail.com,
 * #371, barrada 6× pelo gate de rosto). Por isso aqui não há **nada**
 * hard-coded em nenhum dos dois: aluno, imagem, áudio e recorte são todos
 * argumentos.
 *
 * ── O QUE ELE NÃO FAZ (de propósito) ──────────────────────────────────────
 *
 * 1. NÃO COBRA, E NÃO OLHA SALDO. Nenhuma tabela de crédito é tocada — nem pra
 *    LER. O custo é calculado com a mesma conta da rota (`cloneCreditsCost`) e
 *    só IMPRESSO. Se este script encostasse em crédito, o aluno do #369 (874
 *    créditos, job de 7.455) ou falharia no gate ou ficaria negativo. O teste
 *    `video_clone_conta_da_casa.test.cjs` registra TODA tabela e TODA coluna
 *    tocada e falha se qualquer uma for de crédito — inclusive as colunas
 *    `credits_*` de `profiles`, que por isso NÃO são selecionadas aqui.
 *
 * 2. NÃO PASSA `webhook` no job. O webhook de generation chama
 *    `finalizeVideoClone`, que dispara `handleTechFailure` a cada falha.
 *    Fazemos o poll nós mesmos.
 *
 *    ⚠️ CORREÇÃO MEDIDA (13/09) do motivo que circulava: dizia-se que o
 *    webhook "estorna crédito mesmo sem ter havido débito, imprimindo crédito
 *    do nada". Isso é verdade no ÁUDIO (regra 8 do
 *    `refazer_audio_conta_da_casa.cjs`), mas NÃO no vídeo: o
 *    `refundOriginalDebit` de `lib/support/failure-alert.ts` ancora no débito
 *    real do extrato e devolve `"nada cobrado (sem débito no extrato)"` quando
 *    não acha nenhum. Sem débito, não há estorno. O motivo REAL de não passar
 *    webhook aqui é outro e continua de pé: `handleTechFailure` manda e-mail
 *    pro suporte e alimenta a regra de rajada (`video_clone_refund`: 2 falhas
 *    em 6h abrem incidente). Job da casa que falha viraria chamado fantasma na
 *    fila que o Vigia varre. Registrado com o motivo certo pra ninguém
 *    "consertar" isto amanhã achando que a razão era crédito.
 *
 * 3. NÃO CRIA LINHA `pending` EM `video_clones`. Esta é a decisão de projeto
 *    mais importante do arquivo, e ela é DIFERENTE da `fumaca_video_clone.cjs`
 *    (que não cria linha nenhuma) e diferente da rota (que cria `pending`
 *    antes de disparar). Aqui a linha nasce **só depois** do MP4 estar provado
 *    no R2, já com `status='ready'`. Três motivos, todos medidos:
 *
 *      (a) TRAVA DO ALUNO. A rota recusa novo clone com 409 `clone_in_progress`
 *          enquanto existir linha `pending`/`generating` do aluno, e o DELETE
 *          se recusa a apagar linha in-flight. Um job da casa de até 90min
 *          deixaria o aluno TRANCADO fora do próprio produto por 90min — pra
 *          fazer um favor a ele. Inaceitável.
 *      (b) SWEEPER. `api/v1/agent/sweep-clones` varre exatamente
 *          `status in (pending, generating)` a cada 5min e aplica
 *          `finalizeVideoClone` por fora — ou seja, a linha `pending` reabre
 *          pela porta dos fundos tudo o que a regra 2 fechou. Linha que nasce
 *          `ready` é invisível pro sweeper.
 *      (c) HONESTIDADE DO DADO. `video_path` é gravado no INSERT da rota, então
 *          `status='ready' AND video_path IS NOT NULL` NÃO prova que o clone
 *          saiu (lição de 12/09). Nesta ferramenta a linha só existe depois do
 *          `HeadObject` no R2 — aqui a invariante vale de verdade.
 *
 *    A linha nasce com `credits_cost = 0` e `name` prefixado
 *    `"Conta da casa — "`, o mesmo padrão que o áudio já usa (é o que o
 *    detector de "entregue e não cobrada" do #125 procura pra não acusar
 *    vazamento de receita).
 *
 * 4. SEM `--confirmar`, NÃO DISPARA E NÃO GRAVA NADA. O ensaio só lê, calcula e
 *    escreve os PNGs de conferência do recorte na pasta de saída local.
 *
 * ── O RECORTE ─────────────────────────────────────────────────────────────
 * A promessa ao aluno foi "foto RECORTADA", porque no quadro original o rosto
 * ocupa pouco do frame e sobra pouco pixel pra boca — e boca é o que o
 * lip-sync anima.
 *
 * ⚠️ NÃO existe detector de rosto nesta máquina (sem `cv2`), e eu me recuso a
 * chutar a caixa do rosto ou a pedir pra um modelo de visão adivinhar
 * coordenadas e tratar o palpite como medida. Então o recorte é EXPLÍCITO:
 * quem roda passa a caixa do rosto (`--rosto x0,y0,x1,y1`, lida na imagem) ou
 * a caixa final (`--recorte x,y,w,h`), e a ferramenta DERIVA o enquadramento
 * cabeça-e-ombros a partir dela. Todo ensaio escreve `antes.png`, `depois.png`
 * e `comparativo.png` pra decisão ser tomada olhando, não lendo número.
 *
 * O recorte sai na PROPORÇÃO EXATA do tier (480:832). Isso importa: o nó 171
 * (`ImageResizeKJv2`) do template tem `keep_proportion: "crop"` +
 * `crop_position: "center"` e vai cortar sozinho o que sobrar da proporção —
 * entregar já na proporção certa transforma esse corte num no-op e garante que
 * o que eu conferi no `depois.png` é o que a GPU vai receber.
 *
 * ── USO ───────────────────────────────────────────────────────────────────
 *   node _frank/ferramentas/video_clone_conta_da_casa.cjs \
 *     --aluno contato@exemplo.com.br \
 *     --imagem <chave R2 ou caminho local> \
 *     --audio <generationId ou chave R2> \
 *     [--tier 480p-v3] [--nome "#369 teste prometido"] \
 *     [--rosto x0,y0,x1,y1] [--rosto-fracao 0.333] [--headroom 0.165] \
 *     [--recorte x,y,w,h] [--minutos 90] [--saida <dir>] \
 *     [--confirmar]
 *
 * Exit code 0 = entregou (MP4 provado no R2) · 1 = não entregou.
 */
const path = require("node:path");
const fsReal = require("node:fs");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const { supa, r2, s3, BUCKETS, RAIZ } = require("./_comum.cjs");

/* ═══════════════════════════ NÚCLEO PURO ═══════════════════════════════════
 * Nada daqui pra baixo até "ADAPTADORES" faz I/O. Banco, rede, relógio, disco
 * e UUID entram por `deps`. É o que deixa "não houve débito" e "o recorte é
 * este" serem provados em teste sem banco, sem R2 e sem GPU.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Espelho de `frontend/src/lib/video-clone/config.ts` (aquilo é TS, isto é
 *  CJS). O teste compara os dois e falha se divergirem. */
const TIERS = {
  "480p-v3": { id: "480p-v3", label: "Padrão 2.0", flow: "v3", creditsPerSecond: 105, width: 480, height: 832 },
  "480p-v2": { id: "480p-v2", label: "Turbo", flow: "v2", creditsPerSecond: 80, width: 480, height: 832 },
};
const CLONE_FPS = 25;
const CLONE_MIN_BILLED_SECONDS = 5;
const CLONE_MAX_AUDIO_SECONDS = 90;

/** Tabelas que este script NUNCA pode tocar — nem pra ler. Medido em 13/09 no
 *  information_schema; o teste usa esta lista como régua. */
const TABELAS_DE_CREDITO = [
  "credit_transactions",
  "credit_campaigns",
  "credit_campaign_grants",
  "trial_credit_expirations",
  "entitlements",
  "_backfill_161_entitlements",
  "subscription_cancellations",
];

/** Espelha `cloneCreditsCost`. CALCULADO pra imprimir, NUNCA debitado. */
function custoQueNaoSeraCobrado(tier, segundos) {
  return Math.max(CLONE_MIN_BILLED_SECONDS, Math.ceil(segundos)) * tier.creditsPerSecond;
}

/** Espelha `cloneExecutionTimeoutMs` — o teto DENTRO do RunPod (não é o nosso). */
function tetoDeExecucaoMs(tier, segundos) {
  const billed = Math.max(CLONE_MIN_BILLED_SECONDS, Math.ceil(segundos));
  const perAudioSecond = tier.flow === "v1" ? 60 : 30;
  return (20 * 60 + billed * perAudioSecond) * 1000;
}

/**
 * Espelha a fórmula de `buildInfiniteTalkWorkflow` por fluxo.
 *
 * ⚠️ DERIVADO, NÃO CHUTADO — e conferido contra as duas linhas REAIS do aluno
 * do #369 (medido 13/09):
 *   • 24,73s · tier 480p-v3 · 625 frames  → floor(24,73)×25+25 = 625 ✔ exato
 *   • 49,08s · tier 480p-v2 · 1253 frames → ceil(49,08×25)+25 = 1252 ✘ erra 1
 * A divergência de 1 frame no v2 NÃO é fórmula errada: `duration_seconds` é
 * gravado arredondado (`Math.round(d*100)/100`) enquanto o workflow é montado
 * com a duração CRUA, e `ceil()` amplia qualquer casa decimal perdida. Ou seja:
 * no v2 a precisão da duração muda o resultado; no v3, `floor()` a engole.
 * Foi por isso que a razão frames/segundos das duas linhas dava "~25,5 fps" e
 * "~25,3 fps": aquilo nunca foi FPS, é a fórmula com o colchão de +25 frames
 * dividida pela duração. O FPS do fluxo é 25, fixo (nó 194, `fps: 25`).
 */
function numeroDeFrames(flow, segundos) {
  if (flow === "v3") return Math.floor(segundos) * CLONE_FPS + CLONE_FPS;
  if (flow === "v2") return Math.max(50, Math.ceil(segundos * CLONE_FPS) + 25);
  return Math.max(25, Math.ceil(segundos * CLONE_FPS));
}

/**
 * Enquadramento cabeça-e-ombros, PURO e determinístico.
 *
 * Recebe a caixa do rosto em pixels da imagem de origem e devolve a caixa de
 * recorte na proporção EXATA do tier, com o rosto ocupando `fracaoAlvo` da
 * altura e `headroom` de sobra acima do topo da cabeça.
 *
 * Devolve também o que foi preciso ceder (`limites`), porque recorte que bate
 * na borda da imagem e é silenciosamente reposicionado é como o quadro sai
 * torto sem ninguém perceber.
 */
function enquadrarCabecaEOmbros({ imagem, rosto, aspecto, fracaoAlvo = 1 / 3, headroom = 0.165 }) {
  if (!(imagem && imagem.width > 0 && imagem.height > 0)) throw new Error("imagem sem dimensões");
  if (!(rosto && rosto.x1 > rosto.x0 && rosto.y1 > rosto.y0)) throw new Error("caixa de rosto inválida");
  if (!(fracaoAlvo > 0 && fracaoAlvo <= 1)) throw new Error(`--rosto-fracao fora de (0,1]: ${fracaoAlvo}`);
  if (!(headroom >= 0 && headroom < 1)) throw new Error(`--headroom fora de [0,1): ${headroom}`);

  const alturaRosto = rosto.y1 - rosto.y0;
  const limites = [];

  let height = Math.round(alturaRosto / fracaoAlvo);
  let width = Math.round(height * aspecto);

  // A imagem é o teto. Encolhe mantendo a proporção do tier — nunca estica.
  if (width > imagem.width) {
    width = imagem.width;
    height = Math.round(width / aspecto);
    limites.push("largura da imagem limitou o recorte (o rosto vai sair maior que o alvo)");
  }
  if (height > imagem.height) {
    height = imagem.height;
    width = Math.round(height * aspecto);
    limites.push("altura da imagem limitou o recorte (o rosto vai sair maior que o alvo)");
  }

  const centroX = (rosto.x0 + rosto.x1) / 2;
  const leftIdeal = Math.round(centroX - width / 2);
  const left = Math.max(0, Math.min(leftIdeal, imagem.width - width));
  if (left !== leftIdeal) limites.push("rosto não ficou centrado na horizontal (bateu na borda da imagem)");

  const topIdeal = Math.round(rosto.y0 - headroom * height);
  const top = Math.max(0, Math.min(topIdeal, imagem.height - height));
  if (top !== topIdeal) limites.push("headroom pedido não coube (bateu na borda da imagem)");

  return {
    left,
    top,
    width,
    height,
    /** Fração da altura do recorte que o rosto de fato ocupa (pode diferir do
     *  alvo quando a imagem limitou). É este número que vale, não o pedido. */
    fracaoReal: alturaRosto / height,
    limites,
  };
}

/** Valida uma caixa de recorte explícita contra a imagem, sem "consertar" nada
 *  em silêncio: `--recorte` é ordem direta, então erro vira erro. */
function conferirRecorteExplicito(caixa, imagem) {
  const { left, top, width, height } = caixa;
  if (![left, top, width, height].every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error("--recorte exige quatro inteiros >= 0: x,y,w,h");
  }
  if (width === 0 || height === 0) throw new Error("--recorte com largura ou altura zero");
  if (left + width > imagem.width || top + height > imagem.height) {
    throw new Error(
      `--recorte ${left},${top},${width},${height} sai da imagem de ${imagem.width}x${imagem.height} ` +
        `(precisaria de ${left + width}x${top + height}). Abortei sem recortar.`,
    );
  }
  return caixa;
}

/**
 * Qual bucket guarda uma chave de imagem. Espelha a decisão do GET da rota
 * (`route.ts`): upload do próprio fluxo mora no bucket de generations (TTL
 * 30d); o resto (histórico do Gerador de Imagem, e o que ESTA ferramenta
 * grava) mora no bucket permanente de imagens.
 */
function bucketDaImagem(chave, buckets) {
  return chave.includes("/video-clone/uploads/") ? buckets.generations : buckets.imagens;
}

/* ──────────────────────────── argumentos ───────────────────────────────── */

const COM_VALOR = new Set([
  "--aluno", "--imagem", "--audio", "--tier", "--nome",
  "--rosto", "--rosto-fracao", "--headroom", "--recorte", "--minutos", "--saida", "--duracao",
]);
const BOOLEANOS = new Set(["--confirmar"]);

/** Lê "a,b,c,d" como quatro números. Recusa lixo em vez de virar NaN adiante. */
function quatroNumeros(texto, flag) {
  const partes = String(texto).split(",").map((s) => s.trim());
  if (partes.length !== 4) throw new Error(`${flag} exige 4 números separados por vírgula, veio "${texto}"`);
  const nums = partes.map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) throw new Error(`${flag}: "${p}" não é número`);
    return n;
  });
  return nums;
}

function interpretarArgumentos(argv) {
  const out = {
    aluno: null, imagem: null, audio: null, tierId: "480p-v3", rotulo: null,
    rosto: null, fracaoAlvo: 1 / 3, headroom: 0.165, recorte: null,
    minutos: 90, saida: null, duracao: null, confirmar: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (COM_VALOR.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`${a} exige um valor`);
      if (a === "--aluno") out.aluno = v;
      if (a === "--imagem") out.imagem = v;
      if (a === "--audio") out.audio = v;
      if (a === "--tier") out.tierId = v;
      if (a === "--nome") out.rotulo = v;
      if (a === "--saida") out.saida = v;
      if (a === "--rosto") {
        const [x0, y0, x1, y1] = quatroNumeros(v, "--rosto");
        out.rosto = { x0, y0, x1, y1 };
      }
      if (a === "--recorte") {
        const [left, top, width, height] = quatroNumeros(v, "--recorte");
        out.recorte = { left, top, width, height };
      }
      for (const [flag, campo] of [["--rosto-fracao", "fracaoAlvo"], ["--headroom", "headroom"], ["--minutos", "minutos"], ["--duracao", "duracao"]]) {
        if (a === flag) {
          const n = Number(v);
          if (!Number.isFinite(n)) throw new Error(`${flag}: "${v}" não é número`);
          out[campo] = n;
        }
      }
    } else if (BOOLEANOS.has(a)) {
      if (a === "--confirmar") out.confirmar = true;
    } else {
      throw new Error(`argumento desconhecido: ${a}`);
    }
  }

  if (!out.aluno) throw new Error("faltou --aluno <email ou uuid>");
  if (!out.imagem) throw new Error("faltou --imagem <chave R2 ou caminho local>");
  if (!out.audio) throw new Error("faltou --audio <generationId ou chave R2>");
  if (!TIERS[out.tierId]) throw new Error(`--tier inválido: ${out.tierId} (use ${Object.keys(TIERS).join(" ou ")})`);
  if (out.rosto && out.recorte) {
    throw new Error("--rosto e --recorte são as duas formas de dizer a MESMA coisa. Escolha uma.");
  }
  if (!(out.minutos > 0)) throw new Error(`--minutos inválido: ${out.minutos}`);
  return out;
}

/** É UUID? Serve pra separar generationId de chave R2, e uuid de e-mail. */
const ehUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));

/** Nome da linha. O prefixo é contrato com o detector do #125 — não mexer. */
function nomeDaLinha(rotulo, hojeISO) {
  return `Conta da casa — ${hojeISO.slice(0, 10)}${rotulo ? ` — ${rotulo}` : ""}`;
}

/* ═══════════════════════════ PLANO (lê, não escreve) ══════════════════════ */

/**
 * Monta o plano inteiro só LENDO. Tudo que pode dar errado (aluno inexistente,
 * áudio de outro dono, arquivo sumido do R2, recorte fora da imagem) estoura
 * AQUI — antes de existir job, antes de existir linha.
 */
async function planejar(deps, args) {
  const tier = TIERS[args.tierId];

  // ── aluno ──────────────────────────────────────────────────────────────
  // ⚠️ As colunas `credits_subscription`/`credits_extra` existem em `profiles`
  // e NÃO são pedidas aqui de propósito: regra 1 proíbe até LER saldo, e o
  // teste falha se alguma coluna casar com /credit/i.
  const aluno = await deps.db.umaLinha("profiles", "id, email, display_name, access_until", (q) =>
    ehUuid(args.aluno) ? q.eq("id", args.aluno) : q.eq("email", args.aluno),
  );
  if (!aluno) throw new Error(`aluno não encontrado: ${args.aluno}`);

  // ── áudio ──────────────────────────────────────────────────────────────
  let audioChave;
  let duracao;
  let origemAudio;
  if (ehUuid(args.audio)) {
    const gen = await deps.db.umaLinha(
      "generations",
      "id, user_id, status, audio_path, duration_seconds, name",
      (q) => q.eq("id", args.audio),
    );
    if (!gen) throw new Error(`generation não encontrada: ${args.audio}`);
    if (gen.user_id !== aluno.id) {
      throw new Error(`generation ${args.audio} é de OUTRO usuário (${gen.user_id}), não de ${aluno.email}`);
    }
    if (gen.status !== "ready" || !gen.audio_path) throw new Error(`generation ${args.audio} não está pronta (status=${gen.status})`);
    audioChave = gen.audio_path;
    duracao = Number(gen.duration_seconds);
    origemAudio = `generation ${gen.id}${gen.name ? ` ("${gen.name}")` : ""}`;
  } else {
    audioChave = args.audio;
    duracao = args.duracao ?? (await deps.medirDuracao(deps.buckets.generations, audioChave));
    origemAudio = `chave R2 ${audioChave}`;
  }
  if (!(duracao > 0)) throw new Error("não consegui determinar a duração do áudio (use --duracao <segundos>)");
  if (duracao > CLONE_MAX_AUDIO_SECONDS + 0.5) {
    throw new Error(`áudio tem ${duracao}s — o teto do produto é ${CLONE_MAX_AUDIO_SECONDS}s`);
  }
  const headAudio = await deps.r2.head(deps.buckets.generations, audioChave);
  if (!headAudio) throw new Error(`áudio não existe no R2: ${deps.buckets.generations}/${audioChave}`);

  // ── imagem (bytes na mão: é o que o recorte precisa medir) ─────────────
  const imagemEhLocal = !ehChaveR2(args.imagem);
  let bytesImagem;
  let origemImagem;
  if (imagemEhLocal) {
    bytesImagem = await deps.arquivo.ler(args.imagem);
    origemImagem = `arquivo local ${args.imagem}`;
  } else {
    const bucket = bucketDaImagem(args.imagem, deps.buckets);
    const head = await deps.r2.head(bucket, args.imagem);
    if (!head) throw new Error(`imagem não existe no R2: ${bucket}/${args.imagem}`);
    bytesImagem = await deps.r2.baixar(bucket, args.imagem);
    origemImagem = `R2 ${bucket}/${args.imagem}`;
  }
  const dimensoes = await deps.imagem.medir(bytesImagem);

  // ── recorte ────────────────────────────────────────────────────────────
  const aspecto = tier.width / tier.height;
  let recorte = null;
  if (args.recorte) {
    recorte = conferirRecorteExplicito(args.recorte, dimensoes);
    recorte = { ...recorte, fracaoReal: null, limites: [] };
  } else if (args.rosto) {
    recorte = enquadrarCabecaEOmbros({
      imagem: dimensoes,
      rosto: args.rosto,
      aspecto,
      fracaoAlvo: args.fracaoAlvo,
      headroom: args.headroom,
    });
  }

  const numFrames = numeroDeFrames(tier.flow, duracao);
  const cloneId = deps.uuid();

  return {
    aluno,
    tier,
    duracao,
    origemAudio,
    origemImagem,
    audioChave,
    imagemEhLocal,
    imagemOrigemChave: imagemEhLocal ? null : args.imagem,
    bytesImagem,
    dimensoes,
    recorte,
    numFrames,
    cloneId,
    // Saída determinística, MESMA convenção da rota — é o que faz o GET do
    // histórico achar o MP4 (ele presigna `video_path` no bucket de imagens).
    s3Key: `${aluno.id}/video-clone/${cloneId}/result.mp4`,
    // A imagem recortada NUNCA sobrescreve a do aluno: prefixo `_casa/`.
    imagemFinalChave: recorte
      ? `_casa/video-clone-conta-da-casa/${cloneId}/imagem.png`
      : args.imagem,
    custoNaoCobrado: custoQueNaoSeraCobrado(tier, duracao),
    tetoRunpodMs: tetoDeExecucaoMs(tier, duracao),
    tetoNossoMs: args.minutos * 60 * 1000,
    nome: nomeDaLinha(args.rotulo, deps.hojeISO()),
  };
}

/** Chave R2 x caminho local: chave não começa com / nem . e não existe no disco. */
function ehChaveR2(v) {
  if (v.startsWith("/") || v.startsWith("./") || v.startsWith("../") || v.startsWith("~")) return false;
  try {
    return !fsReal.existsSync(v);
  } catch {
    return true;
  }
}

/* ═══════════════════════════ WORKFLOW ═════════════════════════════════════ */

/** Espelha `buildInfiniteTalkWorkflow` (v2/v3 — os tiers que existem hoje). */
function montarWorkflow({ imageUrl, audioUrl, s3Key, tier, duracaoSegundos, seed }) {
  const tpl = (nome) =>
    JSON.parse(JSON.stringify(require(path.join(RAIZ, "frontend", "src", "lib", "video-clone", nome))));
  const numFrames = numeroDeFrames(tier.flow, duracaoSegundos);
  if (tier.flow === "v3") {
    const wf = tpl("infinitetalk-v3-template.json");
    wf["133"].inputs.url = imageUrl;
    wf["125"].inputs.url = audioUrl;
    wf["900"].inputs.s3_key = s3Key;
    wf["194"].inputs.num_frames = numFrames;
    return { workflow: wf, numFrames };
  }
  const wf = tpl("infinitetalk-v2-template.json");
  wf["133"].inputs.url = imageUrl;
  wf["125"].inputs.url = audioUrl;
  wf["900"].inputs.s3_key = s3Key;
  wf["171"].inputs.width = tier.width;
  wf["171"].inputs.height = tier.height;
  wf["194"].inputs.num_frames = numFrames;
  wf["128"].inputs.seed = seed;
  return { workflow: wf, numFrames };
}

/* ═══════════════════════════ ADAPTADORES (I/O real) ═══════════════════════ */

const RUNPOD_BASE = "https://api.runpod.ai/v2";

/**
 * Corpo do POST /run. PURO de propósito: é aqui que a regra 2 (nunca passar
 * `webhook`) vira algo que um teste consegue provar, em vez de um comentário
 * que alguém apaga sem perceber. Ver `video_clone_conta_da_casa.test.cjs`.
 */
function corpoDoJob(workflow, executionTimeoutMs) {
  return { input: { workflow }, policy: { executionTimeout: executionTimeoutMs } };
}

function credenciaisRunpod() {
  const key = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_ENDPOINT_INFINITETALK_ID;
  if (!key) throw new Error("RUNPOD_API_KEY ausente no frontend/.env.local");
  if (!endpoint) throw new Error("RUNPOD_ENDPOINT_INFINITETALK_ID ausente no frontend/.env.local");
  return { key, endpoint };
}

function depsReais() {
  const db = supa();
  const sharp = require(path.join(RAIZ, "frontend", "node_modules", "sharp"));
  const { getSignedUrl } = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "s3-request-presigner"));
  const cliente = r2();

  const buckets = {
    generations: BUCKETS.geracoes(),
    imagens: process.env.R2_BUCKET_IMAGES || BUCKETS.vozes(),
    /** Onde o worker GRAVA o MP4. Medido: é o mesmo que `imagesBucket()` da
     *  app resolve hoje (R2_BUCKET_IMAGES não existe em produção). */
    worker: BUCKETS.worker(),
  };

  return {
    buckets,
    uuid: randomUUID,
    agora: () => Date.now(),
    hojeISO: () => new Date().toISOString(),
    dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (...a) => console.log(...a),

    db: {
      async umaLinha(tabela, colunas, filtrar) {
        const { data, error } = await filtrar(db.from(tabela).select(colunas)).maybeSingle();
        if (error) throw new Error(`consulta ${tabela}: ${error.message}`);
        return data;
      },
      async inserir(tabela, linha) {
        const { error } = await db.from(tabela).insert(linha);
        if (error) throw new Error(`insert ${tabela}: ${error.message}`);
      },
    },

    r2: {
      async head(bucket, key) {
        try {
          return await cliente.send(new s3.HeadObjectCommand({ Bucket: bucket, Key: key }));
        } catch {
          return null;
        }
      },
      async baixar(bucket, key) {
        const out = await cliente.send(new s3.GetObjectCommand({ Bucket: bucket, Key: key }));
        const chunks = [];
        for await (const c of out.Body) chunks.push(c);
        return Buffer.concat(chunks);
      },
      async subir(bucket, key, body, contentType) {
        await cliente.send(new s3.PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      },
      urlGet: (bucket, key, segundos) =>
        getSignedUrl(cliente, new s3.GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: segundos }),
    },

    arquivo: {
      ler: async (p) => fsReal.promises.readFile(p),
      escrever: async (p, buf) => {
        await fsReal.promises.mkdir(path.dirname(p), { recursive: true });
        await fsReal.promises.writeFile(p, buf);
      },
    },

    imagem: {
      medir: async (buf) => {
        const m = await sharp(buf).metadata();
        return { width: m.width, height: m.height, format: m.format };
      },
      recortar: async (buf, caixa) =>
        sharp(buf)
          .extract({ left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height })
          .png()
          .toBuffer(),
      /** Pré-visualização no tamanho EXATO que a GPU vai ver (480x832). */
      previa: async (buf, tier) =>
        sharp(buf)
          .resize(tier.width, tier.height, { fit: "cover", position: "centre", kernel: "lanczos3" })
          .jpeg({ quality: 92 })
          .toBuffer(),
      lado_a_lado: async (bufs, tier, rotulos) => {
        const vao = 10;
        const largura = bufs.length * tier.width + (bufs.length - 1) * vao;
        const legenda = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${tier.height}" viewBox="0 0 ${largura} ${tier.height}">` +
            rotulos
              .map(
                (t, i) =>
                  `<text x="${i * (tier.width + vao) + 12}" y="34" fill="#0f0" font-size="26" font-family="monospace" ` +
                  `style="paint-order:stroke;stroke:#000;stroke-width:5">${t}</text>`,
              )
              .join("") +
            `</svg>`,
        );
        const base = await sharp({
          create: { width: largura, height: tier.height, channels: 3, background: "#111" },
        })
          .composite(bufs.map((b, i) => ({ input: b, left: i * (tier.width + vao), top: 0 })))
          .png()
          .toBuffer();
        const camada = await sharp(legenda).resize(largura, tier.height, { fit: "fill" }).png().toBuffer();
        return sharp(base).composite([{ input: camada, top: 0, left: 0 }]).jpeg({ quality: 92 }).toBuffer();
      },
    },

    /** Duração de um áudio no R2, via ffprobe. Só usado quando `--audio` é
     *  chave crua (o caminho normal é generationId, que já tem a duração). */
    medirDuracao: async (bucket, key) => {
      const buf = await (async () => {
        const out = await cliente.send(new s3.GetObjectCommand({ Bucket: bucket, Key: key }));
        const chunks = [];
        for await (const c of out.Body) chunks.push(c);
        return Buffer.concat(chunks);
      })();
      const tmp = path.join(require("node:os").tmpdir(), `ccdc-${randomUUID()}${path.extname(key) || ".bin"}`);
      try {
        fsReal.writeFileSync(tmp, buf);
        const saida = execFileSync(
          "ffprobe",
          ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", tmp],
          { encoding: "utf8" },
        );
        const n = Number(String(saida).trim());
        if (!Number.isFinite(n)) throw new Error(`ffprobe devolveu "${saida}"`);
        return n;
      } finally {
        try {
          fsReal.unlinkSync(tmp);
        } catch {
          /* melhor-esforço */
        }
      }
    },

    runpod: {
      async disparar(workflow, executionTimeoutMs) {
        const { key, endpoint } = credenciaisRunpod();
        // SEM `webhook` de propósito — ver regra 2 no cabeçalho. O corpo sai de
        // `corpoDoJob`, que é puro justamente pra isso ser testável.
        const res = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(corpoDoJob(workflow, executionTimeoutMs)),
        });
        if (!res.ok) throw new Error(`RunPod run ${res.status}: ${(await res.text()).slice(0, 500)}`);
        const json = await res.json();
        if (!json.id) throw new Error(`RunPod run sem job id: ${JSON.stringify(json)}`);
        return json.id;
      },
      async status(jobId) {
        const { key, endpoint } = credenciaisRunpod();
        const res = await fetch(`${RUNPOD_BASE}/${endpoint}/status/${jobId}`, {
          headers: { Authorization: `Bearer ${key}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`RunPod status ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const json = await res.json();
        const partes = [];
        if (json.error) partes.push(typeof json.error === "string" ? json.error : JSON.stringify(json.error));
        const det = json.output && json.output.details;
        if (Array.isArray(det)) partes.push(det.join("\n"));
        else if (det) partes.push(typeof det === "string" ? det : JSON.stringify(det));
        return {
          status: json.status ?? "IN_QUEUE",
          executionTimeMs: typeof json.executionTime === "number" ? json.executionTime : null,
          delayTimeMs: typeof json.delayTime === "number" ? json.delayTime : null,
          rawError: partes.length ? partes.join("\n") : null,
          bruto: json,
        };
      },
      async cancelar(jobId) {
        try {
          const { key, endpoint } = credenciaisRunpod();
          await fetch(`${RUNPOD_BASE}/${endpoint}/cancel/${jobId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
          });
          return true;
        } catch {
          return false;
        }
      },
    },
  };
}

/* ═══════════════════════════ EXECUÇÃO ═════════════════════════════════════ */

const TERMINAIS = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"];
const INTERVALO_POLL_MS = 15000;

/**
 * Dispara, acompanha com prazo PRÓPRIO e só grava a linha depois do MP4
 * provado no R2. Ver regra 3 do cabeçalho pra por que a ordem é esta.
 */
async function executar(deps, plano, previa) {
  const { log } = deps;

  // 1. imagem final (recortada, se houve recorte) pro R2
  let bucketImagem;
  if (plano.recorte) {
    bucketImagem = deps.buckets.imagens;
    await deps.r2.subir(bucketImagem, plano.imagemFinalChave, previa.bytesRecortados, "image/png");
    log(`imagem recortada publicada: ${bucketImagem}/${plano.imagemFinalChave}`);
  } else if (plano.imagemEhLocal) {
    bucketImagem = deps.buckets.imagens;
    await deps.r2.subir(bucketImagem, plano.imagemFinalChave, plano.bytesImagem, "image/png");
    log(`imagem local publicada: ${bucketImagem}/${plano.imagemFinalChave}`);
  } else {
    bucketImagem = bucketDaImagem(plano.imagemFinalChave, deps.buckets);
  }

  // 2. insumos por URL assinada (2h — sobra pro job na fila), igual à rota
  const [imageUrl, audioUrl] = await Promise.all([
    deps.r2.urlGet(bucketImagem, plano.imagemFinalChave, 7200),
    deps.r2.urlGet(deps.buckets.generations, plano.audioChave, 7200),
  ]);

  const { workflow, numFrames } = montarWorkflow({
    imageUrl,
    audioUrl,
    s3Key: plano.s3Key,
    tier: plano.tier,
    duracaoSegundos: plano.duracao,
    seed: 20260913,
  });

  // 3. dispara
  const t0 = deps.agora();
  const jobId = await deps.runpod.disparar(workflow, plano.tetoRunpodMs);
  log(`job ${jobId} enfileirado — ${numFrames} frames, teto do RunPod ${Math.round(plano.tetoRunpodMs / 60000)}min.`);
  log(`nosso teto: ${Math.round(plano.tetoNossoMs / 60000)}min. Poll a cada ${INTERVALO_POLL_MS / 1000}s.`);

  // 4. poll com prazo PRÓPRIO — nunca laço infinito (regra 4)
  const prazo = t0 + plano.tetoNossoMs;
  let ultimo = null;
  let visto = "";
  while (deps.agora() < prazo) {
    await deps.dormir(INTERVALO_POLL_MS);
    try {
      ultimo = await deps.runpod.status(jobId);
    } catch (e) {
      log(`  (status falhou, tento de novo: ${e instanceof Error ? e.message : e})`);
      continue;
    }
    const minutos = Math.round((deps.agora() - t0) / 60000);
    if (ultimo.status !== visto) {
      visto = ultimo.status;
      log(`  [${minutos}min] ${ultimo.status}`);
    } else if (minutos > 0 && minutos % 10 === 0) {
      log(`  [${minutos}min] ainda ${ultimo.status}`);
    }
    if (TERMINAIS.includes(ultimo.status)) break;
  }
  const decorridoMin = Math.round((deps.agora() - t0) / 60000);

  // 5. estourou o NOSSO prazo: cancela pra não queimar GPU (regra 4)
  if (!ultimo || !TERMINAIS.includes(ultimo.status)) {
    const cancelado = await deps.runpod.cancelar(jobId);
    return {
      ok: false,
      motivo: "sem_resposta",
      jobId,
      decorridoMin,
      ultimoStatus: ultimo ? ultimo.status : "sem status",
      cancelado,
    };
  }

  // 6. job falhou
  if (ultimo.status !== "COMPLETED") {
    return {
      ok: false,
      motivo: "job_falhou",
      jobId,
      decorridoMin,
      status: ultimo.status,
      rawError: ultimo.rawError || `RunPod ${ultimo.status} (sem texto de erro)`,
      bruto: ultimo.bruto,
    };
  }

  // 7. "COMPLETED" NÃO BASTA (regra 5): o MP4 existe mesmo?
  const head = await deps.r2.head(deps.buckets.worker, plano.s3Key);
  if (!head || !(head.ContentLength > 0)) {
    return { ok: false, motivo: "sem_arquivo", jobId, decorridoMin, s3Key: plano.s3Key, bruto: ultimo.bruto };
  }

  // 8. SÓ AGORA a linha nasce — e nasce `ready` (regra 3)
  await deps.db.inserir("video_clones", {
    id: plano.cloneId,
    user_id: plano.aluno.id,
    name: plano.nome,
    image_path: plano.imagemFinalChave,
    audio_path: plano.audioChave,
    duration_seconds: Math.round(plano.duracao * 100) / 100,
    num_frames: numFrames,
    tier: plano.tier.id,
    credits_cost: 0,
    status: "ready",
    runpod_job_id: jobId,
    video_path: plano.s3Key,
  });

  const url = await deps.r2.urlGet(deps.buckets.worker, plano.s3Key, 7 * 24 * 3600);
  return { ok: true, jobId, decorridoMin, bytes: head.ContentLength, cloneId: plano.cloneId, url };
}

/* ═══════════════════════════ MAIN ═════════════════════════════════════════ */

function pastaDeSaidaPadrao() {
  return path.join(require("node:os").homedir(), ".cache", "frank-saida", "video-clone-conta-da-casa");
}

async function main(argv) {
  const args = interpretarArgumentos(argv);
  const deps = depsReais();
  const plano = await planejar(deps, args);
  const { log } = deps;

  const saida = path.join(args.saida || pastaDeSaidaPadrao(), plano.cloneId);

  // ── pré-visualização do recorte: SEMPRE, ensaio ou não ─────────────────
  // "me mostre o antes/depois em ARQUIVO, não só em texto".
  const bytesRecortados = plano.recorte
    ? await deps.imagem.recortar(plano.bytesImagem, plano.recorte)
    : null;
  const antes = await deps.imagem.previa(plano.bytesImagem, plano.tier);
  const depois = bytesRecortados ? await deps.imagem.previa(bytesRecortados, plano.tier) : null;
  await deps.arquivo.escrever(path.join(saida, "antes.jpg"), antes);
  if (depois) {
    await deps.arquivo.escrever(path.join(saida, "depois.jpg"), depois);
    await deps.arquivo.escrever(
      path.join(saida, "comparativo.jpg"),
      await deps.imagem.lado_a_lado([antes, depois], plano.tier, ["ANTES (sem recorte)", "DEPOIS (recortado)"]),
    );
  }

  // ── plano ──────────────────────────────────────────────────────────────
  const l = "─".repeat(70);
  log(l);
  log(`VÍDEO CLONE POR CONTA DA CASA — ${plano.tier.label} (${plano.tier.id})`);
  log(l);
  log(`ALUNO   : ${plano.aluno.display_name} <${plano.aluno.email}>`);
  log(`          id ${plano.aluno.id} · acesso até ${plano.aluno.access_until}`);
  log(`ÁUDIO   : ${plano.origemAudio}`);
  log(`          ${plano.audioChave} — ${plano.duracao}s`);
  log(`IMAGEM  : ${plano.origemImagem}`);
  log(`          ${plano.dimensoes.width}x${plano.dimensoes.height} (${plano.dimensoes.format})`);
  if (plano.recorte) {
    const r = plano.recorte;
    log(`RECORTE : ${r.left},${r.top} ${r.width}x${r.height} — proporção ${(r.width / r.height).toFixed(4)} (tier ${(plano.tier.width / plano.tier.height).toFixed(4)})`);
    if (r.fracaoReal != null) log(`          rosto ocupa ${(r.fracaoReal * 100).toFixed(1)}% da altura do quadro`);
    const ganho = plano.dimensoes.width / r.width;
    log(`          ganho de resolução na boca: ${ganho.toFixed(2)}x`);
    for (const aviso of r.limites) log(`          ⚠️  ${aviso}`);
    log(`          vai pro R2 como ${plano.imagemFinalChave} (NÃO sobrescreve a do aluno)`);
  } else {
    log(`RECORTE : NENHUM (sem --rosto/--recorte a foto vai inteira, igual à rota)`);
  }
  log(`FRAMES  : ${plano.numFrames}  (fluxo ${plano.tier.flow}, ${CLONE_FPS} fps)`);
  log(`CUSTO   : ${plano.custoNaoCobrado.toLocaleString("pt-BR")} cr — NÃO SERÁ COBRADO (conta da casa)`);
  log(`TETOS   : RunPod ${Math.round(plano.tetoRunpodMs / 60000)}min · nosso ${Math.round(plano.tetoNossoMs / 60000)}min`);
  log(`SAÍDA   : ${deps.buckets.worker}/${plano.s3Key}`);
  log(`LINHA   : video_clones id ${plano.cloneId} — credits_cost=0, status='ready',`);
  log(`          name="${plano.nome}" — criada SÓ depois do MP4 provado no R2`);
  log(l);
  log(`CONFERÊNCIA DO RECORTE (abra estes arquivos):`);
  log(`  ${path.join(saida, "antes.jpg")}`);
  if (depois) {
    log(`  ${path.join(saida, "depois.jpg")}`);
    log(`  ${path.join(saida, "comparativo.jpg")}   <- antes | depois, lado a lado`);
  }
  log(l);

  if (!args.confirmar) {
    log("");
    log("ENSAIO — nada foi disparado, nada foi gravado no banco nem no R2.");
    log("Os arquivos acima são a única coisa que foi escrita, e só no disco local.");
    log("Confira o recorte e, se estiver bom, rode de novo com --confirmar.");
    return 0;
  }

  log("");
  log("--confirmar: DISPARANDO de verdade.");
  const r = await executar(deps, plano, { bytesRecortados });

  if (r.ok) {
    log("");
    log(`ENTREGUE — job ${r.jobId} em ${r.decorridoMin}min, MP4 de ${(r.bytes / 1048576).toFixed(2)} MB.`);
    log(`clone ${r.cloneId} criado para ${plano.aluno.email} (credits_cost=0, sem débito).`);
    log("");
    log(`link (7 dias): ${r.url}`);
    return 0;
  }

  console.error("");
  if (r.motivo === "sem_resposta") {
    console.error(`NÃO ENTREGUE — sem resposta em ${Math.round(plano.tetoNossoMs / 60000)}min (job ${r.jobId}, último status ${r.ultimoStatus}).`);
    console.error(r.cancelado ? "Job cancelado no RunPod pra não queimar GPU." : "NÃO consegui cancelar o job — confira no painel do RunPod.");
    console.error("Nenhuma linha foi criada. Nada foi cobrado. Dá pra rodar de novo.");
  } else if (r.motivo === "job_falhou") {
    console.error(`NÃO ENTREGUE — job ${r.jobId} ${r.status} em ${r.decorridoMin}min.`);
    console.error("");
    console.error("raw_error COMPLETO (sem truncar):");
    console.error(r.rawError);
    console.error("");
    console.error("resposta crua do RunPod:");
    console.error(JSON.stringify(r.bruto, null, 2));
  } else {
    console.error(`NÃO ENTREGUE — job ${r.jobId} disse COMPLETED em ${r.decorridoMin}min, mas o MP4 não está no R2.`);
    console.error(`Esperava ${deps.buckets.worker}/${r.s3Key}.`);
    console.error("");
    console.error(JSON.stringify(r.bruto, null, 2));
  }
  console.error("");
  console.error("Nenhuma linha em video_clones foi criada (ela só nasce com o MP4 provado).");
  return 1;
}

module.exports = {
  TIERS,
  CLONE_FPS,
  CLONE_MIN_BILLED_SECONDS,
  CLONE_MAX_AUDIO_SECONDS,
  TABELAS_DE_CREDITO,
  custoQueNaoSeraCobrado,
  tetoDeExecucaoMs,
  numeroDeFrames,
  enquadrarCabecaEOmbros,
  conferirRecorteExplicito,
  bucketDaImagem,
  interpretarArgumentos,
  nomeDaLinha,
  ehUuid,
  planejar,
  executar,
  montarWorkflow,
  corpoDoJob,
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error("FALHOU:", e instanceof Error ? e.message : String(e));
      if (process.env.DEBUG) console.error(e instanceof Error ? e.stack : "");
      process.exit(1);
    });
}
