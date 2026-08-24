#!/usr/bin/env node
/**
 * conferir_transcript_referencia.cjs — o texto gravado da referência bate com o áudio?
 *
 * POR QUE EXISTE (Negrini #124, 24/08): `voices.reference_transcript` tinha um
 * "O" no fim que o `ref/auto.wav` NÃO contém (timestamp impreciso do corte por
 * palavra). O VoxCPM continua o TEXTO da referência → ecoou "Ou" no começo de
 * CADA frase gerada. Reescrever o transcript a partir do próprio áudio curou
 * 100%. O worker (dev) passou a fazer isso no treino; aqui é a VARREDURA das
 * vozes que já existem — sem GPU, sem retreino.
 *
 * O que faz por voz: baixa auto.wav, transcreve (whisper-1, OpenAI, ~R$0,02),
 * normaliza as duas pontas (1ª e última palavra) e compara com o transcript
 * gravado. Divergência na ponta = palavra fantasma (ou faltante) = candidata.
 *
 * Uso (de qualquer pasta):
 *   node _frank/ferramentas/conferir_transcript_referencia.cjs --medir [--limite 30] [--desde 2026-08-01]
 *       só mede; grava frontend/_Bugs/chamado_108_referencias/transcript_divergentes.json
 *   node _frank/ferramentas/conferir_transcript_referencia.cjs --curar <voiceId> [--confirmar]
 *       reescreve reference_transcript da voz a partir do áudio (backup do texto em arquivo)
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({ path: path.join(c.RAIZ, "frontend", ".env.local") });

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const tem = (n) => process.argv.includes(n);
const OUT_DIR = path.join(c.RAIZ, "frontend", "_Bugs", "chamado_108_referencias");
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || [];

async function transcrever(buf) {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "audio/wav" }), "ref.wav");
  fd.append("model", "whisper-1"); fd.append("language", "pt"); fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json(); if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 150));
  return j;
}

/** Compara pontas: devolve {ok, motivo, ultima_texto, ultima_audio, ...}. */
function comparar(transcript, ouvido) {
  const T = norm(transcript), A = norm(ouvido);
  if (!A.length) return { ok: false, motivo: "audio_mudo" };
  if (!T.length) return { ok: false, motivo: "transcript_vazio" };
  const fimOk = T[T.length - 1] === A[A.length - 1];
  const iniOk = T[0] === A[0];
  // tolerância: whisper pode escrever número como dígito; se as 2 últimas casam, ok
  const fim2 = T.slice(-2).join(" ") === A.slice(-2).join(" ");
  const ok = (fimOk || fim2) && iniOk;
  return { ok, motivo: ok ? null : (!fimOk && !fim2 ? "cauda_diverge" : "inicio_diverge"),
    cauda_texto: T.slice(-3).join(" "), cauda_audio: A.slice(-3).join(" "), inicio_texto: T.slice(0, 2).join(" "), inicio_audio: A.slice(0, 2).join(" "),
    palavras_texto: T.length, palavras_audio: A.length };
}

async function medir() {
  const limite = parseInt(arg("--limite") || "30", 10);
  const desde = arg("--desde") || "2000-01-01";
  const s = c.supa();
  const { data: vozes } = await s.from("voices").select("id,name,user_id,reference_audio_path,reference_transcript,trained_at")
    .eq("status", "ready").not("reference_audio_path", "is", null).not("reference_transcript", "is", null)
    .gte("trained_at", desde).order("trained_at", { ascending: false }).limit(limite);
  const bucket = c.BUCKETS.vozes();
  const res = [];
  console.log(`conferindo ${vozes.length} vozes (treinadas desde ${desde})…`);
  for (const v of vozes) {
    try {
      const buf = Buffer.from(await (await fetch(await c.urlAssinada(bucket, v.reference_audio_path, 600))).arrayBuffer());
      const j = await transcrever(buf);
      const cmp = comparar(v.reference_transcript, j.text);
      res.push({ id: v.id, nome: v.name, trained_at: v.trained_at, ...cmp, ouvido: j.text });
      console.log(`${cmp.ok ? "  ok " : "  ✗  "} ${v.id.slice(0, 8)} ${String(v.trained_at).slice(0, 10)} ${cmp.ok ? "" : (cmp.motivo === "inicio_diverge" ? `${cmp.motivo}: texto "${cmp.inicio_texto}…" × áudio "${cmp.inicio_audio}…"` : (cmp.motivo === "inicio_diverge" ? `${cmp.motivo}: texto "${cmp.inicio_texto}…" × áudio "${cmp.inicio_audio}…"` : `${cmp.motivo}: texto "…${cmp.cauda_texto}" × áudio "…${cmp.cauda_audio}"`))}`);
    } catch (e) { res.push({ id: v.id, erro: e.message.slice(0, 80) }); console.log(`  ERR ${v.id.slice(0, 8)} ${e.message.slice(0, 60)}`); }
  }
  const ruins = res.filter((r) => r.ok === false);
  console.log(`\n${ruins.length} de ${res.length} divergentes (${res.length ? Math.round(ruins.length / res.length * 100) : 0}%)`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "transcript_divergentes.json"), JSON.stringify(res, null, 1));
}

async function curar(voiceId) {
  const s = c.supa();
  const { data: v } = await s.from("voices").select("id,name,reference_audio_path,reference_transcript").eq("id", voiceId).single();
  if (!v) throw new Error("voz não encontrada");
  const buf = Buffer.from(await (await fetch(await c.urlAssinada(c.BUCKETS.vozes(), v.reference_audio_path, 600))).arrayBuffer());
  const j = await transcrever(buf);
  let novo = j.text.trim(); if (novo && /[a-z0-9À-ɏ]$/i.test(novo)) novo += ".";
  const cmp = comparar(v.reference_transcript, j.text);
  console.log(`voz "${v.name}"\nANTES : …${(v.reference_transcript || "").slice(-80)}\nÁUDIO : …${novo.slice(-80)}\n${cmp.ok ? "pontas batem — nada a curar" : "DIVERGE: " + cmp.motivo}`);
  if (!tem("--confirmar")) { console.log("\n(simulação — --confirmar grava)"); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `transcript_backup_${v.id.slice(0, 8)}_${Date.now().toString(36)}.txt`), v.reference_transcript || "");
  const { error } = await s.from("voices").update({ reference_transcript: novo }).eq("id", v.id);
  if (error) throw new Error(error.message);
  console.log("✅ reference_transcript reescrito a partir do áudio (backup do texto antigo em _Bugs)");
}

(async () => {
  if (tem("--medir")) return medir();
  const id = arg("--curar"); if (id) return curar(id);
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
