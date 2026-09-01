/**
 * Manda um ÁUDIO pro grupo do Telegram (o telegram.cjs só manda texto).
 *
 * Pedido do Johnny 29/08: comparar no ouvido a voz com e sem o esticador.
 * Eu não ouço — quem decide é ele, então o arquivo precisa chegar no celular.
 *
 *   node _frank/ferramentas/telegram_audio.cjs <arquivo.mp3> "legenda"
 *
 * Credenciais: `.env.telegram` na raiz (mesmo arquivo do telegram.cjs).
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "..");
const ENV = path.join(RAIZ, ".env.telegram");

function lerEnv() {
  const out = {};
  for (const linha of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

(async () => {
  const arquivo = process.argv[2];
  const legenda = process.argv[3] || "";
  if (!arquivo) {
    console.error('uso: node _frank/ferramentas/telegram_audio.cjs <arquivo.mp3> "legenda"');
    process.exit(1);
  }
  const env = lerEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes no .env.telegram");

  const form = new FormData();
  form.append("chat_id", chat);
  form.append("caption", legenda.slice(0, 1000));
  form.append("title", path.basename(arquivo));
  form.append("audio", new Blob([fs.readFileSync(arquivo)], { type: "audio/mpeg" }), path.basename(arquivo));

  const res = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, { method: "POST", body: form });
  const j = await res.json();
  if (!j.ok) throw new Error(`telegram: ${JSON.stringify(j).slice(0, 300)}`);
  console.log(`enviado (message_id ${j.result.message_id}) — ${path.basename(arquivo)}`);
})().catch((e) => {
  console.error("falhou:", e.message);
  process.exit(1);
});
