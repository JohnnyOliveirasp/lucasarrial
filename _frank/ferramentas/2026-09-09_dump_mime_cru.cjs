/**
 * Dump do MIME CRU de um uid do INBOX — leitura pura.
 *
 * POR QUE ISTO EXISTE
 * O `ler_caixa.cjs` renderiza o corpo com um PORTE do `mailText` de produção.
 * Quando a pergunta da ronda é "a Fast leu esta mensagem do mesmo jeito que eu
 * li?", o porte não serve de prova: ele pode acertar onde a produção erra, e
 * foi exatamente essa lacuna que o incidente #261 (`ab485826`) deixou escrita
 * na própria ressalva — *"NÃO li o MIME cru do uid 436 ... quem pegar o card
 * deve começar dumpando o BODYSTRUCTURE antes de mexer no mailText"*. O #261
 * acabou REFUTADO justamente na fonte. Este script é essa fonte, disponível
 * antes de abrir chamado em vez de depois de fechá-lo.
 *
 * GARANTIAS (as mesmas do ler_caixa.cjs — ordem de 19/08)
 *   - `EXAMINE` (read-only no protocolo) e `BODY.PEEK[]`, nunca `BODY[]`:
 *     a mensagem NÃO vira lida. O não-lido é a fila da Fast; marcar como lido
 *     faz ela nunca responder aquele aluno.
 *   - Tripwire de comando de escrita: STORE/APPEND/MOVE/... morrem aqui.
 *   - PROVA, não promessa: imprime as FLAGS antes e depois do fetch e acusa
 *     se mudaram. "PEEK não marca" é o que a RFC diz; o que vale é o que o
 *     servidor fez.
 *   - Nenhum segredo é impresso.
 *
 * uso: node _frank/ferramentas/2026-09-09_dump_mime_cru.cjs <uid> [<uid>...]
 *      grava /tmp/uid<N>.raw e imprime BODYSTRUCTURE + FLAGS.
 */
const path = require("node:path");
const fs = require("node:fs");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const SENHA = process.env.SUPPORT_MAIL_PASSWORD || "";

/** Comandos que esta ferramenta NUNCA emite. Se aparecer, é bug: morre aqui. */
const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b|\bBODY\[/i;

class Sessao {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.seq = 0;
    this.socket = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const s = tls.connect({ host: HOST, port: 993, servername: HOST }, () => resolve());
      s.on("error", reject);
      s.setTimeout(30_000, () => {
        s.destroy();
        reject(new Error("IMAP timeout"));
      });
      s.on("data", (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m);
  }

  // Só olha o FIM do buffer (lição do incidente de 08/08 — mensagem de 33MB).
  waitFor(pattern, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const cauda = this.buffer.subarray(Math.max(0, this.buffer.length - 4096)).toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - started > timeoutMs) return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  async command(cmd, sensivel = false) {
    if (!this.socket) throw new Error("IMAP sem conexão");
    if (!sensivel && PROIBIDOS.test(cmd)) {
      throw new Error(`comando PROIBIDO nesta ferramenta (só leitura): ${cmd.split(" ").slice(0, 3).join(" ")}`);
    }
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      // O texto do LOGIN nunca vai pro erro: poderia arrastar a senha junto.
      throw new Error(`IMAP ${sensivel ? "LOGIN" : cmd.split(" ")[0]} falhou: ${sensivel ? "(recusado)" : res.slice(-200)}`);
    }
    return res;
  }

  close() {
    try {
      this.socket?.write(`a${++this.seq} LOGOUT\r\n`);
      this.socket?.end();
    } catch {
      /* já caiu */
    }
  }
}

const flagsDe = (res) => res.match(/FLAGS \(([^)]*)\)/)?.[1] ?? "(uid não encontrado)";

(async () => {
  const uids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  if (!uids.length) {
    console.log("uso: node _frank/ferramentas/2026-09-09_dump_mime_cru.cjs <uid> [<uid>...]");
    process.exit(1);
  }
  if (!SENHA) throw new Error("SUPPORT_MAIL_PASSWORD ausente no frontend/.env.local");

  const sessao = new Sessao();
  await sessao.connect();
  await sessao.command(`LOGIN "${USER}" "${SENHA}"`, true);
  await sessao.command("EXAMINE INBOX"); // read-only no protocolo

  try {
    for (const uid of uids) {
      const antes = flagsDe(await sessao.command(`UID FETCH ${uid} (FLAGS)`));
      const bs = await sessao.command(`UID FETCH ${uid} (BODYSTRUCTURE)`);
      const raw = await sessao.command(`UID FETCH ${uid} (BODY.PEEK[])`);
      const depois = flagsDe(await sessao.command(`UID FETCH ${uid} (FLAGS)`));

      const destino = `/tmp/uid${uid}.raw`;
      fs.writeFileSync(destino, raw, "latin1");

      console.log(`\n===== uid ${uid} =====`);
      console.log(`FLAGS antes: [${antes}]`);
      console.log(`FLAGS depois:[${depois}]  ${antes === depois ? "INALTERADAS (PEEK provado)" : "*** MUDOU — BUG, reporte ***"}`);
      console.log("--- BODYSTRUCTURE ---");
      console.log((bs.split(/\r?\n/).find((l) => /BODYSTRUCTURE/i.test(l)) || "(não achou)").slice(0, 2000));
      console.log(`--- raw gravado em ${destino} (${raw.length} bytes) ---`);
    }
  } finally {
    sessao.close();
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
