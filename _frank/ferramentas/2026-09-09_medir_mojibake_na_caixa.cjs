/**
 * QUANTOS ALUNOS a Fast leu com o texto CORROMPIDO?
 *
 * Não é simulação: baixa o MIME cru dos últimos N e-mails JÁ LIDOS do INBOX e
 * roda a função `mailText` **de produção** (`frontend/src/lib/agent/mail-respond.ts`,
 * importada via jiti — não um porte) sobre cada um, exatamente como o cérebro da
 * Fast recebe. Depois classifica.
 *
 * O DEFEITO QUE ISTO MEDE (mail-respond.ts:86-91)
 *   try {
 *     const round = Buffer.from(text, "latin1").toString("utf8");
 *     if (!/�/.test(round)) text = round;   // <-- tudo ou nada
 *   } catch {}
 * A guarda anti-mojibake converte o texto INTEIRO e só aceita se NÃO sobrar
 * nenhum U+FFFD. Um único byte indecodificável em QUALQUER lugar — inclusive na
 * CITAÇÃO do e-mail anterior, que não é do aluno — condena o texto todo a ficar
 * em mojibake, inclusive a frase do aluno, que sozinha converteria limpa.
 *
 * CLASSIFICAÇÃO
 *   CORROMPIDO ....... a Fast recebeu mojibake E a conversão da FALA do aluno
 *                      (o trecho antes da citação) sairia limpa. Ou seja: dava
 *                      pra ler e não leu. É a população do defeito.
 *   corrompido-total .. mojibake e nem a fala converte limpa (outra causa).
 *   ok ................ sem mojibake.
 *   sem-acento ........ nada a decidir (texto puro ASCII).
 *
 * Leitura pura: EXAMINE + BODY.PEEK[], nunca BODY[]. Imprime a contagem de
 * não-lidos antes e depois — a fila da Fast não pode encolher por causa desta
 * medição. Nenhum segredo é impresso; e-mail do aluno aparece só na linha do caso.
 *
 * uso: node _frank/ferramentas/2026-09-09_medir_mojibake_na_caixa.cjs [N]   (padrão 40)
 */
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
const FRONT = path.join(RAIZ, "frontend");
require(path.join(FRONT, "node_modules", "dotenv")).config({ path: path.join(FRONT, ".env.local") });

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const SENHA = process.env.SUPPORT_MAIL_PASSWORD || "";

const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b|\bBODY\[/i;

// ---- a função REAL de produção, não um porte ----
const createJiti = require(path.join(FRONT, "node_modules", "jiti"));
const jiti = (createJiti.default || createJiti)(path.join(FRONT, "noop.js"), {
  alias: { "@": path.join(FRONT, "src") },
  interopDefault: true,
});
const { mailText } = jiti(path.join(FRONT, "src", "lib", "agent", "mail-respond.ts"));
if (typeof mailText !== "function") throw new Error("mailText não exportado por mail-respond.ts");

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
      s.on("data", (c) => {
        this.buffer = Buffer.concat([this.buffer, c]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m);
  }
  waitFor(pattern, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const cauda = this.buffer.subarray(Math.max(0, this.buffer.length - 4096)).toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - t0 > timeoutMs) return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  async command(cmd, sensivel = false) {
    if (!sensivel && PROIBIDOS.test(cmd)) throw new Error(`comando PROIBIDO (só leitura): ${cmd.split(" ").slice(0, 3).join(" ")}`);
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) throw new Error(`IMAP ${sensivel ? "LOGIN" : cmd.split(" ")[0]} falhou: ${sensivel ? "(recusado)" : res.slice(-160)}`);
    return res;
  }
  close() {
    try {
      this.socket?.write(`a${++this.seq} LOGOUT\r\n`);
      this.socket?.end();
    } catch {}
  }
}

const cabecalho = (raw, nome) => raw.match(new RegExp(`^${nome}:\\s*(.*)$`, "im"))?.[1]?.trim() ?? "";
const temFFFD = (s) => /�/.test(s);
/** Onde a fala do aluno acaba e começa a citação do e-mail anterior. */
const cortarNaCitacao = (t) => {
  const i = t.search(/\s(?:Fast - FastCloner|Em [A-Za-z0-9]|A [a-zç]+-?f?e?i?r?a?,|\S+@\S+ escreveu|On \w+,|>)/);
  return i > 0 ? t.slice(0, i) : t;
};

