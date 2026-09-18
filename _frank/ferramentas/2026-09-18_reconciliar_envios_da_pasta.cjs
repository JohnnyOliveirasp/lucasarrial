/**
 * reconciliar_envios_da_pasta.cjs — a PASTA ENVIADOS é a fonte durável do
 * livro-caixa. Reconstrói em `emails_enviados` toda carta que saiu da casa e
 * não deixou linha (#101).
 *
 * POR QUE EXISTE, E POR QUE NÃO BASTAVA O IRMÃO DO LADO.
 *
 * O #101 foi fechado `fixed`, mas tem um furo VIVO — não é passivo. O PR #311
 * (`366e1cd8`, 16/09 11:26Z) pôs o `registrarEmEnviosDaCasa` dentro do
 * `enviar_email.cjs`, e ele vale pra frente NO CHECKOUT QUE RECEBEU O MERGE.
 * Só que a ronda não manda carta de um checkout só: ela manda de worktree
 * descartável. Medido na ronda de 18/09 14hZ: **99 dos 113 worktrees da
 * máquina** têm um `enviar_email.cjs` SEM a função. Cada um desses é um cano
 * por onde a carta sai pro aluno, entra na pasta Enviados, e não entra na
 * tabela. O furo não fecha por merge — ele fecha quando o worktree morre, e
 * worktree novo nasce todo dia.
 *
 * ⚠️ E O LEDGER NÃO SALVA: `_frank/prova/envios_ledger.jsonl` é GITIGNORED
 * (`.gitignore:126`). Ele é escrito dentro do worktree e morre junto com ele.
 * É exatamente por isso que esta ferramenta NÃO pode ser uma segunda edição do
 * `2026-09-18_backfill_envios_da_ronda.cjs`, que lê o ledger: aquela fonte
 * some, esta não.
 *
 * A CHAVE: a pasta Enviados é REMOTA (IMAP, na conta do suporte@). Ela
 * sobrevive a `git checkout`, a worktree apagada e a máquina formatada. Logo a
 * fonte durável de reconciliação é A PASTA, e o ledger é que é o apoio.
 *
 * ⚠️ RESPOSTA DIRETA À OBJEÇÃO DO IRMÃO. O cabeçalho do backfill escolheu o
 * ledger dizendo que, na pasta, "o Message-ID sai de cabeçalho decodificado —
 * e é o Message-ID que casa o bounce. Reconstruir a chave de casamento a
 * partir de parse de cabeçalho seria apostar a prova no parser". Essa objeção
 * NÃO se aplica: pela RFC 5322 o `Message-ID` é `msg-id`, construído só de
 * `atext`/`dtext` — ASCII imprimível. Ele NUNCA vem MIME-encoded, porque
 * encoded-word (RFC 2047) só é permitido em campos de texto livre, e nunca
 * dentro de um `msg-id`. Não há decodificação nenhuma no caminho da chave:
 * tira `<>`, minúsculo, pronto. Quem de fato vem encoded é o ASSUNTO — e por
 * isso o assunto aqui é decodificado BEST-EFFORT e JAMAIS usado como chave de
 * casamento. Assunto errado é um texto feio na ficha; chave errada é um bounce
 * que não acha onde carimbar.
 *
 * ⚠️ `enviado_em` É CARIMBADO À MÃO, e é o ponto mais perigoso do script. A
 * coluna é `not null default now()` (`scripts/108_emails_enviados.sql`).
 * Inserir sem informar a data gravaria carta de dias atrás como enviada HOJE,
 * o que é PIOR que a ausência: a ficha de contato (`contato-ficha.ts` →
 * `contato-tentativas.ts`) passaria a dizer "a casa escreveu hoje" pra quem
 * está em silêncio há uma semana, e mataria a ordem de reenvio pelo motivo
 * errado. Então a data sai do cabeçalho `Date:` da própria carta e a linha é
 * RECUSADA se ele faltar, não parsear, ou vier no futuro.
 *
 * ⚠️ `origem = 'reconciliado-da-pasta'`. Não é `'ronda-manual'` (mentiria
 * dizendo que houve registro na hora) nem `'ronda-manual-retroativo'` (é do
 * irmão, e marca linha remontada DO LEDGER). Quem abrir a ficha tem que
 * conseguir separar três coisas: o que foi registrado no ato, o que foi
 * remontado do ledger, e o que foi remontado da pasta. A coluna é TEXT sem
 * CHECK de propósito (a migration diz que a lista vive no TypeScript), então o
 * valor novo entra sem migration. Ele fica FORA da união `OrigemEnvio` do
 * `mail-envio.ts` e isso é inofensivo aqui: `_frank/` está fora do programa do
 * `frontend/tsconfig.json` (include é relativo a `frontend/`), então nada
 * typecheca este arquivo, e no runtime o type-stripping do Node 22 não olha
 * tipo nenhum.
 *
 * ⚠️ NÃO INVENTA ENTREGA. `bounce_em`/`bounce_classe` ficam NULOS. Estar na
 * pasta Enviados prova que a carta SAIU — nunca que ela CHEGOU. É a mesma
 * doutrina do `mail-envio.ts`, que se recusa a ter coluna `entregue`: o único
 * fato gravável é o negativo.
 *
 * ⚠️ A PASTA TAMBÉM NÃO É A VERDADE INTEIRA (#210): quando o APPEND falha 3×,
 * o `enviar_email.cjs` grava o envio em `_frank/prova/enviados_local.jsonl`
 * (`registrarLocal`, linha 324). Essa carta SAIU e NÃO está na pasta. Sem ler
 * esse arquivo junto, ela apareceria como nunca enviada. Ele é local e
 * gitignored igual ao ledger — então só ACRESCENTA o que por acaso existir
 * nesta máquina; a fonte que sustenta a conta continua sendo a pasta.
 *
 * ⚠️ SÓ LEITURA no IMAP, as mesmas três regras do `ler_caixa.cjs` (ordem de
 * 19/08): BODY.PEEK[HEADER.FIELDS] nunca BODY[]; EXAMINE nunca SELECT; zero
 * STORE/EXPUNGE/MOVE/DELETE/APPEND/COPY, com tripwire que derruba o processo
 * antes de o comando ir pro socket.
 *
 * ⚠️ DOIS FILTROS DE TEMPO, E ELES NÃO SÃO A MESMA COISA.
 *
 *   `--desde <data>`  → filtro GROSSO, no servidor. Vira `UID SEARCH SINCE`, e
 *                       o IMAP (RFC 3501) só entende DATA CHEIA: `14-Sep-2026`.
 *                       Não existe SINCE com hora. Ele decide o que a máquina
 *                       chega a BAIXAR.
 *   `--corte=<ISO>`   → filtro FINO, aqui dentro, depois de ler o cabeçalho
 *                       `Date:`. Aceita minuto e segundo
 *                       (`2026-09-14T14:06:31Z`). Ele decide, do que foi
 *                       baixado, o que é ESCRITURÁVEL agora.
 *
 * O corte existe porque a fronteira que importa não cai à meia-noite: a tabela
 * nasceu às 14:06:31Z de 14/09 (migration 108) e o módulo de contato
 * (`contato-tentativas.ts`) DECLARA esse instante como início da sua cobertura.
 * Escriturar carta anterior a ele é defensável (a carta saiu mesmo), mas põe
 * dado antes do período que o módulo anuncia cobrir — é decisão de quem
 * confirma, e o corte é o jeito de tomá-la explicitamente.
 *
 * ⚠️ FORA DA JANELA ≠ RECUSADA, e a conta separa as duas.
 * RECUSADA é DEFEITO da carta: sem Message-ID, sem `Date` legível, `Date` no
 * futuro, sem destinatário. FORA DA JANELA é DECISÃO de quem rodou: a carta
 * está sã, só é anterior ao `--corte`. Misturar as duas faria uma decisão de
 * escopo parecer um monte de carta quebrada — e um dia alguém iria "consertar"
 * carta que não tem nada de errado.
 * O corte é aplicado DEPOIS das recusas de cabeçalho (sem Message-ID, sem Date,
 * Date no futuro) porque sem chave ou sem data não dá NEM pra dizer de que lado
 * da janela a carta cai: o defeito é anterior à pergunta. Nos dois modos essas
 * cartas contam como recusadas, então o corte não maquia defeito.
 *
 * SEM `--confirmar` ele SIMULA e só imprime o que faria. COM `--confirmar`
 * grava e RELÊ DO BANCO os Message-IDs que tentou gravar, conferindo um a um
 * se a linha existe e se a data que ficou é a do cabeçalho — insert que afeta
 * 0 linhas em silêncio já fez ronda reportar trabalho que não aconteceu
 * (armadilha de 20/08).
 *
 * USO:
 *   node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs
 *   node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --desde 01-Sep-2026
 *   node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z
 *   node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --json /tmp/recon.json
 *   node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --confirmar
 *   node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --help
 */
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";

