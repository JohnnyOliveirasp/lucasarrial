#!/usr/bin/env node
/**
 * telegram.cjs — o canal do grupo (Johnny + Frank + Claude).
 *
 * POR QUE EXISTE (pedido do Johnny, 20/08): o Telegram era só do Johnny, e
 * isso o transformava em carteiro de recado técnico entre os dois agentes —
 * exatamente o que deu errado com o DDL em 18/08. Agora os dois agentes falam
 * no MESMO grupo, e ele lê a conversa em vez de repassá-la.
 *
 * ⚠️ BOT FALA COM BOT — mas só em FORMA DE COMANDO. Este bloco já foi reescrito
 * três vezes em um dia; leia como registro de medição, não como lei.
 *
 *   1ª versão: "bot nunca lê bot, é limite da plataforma".  ERRADO.
 *      Base: `--diagnostico` deu 0 mensagens de bot. Era caixa vazia (o Frank
 *      ainda não tinha postado), não impossibilidade. Conclusão grande de um
 *      zero — o erro que este repo vive cobrando, cometido por mim E por ele
 *      no mesmo dia.
 *
 *   2ª versão: "basta mencionar `@nome_do_bot`".  TAMBÉM ERRADO.
 *      Base: o Frank respondeu depois de uma mensagem minha com `@`. Só que a
 *      resposta veio logo após o Johnny digitar "Frank responde o Claude" — foi
 *      o HUMANO que destravou, não a menção. A mensagem seguinte, com `@`
 *      simples, ficou sem resposta.
 *
 *   3ª versão: "de bot pra bot o Telegram exige comando, sempre".  ERRADO DE NOVO.
 *      Vale numa direção só.
 *
 *   4ª versão — a condição mora em QUEM RECEBE, e isto tem log:
 *      O que decide é o PRIVACY MODE do bot que recebe (+ o gate que ele tenha
 *      no próprio código). Não é uma lei simétrica sobre "bot↔bot".
 *
 *        este bot   `can_read_all_group_messages: true`  -> recebe TUDO do
 *                   grupo, inclusive de outro bot, SEM comando nenhum
 *        o do Frank privacy ligado + gate em `src/bot-to-bot.ts`
 *                   -> só aceita `/comando@bot` ou resposta a mensagem dele
 *
 *      Portanto:  Frank -> aqui : comando desnecessário   (medido)
 *                 aqui -> Frank : comando OBRIGATÓRIO     (medido)
 *
 *      Prova, em `.env.telegram.log` (campo `entities`): updates 231582780 e
 *      231582783 chegaram sem comando e sem entidade `bot_command`. Seis
 *      mensagens dele no total. O que me fez achar que não chegavam foi o bug
 *      do `--ler`, não a entrega.
 *
 * Vale sempre: a própria mensagem NUNCA volta (bot não se ouve), e comando fora
 * da PRIMEIRA linha não é comando. Por isso `--para` monta o prefixo sozinho —
 * ninguém deveria precisar lembrar disto ao escrever.
 *
 * ⚠️ Se for reescrever este bloco uma 5ª vez: traga update_id e timestamp. As
 * três primeiras versões morreram por generalizar de uma observação só.
 *
 * ⚠️ ORÇAMENTO ANTI-LOOP: o lado do Frank corta a conversa depois de 4 trocas
 * e fica calado até um humano falar. É proposital (dois bots conversando pra
 * sempre gastam dinheiro). Escreva MENSAGEM DENSA, não pingue-pongue.
 *
 * CREDENCIAIS: `.env.telegram` na raiz do repo (gitignored). Arquivo separado
 * de propósito — o agente não precisa (nem pode) abrir o .env de pagamento.
 *
 * USO (de qualquer pasta):
 *   node _frank/ferramentas/telegram.cjs --arquivo msg.txt --para frank
 *        ^ RECOMENDADO. `--para` monta /msg@<bot>, que e o unico formato que
 *          o outro AGENTE recebe. Sem ele voce fala so pro Johnny.
 *   node _frank/ferramentas/telegram.cjs --enviar "texto" [--quem claude|frank]
 *   node _frank/ferramentas/telegram.cjs --ler                    # o que chegou depois
 *   node _frank/ferramentas/telegram.cjs --ler --tudo             # tudo, do log local
 *   node _frank/ferramentas/telegram.cjs --pendentes              # só o OUTRO agente
 *   node _frank/ferramentas/telegram.cjs --achar-grupo            # acha e grava o chat_id
 *   node _frank/ferramentas/telegram.cjs --diagnostico            # quem sou, o que vejo
 *   node _frank/ferramentas/telegram.cjs --arquivo x.txt --seco   # ensaia, não manda
 *
 * ⚠️ Prefira `--arquivo` para texto longo: em `--enviar "..."` o shell come
 * crase e `$` antes da ferramenta ver — já aconteceu, uma palavra virou
 * "command not found" e sumiu da mensagem que foi enviada.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
const ENV = path.join(RAIZ, ".env.telegram");
const OFFSET = path.join(RAIZ, ".env.telegram.offset");

const IDENTIDADE = {
  claude: "🧠 Claude",
  frank: "🦊 Frank",
};

// ── credenciais ─────────────────────────────────────────────────────────────
function carregarEnv() {
  if (!fs.existsSync(ENV)) {
    throw new Error(
      `${ENV} não existe.\n` +
        `  Copie o .env.telegram.example para .env.telegram e preencha o token.`,
    );
  }
  const env = {};
  for (const linha of fs.readFileSync(ENV, "utf8").split("\n")) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function credenciais({ exigeChat = true } = {}) {
  const env = carregarEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token) throw new Error(`TELEGRAM_BOT_TOKEN vazio em ${ENV}`);
  if (exigeChat && !chat) {
    throw new Error(
      `TELEGRAM_CHAT_ID vazio em ${ENV}.\n` +
        `  Mande uma mensagem no grupo e rode --diagnostico: ele imprime o id.`,
    );
  }
  return {
    token,
    chat,
    remetente: env.TELEGRAM_REMETENTE || "claude",
    destino: env.TELEGRAM_BOT_DESTINO || "",
  };
}

/** Chama a Bot API. NUNCA deixa o token vazar na mensagem de erro. */
async function api(token, metodo, corpo) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) {
    const detalhe = json.description || `HTTP ${res.status}`;
    throw new Error(`Telegram ${metodo} falhou: ${detalhe}`);
  }
  return json.result;
}

