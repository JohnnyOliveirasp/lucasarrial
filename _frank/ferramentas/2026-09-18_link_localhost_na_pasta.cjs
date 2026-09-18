/**
 * QUANTAS CARTAS A CASA MANDOU COM LINK APONTANDO PRO `localhost`?
 *
 * POR QUE EXISTE (ronda 19hZ de 18/09, caso Walsicleia `#1a37605a`).
 * A aluna pagou R$ 936,15, tem voz e foto prontas e NUNCA entrou uma vez desde
 * 04/09 — `last_sign_in_at` NULL. Escreveu 7 vezes. Duas rondas deram o caso
 * por atendido depois de mandar "o link de primeiro acesso".
 *
 * O RISCO QUE ELE MEDE. O link de recuperação é gerado pelo `generateLink` da
 * API admin do Supabase com `redirect_to` montado a partir de
 * `NEXT_PUBLIC_SITE_URL` (`recovery-link/route.ts:25`). No `.env.local` desta
 * máquina essa variável vale **`http://localhost:3000`**, e o Supabase **aceita**
 * esse destino (está na allowlist do projeto, por conveniência de dev):
 * conferido com a conta da casa, a rota de verificação responde **303** mandando
 * o navegador pro `localhost:3000`, com a sessão no fragmento da URL.
 *
 * O que um link desses faz com o aluno: ele clica, o Supabase VERIFICA e
 * **queima** a credencial de uso único, e joga o navegador DELE pra
 * `localhost:3000` — a máquina dele, onde não há nada escutando. Ele vê "não foi
 * possível acessar o site". Pede outro, e o ciclo recomeça. Do nosso lado a
 * carta consta como entregue — e foi entregue mesmo. O link é que não leva a
 * lugar nenhum.
 *
 * ⚠️ ISSO **NÃO** FOI O QUE ACONTECEU COM A WALSICLEIA. Era a minha hipótese, e
 * ela está **REFUTADA**: abri o MIME da carta que a casa mandou pra ela em 16/09
 * (uid 2584) e o `redirect_to` dela era `https://fastcloner.com/auth/callback`,
 * host certo, conferido vivo. Este script fica porque o risco é real pra
 * QUALQUER ronda que gere link desta máquina — não porque tenha explicado aquele
 * caso. Quem usar: é rede de segurança, não diagnóstico pronto.
 *
 * Este script mede o TAMANHO do risco: varre a pasta **Enviados** (remota, que
 * sobrevive a worktree) e conta as cartas cujo corpo carrega um link de
 * verificação com `redirect_to` pro localhost, dizendo PRA QUEM foram.
 *
 * GARANTIAS (herdadas do `ler_caixa.cjs` / `dump_mime_cru.cjs`):
 *   - `EXAMINE` + `BODY.PEEK[]`: nada é marcado como lido, nada é escrito.
 *   - Tripwire de comando de escrita.
 *   - NÃO imprime o token do link (é credencial de acesso à conta do aluno):
 *     imprime só o destino do `redirect_to` e o destinatário.
 *
 * uso: node _frank/ferramentas/2026-09-18_link_localhost_na_pasta.cjs [--desde 2026-08-01]
 */
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";

const argv = process.argv.slice(2);
const idxDesde = argv.indexOf("--desde");
const DESDE = idxDesde >= 0 ? argv[idxDesde + 1] : "01-Aug-2026";

const PROIBIDOS =
  /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b|\bBODY\[(?!HEADER|TEXT|\])/i;

