/**
 * "QUANTAS VEZES A CASA DISSE QUE JÁ TINHA FEITO, SEM TER FEITO?"
 *
 * POR QUE EXISTE (incidente eac94e82, 23/09):
 * Em 22/09 às 22:55:12Z a casa escreveu ao Diego Vargas: "Já coloquei pra
 * rodar aqui. Deve ficar pronto em alguns minutos e eu te aviso." NENHUMA
 * geração foi criada. Ele esperou 13h acreditando que estava processando.
 * A causa medida: o agente não possui ferramenta que enfileire geração, e a
 * guarda contra afirmar ato não visto existe só para ESTORNO (manual.ts:208,
 * seção ## Créditos) — nunca alcançaria este caso.
 *
 * O dano deste defeito NÃO RECLAMA: o aluno que ouviu "já rodei" fica calado
 * esperando, exatamente como o Diego ficou. Por isso a pergunta "quantos
 * outros?" não pode continuar sem instrumento. Este script é o instrumento.
 *
 * ⚠️ ELE NÃO DECIDE NADA. Ele LEVANTA CANDIDATAS. Frase de promessa não é
 * prova de falha: em muitos casos a casa disse "já liberei" e tinha liberado
 * mesmo. Cada candidata precisa ser conferida contra o banco, uma a uma. A
 * saída é uma fila de verificação, não um veredito.
 *
 * ── CONTROLE POSITIVO OBRIGATÓRIO ────────────────────────────────────────
 * A carta do Diego (22/09, "coloquei pra rodar") É conhecida e TEM que
 * aparecer na varredura. Se não aparecer, o instrumento está CEGO e o script
 * sai com código ≠ 0 gritando isso, em vez de imprimir um zero mentiroso.
 * Motivo de existir esta trava, medido em 18/09: a primeira versão do
 * `dump_enviada.cjs` só desfazia quoted-printable, e como as cartas da casa
 * saem em BASE64 ela devolveu "0 cartas com link" em 2819 varridas — um zero
 * falso que por acaso CONCORDAVA com a hipótese de quem media. Nunca mais.
 *
 * Garantias de leitura pura, iguais às do `ler_caixa.cjs` / `dump_enviada.cjs`:
 *  - EXAMINE (nunca SELECT) + BODY.PEEK, então nenhuma flag é tocada e a Fast
 *    não "consome" carta nenhuma marcando como lida;
 *  - tripwire que recusa qualquer verbo de escrita do IMAP.
 *
 * uso: node _frank/ferramentas/2026-09-23_promessa_de_ato_nas_cartas.cjs [--desde 01-Aug-2026] [--lote 25]
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

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};
const DESDE = arg("--desde", "01-Aug-2026");
const LOTE = Number(arg("--lote", "25"));

/**
 * Frases em que a casa afirma um ATO JÁ CONSUMADO (ou em curso agora) do lado
 * dela. Deliberadamente NÃO inclui promessa de futuro ("vou rodar", "vamos
 * verificar"): promessa de futuro não engana o aluno sobre o estado atual —
 * o que prende o aluno calado é acreditar que a coisa JÁ está acontecendo.
 */
const PROMESSAS = [
  { re: /j[áa]\s+coloquei\s+(pra|para)\s+(rodar|processar|gerar|treinar)/i, rotulo: "já coloquei pra rodar" },
  { re: /j[áa]\s+(refiz|rodei|gerei|processei|treinei|reprocessei)/i, rotulo: "já refiz/rodei/gerei" },
  { re: /j[áa]\s+(liberei|creditei|estornei|devolvi)/i, rotulo: "já liberei/creditei/estornei" },
  { re: /j[áa]\s+(corrigi|ajustei|apliquei)/i, rotulo: "já corrigi/ajustei" },
  { re: /acabei\s+de\s+(rodar|refazer|colocar|liberar|gerar|processar|enviar)/i, rotulo: "acabei de ..." },
  { re: /(est[áa]|t[áa])\s+(rodando|processando|gerando|treinando)\s+(agora|aqui)/i, rotulo: "está rodando agora" },
  { re: /coloquei\s+(pra|para)\s+(rodar|processar)\s+aqui/i, rotulo: "coloquei pra rodar aqui" },
  { re: /deve\s+ficar\s+pronto\s+em\s+(alguns?|poucos?)\s+minutos/i, rotulo: "deve ficar pronto em minutos" },
];

// A carta que TEM que aparecer, senão o instrumento é cego.
const CONTROLE = { email: "diegoavnunes@gmail.com", frase: /coloquei\s+(pra|para)\s+rodar/i };

let buf = Buffer.alloc(0);
let seq = 0;
let sock = null;

const espera = (re, ms = 180_000) =>
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

