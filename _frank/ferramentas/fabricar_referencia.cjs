#!/usr/bin/env node
/**
 * fabricar_referencia.cjs — referência de voz FABRICADA (não "trecho bruto").
 *
 * POR QUE EXISTE (24/08, Kessuly/Pepe): o VoxCPM gera em modo "continue este
 * áudio": ele copia da referência de 30s o volume, o ritmo e até palavras da
 * cauda. Hoje a referência é um pedaço bruto escolhido uma vez no treino — se
 * cai num trecho baixo (Pepe, -37 LUFS), cortado no meio da frase (Kessuly,
 * "Assim, antes de..."), ou começando no meio ("americano. Na 18ª peça…"),
 * TODA geração herda o defeito. Retreinar não cura: a LoRA está certa.
 *
 * O que faz, SEM GPU:
 *   1. transcreve a gravação bruta com tempo por palavra (whisper-1, OpenAI);
 *   2. escolhe a janela de 18–30s que COMEÇA em início de frase e TERMINA em
 *      fim de frase (. ! ?), sem pausa > 1,2s, sem "..." — pontuando volume
 *      (perto de -23 LUFS), fala contínua e distância das bordas da gravação;
 *   3. corta do arquivo ORIGINAL, mono 16 kHz, normaliza pra -23 LUFS;
 *   4. sobe em ref/auto.wav (backup .bak-<data>) e grava reference_transcript.
 *
 * Uso (de qualquer pasta):
 *   node _frank/ferramentas/fabricar_referencia.cjs <voiceId> [--confirmar] [--top 5] [--escolher 2]
 *   Cache: a transcrição fica em frontend/_Bugs/chamado_108_referencias/<voz>/raw.whisper.json
 */
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync, execFileSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({ path: path.join(c.RAIZ, "frontend", ".env.local") });

const VOICE = process.argv[2];
const CONFIRMAR = process.argv.includes("--confirmar");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const TOP = parseInt(arg("--top") || "5", 10);
const ESCOLHER = parseInt(arg("--escolher") || "1", 10); // qual candidata aplicar (1 = melhor)
const ALVO = -23, MIN_S = 18, MAX_S = 30, PAUSA_MAX = 1.2;
if (!VOICE) { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(0); }

const ff = (args) => { const r = spawnSync("ffmpeg", args, { encoding: "utf8" }); return (r.stderr || "") + (r.stdout || ""); };
function medir(file) {
  const out = ff(["-hide_banner", "-i", file, "-af", "loudnorm=print_format=summary", "-f", "null", "-"]);
  const g = (re) => parseFloat((out.match(re) || [])[1]);
  return { lufs: g(/Input Integrated:\s+([-\d.]+)/), pico: g(/Input True Peak:\s+([-\d.]+)/), lra: g(/Input LRA:\s+([-\d.]+)/) };
}
const TERMINAL = /[.!?…]["»”)]*$/;
const RETICENCIAS = /\.\.\.$|…$/;

async function transcrever(mp3, dest) {
  if (fs.existsSync(dest)) return JSON.parse(fs.readFileSync(dest, "utf8"));
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "raw.mp3");
  fd.append("model", "whisper-1"); fd.append("language", "pt"); fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word"); fd.append("timestamp_granularities[]", "segment");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json(); if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(dest, JSON.stringify(j)); return j;
}

const soLetras = (s) => ((s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || []).join("");
/** lista de palavras normalizadas (pra comparar transcript x áudio) */
const soLetras2 = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || [];

/** Transcreve UM clipe curto (o próprio ref.wav) — sem cache, é a prova. */
async function transcreverClipe(wav) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(wav)], { type: "audio/wav" }), "ref.wav");
  fd.append("model", "whisper-1"); fd.append("language", "pt"); fd.append("response_format", "json");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json(); if (!r.ok) throw new Error("whisper (clipe): " + JSON.stringify(j).slice(0, 200));
  return j.text || "";
}

