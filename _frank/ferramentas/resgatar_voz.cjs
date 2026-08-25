// --teste (24/08): manda o job pro endpoint ISOLADO de teste (imagem da dev),
// nunca pra producao. Setado ANTES do dotenv (dotenv nao sobrescreve env ja
// definida). Ver memoria project-runpod-endpoint-teste-dev.
if (process.argv.includes("--teste")) {
  process.env.RUNPOD_ENDPOINT_TRAIN_ID = "vtfxcwcb0ohvdn";
  process.env.RUNPOD_ENDPOINT_INFERENCE_ID = "vtfxcwcb0ohvdn";
  console.log("⚠️  MODO TESTE: endpoint vtfxcwcb0ohvdn (fast_cloner_TESTE_dev)");
}
/**
 * 18/08 — RESGATE de voz parada em "uploading" com áudio JÁ no R2.
 * 24/08 — + resgate de voz em "failed" (treino que falhou por culpa NOSSA):
 *          a fonte vira raw_audio_paths REFILTRADO pra só arquivo de áudio de
 *          verdade (o onboarding pode ter varrido o Drive e mandado jpeg/mp4/
 *          pdf como se fosse áudio — caso Claudio 8aca0126). Reescrito em cima
 *          da main (o 1340f5c da branch stale é só referência).
 * Réplica do POST /api/v1/voices/[id]/start-training (mesma receita:
 * max_steps 500, webhook de produção, timeout por duração) + o passo que
 * faltou (uploads-complete: raw_audio_paths/duration/status).
 *
 * NÃO COBRA (ordem do Johnny 18/08: "destes alunos que deram erro você não
 * vai cobrar, pelo contrário vai estornar") — o travamento foi culpa nossa,
 * então o treino do resgate é por conta da casa.
 * ⚠️ Efeito colateral conhecido: se o treino FALHAR, o estorno automático do
 * finalize-training credita 10.000 que não foram cobrados. Como a ordem é
 * compensar o aluno, fica assim de propósito.
 *
 * 25/08 — + GATE MULTI-LOCUTOR (incidente 5c3f1f8b/#65): o resgate da voz
 *          f6f82819 treinou em cima de uma ENTREVISTA (duas pessoas) que já
 *          estava vetada, e o clone saiu com a voz da entrevistadora. Agora,
 *          ANTES de disparar GPU, a referência é medida por F0 (autocorrelação,
 *          mesma técnica de frontend/_Bugs/marcelo_pitch/medir_f0.cjs): se a
 *          distribuição indicar mais de um locutor, o resgate é RECUSADO.
 *          Corte calibrado na varredura de 25/08 (60 vozes ready): IQR máximo
 *          das limpas foi 82Hz; a do Marcelo tem 152Hz. O corte em 100Hz cai
 *          no vazio entre as duas populações.
 *
 * Uso (de dentro de frontend/):
 *   node _Bugs/fast_emails_18-08/resgatar_voz.cjs <voiceId>            # simula
 *   node _Bugs/fast_emails_18-08/resgatar_voz.cjs <voiceId> --confirmar # executa
 *   node _Bugs/fast_emails_18-08/resgatar_voz.cjs <voiceId> --so-gate  # SÓ mede
 *       o gate multi-locutor (qualquer status) e sai; não resgata nada
 *   flag --ignorar-locutor: um HUMANO força passar por cima da recusa do gate
 */
const path_ = require("node:path");
const os_ = require("node:os");
const fs_ = require("node:fs");
const RAIZ_ = path_.resolve(__dirname, "..", "..");
require(path_.join(RAIZ_, "frontend", "node_modules", "dotenv")).config({ path: path_.join(RAIZ_, "frontend", ".env.local") });
const { createClient } = require(path_.join(RAIZ_, "frontend", "node_modules", "@supabase/supabase-js"));
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require(path_.join(RAIZ_, "frontend", "node_modules", "@aws-sdk/client-s3"));
const { getSignedUrl } = require(path_.join(RAIZ_, "frontend", "node_modules", "@aws-sdk/s3-request-presigner"));
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);

