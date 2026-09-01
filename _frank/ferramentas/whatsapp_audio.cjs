#!/usr/bin/env node
/**
 * whatsapp_audio.cjs — manda ÁUDIO pro grupo da equipe no WhatsApp (via WAHA).
 *
 * POR QUE EXISTE (ordem do Johnny 26/08): *"quando você postar no grupo manda a
 * Carol postar a mesma coisa relacionado a áudio no WhatsApp também, para que
 * as pessoas ouçam e deem a avaliação"*. Eu não ouço — quem julga se uma cura
 * ou um retreino ficou bom são as pessoas, e elas estão no zap, não só no
 * Telegram. Áudio que vai pro Telegram vai pro WhatsApp junto.
 *
 * A `lib/agent/waha.ts` só sabia mandar TEXTO. Aqui vai voz/arquivo pelo mesmo
 * WAHA (endpoint /api/sendVoice, com queda pra /api/sendFile).
 *
 * Destino padrão: GRUPO "FASTCLONER - Suporte"
 * (`GRUPO_SUPORTE_JID` em frontend/src/lib/support/grupo.ts).
 *
 * USO (de qualquer pasta do projeto):
 *   node _frank/ferramentas/whatsapp_audio.cjs "legenda" a.mp3 [b.mp3 ...]
 *   node _frank/ferramentas/whatsapp_audio.cjs --seco "legenda" a.mp3   # ensaia
 *   node _frank/ferramentas/whatsapp_audio.cjs --para 5511...@g.us "leg" a.mp3
 *
 * ⚠️ O WhatsApp toca "voice note" (ptt) só em OGG/opus; mp3/wav vão como
 * ARQUIVO de áudio, que toca igual mas aparece como anexo. Convertemos pra ogg
 * quando o ffmpeg existir — é o formato em que a pessoa dá play direto.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { RAIZ } = require("./_comum.cjs");

require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const GRUPO_SUPORTE_JID = "120363428193217427@g.us";
const SESSION = "default";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

const argv = process.argv.slice(2);
const SECO = argv.includes("--seco");
const iPara = argv.indexOf("--para");
const DESTINO = iPara >= 0 ? argv[iPara + 1] : GRUPO_SUPORTE_JID;
// ⚠️ com --para ausente, iPara = -1 e iPara+1 = 0 comeria a LEGENDA (índice 0).
const rest = argv.filter((a, i) => a !== "--seco" && (iPara < 0 || (i !== iPara && i !== iPara + 1)));
const [legenda, ...arquivos] = rest;

if (!legenda || !arquivos.length) {
  console.error('uso: node _frank/ferramentas/whatsapp_audio.cjs "legenda" a.mp3 [b.mp3 ...]');
  process.exit(1);
}

/**
 * O WAHA escuta em 127.0.0.1:3033 DENTRO do Hetzner — de fora ele não existe.
 * Na máquina de dev (sem WAHA_API_URL no .env.local) o POST vai por SSH: o
 * `curl` roda LÁ e lê a chave do .env.local de lá, então o segredo nunca
 * trafega nem aparece aqui. Não instala nem altera nada no servidor.
 * (Túnel `ssh -L` foi tentado antes e não subiu em tempo no Git Bash.)
 */
const SSH_HOST = process.env.HETZNER_SSH || "root@91.99.15.213";
const tunel = null; // mantido pra compatibilidade do encerramento

