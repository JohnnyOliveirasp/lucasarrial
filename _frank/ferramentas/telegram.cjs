#!/usr/bin/env node
/**
 * telegram.cjs — o canal do grupo (Johnny + Frank + Claude).
 *
 * POR QUE EXISTE (pedido do Johnny, 20/08): o Telegram era só do Johnny, e
 * isso o transformava em carteiro de recado técnico entre os dois agentes —
 * exatamente o que deu errado com o DDL em 18/08. Agora os dois agentes falam
 * no MESMO grupo, e ele lê a conversa em vez de repassá-la.
 *
 * ⚠️ BOT FALA COM BOT, SIM — mas só com ENDEREÇAMENTO EXPLÍCITO.
 * Eu escrevi aqui que "o Telegram não entrega a um bot as mensagens de outro
 * bot". ERRADO, e provado errado em 20/08 14:02Z: o Frank e eu somos bots
 * diferentes e nos lemos. O que enganou foi o `--diagnostico` marcar 0
 * mensagens de bot — tirei conclusão grande de um zero, que é exatamente o
 * erro que este repo vive cobrando.
 *
 * O que vale de verdade:
 *   - mensagem SOLTA no grupo NÃO chega ao outro bot;
 *   - chega quando é endereçada: `@nome_do_bot` no texto, ou `/comando@bot`,
 *     ou resposta a uma mensagem dele — e com Bot-to-Bot Mode ligado no
 *     BotFather;
 *   - o bot continua não recebendo as PRÓPRIAS mensagens de volta.
 * Então: SEMPRE inclua `@destino_bot` quando estiver falando com o outro
 * agente. Sem o @, você está falando sozinho e achando que conversou.
 *
 * ⚠️ ORÇAMENTO ANTI-LOOP: o lado do Frank corta a conversa depois de 4 trocas
 * e fica calado até um humano falar. É proposital (dois bots conversando pra
 * sempre gastam dinheiro). Escreva MENSAGEM DENSA, não pingue-pongue.
 *
 * CREDENCIAIS: `.env.telegram` na raiz do repo (gitignored). Arquivo separado
 * de propósito — o agente não precisa (nem pode) abrir o .env de pagamento.
 *
 * USO (de qualquer pasta):
 *   node _frank/ferramentas/telegram.cjs --enviar "texto" [--quem claude|frank]
 *   node _frank/ferramentas/telegram.cjs --arquivo msg.txt   # texto de arquivo
 *
 * ⚠️ Prefira `--arquivo` para texto longo. Em `--enviar "..."` o shell come
 * crase e `$` antes da ferramenta ver (já aconteceu: uma palavra virou
 * "command not found" e sumiu da mensagem).
 *   node _frank/ferramentas/telegram.cjs --ler            # mensagens novas
 *   node _frank/ferramentas/telegram.cjs --achar-grupo    # acha o grupo e grava o id
 *   node _frank/ferramentas/telegram.cjs --diagnostico    # quem sou, o que vejo
 *   node _frank/ferramentas/telegram.cjs --enviar "x" --seco   # ensaia, não manda
 *
 * `--ler` guarda o ponto onde parou em `.env.telegram.offset`, então rodar de
 * novo devolve só o que chegou depois. `--tudo` ignora o ponto salvo.
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
  return { token, chat, remetente: env.TELEGRAM_REMETENTE || "claude" };
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
function montar(texto, quem) {
  const nome = IDENTIDADE[quem] || quem;
  return `${nome}\n${texto}`;
}

async function enviar(texto, quem, seco) {
  const { token, chat, remetente } = credenciais();
  const corpo = montar(texto, quem || remetente);
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
    const arquivo = arg("--arquivo");
    if (arquivo) {
      return await enviar(fs.readFileSync(arquivo, "utf8"), arg("--quem"), tem("--seco"));
    }
    const texto = arg("--enviar");
    if (texto) return await enviar(texto, arg("--quem"), tem("--seco"));
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].split("/**")[1] || "");
  } catch (e) {
    console.error(`ERRO: ${e.message}`);
    process.exit(1);
  }
})();