const VOICE_ID = process.argv[2];
const CONFIRMAR = process.argv.includes("--confirmar");
const SO_GATE = process.argv.includes("--so-gate");
const IGNORAR_LOCUTOR = process.argv.includes("--ignorar-locutor");
if (!VOICE_ID) {
  console.error("uso: node resgatar_voz.cjs <voiceId> [--confirmar] [--so-gate] [--ignorar-locutor]");
  process.exit(1);
}

const SITE = "https://fastcloner.com"; // webhook de PRODUÇÃO (local é localhost)
const TRAIN_EXPIRES = 2 * 60 * 60;
const MAX_STEPS = 500;
const CUSTO_TREINO = 10000;

/** Modo "failed": só extensão que É áudio. De propósito MAIS ESTRITO que o
 *  filtro do modo uploading (que aceita webm/mp4 porque gravador de celular
 *  salva AAC em .mp4): no failed a lista veio de varredura cega do Drive,
 *  então vídeo NÃO é prova da voz do aluno. Se um dia um mp4 for áudio
 *  legítimo, a decisão de incluir é humana, não do filtro. */
const EXT_AUDIO = /\.(mp3|m4a|wav|aac|ogg|flac)$/i;
/** Espelha o mínimo de fala útil do runpod-worker (10 min). Abaixo disso a
 *  reprovação do worker é matemática — nem adianta disparar. */
const MIN_WORKER = 10 * 60;
/** Porta de upload da produção (20 min BRUTOS). Entre 10 e 20 min o worker
 *  ainda pode aprovar (ele mede fala útil) — então no failed só avisa. */
const MIN_UPLOAD = 20 * 60;

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const B_VOICES = process.env.R2_BUCKET_VOICES;
const B_GEN = process.env.R2_BUCKET_GENERATIONS;

const getUrl = (bucket, key, exp = TRAIN_EXPIRES) =>
  getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: exp });
const putUrl = (bucket, key, type) =>
  getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type }), {
    expiresIn: TRAIN_EXPIRES,
  });

async function probe(alvo) {
  const { stdout } = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", alvo],
    { timeout: 120000 },
  );
  const d = Number(String(stdout).trim());
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/**
 * Duração do áudio.
 *
 * 22/08 — POR QUE ISTO BAIXA O ARQUIVO EM VEZ DE SÓ SONDAR A URL:
 * o ffprobe desta máquina dá SEGMENTATION FAULT (exit 139) ao abrir URL https.
 * A versão anterior chamava `ffprobe <url>` dentro de um try/catch que devolvia
 * 0 no catch — ou seja, engolia o segfault EM SILÊNCIO e toda voz reprovava no
 * "só 0.0 min — mínimo 20", independentemente do áudio. A ferramenta parecia
 * recusar o áudio do aluno quando na verdade era o nosso probe que morria.
 * Agora: tenta a URL; se vier 0, BAIXA pro /tmp e mede local (que funciona);
 * e qualquer falha é IMPRESSA, nunca engolida.
 */
