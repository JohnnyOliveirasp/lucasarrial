/**
 * 05/09 — FUMAÇA do Vídeo Clone: dispara UMA geração de ponta a ponta com
 * material DA CASA e responde a única pergunta que importa depois de um
 * deploy: **a ferramenta está de pé AGORA?**
 *
 * ── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
 * Em 05/09 o Vídeo Clone ficou ~12h fora do ar e a casa só descobriu quando um
 * ALUNO PAGANTE tentou e falhou. Nove alunos serviram de cobaia. A panne teve
 * duas causas em sequência, e a segunda foi introduzida pelo conserto da
 * primeira:
 *   (a) o wav2vec sumia porque era baixado pra diretório efêmero do container
 *       (PR #190 consertou com symlink pro volume);
 *   (b) o rebuild disparado por esse mesmo PR foi o primeiro em um mês e
 *       trouxe transformers 5.16.1 no lugar de 5.14.1, que perdeu
 *       `output_hidden_states` e derrubou o nó 194 (PR #192 pinou).
 *
 * A lição, e o motivo desta ferramenta existir: **"build verde" e "deploy
 * feito" NÃO significam "funciona"**. Os dois deploys de 05/09 (d1ce203d
 * 17:47Z e 82a9b91e 23:15Z) terminaram VERDES com a ferramenta quebrada,
 * porque o workflow só empurra a imagem e recicla os workers — ninguém
 * gera nada. Só GERAÇÃO REAL prova. É o que este script faz.
 *
 * O nó 194 (`MultiTalkWav2VecEmbeds`) — exatamente o que quebrou hoje — está
 * no caminho crítico desta fumaça. Se ele voltar a cair, isto acusa.
 *
 * ── O QUE ELE NÃO FAZ (de propósito) ──────────────────────────────────────
 * NÃO COBRA NINGUÉM: não chama `debitCredits`. O custo é CALCULADO e IMPRESSO
 * (mesma conta da rota, `cloneCreditsCost`), nunca debitado — igual ao padrão
 * do `refazer_audio_conta_da_casa.cjs`.
 *
 * NÃO CRIA LINHA em `video_clones`. Isto é uma diferença DELIBERADA em relação
 * à rota, e vale entender o porquê:
 *   1. requisito "não poluir o histórico do aluno nem o painel" — linha
 *      nenhuma é a única forma de garantir isso de verdade;
 *   2. sem linha não existe `handleTechFailure` → não dispara e-mail de
 *      incidente pro suporte a cada fumaça;
 *   3. e principalmente: evita a REGRA 8 do `refazer_audio_conta_da_casa.cjs`
 *      — quando o job FALHA, o estorno automático credita o valor MESMO sem
 *      ter havido débito. Uma fumaça que roda de hora em hora e falha ficaria
 *      IMPRIMINDO CRÉDITO do nada. Por isso também **não passamos `webhook`**
 *      no job: o webhook de generation é quem chama `finalizeVideoClone`.
 * Fazemos o poll nós mesmos e não deixamos rastro no produto.
 *
 * ── USO ───────────────────────────────────────────────────────────────────
 *   node _frank/ferramentas/fumaca_video_clone.cjs                # tier padrão
 *   node _frank/ferramentas/fumaca_video_clone.cjs --tier 480p-v2 # Turbo
 *   node _frank/ferramentas/fumaca_video_clone.cjs --minutos 8    # outro teto
 *   node _frank/ferramentas/fumaca_video_clone.cjs --json         # pra cron/CI
 *   node _frank/ferramentas/fumaca_video_clone.cjs --manter       # não apaga o MP4
 *   node _frank/ferramentas/fumaca_video_clone.cjs --publicar-material
 *
 * Saída: "VIDEO CLONE DE PE (job X ready em Ys)" ou "VIDEO CLONE QUEBRADO"
 * seguido do raw_error COMPLETO, sem truncar.
 * Exit code 0 = passou · 1 = falhou/sem resposta. Serve em cron e em passo
 * final de deploy.
 */
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { supa, r2, s3, BUCKETS, RAIZ } = require("./_comum.cjs");