/** Carrega a PONTUAÇÃO do texto dos segmentos em cima das PALAVRAS com tempo.
 *
 *  POR QUE (Katia #47, 25/08): a versão anterior só aceitava janela que
 *  TERMINASSE num segmento acabado em ponto — e segmento do whisper é fatia de
 *  ~8s, não frase. Medido na gravação dela (2979s): 366 segmentos, só **12
 *  terminam em . ! ?** (3,3%), enquanto o texto tem **173 fins de frase** —
 *  as outras 161 caem no MEIO do segmento e eram invisíveis. Resultado: 0
 *  candidatas, a ferramenta não curava a voz de quem fala emendado.
 *
 *  Os dois fluxos (texto pontuado × palavras cronometradas) são a MESMA fala
 *  em ordem, com raras divergências de tokenização ("faça-se" = 1 token no
 *  texto, 2 palavras no tempo). Alinhamento guloso com resync de até 8:
 *  6.509 de 6.513 casadas = **99,9%**, 4 pulos. Não é heurística de energia
 *  (reprovada 2×) — é timestamp de palavra, que é o que a ordem exige. */
function marcarFimDeFrase(words, segs) {
  const toks = [];
  for (const g of segs) {
    for (const t of (g.text || "").trim().match(/\S+/g) || []) {
      const base = soLetras(t);
      if (base) toks.push({ txt: t, base, fim: TERMINAL.test(t), ret: RETICENCIAS.test(t) });
    }
  }
  const W = words.map((w) => ({ ...w, word: (w.word || "").trim() })).filter((w) => soLetras(w.word));
  W.forEach((w) => { w.base = soLetras(w.word); w.fim = false; w.ret = false; w.txt = w.word; });
  let a = 0, b = 0, casadas = 0;
  while (a < toks.length && b < W.length) {
    if (toks[a].base === W[b].base) {
      W[b].fim = toks[a].fim; W[b].ret = toks[a].ret; W[b].txt = toks[a].txt;
      casadas++; a++; b++; continue;
    }
    let achou = false;
    for (let d = 1; d <= 8 && !achou; d++) {
      if (b + d < W.length && toks[a].base === W[b + d].base) { b += d; achou = true; }
      else if (a + d < toks.length && toks[a + d].base === W[b].base) { a += d; achou = true; }
    }
    if (!achou) { a++; b++; }
  }
  return { W, casadas, total: toks.length };
}

/** Janelas candidatas: começam em INÍCIO de frase e terminam em FIM de frase
 *  (. ! ?), 18–30s, sem pausa > 1,2s — agora por palavra, não por segmento. */
function candidatas(words, segs, total) {
  const { W } = marcarFimDeFrase(words, segs);
  // índices onde uma frase COMEÇA e onde uma frase TERMINA
  const inicios = W.map((_, i) => i).filter((i) => i === 0 || W[i - 1].fim);
  const out = [];
  for (const a of inicios) {
    for (let b = a; b < W.length; b++) {
      const dur = W[b].end - W[a].start;
      if (dur > MAX_S) break;
      if (!W[b].fim || W[b].ret) continue;
      if (dur < MIN_S) continue;
      const ws = W.slice(a, b + 1);
      if (ws.length < 20) continue;
      let pausaMax = 0, fala = 0;
      ws.forEach((w, k) => { fala += w.end - w.start; if (k > 0) pausaMax = Math.max(pausaMax, w.start - ws[k - 1].end); });
      if (pausaMax > PAUSA_MAX) continue;
      const texto = ws.map((w) => w.txt).join(" ").replace(/\s+/g, " ").trim();
      out.push({ start: ws[0].start, end: ws[ws.length - 1].end, dur, pausaMax, densidade: fala / dur, texto, palavras: ws.length });
    }
  }
  return out;
}