async function duracao(url) {
  try {
    const d = await probe(url);
    if (d > 0) return d;
    console.log("   (probe pela URL devolveu 0 — vou baixar e medir local)");
  } catch (e) {
    console.log(`   (probe pela URL falhou: ${String(e.message).slice(0, 80)} — baixando)`);
  }
  const tmp = path_.join(os_.tmpdir(), `dur_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.log(`   ❌ download para medir falhou: HTTP ${resp.status}`);
      return 0;
    }
    fs_.writeFileSync(tmp, Buffer.from(await resp.arrayBuffer()));
    const d = await probe(tmp);
    if (d === 0) console.log("   ❌ ffprobe local também não achou duração — arquivo pode não ser áudio");
    return d;
  } catch (e) {
    console.log(`   ❌ medição local falhou: ${String(e.message).slice(0, 100)}`);
    return 0;
  } finally {
    try { fs_.unlinkSync(tmp); } catch {}
  }
}

/* ============================== GATE MULTI-LOCUTOR ==============================
 * F0 por autocorrelação — porte fiel de frontend/_Bugs/marcelo_pitch/medir_f0.cjs
 * e varrer_refs.cjs (mesmos parâmetros: janela 40ms, salto 20ms, 70-300Hz,
 * RMS>0.01, periodicidade>0.35). Só ffmpeg local, sem dependência nova.
 * Critério de recusa (medido na varredura de 25/08, não é chute):
 *   IQR do F0 > 100Hz  E  cada lado do corte de 160Hz com > 20% das janelas.
 * Menos de 40 janelas vozeadas = INCONCLUSIVO → recusa também (não medir não é
 * o mesmo que estar limpo).
 * ============================================================================= */
const GATE_MAX_SEG = 240;      // ~4 min bastam pra caracterizar a distribuição
const GATE_IQR_HZ = 100;       // vazio medido entre limpas (máx 82Hz) e mista (152Hz)
const GATE_CORTE_HZ = 160;     // fronteira masculino/feminino
const GATE_LADO_MIN = 0.2;     // cada lado com >20% = dois locutores
const GATE_MIN_JANELAS = 40;   // abaixo disso a estatística não vale nada

const GATE_SR = 16000;

/** Extrai a série de F0 (Hz) das janelas vozeadas de um arquivo local. */
async function extrairF0(arquivo, maxSeg) {
  const tmp = path_.join(os_.tmpdir(), `f0_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.raw`);
  try {
    await run("ffmpeg", [
      "-v", "error", "-i", arquivo, "-t", String(maxSeg),
      "-ac", "1", "-ar", String(GATE_SR), "-f", "s16le", "-acodec", "pcm_s16le", tmp,
    ], { timeout: 300000 });
    const buf = fs_.readFileSync(tmp);
    const n = Math.floor(buf.length / 2);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
    const JAN = Math.round(0.04 * GATE_SR);
    const SALTO = Math.round(0.02 * GATE_SR);
    const LAG_MIN = Math.floor(GATE_SR / 300);
    const LAG_MAX = Math.floor(GATE_SR / 70);
    const f0s = [];
    for (let ini = 0; ini + JAN < n; ini += SALTO) {
      let energia = 0;
      for (let i = 0; i < JAN; i++) energia += x[ini + i] * x[ini + i];
      if (Math.sqrt(energia / JAN) < 0.01) continue; // silêncio/ruído não vota
      let melhorLag = 0, melhorR = 0;
      for (let lag = LAG_MIN; lag <= LAG_MAX; lag++) {
        let r = 0;
        for (let i = 0; i + lag < JAN; i++) r += x[ini + i] * x[ini + i + lag];
        const norm = r / (energia + 1e-9);
        if (norm > melhorR) { melhorR = norm; melhorLag = lag; }
      }
      if (melhorR > 0.35 && melhorLag > 0) f0s.push(GATE_SR / melhorLag);
    }
    return { f0s, segAnalisados: n / GATE_SR };
  } finally {
    try { fs_.unlinkSync(tmp); } catch {}
  }
}

/** Baixa um objeto do R2 pro /tmp (ffmpeg/ffprobe daqui segfaulta em URL https). */
async function baixarTmp(bucket, key) {
  const url = await getUrl(bucket, key);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download de ${key} falhou: HTTP ${resp.status}`);
  const tmp = path_.join(os_.tmpdir(), `gate_${Date.now()}_${Math.random().toString(36).slice(2)}${path_.extname(key) || ".bin"}`);
  fs_.writeFileSync(tmp, Buffer.from(await resp.arrayBuffer()));
  return tmp;
}