/* ────────────────────────── material da casa ────────────────────────────── */

/**
 * Entrada FIXA e VERSIONADA da fumaça. Os bytes moram no R2 (o repo é
 * PÚBLICO — nada de rosto de pessoa real versionado em git), e o que fica
 * versionado AQUI é o contrato: a chave exata + o sha256 esperado. Se alguém
 * trocar o objeto no R2, a fumaça acusa em vez de virar outro teste em
 * silêncio.
 *
 * O material é SINTÉTICO e da casa: rosto gerado por IA (não é aluno, não é
 * pessoa real) e voz de TTS lendo uma frase neutra. Recriável do zero pelo
 * `_frank/fixtures/fumaca-video-clone/GERAR.md`.
 */
const MATERIAL = {
  foto: {
    chave: "_casa/fumaca-video-clone/v1/foto.jpg",
    sha256: null, // preenchido por --publicar-material; ver MANIFESTO
  },
  audio: {
    chave: "_casa/fumaca-video-clone/v1/audio.wav",
    sha256: null,
  },
  /** Duração do áudio da casa, em segundos. Fixa: material fixo, custo fixo. */
  duracaoSegundos: null,
};

const MANIFESTO = path.join(RAIZ, "_frank", "fixtures", "fumaca-video-clone", "manifesto.json");
const FIXTURES_DIR = path.join(RAIZ, "_frank", "fixtures", "fumaca-video-clone");

function carregarManifesto() {
  if (!fs.existsSync(MANIFESTO)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFESTO, "utf8"));
  } catch (e) {
    throw new Error(`manifesto ilegível (${MANIFESTO}): ${e.message}`);
  }
}

/* ─────────────────────────── config (espelha o app) ─────────────────────── */

/**
 * Espelho dos tiers de `frontend/src/lib/video-clone/config.ts`. Duplicado
 * aqui porque aquilo é TypeScript e isto é CJS — se o tier mudar lá, mudar
 * aqui. O teste `fumaca_video_clone.test.cjs` compara os dois e falha se
 * divergirem, pra ninguém descobrir a defasagem em produção.
 */
const TIERS = {
  "480p-v3": { id: "480p-v3", label: "Padrão 2.0", flow: "v3", creditsPerSecond: 105, width: 480, height: 832 },
  "480p-v2": { id: "480p-v2", label: "Turbo", flow: "v2", creditsPerSecond: 80, width: 480, height: 832 },
};
const CLONE_FPS = 25;
const CLONE_MIN_BILLED_SECONDS = 5;
const CLONE_MAX_AUDIO_SECONDS = 90;

/** Espelha `cloneCreditsCost` — CALCULADO pra imprimir, NUNCA debitado. */
function creditosCusto(tier, segundos) {
  return Math.max(CLONE_MIN_BILLED_SECONDS, Math.ceil(segundos)) * tier.creditsPerSecond;
}

/** Espelha `cloneExecutionTimeoutMs` — teto do job DENTRO do RunPod. */
function execTimeoutMs(tier, segundos) {
  const billed = Math.max(CLONE_MIN_BILLED_SECONDS, Math.ceil(segundos));
  const perAudioSecond = tier.flow === "v1" ? 60 : 30;
  return (20 * 60 + billed * perAudioSecond) * 1000;
}