// ── enviar ──────────────────────────────────────────────────────────────────
/**
 * ⚠️ MENÇÃO SIMPLES NÃO ENTREGA. Terceira revisão deste comentário em um dia,
 * então vai o que foi MEDIDO, não o que é elegante:
 *
 *   `@Frank_agent_007_bot texto`      -> NÃO chegou (mandei 14:1x, sem resposta)
 *   `/msg@Frank_agent_007_bot texto`  -> forma de comando endereçado
 *   resposta direta a uma mensagem dele -> também vale
 *
 * A "resposta" que eu achei que tinha funcionado com menção simples veio depois
 * do Johnny digitar "Frank responde o Claude" — foi o humano, não o @.
 *
 * Por isso o prefixo é AUTOMÁTICO aqui: quem escreve mensagem não pode ter que
 * lembrar disso. `--para frank` monta `/msg@<bot>` na PRIMEIRA linha (comando
 * fora do início não é comando).
 */
function montar(texto, quem, paraBot) {
  const nome = IDENTIDADE[quem] || quem;
  const cabeca = paraBot ? `/msg@${paraBot}\n` : "";
  return `${cabeca}${nome}\n${texto}`;
}

/**
 * Menção simples vira comando endereçado, sozinha.
 *
 * Username de bot no Telegram TEM que terminar em "bot" — é isso que deixa
 * detectar com segurança. Se o texto abre com `@algumbot`, a menção é trocada
 * por `/msg@algumbot`, que é a única forma que o outro bot recebe.
 *
 * Isto existe porque avisar não bastou: em 20/08 eu mandei duas mensagens com
 * menção simples achando que tinham chegado. Ferramenta que só avisa depende de
 * alguém ler o aviso.
 */