(async () => {
  const N = Number(process.argv[2] || 40);
  if (!SENHA) throw new Error("SUPPORT_MAIL_PASSWORD ausente no frontend/.env.local");

  const s = new Sessao();
  await s.connect();
  await s.command(`LOGIN "${USER}" "${SENHA}"`, true);
  await s.command("EXAMINE INBOX");

  const naoLidosAntes = (await s.command("UID SEARCH UNSEEN")).match(/\* SEARCH([^\r\n]*)/i)?.[1].trim().split(/\s+/).filter(Boolean).length ?? 0;

  const uids = ((await s.command("UID SEARCH SEEN")).match(/\* SEARCH([^\r\n]*)/i)?.[1].trim().split(/\s+/).filter(Boolean) ?? [])
    .map(Number)
    .sort((a, b) => a - b)
    .slice(-N);

  const casos = { CORROMPIDO: [], "corrompido-total": [], ok: 0, "sem-acento": 0 };

  for (const uid of uids) {
    let raw;
    try {
      raw = await s.command(`UID FETCH ${uid} (BODY.PEEK[])`);
    } catch {
      continue;
    }
    const texto = mailText(raw);
    if (!texto) continue;
    const de = (cabecalho(raw, "From").match(/[\w.+-]+@[\w.-]+/) || ["?"])[0];
    const assunto = cabecalho(raw, "Subject").slice(0, 60);

    const mojibake = /Ã.|Â./.test(texto);
    if (!mojibake) {
      if (/[À-ÿ]/.test(texto)) casos.ok++;
      else casos["sem-acento"]++;
      continue;
    }
    const falaConvertida = Buffer.from(cortarNaCitacao(texto), "latin1").toString("utf8");
    const inteiroConvertido = Buffer.from(texto, "latin1").toString("utf8");
    const nFFFD = [...inteiroConvertido].filter((c) => c === "�").length;
    const alvo = !temFFFD(falaConvertida) ? "CORROMPIDO" : "corrompido-total";
    casos[alvo].push({ uid, de, assunto, nFFFD, chars: texto.length, fala: cortarNaCitacao(texto).slice(0, 70), falaOk: falaConvertida.slice(0, 70) });
  }

  const naoLidosDepois = (await s.command("UID SEARCH UNSEEN")).match(/\* SEARCH([^\r\n]*)/i)?.[1].trim().split(/\s+/).filter(Boolean).length ?? 0;
  s.close();

  console.log(`\nMedidos ${uids.length} e-mails JÁ LIDOS mais recentes do INBOX, com o mailText DE PRODUÇÃO.\n`);
  console.log(`  CORROMPIDO (dava pra ler e não leu) : ${casos.CORROMPIDO.length}`);
  console.log(`  corrompido-total (outra causa)      : ${casos["corrompido-total"].length}`);
  console.log(`  ok (acento correto)                 : ${casos.ok}`);
  console.log(`  sem acento (nada a decidir)         : ${casos["sem-acento"]}`);

  for (const [rotulo, lista] of [["CORROMPIDO", casos.CORROMPIDO], ["corrompido-total", casos["corrompido-total"]]]) {
    if (!lista.length) continue;
    console.log(`\n--- ${rotulo} ---`);
    for (const c of lista) {
      console.log(`uid ${c.uid} · ${c.de} · ${c.assunto}`);
      console.log(`   ${c.nFFFD} U+FFFD em ${c.chars} chars (${((c.nFFFD / c.chars) * 100).toFixed(3)}%) condenaram o texto inteiro`);
      console.log(`   a Fast leu  : ${JSON.stringify(c.fala)}`);
      console.log(`   estava assim: ${JSON.stringify(c.falaOk)}`);
    }
  }

  console.log(`\nFila da Fast (não-lidos): antes ${naoLidosAntes}, depois ${naoLidosDepois} — ${naoLidosAntes === naoLidosDepois ? "INTACTA (PEEK provado)" : "*** MUDOU, BUG ***"}`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