function pontuar(cands, raw, dir, total) {
  // mede LUFS de cada candidata (corte rápido) — só nas 40 melhores por forma
  const pre = cands
    .map((k) => ({ ...k, base: (k.dur >= 22 && k.dur <= 28 ? 2 : 0) + k.densidade * 3 - (k.start < 60 || total - k.end < 30 ? 2 : 0) - (k.palavras < 35 ? 1 : 0) }))
    .sort((a, b) => b.base - a.base).slice(0, 40);
  for (const k of pre) {
    const f = path.join(dir, `cand_${k.start.toFixed(1)}.wav`);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(Math.max(0, k.start - 0.15)), "-to", String(k.end + 0.25), "-i", raw, "-ac", "1", "-ar", "16000", f]);
    const m = medir(f); k.lufs = m.lufs; k.lra = m.lra; k.file = f;
    k.score = k.base - Math.abs((m.lufs ?? -40) - ALVO) * 0.25 - (m.lra > 12 ? 1.5 : 0);
  }
  return pre.sort((a, b) => b.score - a.score);
}

(async () => {
  const s = c.supa();
  const { data: v } = await s.from("voices").select("id,name,user_id,raw_audio_paths,reference_audio_path,reference_transcript,language").eq("id", VOICE).single();
  if (!v) throw new Error("voz não encontrada");
  const bucket = c.BUCKETS.vozes();
  const raws = (v.raw_audio_paths || []).filter((k) => k.includes("/raw/"));
  if (!raws.length) throw new Error("voz sem áudio bruto em /raw/");
  const dir = path.join(c.RAIZ, "frontend", "_Bugs", "chamado_108_referencias", v.id.slice(0, 8));
  fs.mkdirSync(dir, { recursive: true });
  // usa o MAIOR arquivo bruto (mais chance de fala contínua)
  const raw = path.join(dir, "raw" + path.extname(raws[0]));
  if (!fs.existsSync(raw)) {
    let maior = null, tam = 0;
    for (const k of raws) { const u = await c.urlAssinada(bucket, k, 600); const b = Buffer.from(await (await fetch(u)).arrayBuffer()); if (b.length > tam) { tam = b.length; maior = b; } }
    fs.writeFileSync(raw, maior);
  }
  const mp3 = path.join(dir, "raw16k.mp3");
  if (!fs.existsSync(mp3)) execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-ac", "1", "-ar", "16000", "-b:a", "48k", mp3]);
  const total = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString());
  console.log(`voz "${v.name}" · bruto ${Math.round(total)}s · ref atual: ${v.reference_audio_path}\n  transcript atual: …${(v.reference_transcript || "").slice(-70)}`);
  const j = await transcrever(mp3, path.join(dir, "raw.whisper.json"));
  const al = marcarFimDeFrase(j.words, j.segments);
  const fins = al.W.filter((w) => w.fim).length;
  const fimDeSegmento = j.segments.filter((g) => TERMINAL.test((g.text || "").trim())).length;
  console.log(`alinhamento texto↔palavra: ${al.casadas}/${al.total} (${(100 * al.casadas / al.total).toFixed(1)}%) · fins de frase: ${fins} (só ${fimDeSegmento} caem em fim de segmento)`);
  if (al.casadas / al.total < 0.9) console.log("⚠️  alinhamento abaixo de 90% — confira o texto da escolhida palavra por palavra antes de aplicar");
  const cands = candidatas(j.words, j.segments, total);
  console.log(`candidatas (frase inteira, ${MIN_S}-${MAX_S}s, pausa<=${PAUSA_MAX}s): ${cands.length}`);
  const rank = pontuar(cands, raw, dir, total);
  rank.slice(0, TOP).forEach((k, n) => console.log(`\n#${n + 1} score ${k.score.toFixed(2)} · ${k.start.toFixed(1)}s→${k.end.toFixed(1)}s (${k.dur.toFixed(1)}s) · ${k.lufs} LUFS · LRA ${k.lra} · pausa máx ${k.pausaMax.toFixed(2)}s\n   "${k.texto}"`));
  const best = rank[ESCOLHER - 1]; if (!best) throw new Error("nenhuma candidata");
  // normaliza a escolhida
  const nova = path.join(dir, "ref_nova.wav");
  const jj = JSON.parse((ff(["-hide_banner", "-i", best.file, "-af", `loudnorm=I=${ALVO}:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]).match(/\{[\s\S]*\}/) || ["{}"])[0]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", best.file, "-af", `loudnorm=I=${ALVO}:TP=-1.5:LRA=11:measured_I=${jj.input_i}:measured_TP=${jj.input_tp}:measured_LRA=${jj.input_lra}:measured_thresh=${jj.input_thresh}:offset=${jj.target_offset}:linear=true,afade=t=out:st=${(best.dur + 0.4 - 0.15).toFixed(2)}:d=0.15`, "-ar", "16000", "-ac", "1", nova]);
  const m = medir(nova);
  console.log(`\nESCOLHIDA: #${ESCOLHER} → ${nova} · ${m.lufs} LUFS · pico ${m.pico}`);

  // O TRANSCRIPT SAI DO CLIPE, NUNCA DA PASSADA LONGA (Katia #47, 25/08).
  // Medido: na gravação de 50min a passada longa devolveu 49 palavras para
  // esta janela e o clipe de 25s diz 69 — o whisper ENGOLE trecho em áudio
  // longo ("...conteúdos, como alguém que já tem o clone pronto. Eu tenho que
  // me portar como alguém que já faz conteúdo..." sumiu inteiro). Gravar o
  // texto da passada longa = transcript que não bate com a referência, que é
  // exatamente o defeito do Negrini #124 (VoxCPM continua o TEXTO e ecoa no
  // começo de cada frase). As bordas da passada longa conferem (1ª e última
  // palavra), então ela serve pra ESCOLHER o corte; o texto, não.
  const ouvido = (await transcreverClipe(nova)).trim();
  const P = soLetras2(best.texto), A = soLetras2(ouvido);
  console.log(`\ncontrole do transcript (o que o clipe REALMENTE diz):\n  "${ouvido}"`);
  console.log(`  palavras: passada longa ${P.length} · clipe ${A.length}` +
    (P.length !== A.length ? `  ⚠️ divergem em ${Math.abs(P.length - A.length)} — vale o clipe` : "  (batem)"));
  if (!ouvido) throw new Error("clipe transcreveu vazio — não grave transcript às cegas");
  if (A[0] !== P[0] || A[A.length - 1] !== P[P.length - 1]) {
    throw new Error(`borda do clipe não bate com a janela escolhida (início "${A[0]}" vs "${P[0]}", fim "${A[A.length - 1]}" vs "${P[P.length - 1]}") — corte errado, não aplique`);
  }
  if (!TERMINAL.test(ouvido)) console.log("⚠️  o clipe não termina em . ! ? — a cauda pode estar cortada");
  const TRANSCRIPT = ouvido;

  if (!CONFIRMAR) { console.log("\n(simulação — nada foi alterado. --confirmar aplica)"); return; }
  const stamp = new Date().toISOString().slice(0, 10) + "-" + Date.now().toString(36).slice(-4);
  const bak = v.reference_audio_path.replace(/\.wav$/, `.bak-${stamp}.wav`);
  await c.r2().send(new c.s3.CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${v.reference_audio_path}`, Key: bak }));
  await c.r2().send(new c.s3.PutObjectCommand({ Bucket: bucket, Key: v.reference_audio_path, Body: fs.readFileSync(nova), ContentType: "audio/wav" }));
  fs.writeFileSync(path.join(dir, `backup_transcript_${stamp}.txt`), v.reference_transcript || "");
  // .select() obrigatório: UPDATE por id inexistente afeta 0 linhas EM SILÊNCIO
  const { data: upd, error } = await s.from("voices").update({ reference_transcript: TRANSCRIPT }).eq("id", v.id).select("id,reference_transcript");
  if (error) throw new Error("update transcript: " + error.message);
  if (!upd || upd.length !== 1) throw new Error(`update afetou ${upd ? upd.length : 0} linhas — esperava 1`);
  if (upd[0].reference_transcript !== TRANSCRIPT) throw new Error("o banco devolveu texto diferente do gravado");
  console.log(`✅ referência fabricada no lugar · backup áudio: ${bak} · transcript antigo em ${dir}`);
  console.log(`   conferido DEPOIS de gravar: 1 linha, transcript do banco == transcript do clipe (${soLetras2(upd[0].reference_transcript).length} palavras)`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
