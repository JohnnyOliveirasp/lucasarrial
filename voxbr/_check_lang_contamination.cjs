// Mede a CONTAMINAÇÃO de idioma no lote pt000 do YODAS (achado do Johnny 09/08:
// uma amostra veio com voz em INGLÊS). O YODAS agrupa por idioma da LEGENDA, não
// do ÁUDIO — vídeo em inglês com legenda traduzida entra no balde "pt".
// Método: corta 25s do meio de cada wav baixado e pergunta o idioma ao Whisper
// (API já usada pela plataforma). Custo: ~US$0,006/min → centavos.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
function loadEnv(){const p=path.join(__dirname,"..","frontend",".env.local");const raw=fs.readFileSync(p,"utf8");for(const l of raw.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]=v;}}

const DIR = path.join(__dirname, "amostras");
const TMP = path.join(DIR, "_lang");

(async () => {
  loadEnv();
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY ausente no .env.local");
  fs.mkdirSync(TMP, { recursive: true });
  const wavs = fs.readdirSync(DIR).filter((f) => f.endsWith(".wav"));
  const contagem = {};
  const suspeitos = [];
  for (const w of wavs) {
    const src = path.join(DIR, w);
    const out = path.join(TMP, w.replace(".wav", ".mp3"));
    try {
      // 25s a partir de 1min (evita vinheta/abertura)
      execFileSync("ffmpeg", ["-v", "error", "-ss", "60", "-t", "25", "-i", src, "-c:a", "libmp3lame", "-q:a", "5", "-y", out]);
      const form = new FormData();
      form.append("file", new Blob([fs.readFileSync(out)], { type: "audio/mpeg" }), path.basename(out));
      form.append("model", "whisper-1");
      form.append("response_format", "verbose_json");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      const j = await res.json();
      const lang = j.language || "?";
      contagem[lang] = (contagem[lang] || 0) + 1;
      if (lang !== "portuguese") suspeitos.push(`${w} -> ${lang}: ${(j.text || "").slice(0, 70)}`);
      process.stdout.write(lang === "portuguese" ? "." : "X");
    } catch (e) {
      process.stdout.write("?");
    }
  }
  console.log("\n\n=== idioma REAL do áudio (amostra de " + wavs.length + " vídeos do pt000) ===");
  const total = Object.values(contagem).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(contagem).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v} (${Math.round((v / total) * 100)}%)`);
  }
  if (suspeitos.length) {
    console.log("\nNÃO-português:");
    for (const s of suspeitos) console.log("  " + s);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
