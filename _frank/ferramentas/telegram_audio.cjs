/**
 * 25/08 — manda ÁUDIO pro grupo do Telegram (BrothersAI) pelo Bot API.
 * Nasceu do caso Ellen (draellenca): o Johnny quis OUVIR original × clone.
 * O telegram.cjs só manda texto; este usa o mesmo .env.telegram (token + chat).
 *
 * Uso (de qualquer pasta do projeto):
 *   node _frank/ferramentas/telegram_audio.cjs "legenda" arquivo1.mp3 [arquivo2.mp3 ...]
 *   node _frank/ferramentas/telegram_audio.cjs --seco "legenda" a.mp3      # ensaia
 */
const fs = require("node:fs");
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
const ENV = path.join(RAIZ, ".env.telegram");

function env() {
  const e = {};
  for (const l of fs.readFileSync(ENV, "utf8").split("\n")) {
    const t = l.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i < 0) continue;
    e[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return e;
}

(async () => {
  const args = process.argv.slice(2);
  const seco = args.includes("--seco");
  const rest = args.filter((a) => a !== "--seco");
  const [legenda, ...arquivos] = rest;
  if (!legenda || !arquivos.length) { console.error("uso: telegram_audio.cjs [--seco] \"legenda\" a.mp3 [b.mp3 ...]"); process.exit(1); }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = env();
  if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID vazios em .env.telegram");
  for (const [i, f] of arquivos.entries()) {
    const abs = path.resolve(f);
    const size = fs.statSync(abs).size;
    const cap = i === 0 ? legenda : path.basename(abs);
    console.log(`${seco ? "(seco) " : ""}→ ${path.basename(abs)} (${(size / 1024).toFixed(0)} KB) legenda: ${cap.slice(0, 80)}`);
    if (seco) continue;
    const fd = new FormData();
    fd.append("chat_id", chat);
    fd.append("caption", cap);
    fd.append("title", path.basename(abs, path.extname(abs)));
    fd.append("audio", new Blob([fs.readFileSync(abs)], { type: "audio/mpeg" }), path.basename(abs));
    const r = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, { method: "POST", body: fd });
    const j = await r.json();
    if (!j.ok) throw new Error(`sendAudio falhou: ${JSON.stringify(j).slice(0, 200)}`);
    console.log(`   ✅ enviado (message_id ${j.result.message_id})`);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