/** Espelha `buildInfiniteTalkWorkflow` (só os fluxos v2/v3, os que existem). */
function montarWorkflow({ imageUrl, audioUrl, s3Key, tier, duracaoSegundos }) {
  const tpl = (nome) => JSON.parse(JSON.stringify(require(path.join(RAIZ, "frontend", "src", "lib", "video-clone", nome))));
  if (tier.flow === "v3") {
    const wf = tpl("infinitetalk-v3-template.json");
    const numFrames = Math.floor(duracaoSegundos) * CLONE_FPS + CLONE_FPS;
    wf["133"].inputs.url = imageUrl;
    wf["125"].inputs.url = audioUrl;
    wf["900"].inputs.s3_key = s3Key;
    wf["194"].inputs.num_frames = numFrames;
    return { workflow: wf, numFrames };
  }
  const wf = tpl("infinitetalk-v2-template.json");
  const numFrames = Math.max(50, Math.ceil(duracaoSegundos * CLONE_FPS) + 25);
  wf["133"].inputs.url = imageUrl;
  wf["125"].inputs.url = audioUrl;
  wf["900"].inputs.s3_key = s3Key;
  wf["171"].inputs.width = tier.width;
  wf["171"].inputs.height = tier.height;
  wf["194"].inputs.num_frames = numFrames;
  // Seed FIXA na fumaça (a rota sorteia). Fumaça é medição: mesma entrada,
  // mesmo caminho de código, todo dia.
  wf["128"].inputs.seed = 20260905;
  return { workflow: wf, numFrames };
}

/* ─────────────────────────────── RunPod ─────────────────────────────────── */

const RUNPOD_BASE = "https://api.runpod.ai/v2";

function runpodCreds() {
  const key = process.env.RUNPOD_API_KEY;
  const endpoint = process.env.RUNPOD_ENDPOINT_INFINITETALK_ID;
  if (!key) throw new Error("RUNPOD_API_KEY ausente no frontend/.env.local");
  if (!endpoint) throw new Error("RUNPOD_ENDPOINT_INFINITETALK_ID ausente no frontend/.env.local");
  return { key, endpoint };
}

async function dispararJob(workflow, executionTimeoutMs) {
  const { key, endpoint } = runpodCreds();
  // SEM `webhook` de propósito — ver cabeçalho: o webhook de generation chama
  // finalizeVideoClone, que estorna. Fumaça não pode imprimir crédito.
  const body = { input: { workflow }, policy: { executionTimeout: executionTimeoutMs } };
  const res = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RunPod run ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const json = await res.json();
  if (!json.id) throw new Error(`RunPod run sem job id: ${JSON.stringify(json)}`);
  return json.id;
}

/**
 * Status do job. Ao contrário de `getInfiniteTalkStatus`, NÃO trunca nada: o
 * requisito da fumaça é justamente o raw_error COMPLETO — foi a falta dele
 * que deixou 13 de 14 falhas de hoje sem o nó identificado.
 */
async function statusJob(jobId) {
  const { key, endpoint } = runpodCreds();
  const res = await fetch(`${RUNPOD_BASE}/${endpoint}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RunPod status ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return {
    status: json.status ?? "IN_QUEUE",
    executionTimeMs: typeof json.executionTime === "number" ? json.executionTime : null,
    delayTimeMs: typeof json.delayTime === "number" ? json.delayTime : null,
    /** Erro CRU e INTEIRO, com o `output.details` do ComfyUI junto. */
    rawError: (() => {
      const partes = [];
      if (json.error) partes.push(typeof json.error === "string" ? json.error : JSON.stringify(json.error));
      const det = json.output && json.output.details;
      if (Array.isArray(det)) partes.push(det.join("\n"));
      else if (det) partes.push(typeof det === "string" ? det : JSON.stringify(det));
      if (json.output && json.output.error) {
        partes.push(typeof json.output.error === "string" ? json.output.error : JSON.stringify(json.output.error));
      }
      return partes.length ? partes.join("\n") : null;
    })(),
    bruto: json,
  };
}

async function cancelarJob(jobId) {
  try {
    const { key, endpoint } = runpodCreds();
    await fetch(`${RUNPOD_BASE}/${endpoint}/cancel/${jobId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────────── R2 ───────────────────────────────────── */

const { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } = s3;
const { getSignedUrl } = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "s3-request-presigner"));

const bucketEntradas = () => BUCKETS.geracoes();
/** Onde o worker GRAVA o MP4 (não é o de generations — ver _comum.cjs). */
const bucketSaida = () => BUCKETS.worker();

function urlGet(bucket, key, segundos) {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: segundos });
}

