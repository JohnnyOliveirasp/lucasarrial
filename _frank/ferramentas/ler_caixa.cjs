#!/usr/bin/env node
/**
 * ler_caixa.cjs — lê a caixa do suporte@ SEM atrapalhar a Fast.
 *
 * POR QUE EXISTE: quando a Fast escala um caso, o incidente guarda só o resumo
 * dela — não o que o aluno escreveu. Sem isso, investigar é adivinhar. E quando
 * ela acha que resolveu, não fica registro nenhum: ninguém revisa o que ela
 * respondeu (foi assim com a Claudia e com a aluna que explodiu em 17/08).
 *
 * ⚠️ AS TRÊS REGRAS QUE NÃO PODEM SER QUEBRADAS:
 *
 *  1. BODY.PEEK[], nunca BODY[]. `BODY[]` marca a mensagem como lida como
 *     efeito colateral. Se isso pegar um e-mail que a Fast ainda não viu, ela
 *     NUNCA MAIS o vê e o aluno fica sem resposta.
 *  2. Busca SEEN, nunca UNSEEN. O não-lido é da Fast — não dispute com ela.
 *  3. Zero STORE, EXPUNGE, MOVE, DELETE. Esta ferramenta lê e sai.
 *
 * PROVA DE QUE NÃO ATRAPALHOU: conte os UNSEEN antes e depois (`--conferir`).
 * O número tem que ser idêntico.
 *
 * USO (de qualquer pasta — o .env.local é resolvido a partir deste arquivo):
 *   node _frank/ferramentas/ler_caixa.cjs --de aluno@exemplo.com
 *   node _frank/ferramentas/ler_caixa.cjs --ultimos 10
 *   node _frank/ferramentas/ler_caixa.cjs --enviados --para aluno@exemplo.com
 *   node _frank/ferramentas/ler_caixa.cjs --conferir
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});
const tls = require("node:tls");

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";
const MAX_BYTES = 300000; // corpo grande é anexo; não baixa (travou a Fast 2 dias em 08/08)

class Imap {
  constructor() { this.buf = Buffer.alloc(0); this.seq = 0; this.sock = null; }
  connect() {
    return new Promise((ok, err) => {
      const s = tls.connect({ host: HOST, port: 993, servername: HOST }, () => ok());
      s.on("error", err);
      s.setTimeout(30000, () => { s.destroy(); err(new Error("IMAP timeout")); });
      s.on("data", (c) => { this.buf = Buffer.concat([this.buf, c]); });
      this.sock = s;
    }).then(() => this.wait(/^\* OK/m));
  }
  wait(re, ms = 30000) {
    return new Promise((ok, err) => {
      const t0 = Date.now();
      const tick = () => {
        // Só o fim do buffer: converter tudo a cada 50ms trava com mensagem grande.
        const cauda = this.buf.subarray(Math.max(0, this.buf.length - 4096)).toString("latin1");
        if (re.test(cauda)) return ok(this.buf.toString("latin1"));
        if (Date.now() - t0 > ms) return err(new Error("IMAP demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  async cmd(c) {
    const tag = `a${++this.seq}`;
    this.buf = Buffer.alloc(0);
    this.sock.write(`${tag} ${c}\r\n`);
    const res = await this.wait(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) throw new Error(`IMAP ${c.split(" ")[0]}: ${res.slice(-200)}`);
    return res;
  }
  close() { try { this.sock.write(`a${++this.seq} LOGOUT\r\n`); this.sock.end(); } catch {} }
}

function decodeWord(s) {
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, _cs, enc, data) => {
    try {
      if (String(enc).toUpperCase() === "B") return Buffer.from(data, "base64").toString("utf8");
      const b = String(data).replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(b, "latin1").toString("utf8");
    } catch { return m; }
  });
}
const header = (raw, n) => {
  const m = raw.match(new RegExp(`^${n}: (.*(?:\\r?\\n[ \\t].*)*)`, "mi"));
  return m ? decodeWord(m[1].replace(/\r?\n[ \t]+/g, " ").trim()) : "";
};
function corpo(raw) {
  const p = raw.search(/Content-Type:\s*text\/plain/i);
  const h = raw.search(/Content-Type:\s*text\/html/i);
  const i = p >= 0 ? p : h;
  let seg = i >= 0 ? raw.slice(i) : raw;
  const cab = seg.slice(0, 400);
  const st = seg.search(/\r?\n\r?\n/);
  seg = st >= 0 ? seg.slice(st) : seg;
  const b = seg.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
  if (b > 0) seg = seg.slice(0, b);
  if (/quoted-printable/i.test(cab)) seg = seg.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, x) => String.fromCharCode(parseInt(x, 16)));
  else if (/base64/i.test(cab)) { try { seg = Buffer.from(seg.replace(/\s+/g, ""), "base64").toString("utf8"); } catch {} }
  let txt = i === h && i >= 0
    ? seg.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
    : seg.replace(/[ \t]+/g, " ").trim();
  try { const r = Buffer.from(txt, "latin1").toString("utf8"); if (!/\uFFFD/.test(r)) txt = r; } catch {}
  return txt.slice(0, 3000);
}

(async () => {
  if (!PASS) { console.error("SUPPORT_MAIL_PASSWORD ausente — rode de dentro de frontend/"); process.exit(1); }
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const de = arg("--de"), para = arg("--para");
  const ultimos = Number(arg("--ultimos") || 10);
  const enviados = process.argv.includes("--enviados");
  const conferir = process.argv.includes("--conferir");

  const s = new Imap();
  await s.connect();
  try {
    await s.cmd(`LOGIN "${USER}" "${PASS.replace(/(["\\])/g, "\\$1")}"`);

    const pasta = enviados ? '"INBOX.Sent"' : "INBOX";
    await s.cmd(`SELECT ${pasta}`);

    // Contagem de não-lidos ANTES: é a prova de que a leitura não atrapalhou.
    const antes = ((await s.cmd("UID SEARCH UNSEEN")).match(/^\* SEARCH([^\r\n]*)/m)?.[1] || "").trim().split(/\s+/).filter(Boolean).length;
    if (conferir) { console.log(`nao-lidos na caixa: ${antes}`); s.close(); return; }

    // REGRA 2: só o que a Fast JÁ viu (ou a pasta de enviados, que ela nunca lê).
    let busca = enviados ? "ALL" : "SEEN";
    if (de) busca += ` FROM "${de}"`;
    if (para) busca += ` TO "${para}"`;
    const uids = ((await s.cmd(`UID SEARCH ${busca}`)).match(/^\* SEARCH([^\r\n]*)/m)?.[1] || "")
      .trim().split(/\s+/).filter(Boolean).map(Number).sort((a, b) => b - a).slice(0, ultimos);

    if (uids.length === 0) { console.log("nada encontrado."); s.close(); return; }
    console.log(`${uids.length} mensagem(ns) em ${pasta}:\n`);

    for (const uid of uids) {
      // REGRA 1: PEEK. Sem isso a mensagem vira "lida" e some da fila da Fast.
      const r = await s.cmd(`UID FETCH ${uid} (RFC822.SIZE BODY.PEEK[])`);
      const tam = Number(r.match(/RFC822\.SIZE (\d+)/)?.[1] || 0);
      console.log("─".repeat(70));
      console.log(`uid ${uid} | ${(tam / 1024).toFixed(0)} KB`);
      console.log(`de:      ${header(r, "From")}`);
      console.log(`para:    ${header(r, "To")}`);
      console.log(`data:    ${header(r, "Date")}`);
      console.log(`assunto: ${header(r, "Subject")}`);
      if (tam > MAX_BYTES) { console.log("(corpo grande demais — provavelmente anexo; não baixado)\n"); continue; }
      console.log(`\n${corpo(r)}\n`);
    }

    const depois = ((await s.cmd("UID SEARCH UNSEEN")).match(/^\* SEARCH([^\r\n]*)/m)?.[1] || "").trim().split(/\s+/).filter(Boolean).length;
    console.log("─".repeat(70));
    console.log(`nao-lidos antes: ${antes} | depois: ${depois} ${antes === depois ? "✓ nada foi marcado" : "⚠️ MUDOU — o PEEK falhou, avise"}`);
  } finally {
    s.close();
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
