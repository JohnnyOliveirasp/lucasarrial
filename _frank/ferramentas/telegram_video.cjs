#!/usr/bin/env node
/**
 * telegram_video.cjs — manda VIDEO (mp4) pro grupo BrothersAI (sendVideo).
 * Irmao do telegram_audio.cjs (que manda mp3 via sendAudio). Nasceu em 27/08
 * pra o Johnny ver o Video Clone do Luciano (#99) sem abrir o R2.
 *
 * USO: node _frank/ferramentas/telegram_video.cjs [--seco] "legenda" a.mp4 [b.mp4 ...]
 * Limite do Telegram por bot: 50 MB por arquivo.
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
  const [legenda, ...arquivos] = args.filter((a) => a !== "--seco");
  if (!legenda || !arquivos.length) { console.error('uso: telegram_video.cjs [--seco] "legenda" a.mp4 [b.mp4 ...]'); process.exit(1); }
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = env();
  if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID vazios em .env.telegram");
  for (const [i, f] of arquivos.entries()) {
    const abs = path.resolve(f);
    const size = fs.statSync(abs).size;
    if (size > 49 * 1024 * 1024) { console.error(`  ✖ ${path.basename(abs)}: ${(size / 1048576).toFixed(1)} MB passa do limite de 50 MB`); continue; }
    const cap = i === 0 ? legenda : path.basename(abs);
    console.log(`${seco ? "(seco) " : ""}→ ${path.basename(abs)} (${(size / 1048576).toFixed(1)} MB) legenda: ${cap.slice(0, 80)}`);
    if (seco) continue;
    const fd = new FormData();
    fd.append("chat_id", chat);
    fd.append("caption", cap);
    fd.append("supports_streaming", "true");
    fd.append("video", new Blob([fs.readFileSync(abs)], { type: "video/mp4" }), path.basename(abs));
    const r = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: "POST", body: fd });
    const j = await r.json();
    if (!j.ok) throw new Error(`sendVideo falhou: ${JSON.stringify(j).slice(0, 200)}`);
    console.log(`   ✅ enviado (message_id ${j.result.message_id})`);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