function comandarMencao(texto) {
  const m = texto.match(/^\s*@([A-Za-z0-9_]*[Bb]ot)\b[ \t]*/);
  if (!m) return { texto, bot: null };
  // Devolve o destino separado do texto: quem monta a mensagem é o `montar`,
  // que sabe pôr o comando na PRIMEIRA linha. Prefixar aqui colocaria o
  // comando depois da linha de identidade — e comando fora da 1ª linha não é
  // comando (pego pelo próprio teste desta ferramenta).
  return { texto: texto.slice(m[0].length), bot: m[1] };
}

async function enviar(texto, quem, seco, paraBot) {
  const { token, chat, remetente, destino } = credenciais();
  let alvo = paraBot === true ? destino : paraBot || null;
  if (paraBot && !alvo) {
    throw new Error(
      "--para pedido mas TELEGRAM_BOT_DESTINO está vazio no .env.telegram.\n" +
        "  Ponha o username do outro bot, sem @ (ex.: Frank_agent_007_bot).",
    );
  }
  // Sem --para, mas o texto abre com menção: converte em vez de só avisar.
  if (!alvo) {
    const r = comandarMencao(texto);
    if (r.bot) {
      texto = r.texto;
      alvo = r.bot;
      console.error(
        `ℹ️  menção @${r.bot} convertida em /msg@${r.bot} — ` +
          "menção simples não é entregue a outro bot.",
      );
    } else if (/@[A-Za-z0-9_]*[Bb]ot\b/.test(texto)) {
      console.error(
        "⚠️  O texto cita um bot com @ no MEIO do texto. Comando fora da 1ª\n" +
          "    linha não é comando — use --para <bot> se a mensagem é pra ele.",
      );
    }
  }
  const corpo = montar(texto, quem || remetente, alvo);
  if (seco) {
    console.log("--- ENSAIO (nada foi enviado) ---");
    console.log(`para chat_id: ${chat}`);
    console.log(corpo);
    return;
  }
  // 4096 é o teto do Telegram; corta em pedaços em vez de estourar.
  const partes = [];
  for (let i = 0; i < corpo.length; i += 3900) partes.push(corpo.slice(i, i + 3900));
  for (const [i, parte] of partes.entries()) {
    const msg = await api(token, "sendMessage", {
      chat_id: chat,
      text: partes.length > 1 ? `${parte}\n\n(${i + 1}/${partes.length})` : parte,
      disable_web_page_preview: true,
    });
    console.log(`enviado (message_id ${msg.message_id})`);
  }
}

// ── ler ─────────────────────────────────────────────────────────────────────
/**
 * ⚠️ POR QUE ISTO É MAIS COMPLICADO DO QUE PARECE (bug real, 20/08):
 * a versão anterior guardava UM ponteiro só e avançava ele para o último update
 * BAIXADO — inclusive os que o filtro de chat descartava. Resultado: mensagem do
 * Frank chegou, o ponteiro passou por cima, e o `--ler` seguinte disse "nada
 * novo". Ele tinha respondido e eu reportei silêncio.
 *
 * Pior: `getUpdates` com offset CONFIRMA no servidor do Telegram, e update
 * confirmado é APAGADO da fila. Ponteiro errado não perde só a vez — perde a
 * mensagem pra sempre.
 *
 * Agora são DOIS ponteiros e um log local:
 *   baixado  — até onde já pedimos ao Telegram (evita repetir download)
 *   mostrado — até onde já foi impresso pra quem lê
 * e TODO update baixado é gravado em `.env.telegram.log` antes de qualquer
 * filtro. Se o filtro errar, a mensagem continua no disco.
 */
const LOG = path.join(RAIZ, ".env.telegram.log");

function lerPonteiros() {
  try {
    const p = JSON.parse(fs.readFileSync(OFFSET, "utf8"));
    return { baixado: p.baixado || 0, mostrado: p.mostrado || 0 };
  } catch {
    // formato antigo: um número só
    try {
      const n = Number(fs.readFileSync(OFFSET, "utf8").trim()) || 0;
      return { baixado: n, mostrado: 0 };
    } catch {
      return { baixado: 0, mostrado: 0 };
    }
  }
}

function gravarPonteiros(p) {
  fs.writeFileSync(OFFSET, JSON.stringify(p), "utf8");
}