async function existeR2(bucket, key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Chaves de áudio bruto (/raw/) da voz, pro fallback quando não há ref/auto.wav. */
async function chavesRawDaVoz(voz) {
  const brutos = Array.isArray(voz.raw_audio_paths) ? voz.raw_audio_paths.filter((k) => EXT_AUDIO.test(k)) : [];
  if (brutos.length > 0) return brutos;
  const lista = await r2.send(
    new ListObjectsV2Command({ Bucket: B_VOICES, Prefix: `${voz.user_id}/${voz.id}/` }),
  );
  return (lista.Contents ?? [])
    .filter((o) => o.Size > 10000 && /\/raw\/[^/]+\.(mp3|wav|m4a|aac|ogg|webm|mp4|flac)$/i.test(o.Key))
    .map((o) => o.Key)
    .sort();
}

/**
 * Mede a referência e devolve o veredito. NÃO toca no banco, NÃO dispara job.
 * @returns {Promise<{recusar: boolean, motivo: string}>}
 */
async function gateMultiLocutor(voz) {
  console.log("\n— gate multi-locutor (F0 por autocorrelação) —");
  const refKey = `${voz.user_id}/${voz.id}/ref/auto.wav`;
  let f0s = [];
  if (await existeR2(B_VOICES, refKey)) {
    console.log(`fonte: ref/auto.wav (a referência que o treino usaria)`);
    const tmp = await baixarTmp(B_VOICES, refKey);
    try {
      ({ f0s } = await extrairF0(tmp, GATE_MAX_SEG));
    } finally {
      try { fs_.unlinkSync(tmp); } catch {}
    }
  } else {
    console.log(`fonte: sem ref/auto.wav — medindo os primeiros ~${GATE_MAX_SEG}s do áudio bruto (/raw/)`);
    const raws = await chavesRawDaVoz(voz);
    if (raws.length === 0) {
      return { recusar: true, motivo: "INCONCLUSIVO: nenhum áudio encontrado pra medir (sem ref/auto.wav e sem /raw/)" };
    }
    let restam = GATE_MAX_SEG;
    for (const k of raws) {
      if (restam <= 1) break;
      const tmp = await baixarTmp(B_VOICES, k);
      try {
        const r = await extrairF0(tmp, restam);
        f0s.push(...r.f0s);
        restam -= r.segAnalisados;
        console.log(`  medido: ${path_.basename(k)} (${r.f0s.length} janelas vozeadas)`);
      } catch (e) {
        console.log(`  (não deu pra medir ${path_.basename(k)}: ${String(e.message).slice(0, 80)})`);
      } finally {
        try { fs_.unlinkSync(tmp); } catch {}
      }
    }
  }

  if (f0s.length < GATE_MIN_JANELAS) {
    console.log(`janelas vozeadas: ${f0s.length} (mínimo pra concluir: ${GATE_MIN_JANELAS})`);
    return { recusar: true, motivo: `INCONCLUSIVO: só ${f0s.length} janelas vozeadas (< ${GATE_MIN_JANELAS}) — não medir não é o mesmo que estar limpo` };
  }

  f0s.sort((a, b) => a - b);
  const q = (p) => f0s[Math.floor(f0s.length * p)];
  const iqr = q(0.75) - q(0.25);
  const baixo = f0s.filter((f) => f < GATE_CORTE_HZ).length / f0s.length;
  const alto = 1 - baixo;
  console.log(`janelas vozeadas: ${f0s.length}`);
  console.log(`F0 mediana: ${q(0.5).toFixed(1)} Hz   p25 ${q(0.25).toFixed(1)} · p75 ${q(0.75).toFixed(1)}   IQR ${iqr.toFixed(1)} Hz`);
  console.log(`abaixo de ${GATE_CORTE_HZ}Hz (faixa masculina): ${(100 * baixo).toFixed(1)}%`);
  console.log(`${GATE_CORTE_HZ}Hz ou mais (faixa feminina):    ${(100 * alto).toFixed(1)}%`);

  const misto = iqr > GATE_IQR_HZ && baixo > GATE_LADO_MIN && alto > GATE_LADO_MIN;
  if (misto) {
    return {
      recusar: true,
      motivo: `MULTI-LOCUTOR: IQR ${iqr.toFixed(1)}Hz > ${GATE_IQR_HZ}Hz e os dois lados do corte de ${GATE_CORTE_HZ}Hz povoados (${(100 * baixo).toFixed(1)}% / ${(100 * alto).toFixed(1)}%, mínimo pra flag: ${100 * GATE_LADO_MIN}%) — treinar nisso produz clone de uma pessoa que não existe`,
    };
  }
  console.log(`✅ gate: um locutor só (IQR ${iqr.toFixed(1)}Hz ≤ ${GATE_IQR_HZ}Hz ou um lado dominante)`);
  return { recusar: false, motivo: "" };
}

/** Aplica o veredito: recusou e ninguém forçou → sai com código ≠ 0. */
function aplicarGate(veredito) {
  if (!veredito.recusar) return;
  console.error(`\n⛔ GATE RECUSOU O RESGATE — ${veredito.motivo}`);
  if (IGNORAR_LOCUTOR) {
    console.error("⚠️ --ignorar-locutor: um humano mandou prosseguir MESMO ASSIM. Fica registrado.");
    return;
  }
  console.error("(nenhum job foi disparado, nada foi gravado no banco. pra forçar: --ignorar-locutor)");
  process.exit(2);
}
/* ============================ fim do gate multi-locutor ============================ */

(async () => {
  const { data: voz } = await supa
    .from("voices")
    .select("id, user_id, name, status, raw_audio_paths")
    .eq("id", VOICE_ID)
    .maybeSingle();
  if (!voz) throw new Error("voz não encontrada");

  // --so-gate: só mede e sai — serve pra auditar QUALQUER voz (inclusive ready),
  // sem passar pelo fluxo de resgate. Nunca grava nada.
  if (SO_GATE) {
    console.log(`voz "${voz.name}" (${voz.status}) — só o gate, sem resgate`);
    const veredito = await gateMultiLocutor(voz);
    aplicarGate(veredito);
    console.log("\n(--so-gate: fim — nada foi alterado)");
    return;
  }

  if (voz.status !== "uploading" && voz.status !== "failed") {
    throw new Error(`status é '${voz.status}', não 'uploading' nem 'failed'`);
  }
  const MODO = voz.status; // "uploading" | "failed"

  const { data: perfil } = await supa
    .from("profiles")
    .select("email, credits_subscription, credits_extra")
    .eq("id", voz.user_id)
    .maybeSingle();
  const saldo = (perfil?.credits_subscription ?? 0) + (perfil?.credits_extra ?? 0);
  console.log(`voz "${voz.name}" (${MODO}) de ${perfil?.email} · saldo ${saldo} (não será cobrado)`);

  // 1. A lista de áudios pro treino — a FONTE muda com o modo.
  let chaves;
  if (MODO === "uploading") {
    // Upload nunca completou: raw_audio_paths está vazio, a fonte é o que
    // chegou no R2 (ordem = a mesma do upload, pelo prefixo NNN_).
    const lista = await r2.send(
      new ListObjectsV2Command({ Bucket: B_VOICES, Prefix: `${voz.user_id}/${voz.id}/` }),
    );
    chaves = (lista.Contents ?? [])
      // ⚠️ 24/08: o prefixo da voz também contém ref/auto.wav e sample — a Kessuly
      // foi retreinada com a própria referência de 30s dentro do "áudio bruto".
      .filter((o) => o.Size > 10000 && /\/raw\/[^/]+\.(mp3|wav|m4a|aac|ogg|webm|mp4|flac)$/i.test(o.Key))
      .map((o) => o.Key)
      .sort();
    if (chaves.length === 0) throw new Error("nenhum áudio no R2");
  } else {
    // Treinou e FALHOU: a fonte é raw_audio_paths (o que a produção usaria),
    // refiltrada pra só áudio — o onboarding pode ter mandado jpeg/mp4/pdf.
    const brutos = Array.isArray(voz.raw_audio_paths) ? voz.raw_audio_paths : [];
    if (brutos.length === 0) {
      throw new Error("raw_audio_paths vazio — no modo failed a fonte é essa lista; confira a voz");
    }
    const mantidos = [];
    const descartados = [];
    for (const k of brutos) (EXT_AUDIO.test(k) ? mantidos : descartados).push(k);
    console.log(`raw_audio_paths: ${brutos.length} arquivo(s) → ${mantidos.length} de áudio, ${descartados.length} descartado(s)`);
    for (const k of descartados) console.log(`  ✗ descartado (extensão não é áudio): ${path_.basename(k)}`);
    if (mantidos.length === 0) {
      throw new Error("ZERO arquivos de áudio depois do filtro — não há o que treinar; o aluno precisa enviar áudio de verdade");
    }
    chaves = mantidos;
  }

  // Duração arquivo a arquivo (ffprobe LOCAL — ver duracao()). No modo failed,
  // arquivo que mede 0 (não abre / não é áudio de verdade) também é descartado.
  const urls = [];
  const validas = [];
  let total = 0;
  for (const k of chaves) {
    const u = await getUrl(B_VOICES, k);
    const d = await duracao(u);
    if (MODO === "failed") {
      if (d === 0) {
        console.log(`  ✗ descartado (duração 0 — não abre ou não é áudio): ${path_.basename(k)}`);
        continue;
      }
      console.log(`  ✓ mantido: ${path_.basename(k)} (${(d / 60).toFixed(1)} min)`);
      validas.push(k);
    }
    urls.push(u);
    total += d;
  }
  if (MODO === "failed") {
    chaves = validas;
    if (chaves.length === 0) {
      throw new Error("ZERO arquivos de áudio válidos depois do ffprobe — não há o que treinar");
    }
  }
  console.log(`${chaves.length} áudio(s), ${(total / 60).toFixed(1)} min no total`);
  if (MODO === "uploading") {
    if (total < MIN_UPLOAD) throw new Error(`só ${(total / 60).toFixed(1)} min — mínimo 20`);
  } else {
    if (total < MIN_WORKER) {
      throw new Error(`só ${(total / 60).toFixed(1)} min — o worker exige ${MIN_WORKER / 60} min de fala ÚTIL, reprovação é matemática`);
    }
    if (total < MIN_UPLOAD) {
      console.log(`⚠️ ${(total / 60).toFixed(1)} min brutos < porta de upload (${MIN_UPLOAD / 60} min) — o worker mede fala útil e pode reprovar; decisão é sua`);
    }
  }

  // GATE MULTI-LOCUTOR — roda ANTES de qualquer escrita/GPU, inclusive no
  // ensaio (ensaio que não mede não serve de ensaio). Recusa = sai com ≠ 0.
  const veredito = await gateMultiLocutor(voz);
  aplicarGate(veredito);

  if (!CONFIRMAR) {
    console.log("\n(simulação — nada foi alterado. rode com --confirmar pra executar)");
    return;
  }

  // 2. uploads-complete (uploading: o passo que faltou; failed: persiste a
  //    lista REFILTRADA — senão a produção e o worker seguem vendo jpeg/mp4/pdf)
  const { error: e1 } = await supa
    .from("voices")
    .update({
      raw_audio_paths: chaves,
      duration_seconds: Math.round(total),
      status: "awaiting_training",
      error_message: null,
    })
    .eq("id", voz.id);
  if (e1) throw new Error(`update uploads-complete: ${e1.message}`);
  console.log("✅ voz restaurada (awaiting_training)");

  // 3. Treino — mesma receita do start-training
  const loraKey = `${voz.user_id}/${voz.id}/lora.safetensors`;
  const refKey = `${voz.user_id}/${voz.id}/ref/auto.wav`;
  const sampleKey = `${voz.user_id}/${voz.id}/sample.wav`;
  const body = {
    input: {
      type: "train",
      voice_id: voz.id,
      audio_urls: urls,
      lora_upload_url: await putUrl(B_VOICES, loraKey, "application/octet-stream"),
      reference_upload_url: await putUrl(B_VOICES, refKey, "audio/wav"),
      sample_upload_url: await putUrl(B_GEN, sampleKey, "audio/wav"),
      max_steps: MAX_STEPS,
      language: "pt",
    },
    webhook: `${SITE}/api/v1/webhooks/runpod`,
    policy: { executionTimeout: (30 * 60 + Math.ceil(total * 0.3)) * 1000 },
  };
  const res = await fetch(
    `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_TRAIN_ID}/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`RunPod ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const job = await res.json();
  console.log(`✅ treino disparado: ${job.id} (${job.status})`);

  await supa
    .from("voices")
    .update({ status: "training", runpod_job_id: job.id, lora_path: loraKey, error_message: null })
    .eq("id", voz.id);
  await supa.from("training_jobs").insert({
    voice_id: voz.id,
    user_id: voz.user_id,
    runpod_job_id: job.id,
    status: "queued",
  });

  // 4. SEM cobrança (ordem do Johnny 18/08) — a culpa do travamento é nossa.
  console.log(`✅ sem débito: treino de resgate por conta da casa`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
