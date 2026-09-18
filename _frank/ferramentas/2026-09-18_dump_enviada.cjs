/**
 * DUMP DE UMA CARTA DA PASTA ENVIADOS — leitura pura, controle positivo.
 *
 * POR QUE EXISTE: nesta ronda (19hZ de 18/09) o
 * `2026-09-18_link_localhost_na_pasta.cjs` devolveu **0 cartas com link de
 * verificação** em 2819 varridas. Zero que não bate com nada é suspeito de ser
 * falso — a ronda de 17/09 já pegou dois zeros falsos num dia só. Antes de
 * acreditar no zero, é preciso abrir UMA carta conhecida e ver com o olho o que
 * tem dentro dela. É pra isso que este script serve.
 *
 * Garantias iguais às do `ler_caixa.cjs`: `EXAMINE` (read-only) + `BODY.PEEK[]`,
 * nenhuma flag é alterada, nenhum comando de escrita é emitido.
 *
 * NÃO imprime senha nem token: as URLs saem truncadas em 120 caracteres, o que
 * basta pra ver o HOST e o caminho sem expor a credencial que vai no `token=`.
 *
 * uso: node _frank/ferramentas/2026-09-18_dump_enviada.cjs <uid>
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

const uid = process.argv[2];
if (!uid) {
  console.error("uso: node _frank/ferramentas/2026-09-18_dump_enviada.cjs <uid>");
  process.exit(1);
}

let buf = Buffer.alloc(0);
let seq = 0;
let sock = null;

const espera = (re, ms = 120_000) =>
  new Promise((ok, no) => {
    const t0 = Date.now();
    const tick = () => {
      const cauda = buf.subarray(Math.max(0, buf.length - 4096)).toString("latin1");
      if (re.test(cauda)) return ok(buf.toString("latin1"));
      if (Date.now() - t0 > ms) return no(new Error("IMAP demorou"));
      setTimeout(tick, 50);
    };
    tick();
  });

const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b/i;

async function cmd(c, sensivel = false) {
  if (!sensivel && PROIBIDOS.test(c)) throw new Error(`comando PROIBIDO: ${c.split(" ")[0]}`);
  const tag = `a${++seq}`;
  buf = Buffer.alloc(0);
  sock.write(`${tag} ${c}\r\n`);
  const r = await espera(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
  if (!new RegExp(`^${tag} OK`, "m").test(r)) throw new Error(r.slice(-300));
  return r;
}

/**
 * Decodifica o corpo conforme o `Content-Transfer-Encoding` REAL da carta.
 *
 * ⚠️ ARMADILHA MEDIDA NESTA RONDA: a primeira versão deste código só desfazia
 * quoted-printable. As cartas que a casa manda pelo `enviar_email.cjs` saem em
 * **base64** — então o grep não achava URL nenhuma e devolvia "0 cartas com
 * link" em 2819 varridas. Zero falso, e um que CONCORDAVA com a hipótese de
 * quem media. Sempre olhe o `Content-Transfer-Encoding` antes de acreditar.
 */
function decodificarCorpo(bruto) {
  const enc = (bruto.match(/^Content-Transfer-Encoding:\s*(\S+)/im)?.[1] ?? "")
    .trim()
    .toLowerCase();

  // corpo = tudo depois da primeira linha em branco do bloco de cabeçalhos
  const corte = bruto.search(/\r?\n\r?\n/);
  const cabecalho = corte >= 0 ? bruto.slice(0, corte) : bruto;
  let corpo = corte >= 0 ? bruto.slice(corte) : "";

  if (enc === "base64") {
    // pedaços de base64 podem vir entremeados com a moldura do IMAP; pega só
    // as linhas que são base64 puro e concatena.
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
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return `${cabecalho}\n${corpo}`;
}

(async () => {
  if (!PASS) {
    console.error("faltou SUPPORT_MAIL_PASSWORD");
    process.exit(1);
  }
  await new Promise((ok, no) => {
    sock = tls.connect({ host: HOST, port: 993, servername: HOST }, () => ok());
    sock.on("error", no);
    sock.on("data", (c) => {
      buf = Buffer.concat([buf, c]);
    });
  });
  await espera(/^\* OK/m);
  await cmd(`LOGIN "${USER}" "${PASS}"`, true);
  await cmd(`EXAMINE "Sent"`);

  const bruto = await cmd(`UID FETCH ${uid} (BODY.PEEK[])`);
  const corpo = decodificarCorpo(bruto);

  console.log(`uid ........ ${uid}`);
  console.log(`bytes ...... ${bruto.length}`);
  console.log(`To ......... ${bruto.match(/^To:\s*(.+)$/im)?.[1] ?? "?"}`);
  console.log(`Date ....... ${bruto.match(/^Date:\s*(.+)$/im)?.[1] ?? "?"}`);
  console.log(`Subject .... ${bruto.match(/^Subject:\s*(.+)$/im)?.[1] ?? "?"}`);
  console.log(
    `Encoding ... ${bruto.match(/^Content-Transfer-Encoding:\s*(.+)$/im)?.[1] ?? "?"}`,
  );
  console.log("");
  console.log("URLs no corpo (truncadas em 120 — não expor token):");
  const urls = [...new Set([...corpo.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)].map((m) => m[0]))];
  if (!urls.length) console.log("   (nenhuma)");
  for (const u of urls) console.log(`   ${u.length > 120 ? `${u.slice(0, 120)}…[corte]` : u}`);
  console.log("");
  // O que importa no link de verificação é PRA ONDE ele joga o aluno depois de
  // queimar o token. Isso mora no `redirect_to` e é o que a ronda de 19hZ de
  // 18/09 foi medir. Sai separado porque a URL inteira é truncada pra não
  // expor o `token=`.
  console.log("redirect_to de cada link de verificação:");
  const verifies = [...corpo.matchAll(/auth\/v1\/verify\?[^\s"'<>\\)]+/g)].map((m) => m[0]);
  if (!verifies.length) console.log("   (nenhum link de verificação)");
  for (const v of verifies) {
    const rt = v.match(/redirect_to=([^&\s"'<>]+)/)?.[1];
    let destino = rt ? decodeURIComponent(rt) : "(sem redirect_to)";
    if (/%2F|%3A/i.test(destino)) destino = decodeURIComponent(destino);
    console.log(`   ${destino}`);
  }
  console.log("");
  console.log(`tem "localhost" ....... ${/localhost|127\.0\.0\.1/i.test(corpo)}`);
  console.log(`tem "auth/v1/verify" .. ${/auth\/v1\/verify/i.test(corpo)}`);
  console.log(`tem "reset-password" .. ${/reset-password/i.test(corpo)}`);

  sock.end();
})().catch((e) => {
  console.error("falhou:", e?.message ?? e);
  process.exit(1);
});