/** Grava no disco ANTES de filtrar — filtro errado não pode apagar mensagem. */
function arquivar(updates) {
  if (!updates.length) return;
  fs.appendFileSync(
    LOG,
    updates.map((u) => JSON.stringify(u)).join("\n") + "\n",
    "utf8",
  );
}

/** Releitura do log local (não gasta a fila do Telegram). */
function doLog() {
  try {
    return fs
      .readFileSync(LOG, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function descreve(u) {
  const m = u.message || u.edited_message || u.channel_post;
  if (!m) return null;
  const de = m.from
    ? `${m.from.first_name || ""}${m.from.is_bot ? " [BOT]" : ""}`.trim()
    : "?";
  const quando = new Date((m.date || 0) * 1000).toISOString().replace("T", " ").slice(0, 19);
  return {
    update_id: u.update_id,
    chat_id: m.chat?.id,
    chat: m.chat?.title || m.chat?.username || m.chat?.id,
    de,
    is_bot: Boolean(m.from?.is_bot),
    quando,
    texto: (m.text || m.caption || "(sem texto)").slice(0, 1500),
  };
}

async function ler({ tudo }) {
  const { token, chat } = credenciais({ exigeChat: false });
  const p = lerPonteiros();

  // 1. baixa o que ainda não baixamos e ARQUIVA antes de olhar
  const novos = await api(token, "getUpdates", {
    offset: p.baixado ? p.baixado + 1 : undefined,
    timeout: 0,
    allowed_updates: ["message", "edited_message", "channel_post"],
  });
  arquivar(novos);
  if (novos.length) p.baixado = novos[novos.length - 1].update_id;

  // 2. mostra do LOG (sobrevive a filtro errado e à fila do Telegram sumir)
  const desde = tudo ? 0 : p.mostrado;
  const mostrar = doLog()
    .filter((u) => u.update_id > desde)
    .map(descreve)
    .filter((d) => d && (!chat || String(d.chat_id) === String(chat)));

  for (const d of mostrar) {
    console.log(`\n[${d.quando}] ${d.de} (chat ${d.chat})`);
    console.log(d.texto);
  }
  if (!mostrar.length) console.log("nada novo.");

  // 3. só avança o ponteiro do que foi REALMENTE mostrado
  if (mostrar.length) p.mostrado = Math.max(...mostrar.map((d) => d.update_id));
  gravarPonteiros(p);
}

/** Só o que o outro AGENTE falou e ainda não foi respondido. */
async function pendentes() {
  const { chat } = credenciais({ exigeChat: false });
  await ler({ tudo: true }).catch(() => {});
  const meus = Object.values(IDENTIDADE);
  const deles = doLog()
    .map(descreve)
    .filter((d) => d && (!chat || String(d.chat_id) === String(chat)))
    .filter((d) => d.is_bot && !meus.some((n) => d.texto.startsWith(n)));
  console.log(`\n=== ${deles.length} mensagens de OUTRO agente no log ===`);
  for (const d of deles.slice(-5)) {
    console.log(`\n[${d.quando}] ${d.de}`);
    console.log(d.texto.slice(0, 800));
  }
}

// ── diagnóstico ─────────────────────────────────────────────────────────────
async function diagnostico() {
  const { token } = credenciais({ exigeChat: false });
  const eu = await api(token, "getMe");
  console.log(`Eu sou: @${eu.username} (id ${eu.id})`);
  console.log(`  can_read_all_group_messages: ${eu.can_read_all_group_messages}`);
  if (!eu.can_read_all_group_messages) {
    console.log(
      "  ⚠️ privacy mode LIGADO — no grupo eu só recebo mensagem que me menciona\n" +
        "     ou que é comando. BotFather -> /setprivacy -> Disable, e REMOVA e\n" +
        "     ADICIONE o bot no grupo de novo (a mudança não vale retroativa).",
    );
  }

  const updates = await api(token, "getUpdates", { timeout: 0 });
  console.log(`\nUpdates visíveis agora: ${updates.length}`);
  const chats = new Map();
  let deBot = 0;
  for (const u of updates) {
    const d = descreve(u);
    if (!d) continue;
    if (d.is_bot) deBot++;
    if (!chats.has(d.chat_id)) chats.set(d.chat_id, d.chat);
  }
  if (chats.size) {
    console.log("\nchat_id que eu enxergo (use no TELEGRAM_CHAT_ID):");
    for (const [id, nome] of chats) console.log(`  ${id}  ${nome}`);
  } else {
    console.log("\nNenhum chat visível. Mande uma mensagem no grupo e rode de novo.");
  }

  console.log(`\nMensagens vindas de BOT que eu consegui ler: ${deBot}`);
  console.log(
    deBot > 0
      ? "  -> eu ENXERGO outro bot. Agente->agente pode ir pelo Telegram."
      : "  -> não enxerguei nenhum bot. Se o outro agente JÁ POSTOU no grupo e\n" +
          "     mesmo assim deu 0, está confirmado: bot não lê bot, e o fio\n" +
          "     agente->agente tem que ser o git (_frank/mensagens/).",
  );
}

// ── achar o grupo e preencher o chat_id sozinho ─────────────────────────────
/**
 * O chat_id de um grupo nao aparece em lugar nenhum da interface do Telegram —
 * so a API conta. Entao em vez de pedir isso ao Johnny, a ferramenta descobre e
 * escreve no .env.telegram ela mesma.
 */
async function acharGrupo() {
  const { token } = credenciais({ exigeChat: false });
  const updates = await api(token, "getUpdates", { timeout: 0 });
  const chats = new Map();
  for (const u of updates) {
    const d = descreve(u);
    if (d && d.chat_id) chats.set(d.chat_id, d.chat);
  }
  const grupos = [...chats].filter(([id]) => Number(id) < 0);
  if (!chats.size) {
    console.log(
      [
        "Nao vi nenhuma conversa ainda.",
        "  1. adicione o bot no grupo;",
        "  2. mande QUALQUER mensagem la dentro;",
        "  3. rode este comando de novo.",
      ].join("\n"),
    );
    return;
  }
  console.log("Conversas que eu enxergo:");
  for (const [id, nome] of chats) {
    console.log(`  ${id}  ${nome}${Number(id) < 0 ? "   <- grupo" : ""}`);
  }
  if (grupos.length !== 1) {
    console.log(
      grupos.length
        ? "\nMais de um grupo. Escolha o id certo e ponha no TELEGRAM_CHAT_ID."
        : "\nNenhum GRUPO (id negativo). Adicione o bot ao grupo e mande uma mensagem la.",
    );
    return;
  }
  const [id, nome] = grupos[0];
  const linhas = fs.readFileSync(ENV, "utf8").split("\n");
  const i = linhas.findIndex((l) => l.trim().startsWith("TELEGRAM_CHAT_ID="));
  if (i < 0) linhas.push(`TELEGRAM_CHAT_ID=${id}`);
  else linhas[i] = `TELEGRAM_CHAT_ID=${id}`;
  fs.writeFileSync(ENV, linhas.join("\n"), "utf8");
  console.log(`\nGravado: TELEGRAM_CHAT_ID=${id}  (${nome})`);
}

// ── cli ─────────────────────────────────────────────────────────────────────
function arg(nome) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tem = (nome) => process.argv.includes(nome);

(async () => {
  try {
    if (tem("--achar-grupo")) return await acharGrupo();
    if (tem("--diagnostico")) return await diagnostico();
    if (tem("--pendentes")) return await pendentes();
    if (tem("--ler")) return await ler({ tudo: tem("--tudo") });
    const para = tem("--para") ? (arg("--para") || true) : null;
    const alvo = para === "frank" || para === true ? true : para;
    const arquivo = arg("--arquivo");
    if (arquivo) {
      return await enviar(
        fs.readFileSync(arquivo, "utf8"), arg("--quem"), tem("--seco"), alvo,
      );
    }
    const texto = arg("--enviar");
    if (texto) return await enviar(texto, arg("--quem"), tem("--seco"), alvo);
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].split("/**")[1] || "");
  } catch (e) {
    console.error(`ERRO: ${e.message}`);
    process.exit(1);
  }
})();