async function baixar(bucket, key) {
  const out = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const c of out.Body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function cabecalho(bucket, key) {
  try {
    return await r2().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    return null;
  }
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/* ───────────────────────── publicar material (setup) ───────────────────── */

/**
 * `--publicar-material`: sobe os arquivos locais de
 * `_frank/fixtures/fumaca-video-clone/` pras chaves FIXAS do R2 e grava o
 * manifesto com o sha256 + a duração medida. Roda UMA vez (ou quando o
 * material mudar de versão de propósito).
 */
async function publicarMaterial() {
  const foto = path.join(FIXTURES_DIR, "foto.jpg");
  const audio = path.join(FIXTURES_DIR, "audio.wav");
  const faltando = [foto, audio].filter((p) => !fs.existsSync(p));
  if (faltando.length) {
    console.error("Material da casa não encontrado localmente:");
    for (const f of faltando) console.error(`  faltando: ${f}`);
    console.error(`\nComo produzir: veja ${path.join(FIXTURES_DIR, "GERAR.md")}`);
    return 1;
  }
  const bFoto = fs.readFileSync(foto);
  const bAudio = fs.readFileSync(audio);
  const duracao = medirDuracaoWav(bAudio);
  if (!(duracao > 0)) throw new Error("não consegui medir a duração do audio.wav (header WAV inválido?)");
  if (duracao > CLONE_MAX_AUDIO_SECONDS) throw new Error(`audio da casa tem ${duracao}s — o teto é ${CLONE_MAX_AUDIO_SECONDS}s`);

  const cli = r2();
  await cli.send(new PutObjectCommand({ Bucket: bucketEntradas(), Key: MATERIAL.foto.chave, Body: bFoto, ContentType: "image/jpeg" }));
  await cli.send(new PutObjectCommand({ Bucket: bucketEntradas(), Key: MATERIAL.audio.chave, Body: bAudio, ContentType: "audio/wav" }));

  const manifesto = {
    _comentario:
      "Contrato da entrada FIXA da fumaça do Vídeo Clone. Os bytes moram no R2 (repo é público); " +
      "aqui fica a chave + o sha256, pra fumaça acusar se o material for trocado. Gerado por --publicar-material.",
    bucket: bucketEntradas(),
    foto: { chave: MATERIAL.foto.chave, sha256: sha256(bFoto), bytes: bFoto.length },
    audio: { chave: MATERIAL.audio.chave, sha256: sha256(bAudio), bytes: bAudio.length, duracaoSegundos: duracao },
  };
  fs.writeFileSync(MANIFESTO, `${JSON.stringify(manifesto, null, 2)}\n`);
  console.log("Material da casa publicado:");
  console.log(`  foto  ${MATERIAL.foto.chave}  (${bFoto.length} bytes)`);
  console.log(`  audio ${MATERIAL.audio.chave} (${bAudio.length} bytes, ${duracao}s)`);
  console.log(`  manifesto: ${MANIFESTO}`);
  return 0;
}

/**
 * Duração de um WAV PCM pelo header (sem depender de ffprobe instalado).
 *
 * ⚠️ ARMADILHA MEDIDA (05/09, ao criar o material da casa): o WAV que a API de
 * TTS da OpenAI devolve é um WAV de STREAMING — ela escreve o header antes de
 * saber o tamanho e deixa `data` com 0xFFFFFFFF (4.294.967.295) de placeholder.
 * Confiar nesse campo dava **89.478 s** pra um áudio de 6,71 s: a fumaça
 * calcularia num_frames e custo em cima de uma duração ~13.000× maior e
 * mandaria lixo pra GPU sem nunca reclamar.
 *
 * Por isso o tamanho declarado é tratado como PISTA, não como verdade: quando
 * ele é ausente/placeholder/maior do que os bytes que realmente existem no
 * arquivo, vale o que está no arquivo. Confere com ffprobe (6,71 s).
 */
function medirDuracaoWav(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return 0;
  let pos = 12;
  let byteRate = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const declarado = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(pos + 16);
    if (id === "data") {
      if (!(byteRate > 0)) return 0;
      const disponivel = buf.length - (pos + 8);
      const real = declarado === 0 || declarado > disponivel ? disponivel : declarado;
      return Math.round((real / byteRate) * 100) / 100;
    }
    if (declarado === 0 || declarado > buf.length) return 0; // header corrompido
    pos += 8 + declarado + (declarado % 2);
  }
  return 0;
}

/* ──────────────────────────────── main ─────────────────────────────────── */

const argv = process.argv.slice(2);
const temFlag = (f) => argv.includes(f);
const valorFlag = (f, padrao) => {
  const i = argv.indexOf(f);
  return i > -1 && argv[i + 1] ? argv[i + 1] : padrao;
};

const JSON_OUT = temFlag("--json");
const MANTER = temFlag("--manter");
const TIER_ID = valorFlag("--tier", "480p-v3");
const MINUTOS = Number(valorFlag("--minutos", "5"));

const log = (...a) => {
  if (!JSON_OUT) console.log(...a);
};

async function main() {
  if (temFlag("--publicar-material")) return publicarMaterial();

  const tier = TIERS[TIER_ID];
  if (!tier) {
    console.error(`tier inválido: ${TIER_ID} (use ${Object.keys(TIERS).join(" ou ")})`);
    return 1;
  }
  if (!Number.isFinite(MINUTOS) || MINUTOS <= 0) {
    console.error(`--minutos inválido: ${valorFlag("--minutos", "5")}`);
    return 1;
  }

  // ── material da casa ────────────────────────────────────────────────────
  const manifesto = carregarManifesto();
  if (!manifesto) {
    console.error("VIDEO CLONE — FUMAÇA NÃO RODOU: falta o material da casa.");
    console.error("");
    console.error("Esta ferramenta NÃO usa arquivo de aluno, por princípio. Ela precisa de");
    console.error("uma foto e um áudio curto (5-10s) SINTÉTICOS, da casa, fixos e versionados.");
    console.error("");
    console.error("Onde guardar:");
    console.error(`  ${path.join(FIXTURES_DIR, "foto.jpg")}   (rosto frontal, gerado por IA)`);
    console.error(`  ${path.join(FIXTURES_DIR, "audio.wav")}  (TTS, 5-10s, frase neutra)`);
    console.error("Depois rode:");
    console.error("  node _frank/ferramentas/fumaca_video_clone.cjs --publicar-material");
    console.error(`Isso sobe pro R2 (${MATERIAL.foto.chave} / ${MATERIAL.audio.chave})`);
    console.error(`e grava o manifesto com sha256 em ${MANIFESTO}.`);
    console.error(`Como produzir o material: ${path.join(FIXTURES_DIR, "GERAR.md")}`);
    return 1;
  }

  const duracao = manifesto.audio.duracaoSegundos;
  const custo = creditosCusto(tier, duracao);
  log("─────────────────────────────────────────────────────────────");
  log(`FUMAÇA DO VÍDEO CLONE — ${tier.label} (${tier.id})`);
  log(`material da casa: ${manifesto.foto.chave} + ${manifesto.audio.chave} (${duracao}s)`);
  log(`custo se fosse aluno: ${custo} créditos — CONTA DA CASA, não debitado de ninguém`);
  log(`teto desta medição: ${MINUTOS} min`);
  log("─────────────────────────────────────────────────────────────");

  // Integridade: o material é o MESMO que foi versionado?
  const bucketIn = manifesto.bucket || bucketEntradas();
  for (const [nome, meta] of [["foto", manifesto.foto], ["audio", manifesto.audio]]) {
    const head = await cabecalho(bucketIn, meta.chave);
    if (!head) {
      console.error(`VIDEO CLONE — FUMAÇA NÃO RODOU: ${nome} da casa sumiu do R2 (${bucketIn}/${meta.chave}).`);
      console.error("Republique com: node _frank/ferramentas/fumaca_video_clone.cjs --publicar-material");
      return 1;
    }
    const bytes = await baixar(bucketIn, meta.chave);
    const hash = sha256(bytes);
    if (hash !== meta.sha256) {
      console.error(`VIDEO CLONE — FUMAÇA NÃO RODOU: ${nome} da casa foi TROCADO no R2.`);
      console.error(`  esperado (manifesto): ${meta.sha256}`);
      console.error(`  encontrado no R2:     ${hash}`);
      console.error("A fumaça só vale se a entrada for sempre a mesma. Republique ou atualize o manifesto.");
      return 1;
    }
  }
  log("material conferido (sha256 bate com o manifesto).");

  // ── monta e dispara ─────────────────────────────────────────────────────
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const s3Key = `_casa/fumaca-video-clone/saida/${carimbo}-${tier.id}.mp4`;
  const [imageUrl, audioUrl] = await Promise.all([
    urlGet(bucketIn, manifesto.foto.chave, 7200),
    urlGet(bucketIn, manifesto.audio.chave, 7200),
  ]);
  const { workflow, numFrames } = montarWorkflow({ imageUrl, audioUrl, s3Key, tier, duracaoSegundos: duracao });
  const tetoJob = execTimeoutMs(tier, duracao);

  const t0 = Date.now();
  let jobId;
  try {
    jobId = await dispararJob(workflow, tetoJob);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (JSON_OUT) console.log(JSON.stringify({ ok: false, motivo: "run_falhou", erro: msg }));
    console.error("VIDEO CLONE QUEBRADO — nem consegui enfileirar o job no RunPod.");
    console.error("");
    console.error("raw_error COMPLETO:");
    console.error(msg);
    return 1;
  }
  log(`job ${jobId} enfileirado (${numFrames} frames, teto do job ${Math.round(tetoJob / 60000)}min).`);

  // ── poll com prazo PRÓPRIO (nunca laço infinito) ────────────────────────
  const prazo = t0 + MINUTOS * 60 * 1000;
  let ultimo = null;
  let visto = "";
  while (Date.now() < prazo) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      ultimo = await statusJob(jobId);
    } catch (e) {
      log(`  (status falhou, tentando de novo: ${e instanceof Error ? e.message : e})`);
      continue;
    }
    if (ultimo.status !== visto) {
      visto = ultimo.status;
      log(`  [${Math.round((Date.now() - t0) / 1000)}s] ${ultimo.status}`);
    }
    if (["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(ultimo.status)) break;
  }

  const decorrido = Math.round((Date.now() - t0) / 1000);

  // ── sem resposta no prazo ───────────────────────────────────────────────
  if (!ultimo || !["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(ultimo.status)) {
    // Não deixa GPU rodando às nossas custas depois que já desistimos.
    const cancelado = await cancelarJob(jobId);
    const estado = ultimo ? ultimo.status : "sem status";
    if (JSON_OUT) {
      console.log(JSON.stringify({ ok: false, motivo: "sem_resposta", jobId, segundos: decorrido, ultimoStatus: estado }));
    }
    console.error(`VIDEO CLONE — SEM RESPOSTA EM ${MINUTOS} MIN (job ${jobId}, último status: ${estado}).`);
    console.error(cancelado ? "Job cancelado no RunPod pra não queimar GPU à toa." : "Não consegui cancelar o job — confira no painel do RunPod.");
    console.error("");
    console.error("Isto JÁ É informação: ou a fila está entupida, ou o worker está subindo frio");
    console.error("demais. Não é prova de que a ferramenta quebrou — é prova de que ela não");
    console.error(`respondeu em ${MINUTOS} min. Rode de novo com --minutos maior pra separar os dois casos.`);
    return 1;
  }

  // ── falhou ──────────────────────────────────────────────────────────────
  if (ultimo.status !== "COMPLETED") {
    const raw = ultimo.rawError || `RunPod ${ultimo.status} (sem texto de erro — o job morreu sem reportar)`;
    if (JSON_OUT) {
      console.log(JSON.stringify({ ok: false, motivo: "job_falhou", jobId, status: ultimo.status, segundos: decorrido, rawError: raw }));
    }
    console.error(`VIDEO CLONE QUEBRADO (job ${jobId}, ${ultimo.status} em ${decorrido}s).`);
    console.error("");
    console.error("raw_error COMPLETO (sem truncar):");
    console.error(raw);
    console.error("");
    console.error("resposta crua do RunPod:");
    console.error(JSON.stringify(ultimo.bruto, null, 2));
    await limpar(s3Key);
    return 1;
  }

  // ── "COMPLETED" não basta: o MP4 existe mesmo? ──────────────────────────
  // Esta é a lição de hoje aplicada: status verde não é prova. Só arquivo é.
  const head = await cabecalho(bucketSaida(), s3Key);
  if (!head || !(head.ContentLength > 0)) {
    if (JSON_OUT) {
      console.log(JSON.stringify({ ok: false, motivo: "sem_arquivo", jobId, segundos: decorrido, s3Key }));
    }
    console.error(`VIDEO CLONE QUEBRADO (job ${jobId} disse COMPLETED em ${decorrido}s, mas não gravou o MP4).`);
    console.error(`Esperava ${bucketSaida()}/${s3Key} — não existe ou está vazio.`);
    console.error("");
    console.error("resposta crua do RunPod:");
    console.error(JSON.stringify(ultimo.bruto, null, 2));
    return 1;
  }

  const mb = (head.ContentLength / 1048576).toFixed(2);
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: true, jobId, segundos: decorrido, bytes: head.ContentLength, creditosNaoCobrados: custo }));
  }
  log("");
  log(`VIDEO CLONE DE PE (job ${jobId} ready em ${decorrido}s, MP4 de ${mb} MB)`);
  log(`custo NÃO cobrado de ninguém: ${custo} créditos (conta da casa)`);
  if (ultimo.delayTimeMs != null) log(`fila/cold start: ${Math.round(ultimo.delayTimeMs / 1000)}s · execução: ${Math.round((ultimo.executionTimeMs ?? 0) / 1000)}s`);
  await limpar(s3Key);
  return 0;
}

/** Limpa atrás de si: o MP4 de teste não fica acumulando no bucket. */
async function limpar(s3Key) {
  if (MANTER) {
    log(`(--manter) MP4 preservado em ${bucketSaida()}/${s3Key}`);
    return;
  }
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: bucketSaida(), Key: s3Key }));
  } catch {
    /* melhor-esforço: um MP4 órfão de 2MB não justifica falhar a fumaça */
  }
}

/* As funções puras são exportadas pro teste (fumaca_video_clone.test.cjs).
 * O `require.main` garante que importar o módulo NÃO dispare uma geração. */
module.exports = { TIERS, CLONE_FPS, creditosCusto, execTimeoutMs, montarWorkflow, medirDuracaoWav };

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error("VIDEO CLONE — FUMAÇA ESTOUROU (erro na própria ferramenta, não conclui nada sobre produção):");
      console.error(e instanceof Error ? e.stack : String(e));
      process.exit(1);
    });
}