class Sessao {
  constructor() {
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.seq = 0;
  }
  async connect() {
    await new Promise((resolve, reject) => {
      const s = tls.connect({ host: HOST, port: 993, servername: HOST }, () =>
        resolve(),
      );
      s.on("error", reject);
      s.setTimeout(120_000, () => {
        s.destroy();
        reject(new Error("IMAP timeout"));
      });
      s.on("data", (c) => {
        this.buffer = Buffer.concat([this.buffer, c]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m);
  }
  waitFor(pattern, timeoutMs = 120_000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const cauda = this.buffer
          .subarray(Math.max(0, this.buffer.length - 4096))
          .toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - t0 > timeoutMs)
          return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  async command(cmd, sensivel = false) {
    if (!this.socket) throw new Error("IMAP sem conexão");
    if (!sensivel && PROIBIDOS.test(cmd)) {
      throw new Error(`comando PROIBIDO (só leitura): ${cmd.split(" ")[0]}`);
    }
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP falhou: ${res.slice(-200)}`);
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

function nomeDaPasta(linha) {
  return (
    linha
      ?.match(/"\S*"\s+(?:"([^"]+)"|(\S+))\s*$/)
      ?.slice(1)
      .find(Boolean) ?? null
  );
}

/**
 * Decodifica o corpo conforme o `Content-Transfer-Encoding` REAL da carta.
 *
 * ⚠️ FALSO ZERO MEDIDO NESTA RONDA (19hZ de 18/09), e é por isso que esta
 * função existe em vez de um `replace` de quoted-printable. A primeira versão
 * deste script só desfazia QP e devolveu **0 cartas com link de verificação**
 * em **2819** varridas. As cartas que a casa manda pelo `enviar_email.cjs`
 * saem em **base64** — o grep nunca via URL nenhuma. O zero ainda por cima
 * CONCORDAVA com a hipótese de quem media, que é quando ele mais engana.
 *
 * Só apareceu porque abri UMA carta conhecida como controle positivo
 * (`2026-09-18_dump_enviada.cjs`, uid 2584). Quem mexer aqui: rode o controle
 * positivo antes de acreditar em qualquer contagem.
 */
function decodificarCorpo(bruto) {
  const enc = (bruto.match(/^Content-Transfer-Encoding:\s*(\S+)/im)?.[1] ?? "")
    .trim()
    .toLowerCase();

  const corte = bruto.search(/\r?\n\r?\n/);
  const cabecalho = corte >= 0 ? bruto.slice(0, corte) : bruto;
  let corpo = corte >= 0 ? bruto.slice(corte) : "";

  if (enc === "base64") {
    const b64 = corpo
      .split(/\r?\n/)
      .filter((l) => /^[A-Za-z0-9+/=]{4,}\s*$/.test(l))
      .join("");
    try {
      corpo = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      /* deixa cru */
    }
  } else if (enc === "quoted-printable") {
    corpo = corpo
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      );
  }
  return `${cabecalho}\n${corpo}`;
}

(async () => {
  if (!PASS) {
    console.error("faltou SUPPORT_MAIL_PASSWORD no frontend/.env.local");
    process.exit(1);
  }

  const s = new Sessao();
  await s.connect();
  await s.command(`LOGIN "${USER}" "${PASS}"`, true);

  const lista = await s.command(`LIST "" "*"`);
  const linhas = lista.split(/\r?\n/).filter((l) => l.startsWith("* LIST"));
  const pasta =
    nomeDaPasta(
      linhas.find((l) => /\\Sent\b/i.test(l)) ||
        linhas.find((l) => /(Sent(?: Items| Messages)?|INBOX\.Sent)"?\s*$/i.test(l)),
    ) || "Sent";

  await s.command(`EXAMINE "${pasta}"`);
  const busca = await s.command(`UID SEARCH SINCE ${DESDE}`);
  const uids = (busca.match(/^\* SEARCH([^\r\n]*)/m)?.[1] || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  console.log(`pasta "${pasta}" · ${uids.length} carta(s) desde ${DESDE}`);
  console.log("");

  const comLink = [];
  const comLocalhost = [];

  for (const uid of uids) {
    let bruto;
    try {
      const r = await s.command(`UID FETCH ${uid} (BODY.PEEK[])`);
      bruto = decodificarCorpo(r);
    } catch {
      continue;
    }
    const para =
      bruto.match(/^To:\s*(.+)$/im)?.[1]?.trim().replace(/.*<|>.*/g, "") ?? "?";
    const data = bruto.match(/^Date:\s*(.+)$/im)?.[1]?.trim() ?? "?";
    const assunto = bruto.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? "?";

    // qualquer link de verificação do Supabase no corpo
    const verifies = [...bruto.matchAll(/auth\/v1\/verify\?[^\s"'<>]+/g)].map(
      (m) => m[0],
    );
    if (!verifies.length) continue;

    comLink.push({ uid, para, data, assunto });

    for (const v of verifies) {
      const rt = v.match(/redirect_to=([^&\s"'<>]+)/)?.[1];
      const destino = rt ? decodeURIComponent(decodeURIComponent(rt)) : "(sem redirect_to)";
      if (/localhost|127\.0\.0\.1/i.test(destino)) {
        comLocalhost.push({ uid, para, data, assunto, destino });
        break;
      }
    }
  }

  s.close();

  console.log(`cartas com link de verificação do Supabase: ${comLink.length}`);
  console.log("");
  console.log(
    "══════════════════════════════════════════════════════════════════",
  );
  console.log(`🕳️  COM redirect_to PRO LOCALHOST: ${comLocalhost.length}`);
  console.log(
    "══════════════════════════════════════════════════════════════════",
  );
  for (const c of comLocalhost) {
    console.log(`  uid ${c.uid} · ${c.data}`);
    console.log(`     para: ${c.para}`);
    console.log(`     assunto: ${c.assunto}`);
    console.log(`     destino: ${c.destino}`);
  }
  if (!comLocalhost.length) {
    console.log("  nenhuma. (não é prova de que nunca houve — só desta janela)");
  }
  console.log("");
  const destinatarios = [...new Set(comLocalhost.map((c) => c.para))];
  console.log(`alunos distintos afetados nesta janela: ${destinatarios.length}`);
  for (const d of destinatarios) console.log(`  · ${d}`);
})().catch((e) => {
  console.error("falhou:", e?.message ?? e);
  process.exit(1);
});