/** Mesma decodificação do dump_enviada: base64 É o caso comum da casa. */
function decodificar(bruto) {
  const enc = (bruto.match(/^Content-Transfer-Encoding:\s*(\S+)/im)?.[1] ?? "").trim().toLowerCase();
  const corte = bruto.search(/\r?\n\r?\n/);
  let corpo = corte >= 0 ? bruto.slice(corte) : bruto;
  if (enc === "base64") {
    const b64 = corpo.split(/\r?\n/).filter((l) => /^[A-Za-z0-9+/=]{4,}\s*$/.test(l)).join("");
    try { corpo = Buffer.from(b64, "base64").toString("utf8"); } catch { /* cru */ }
  } else if (enc === "quoted-printable") {
    corpo = corpo.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return corpo;
}

/** Separa a resposta de um FETCH em lote nas cartas individuais, por uid. */
function fatiarPorUid(bruto) {
  const partes = [];
  const re = /\*\s+\d+\s+FETCH\s+\([^)]*?UID\s+(\d+)/gi;
  const marcas = [...bruto.matchAll(re)];
  for (let i = 0; i < marcas.length; i++) {
    const ini = marcas[i].index;
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : bruto.length;
    partes.push({ uid: marcas[i][1], bruto: bruto.slice(ini, fim) });
  }
  return partes;
}

/** Recorta a frase achada com um pouco de contexto, pra leitura humana. */
function trecho(corpo, re) {
  const m = corpo.match(re);
  if (!m) return "";
  const i = Math.max(0, m.index - 90);
  return corpo.slice(i, Math.min(corpo.length, m.index + m[0].length + 110)).replace(/\s+/g, " ").trim();
}

(async () => {
  if (!PASS) { console.error("faltou SUPPORT_MAIL_PASSWORD"); process.exit(1); }

  await new Promise((ok, no) => {
    sock = tls.connect({ host: HOST, port: 993, servername: HOST }, () => ok());
    sock.on("error", no);
    sock.on("data", (c) => { buf = Buffer.concat([buf, c]); });
  });
  await espera(/^\* OK/m);
  await cmd(`LOGIN "${USER}" "${PASS}"`, true);
  await cmd(`EXAMINE "Sent"`);

  const rBusca = await cmd(`UID SEARCH SINCE ${DESDE}`);
  const uids = (rBusca.match(/^\*\s+SEARCH([^\r\n]*)/mi)?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
  console.log(`pasta Sent · cartas desde ${DESDE}: ${uids.length}`);
  if (!uids.length) { console.error("ZERO cartas na janela — janela errada ou pasta errada. PARE."); process.exit(1); }

  const achados = [];
  let lidas = 0;
  for (let i = 0; i < uids.length; i += LOTE) {
    const faixa = uids.slice(i, i + LOTE).join(",");
    let bruto;
    try {
      bruto = await cmd(`UID FETCH ${faixa} (BODY.PEEK[])`);
    } catch (e) {
      console.error(`  lote ${i}-${i + LOTE} falhou: ${e.message.slice(0, 120)}`);
      continue;
    }
    for (const carta of fatiarPorUid(bruto)) {
      lidas++;
      const corpo = decodificar(carta.bruto);
      const para = carta.bruto.match(/^To:\s*(.+)$/im)?.[1]?.trim() ?? "?";
      const data = carta.bruto.match(/^Date:\s*(.+)$/im)?.[1]?.trim() ?? "?";
      const assunto = carta.bruto.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? "?";
      for (const p of PROMESSAS) {
        if (p.re.test(corpo)) {
          achados.push({ uid: carta.uid, para, data, assunto, rotulo: p.rotulo, trecho: trecho(corpo, p.re) });
          break;
        }
      }
    }
    process.stderr.write(`\r  lidas ${lidas}/${uids.length} · candidatas ${achados.length}   `);
  }
  process.stderr.write("\n");

  // ── CONTROLE POSITIVO ──────────────────────────────────────────────────
  const controle = achados.find((a) => a.para.includes(CONTROLE.email) && CONTROLE.frase.test(a.trecho));
  console.log("");
  console.log("CONTROLE POSITIVO (a carta do Diego de 22/09 tem que estar aqui):");
  if (!controle) {
    console.log("   ✗ NÃO ACHEI — INSTRUMENTO CEGO.");
    console.log("   O zero/os números acima NÃO valem. Provável causa: decodificação");
    console.log("   (a casa manda base64), janela --desde curta, ou pasta errada.");
    console.log(`   lidas=${lidas} de ${uids.length} uids na janela.`);
    process.exit(2);
  }
  console.log(`   ✓ achada — uid ${controle.uid} · ${controle.data}`);
  console.log(`     "${controle.trecho.slice(0, 150)}"`);
  console.log("   O instrumento enxerga. Os números abaixo podem ser lidos.");

  console.log("");
  console.log(`VARRIDAS: ${lidas} cartas · CANDIDATAS: ${achados.length}`);
  console.log("(candidata = a casa afirmou um ato dela. NÃO é prova de que não fez.)");
  console.log("");
  const porRotulo = {};
  for (const a of achados) porRotulo[a.rotulo] = (porRotulo[a.rotulo] ?? 0) + 1;
  for (const [r, n] of Object.entries(porRotulo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)} × ${r}`);
  }
  console.log("");
  console.log("FILA DE VERIFICAÇÃO (cada uma precisa ser conferida no banco):");
  for (const a of achados.sort((x, y) => (x.data < y.data ? 1 : -1))) {
    console.log(`\n  uid ${a.uid} · ${a.data}`);
    console.log(`  para: ${a.para}`);
    console.log(`  assunto: ${a.assunto.slice(0, 90)}`);
    console.log(`  [${a.rotulo}] "${a.trecho.slice(0, 190)}"`);
  }

  sock.end();
})().catch((e) => {
  console.error("falhou:", e?.message ?? e);
  process.exit(1);
});