async function waha(rota, body) {
  const payload = JSON.stringify(body);

  if (process.env.WAHA_API_URL) {
    const res = await fetch(`${process.env.WAHA_API_URL.replace(/\/$/, "")}${rota}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}),
      },
      body: payload,
    });
    return { ok: res.ok, status: res.status, text: () => res.text(), json: () => res.json() };
  }

  // Remoto: manda o corpo pelo stdin do ssh (áudio em base64 é grande).
  const { execFileSync } = require("node:child_process");
  const remoto =
    'cd /mnt/volume/aiverse/frontend && ' +
    'U=$(grep -m1 "^WAHA_API_URL=" .env.local | cut -d= -f2- | tr -d \'"\') && ' +
    'K=$(grep -m1 "^WAHA_API_KEY=" .env.local | cut -d= -f2- | tr -d \'"\') && ' +
    `curl -s -m 120 -w '\\nHTTP:%{http_code}' -X POST -H 'content-type: application/json' ` +
    `-H "X-Api-Key: $K" --data-binary @- "$U${rota}"`;

  const saida = execFileSync("ssh", ["-o", "ConnectTimeout=20", "-o", "BatchMode=yes", SSH_HOST, remoto], {
    input: payload,
    maxBuffer: 64 * 1024 * 1024,
  }).toString();

  const m = saida.match(/HTTP:(\d+)\s*$/);
  const status = m ? Number(m[1]) : 0;
  const corpo = saida.replace(/\nHTTP:\d+\s*$/, "");
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => corpo,
    json: async () => {
      try {
        return JSON.parse(corpo);
      } catch {
        return {};
      }
    },
  };
}

/** mp3/wav → ogg/opus (voice note de verdade). Sem ffmpeg, manda como está. */
function paraOgg(arquivo) {
  if (/\.ogg$/i.test(arquivo)) return arquivo;
  const saida = path.join(path.dirname(arquivo), `${path.basename(arquivo).replace(/\.[^.]+$/, "")}.ogg`);
  try {
    execFileSync(FFMPEG, ["-v", "error", "-y", "-i", arquivo, "-c:a", "libopus", "-b:a", "48k", "-ac", "1", saida]);
    return saida;
  } catch {
    console.warn(`   ⚠️  ffmpeg falhou em ${path.basename(arquivo)} — mandando o original`);
    return arquivo;
  }
}

(async () => {
  if (!SECO && !process.env.WAHA_API_URL) {
    console.log(`WAHA nao e local — enviando pelo servidor (${SSH_HOST})`);
  }
  console.log(`destino: ${DESTINO}${DESTINO === GRUPO_SUPORTE_JID ? ' (grupo "FASTCLONER - Suporte")' : ""}`);
  for (const [i, bruto] of arquivos.entries()) {
    if (!fs.existsSync(bruto)) {
      console.error(`   ❌ não existe: ${bruto}`);
      process.exitCode = 1;
      continue;
    }
    const arquivo = SECO ? bruto : paraOgg(bruto);
    const kb = Math.round(fs.statSync(arquivo).size / 1024);
    const cap = i === 0 ? legenda : path.basename(bruto);
    console.log(`→ ${path.basename(arquivo)} (${kb} KB) legenda: ${cap.slice(0, 80)}`);
    if (SECO) continue;

    const corpo = {
      session: SESSION,
      chatId: DESTINO,
      file: {
        mimetype: /\.ogg$/i.test(arquivo) ? "audio/ogg; codecs=opus" : "audio/mpeg",
        filename: path.basename(arquivo),
        data: fs.readFileSync(arquivo).toString("base64"),
      },
      convert: true,
    };

    // A legenda vai como TEXTO antes do áudio: sendVoice não tem caption.
    if (cap) {
      const t = await waha("/api/sendText", { session: SESSION, chatId: DESTINO, text: cap });
      if (!t.ok) console.warn(`   ⚠️  legenda falhou (${t.status}): ${(await t.text()).slice(0, 160)}`);
    }

    let res = await waha("/api/sendVoice", corpo);
    if (!res.ok) {
      const err = (await res.text()).slice(0, 160);
      console.warn(`   ↩︎ sendVoice ${res.status} (${err}) — tentando sendFile`);
      res = await waha("/api/sendFile", corpo);
    }
    if (!res.ok) {
      console.error(`   ❌ falhou ${res.status}: ${(await res.text()).slice(0, 200)}`);
      process.exitCode = 1;
      continue;
    }
    const json = await res.json().catch(() => ({}));
    const id = typeof json.id === "string" ? json.id : (json.id?._serialized ?? json.id?.id ?? "ok");
    console.log(`   ✅ enviado (${id})`);
  }
  if (SECO) console.log("\n(ensaio — nada foi enviado)");
})().catch((e) => {
  console.error("ERRO:", e.message);
  if (tunel) tunel.kill();
  process.exit(1);
});