const ORIGEM = "reconciliado-da-pasta";
/** migration 108: antes disto a tabela não existia. Só informativo — carta
 *  anterior que saiu é buraco de verdade e pode ser escriturada; o relatório
 *  separa as duas faixas pra quem confirma decidir com o número na frente. */
const TABELA_VIVA_DESDE = "2026-09-14T14:06:31Z";

// ---------- sessão IMAP ----------
//
// Espelhada do `2026-09-18_enviados_x_tabela.cjs` SEM mudança de comportamento.
// Aquele arquivo é um IIFE e não exporta nada (`module.exports` não existe lá),
// então `require` dele EXECUTARIA a ronda inteira em vez de emprestar a função
// — e mexer nele estava fora do escopo deste cartão. Mesmo precedente do
// `ler_caixa.cjs:222`, que espelha o parser do `_anexos.cjs` pelo mesmo motivo.
// SE um dia aquele script passar a exportar `lerEnviados`: apague este bloco e
// troque por um require. Não deixe as duas cópias divergirem.
const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b|\bBODY\[(?!HEADER)/i;

class Sessao {
  constructor() {
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.seq = 0;
  }
  async connect() {
    await new Promise((resolve, reject) => {
      const s = tls.connect({ host: HOST, port: 993, servername: HOST }, () => resolve());
      s.on("error", reject);
      s.setTimeout(60_000, () => {
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
  waitFor(pattern, timeoutMs = 60_000) {
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
    if (!this.socket) throw new Error("IMAP sem conexão");
    if (!sensivel && PROIBIDOS.test(cmd)) {
      throw new Error(`comando PROIBIDO nesta ferramenta (só leitura): ${cmd.split(" ").slice(0, 3).join(" ")}`);
    }
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP ${sensivel ? "LOGIN" : cmd.split(" ")[0]} falhou: ${res.slice(-200)}`);
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
  return linha?.match(/"\S*"\s+(?:"([^"]+)"|(\S+))\s*$/)?.slice(1).find(Boolean) ?? null;
}
/** A pasta se acha pelo atributo \Sent do LIST — NESTE servidor ela se chama
 *  "Sent", não "INBOX.Sent". Procurar por nome fixo já deu caixa errada. */
async function acharEnviados(sessao) {
  const res = await sessao.command(`LIST "" "*"`);
  const linhas = res.split(/\r?\n/).filter((l) => l.startsWith("* LIST"));
  const porFlag = linhas.find((l) => /\\Sent\b/i.test(l));
  const porNome = linhas.find((l) => /(Sent(?: Items| Messages)?|INBOX\.Sent)"?\s*$/i.test(l));
  return nomeDaPasta(porFlag || porNome) || "Sent";
}

/**
 * Chave de casamento: sem `<>`, sem espaço, minúsculo. NÃO passa por
 * decodificação nenhuma — ver a nota da RFC 5322 no cabeçalho. É a mesma
 * normalização do `normalizarMessageId` do `mail-envio.ts`, aplicada dos dois
 * lados (pasta e tabela) pra comparação; quem monta a chave que VAI PRO BANCO
 * é o próprio `linhaDoEnvio`, importado de produção.
 */
function normId(v) {
  return (v || "").replace(/[<>\s]/g, "").toLowerCase() || null;
}
function primeiroEndereco(v) {
  const m = (v || "").match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/);
  return m ? m[0].toLowerCase() : null;
}

function cabecalhosDoBloco(txt) {
  // desdobra continuação (linha começando com espaço/tab)
  const linhas = txt.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/);
  const out = {};
  for (const l of linhas) {
    const m = l.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

/**
 * Assunto legível, BEST-EFFORT — nunca chave de nada.
 * Dois casos, nesta ordem:
 *  1. encoded-word (RFC 2047) → `decodeWord` de produção (`mail-charset.ts`),
 *     que respeita o charset declarado DENTRO do encoded-word (o #320 mostrou
 *     que assumir UTF-8 vira U+FFFD em `=?ISO-8859-1?Q?...?=`).
 *  2. cliente não-conformante que jogou UTF-8 cru no cabeçalho: o header foi
 *     lido em latin1 (1 byte = 1 char), então dá pra recuperar os bytes e,
 *     se forem UTF-8 válido (`utf8Valido`, também de produção), decodificar.
 * Falhou tudo? Devolve o que veio. Assunto feio é cosmético; o que não pode é
 * o script morrer por causa de um cabeçalho torto.
 */
function assuntoLegivel(bruto, charset) {
  if (!bruto) return null;
  try {
    if (/=\?[^?]+\?[BQ]\?/i.test(bruto)) return charset.decodeWord(bruto);
    if (/[\x80-\xff]/.test(bruto)) {
      const bytes = Buffer.from(bruto, "latin1");
      if (charset.utf8Valido(bytes)) return bytes.toString("utf8");
    }
  } catch {
    /* best-effort mesmo */
  }
  return bruto;
}

async function lerEnviados(desde, charset) {
  const s = new Sessao();
  await s.connect();
  await s.command(`LOGIN "${USER}" "${PASS.replace(/(["\\])/g, "\\$1")}"`, true);
  const caixa = await acharEnviados(s);
  await s.command(`EXAMINE "${caixa}"`);
  const busca = await s.command(`UID SEARCH SINCE ${desde}`);
  const uids = (busca.match(/^\* SEARCH([\d\s]*)/m)?.[1] || "").trim().split(/\s+/).filter(Boolean).map(Number);
  const msgs = [];
  for (let i = 0; i < uids.length; i += 50) {
    const lote = uids.slice(i, i + 50);
    const res = await s.command(
      `UID FETCH ${lote.join(",")} (BODY.PEEK[HEADER.FIELDS (DATE TO SUBJECT MESSAGE-ID)])`,
    );
    const re = /UID (\d+) BODY\[HEADER\.FIELDS[^\]]*\] \{(\d+)\}\r?\n/g;
    let m;
    while ((m = re.exec(res))) {
      const uid = Number(m[1]);
      const len = Number(m[2]);
      const bloco = res.slice(m.index + m[0].length, m.index + m[0].length + len);
      const h = cabecalhosDoBloco(bloco);
      msgs.push({
        fonte: `pasta:${caixa} uid ${uid}`,
        messageId: normId(h["message-id"]),
        para: primeiroEndereco(h.to),
        assunto: assuntoLegivel(h.subject, charset),
        quando: h.date ? new Date(h.date) : null,
      });
    }
  }
  s.close();
  return { caixa, uids, msgs };
}

/** #210: cartas que SAÍRAM e cujo APPEND falhou 3× — não estão na pasta. */
function lerRegistroLocal() {
  const arq = path.join(RAIZ, "_frank", "prova", "enviados_local.jsonl");
  if (!fs.existsSync(arq)) return { arq, existe: false, itens: [] };
  const itens = fs
    .readFileSync(arq, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((e) => ({
      fonte: "enviados_local.jsonl (#210)",
      messageId: normId(e.message_id),
      para: (e.para || "").trim().toLowerCase() || null,
      assunto: e.assunto || null,
      quando: e.at ? new Date(e.at) : null,
    }));
  return { arq, existe: true, itens };
}

/**
 * TODOS os Message-IDs já registrados. Pagina de 1000 porque a consulta do
 * Supabase CORTA em silêncio nesse número (armadilha de 20/08).
 * Ordena por `id` (primary key, único) e não por `enviado_em`: com coluna
 * repetida, duas linhas empatadas na fronteira da página podem sair duas vezes
 * ou nenhuma — e uma que "sumisse" viraria insert duplicado batendo no UNIQUE.
 */
async function messageIdsDaTabela(db) {
  const jaTem = new Set();
  let total = 0;
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("emails_enviados")
      .select("message_id")
      .order("id", { ascending: true })
      .range(de, de + 999);
    if (error) throw new Error(`emails_enviados: ${error.message}`);
    total += (data || []).length;
    for (const r of data || []) {
      const k = normId(r.message_id);
      if (k) jaTem.add(k);
    }
    if (!data || data.length < 1000) break;
  }
  return { jaTem, total };
}

function fmt(d) {
  return d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) + "Z" : "?";
}

const AJUDA = `
reconciliar_envios_da_pasta — reconstrói em emails_enviados a carta que saiu da
casa (pasta Enviados, IMAP) e não deixou linha.

  --desde <data>     filtro GROSSO, no servidor (UID SEARCH SINCE). O IMAP só
                     entende DATA CHEIA, no formato dd-Mon-yyyy: 14-Sep-2026.
                     Não existe SINCE com hora. Decide o que é BAIXADO.
                     (padrão: 14-Sep-2026)

  --corte=<ISO>      filtro FINO, aqui dentro, aplicado DEPOIS de ler o
                     cabeçalho Date: da carta. Aceita minuto e segundo:
                     --corte=2026-09-14T14:06:31Z. Decide, do que foi baixado,
                     o que é ESCRITURÁVEL agora. Carta anterior ao instante sai
                     da conta como FORA DA JANELA — que NÃO é o mesmo que
                     'recusada'. Recusada é defeito da carta (sem Message-ID,
                     sem Date, Date no futuro, sem destinatário); fora da janela
                     é decisão de quem rodou, e a carta está sã.
                     Exija o fuso (Z ou ±hh:mm): sem ele o Node leria como hora
                     LOCAL da máquina e o corte mudaria de lugar.
                     (padrão: sem corte — tudo que --desde trouxe vale)

  --json <arquivo>   grava o detalhe (candidatas, fora da janela, recusadas)
  --confirmar        GRAVA. Sem ele o script só simula e não escreve nada.
  --help, -h         esta ajuda
`;

(async () => {
  const argv = process.argv.slice(2);
  // aceita as duas formas: "--k valor" e "--k=valor"
  const pega = (k) => {
    const comIgual = argv.find((a) => a.startsWith(`${k}=`));
    if (comIgual) return comIgual.slice(k.length + 1);
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : null;
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(AJUDA);
    return;
  }
  const confirmar = argv.includes("--confirmar");
  const desde = pega("--desde") || "14-Sep-2026";
  const saidaJson = pega("--json");

  // ⚠️ fuso OBRIGATÓRIO quando vem hora. `new Date("2026-09-14T14:06:31")` é
  // lido como hora LOCAL pelo Node — o corte andaria de lugar conforme a
  // máquina, e um corte que anda é pior que corte nenhum. Data-só vale como
  // meia-noite UTC (é o que a própria ISO 8601 diz).
  const corteBruto = pega("--corte");
  let corte = null;
  if (corteBruto != null) {
    const ok = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(
      corteBruto,
    );
    corte = ok ? new Date(corteBruto.replace(" ", "T")) : null;
    if (!corte || Number.isNaN(corte.getTime())) {
      console.error(
        `FALHOU: --corte inválido: "${corteBruto}"\n` +
          `   use ISO com fuso explícito, ex.: --corte=2026-09-14T14:06:31Z\n` +
          `   (data-só também vale: --corte=2026-09-14 = meia-noite UTC)`,
      );
      process.exit(1);
    }
  }

  // Produção, não cópia: `linhaDoEnvio` monta a linha (e normaliza a chave do
  // casamento) e o `mail-charset` decodifica o assunto. Type-stripping nativo
  // do Node 22, mesmo padrão do `registrarEmEnviosDaCasa` do enviar_email.cjs.
  const envio = await import(path.join(RAIZ, "frontend", "src", "lib", "agent", "mail-envio.ts"));
  const charset = await import(path.join(RAIZ, "frontend", "src", "lib", "agent", "mail-charset.ts"));
  const { supa } = require(path.join(__dirname, "_comum.cjs"));
  const db = supa();

  console.log(`📤 reconciliando pasta Enviados (desde ${desde}) → emails_enviados`);
  console.log(
    corte
      ? `   corte fino: só carta com Date >= ${fmt(corte)} (o resto fica FORA DA JANELA, não é recusa)`
      : `   corte fino: nenhum (--corte=<ISO> estreita por hora/minuto/segundo)`,
  );
  console.log(`   origem das linhas novas: '${ORIGEM}'`);
  console.log(`   modo: ${confirmar ? "⚠️  CONFIRMAR (grava)" : "🧪 ENSAIO (não grava nada)"}\n`);

  const { caixa, uids, msgs } = await lerEnviados(desde, charset);
  console.log(`caixa "${caixa}": ${uids.length} uid(s) na busca, ${msgs.length} com cabeçalho lido`);
  if (uids.length !== msgs.length) {
    console.log(
      `   ⚠️  ${uids.length - msgs.length} uid(s) não renderam cabeçalho — NÃO conte como buraco, conte como NÃO-MEDIDO`,
    );
  }
  const local = lerRegistroLocal();
  console.log(
    local.existe
      ? `registro local (#210, APPEND falhou): ${local.itens.length} carta(s)`
      : `registro local (#210): arquivo não existe nesta máquina — 0 cartas (é gitignored, some com o worktree)`,
  );

  const { jaTem, total } = await messageIdsDaTabela(db);
  console.log(`tabela: ${total} linha(s), ${jaTem.size} Message-ID(s) distintos já registrados\n`);

  // ---- candidatas: o que saiu e não tem linha ----
  const candidatas = new Map(); // mid -> linha (dedup: message_id é UNIQUE)
  const recusadas = [];
  const jaRegistradas = [];
  const duplicadasNaFonte = [];
  const foraDaJanela = []; // --corte: decisão de escopo, NUNCA defeito
  const agora = Date.now();

  for (const m of [...msgs, ...local.itens]) {
    if (!m.messageId) {
      recusadas.push({ m, motivo: "sem Message-ID — nenhum bounce acharia esta linha pra carimbar" });
      continue;
    }
    if (jaTem.has(m.messageId)) {
      jaRegistradas.push(m);
      continue;
    }
    if (candidatas.has(m.messageId)) {
      duplicadasNaFonte.push(m);
      continue;
    }
    if (!m.quando || Number.isNaN(m.quando.getTime())) {
      recusadas.push({ m, motivo: "sem cabeçalho Date legível — gravaria carta velha como enviada HOJE" });
      continue;
    }
    // Data no futuro é cabeçalho corrompido/relógio torto. Deixar passar
    // poluiria a ficha com "a casa escreveu" numa data que ainda não chegou.
    if (m.quando.getTime() > agora + 24 * 3600_000) {
      recusadas.push({ m, motivo: `Date no futuro (${fmt(m.quando)}) — cabeçalho não confiável` });
      continue;
    }
    // ⚠️ AQUI, e não antes: o corte é filtro FINO e só pode ser aplicado depois
    // de a data ter sido lida e validada acima. E vem ANTES das recusas que
    // sobraram (sem destinatário, linha recusada) de propósito: carta que eu
    // decidi não escriturar agora não precisa ser dissecada em busca de defeito.
    if (corte && m.quando.getTime() < corte.getTime()) {
      foraDaJanela.push(m);
      continue;
    }
    if (!m.para) {
      recusadas.push({ m, motivo: "sem destinatário no To — `to_email` é NOT NULL" });
      continue;
    }
    // A linha vem de produção. `origem` fora da união `OrigemEnvio` é de
    // propósito e inofensivo (ver cabeçalho). `bounce_*` nem são passados:
    // ficam nulos, porque a pasta prova que SAIU e nunca que CHEGOU.
    const linha = envio.linhaDoEnvio({
      messageId: m.messageId,
      toEmail: m.para,
      assunto: m.assunto || "",
      origem: ORIGEM,
    });
    if (!linha) {
      recusadas.push({ m, motivo: "`linhaDoEnvio` recusou (chave ou destinatário inválido)" });
      continue;
    }
    // ⚠️ A COLUNA TEM `default now()`. Carimbar aqui é o ponto do script.
    linha.enviado_em = m.quando.toISOString();
    candidatas.set(m.messageId, { linha, fonte: m.fonte, quando: m.quando });
  }

  const lista = [...candidatas.values()].sort((a, z) => a.quando - z.quando);
  console.log(`✔ ${jaRegistradas.length} carta(s) já tinham linha (nada a fazer)`);
  if (duplicadasNaFonte.length) {
    console.log(`✔ ${duplicadasNaFonte.length} repetida(s) entre pasta e registro local — contadas uma vez só`);
  }
  if (foraDaJanela.length) {
    const ordenadas = [...foraDaJanela].sort((a, z) => a.quando - z.quando);
    console.log(
      `\n🚪 ${foraDaJanela.length} FORA DA JANELA (--corte=${corteBruto}) — sem defeito nenhum,` +
        ` só anteriores ao corte:`,
    );
    console.log(`   da mais velha ${fmt(ordenadas[0].quando)} até ${fmt(ordenadas[ordenadas.length - 1].quando)}`);
    console.log(`   NÃO são recusas: some o --corte e elas voltam pra conta. Detalhe por carta: --json`);
  }
  if (recusadas.length) {
    console.log(`\n⛔ ${recusadas.length} RECUSADA(s) de propósito (DEFEITO da carta, não escopo):`);
    for (const r of recusadas) console.log(`   ${r.m.fonte} · ${r.m.para || "?"} — ${r.motivo}`);
  }

  // ---- a conta tem que FECHAR com o que foi lido, senão sumiu carta no meio ----
  const totalLido = msgs.length + local.itens.length;
  const soma =
    jaRegistradas.length + duplicadasNaFonte.length + foraDaJanela.length + recusadas.length + lista.length;
  console.log(`\n📐 CONTAGEM (tem que fechar com o total lido):`);
  console.log(`   ${String(msgs.length).padStart(5)}  lidas da pasta "${caixa}"`);
  console.log(`   ${String(local.itens.length).padStart(5)}  + registro local (#210)`);
  console.log(`   ${String(totalLido).padStart(5)}  = TOTAL`);
  console.log(`   ${String(jaRegistradas.length).padStart(5)}    já tinham linha`);
  console.log(`   ${String(duplicadasNaFonte.length).padStart(5)}    repetidas entre as duas fontes`);
  console.log(`   ${String(foraDaJanela.length).padStart(5)}    FORA DA JANELA (decisão: --corte)`);
  console.log(`   ${String(recusadas.length).padStart(5)}    RECUSADAS (defeito da carta)`);
  console.log(
    `   ${String(lista.length).padStart(5)}    ${
      corte ? "DENTRO DA JANELA — escrituráveis" : "escrituráveis (sem --corte a janela é tudo que --desde trouxe)"
    }`,
  );
  console.log(
    soma === totalLido
      ? `   ✔ ${soma} = ${totalLido}: nenhuma carta sumiu na classificação`
      : `   ⛔ ${soma} ≠ ${totalLido}: ${Math.abs(soma - totalLido)} carta(s) sumiram na classificação — NÃO confirme`,
  );

  const vivo = new Date(TABELA_VIVA_DESDE).getTime();
  const antesDaTabela = lista.filter((f) => f.quando.getTime() < vivo);

  console.log("\n" + "═".repeat(70));
  console.log(
    `🕳️  CARTAS QUE SAÍRAM E NÃO TÊM LINHA${corte ? ", DENTRO DA JANELA" : ""}: ${lista.length}`,
  );
  console.log("═".repeat(70));
  if (antesDaTabela.length) {
    console.log(
      `   (${antesDaTabela.length} delas são anteriores a ${fmt(TABELA_VIVA_DESDE)}, quando a tabela`,
    );
    console.log(`    nasceu. A carta saiu de verdade, então escriturar é correto — mas é DECISÃO`);
    console.log(`    de quem confirma, não defeito novo. Pra deixar essas de fora agora:`);
    console.log(`    --corte=${TABELA_VIVA_DESDE})`);
  }
  for (const f of lista) {
    console.log(`\n   ${fmt(f.quando)} · ${f.linha.to_email}`);
    console.log(`      "${(f.linha.assunto || "(sem assunto)").slice(0, 74)}"`);
    console.log(`      ${f.fonte} · ${f.linha.message_id}`);
  }

  if (saidaJson) {
    fs.writeFileSync(
      saidaJson,
      JSON.stringify(
        {
          desde,
          corte: corte ? corte.toISOString() : null,
          origem: ORIGEM,
          contagem: {
            total_lido: totalLido,
            ja_registradas: jaRegistradas.length,
            duplicadas_na_fonte: duplicadasNaFonte.length,
            fora_da_janela: foraDaJanela.length,
            recusadas: recusadas.length,
            dentro_da_janela: lista.length,
            fecha: soma === totalLido,
          },
          candidatas: lista,
          fora_da_janela: foraDaJanela,
          recusadas,
        },
        null,
        2,
      ),
    );
    console.log(`\ndetalhe gravado em ${saidaJson}`);
  }

  if (!lista.length) {
    console.log("\nnada a fazer.");
    return;
  }

  if (!confirmar) {
    console.log(`\n🧪 SIMULAÇÃO — NADA foi gravado. Rode com --confirmar pra valer.`);
    return;
  }

  // ---- daqui pra baixo só com --confirmar ----

  // `user_id` é conveniência de consulta; a FK é pra `auth.users` e a chave que
  // casa o bounce é o Message-ID. Aluno sem perfil (lead, typo) fica nulo e a
  // linha vale igual — exigir user_id obrigaria a inventar dado.
  const emails = [...new Set(lista.map((f) => f.linha.to_email))];
  const perfis = new Map();
  for (let i = 0; i < emails.length; i += 50) {
    const { data, error } = await db.from("profiles").select("id, email").in("email", emails.slice(i, i + 50));
    if (error) throw new Error(`profiles: ${error.message}`);
    for (const p of data || []) perfis.set((p.email || "").toLowerCase(), p.id);
  }
  for (const f of lista) f.linha.user_id = perfis.get(f.linha.to_email) ?? null;

  // INSERT em lotes, com queda pra linha-a-linha: `message_id` é UNIQUE, então
  // UMA colisão derrubaria o lote INTEIRO e as boas se perderiam junto. Colisão
  // aqui é esperada e benigna (outro processo registrou entre a leitura e o
  // insert) — vira "já estava lá", não erro.
  let gravadas = 0;
  const colidiram = [];
  const falharam = [];
  for (let i = 0; i < lista.length; i += 100) {
    const lote = lista.slice(i, i + 100);
    const { data, error } = await db.from("emails_enviados").insert(lote.map((f) => f.linha)).select("id");
    if (!error) {
      gravadas += data?.length ?? 0;
      continue;
    }
    console.log(`   lote ${i / 100 + 1} falhou em bloco (${error.message}) — tentando linha a linha`);
    for (const f of lote) {
      const { data: d1, error: e1 } = await db.from("emails_enviados").insert(f.linha).select("id");
      if (!e1) {
        gravadas += d1?.length ?? 0;
      } else if (e1.code === "23505") {
        colidiram.push({ f, erro: e1.message });
      } else {
        falharam.push({ f, erro: e1.message });
      }
    }
  }
  console.log(`\n✅ INSERT devolveu ${gravadas} linha(s)`);
  if (colidiram.length) console.log(`   ${colidiram.length} já existia(m) (UNIQUE) — outro processo registrou antes`);
  if (falharam.length) {
    console.log(`   ⛔ ${falharam.length} FALHOU/FALHARAM de verdade:`);
    for (const x of falharam) console.log(`      ${x.f.linha.message_id} · ${x.f.linha.to_email} — ${x.erro}`);
  }

  // ---- RELEITURA: o que o banco confirma, não o que o script planejou ----
  console.log("\n📒 conferindo NO BANCO, Message-ID por Message-ID...");
  const alvos = new Map(lista.map((f) => [f.linha.message_id, f.linha.enviado_em]));
  const chaves = [...alvos.keys()];
  const achadas = new Map();
  for (let i = 0; i < chaves.length; i += 50) {
    const { data, error } = await db
      .from("emails_enviados")
      .select("message_id, enviado_em, origem, bounce_em")
      .in("message_id", chaves.slice(i, i + 50));
    if (error) throw new Error(`releitura falhou: ${error.message}`);
    for (const r of data || []) achadas.set(r.message_id, r);
  }
  const ausentes = chaves.filter((k) => !achadas.has(k));
  const dataTorta = [];
  for (const [k, r] of achadas) {
    if (new Date(r.enviado_em).getTime() !== new Date(alvos.get(k)).getTime()) {
      dataTorta.push({ k, esperado: alvos.get(k), achado: r.enviado_em });
    }
  }
  console.log(`   ${achadas.size}/${chaves.length} existem de fato na tabela`);
  if (ausentes.length) {
    console.log(`   ⛔ ${ausentes.length} NÃO estão lá — o insert não aconteceu, NÃO reporte como escriturado:`);
    for (const k of ausentes) console.log(`      ${k}`);
  }
  if (dataTorta.length) {
    console.log(`   ⛔ ${dataTorta.length} com enviado_em DIFERENTE do cabeçalho — o carimbo histórico falhou:`);
    for (const d of dataTorta) console.log(`      ${d.k}: esperado ${fmt(d.esperado)}, achado ${fmt(d.achado)}`);
  } else if (achadas.size) {
    console.log(`   ✔ nenhuma com data de hoje: o carimbo histórico pegou em todas`);
  }
  const comBounce = [...achadas.values()].filter((r) => r.bounce_em);
  if (comBounce.length) {
    console.log(`   ℹ️  ${comBounce.length} já tinha(m) bounce carimbado (linha pré-existente, não criada aqui)`);
  }
})().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
