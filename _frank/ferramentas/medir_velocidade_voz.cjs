/**
 * 25/08 — mede a velocidade NATURAL de fala de uma voz existente (caso Ellen)
 * e, com --gravar, salva em voices.speech_rate_wps (mig 96). Nao toca LoRA,
 * referencia nem transcript: e' so a regua do QA de ritmo da geracao.
 *
 * Como: baixa cada arquivo bruto do treino, corta 3 janelas de 30s (20/50/80%),
 * transcreve com whisper-1 (timestamps de palavra) e calcula ARTICULACAO
 * (palavras / segundos falando, pausas fora). Regua = mediana das janelas.
 * Custo ~R$0,10 por voz.
 *
 *   node _frank/ferramentas/medir_velocidade_voz.cjs <voiceId>            # so mede
 *   node _frank/ferramentas/medir_velocidade_voz.cjs <voiceId> --gravar   # grava
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({ path: path.join(c.RAIZ, "frontend", ".env.local") });

const VOICE_ID = process.argv[2];
const GRAVAR = process.argv.includes("--gravar");
if (!VOICE_ID) { console.error("uso: medir_velocidade_voz.cjs <voiceId> [--gravar]"); process.exit(1); }

async function whisperWords(file) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), path.basename(file));
  fd.append("model", "whisper-1"); fd.append("language", "pt"); fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json(); if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 120));
  return j.words || [];
}
const articulacao = (w) => { if (w.length < 8) return null; const f = w.reduce((a, x) => a + Math.max(0, x.end - x.start), 0); return f < 1 ? null : +(w.length / f).toFixed(2); };
const mediana = (xs) => { const a = xs.filter((x) => x != null).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : +((a[m - 1] + a[m]) / 2).toFixed(2); };

(async () => {
  const s = c.supa();
  const { data: v, error } = await s.from("voices").select("id,name,raw_audio_paths,speech_rate_wps,language").eq("id", VOICE_ID).maybeSingle();
  if (error || !v) throw new Error("voz nao encontrada: " + (error && error.message));
  const raws = Array.isArray(v.raw_audio_paths) ? v.raw_audio_paths : [];
  if (!raws.length) throw new Error("voz sem raw_audio_paths — nao da pra medir");
  console.log(`voz "${v.name}" · ${raws.length} arquivo(s) brutos · speech_rate_wps atual: ${v.speech_rate_wps ?? "(vazio)"}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vel_"));
  const bucket = c.BUCKETS.vozes();
  const todas = [];
  for (const key of raws) {
    const local = path.join(tmp, path.basename(key));
    fs.writeFileSync(local, Buffer.from(await (await fetch(await c.urlAssinada(bucket, key, 600))).arrayBuffer()));
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", local]).toString());
    const janelas = [];
    for (const frac of [0.2, 0.5, 0.8]) {
      const off = Math.max(0, Math.floor(dur * frac) - 15);
      const mp3 = path.join(tmp, `${path.basename(key)}_${frac}.mp3`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(off), "-t", "30", "-i", local, "-vn", "-ac", "1", "-ar", "16000", mp3]);
      const a = articulacao(await whisperWords(mp3));
      janelas.push(a); if (a != null) todas.push(a);
    }
    console.log(`  ${path.basename(key).slice(0, 45).padEnd(45)} ${Math.round(dur)}s  articulacao=${JSON.stringify(janelas)}`);
  }
  const regua = mediana(todas);
  console.log(`\nREGUA (mediana de ${todas.length} janelas): ${regua} palavras/s falando`);
  if (!GRAVAR) { console.log("(so medi — --gravar salva em voices.speech_rate_wps)"); return; }
  const { error: e2 } = await s.from("voices").update({ speech_rate_wps: regua }).eq("id", VOICE_ID);
  if (e2) throw new Error("update: " + e2.message);
  console.log(`✅ gravado speech_rate_wps=${regua} (nada mais foi tocado)`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
