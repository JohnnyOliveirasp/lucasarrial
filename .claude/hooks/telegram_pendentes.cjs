#!/usr/bin/env node
/**
 * SessionStart — avisa o Claude, ANTES da primeira pergunta, que existe um
 * canal no Telegram e o que chegou nele enquanto ele não existia.
 *
 * ⚠️ POR QUE EXISTE (20/08): o Frank roda 24h, o Vigia de 2 em 2h, a Fast de 5
 * em 5 min. O Claude só existe com sessão aberta - é o único dos quatro que
 * não acorda sozinho. No dia 20/08 o Frank respondeu 16:11 e a resposta ficou
 * parada até o Johnny cobrar "voce nao esta acompanhando o telegram?". O canal
 * funcionava; faltava alguem OLHAR ao acordar.
 *
 * Usa `--espiar` de proposito: ele NAO consome a fila (offset intacto), entao
 * abrir sessao nao "rouba" mensagem que a ronda ainda vai processar.
 *
 * Fail-open sempre: sem credencial, sem rede ou com erro, o hook sai calado com
 * exit 0. Um canal mudo nao pode impedir a sessao de comecar.
 */
const { execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const RAIZ = path.resolve(__dirname, "..", "..");
const FERRAMENTA = path.join(RAIZ, "_frank", "ferramentas", "telegram.cjs");
const LOG = path.join(RAIZ, ".env.telegram.log");

/** Quantas trocas anteriores relembrar, e quanto de cada uma. */
const LEMBRAR = 6;
const CORTE = 260;

/**
 * O QUE JÁ FOI CONVERSADO — lido do log local, não da fila.
 *
 * ⚠️ POR QUE EXISTE (21/08): o `--espiar` mostra só o que está PENDENTE. Quando
 * a fila está vazia — ou depois que alguém consome — eu acordava sem lembrar de
 * NADA que já tinha sido dito, mesmo com o histórico inteiro no disco. Aconteceu
 * comigo neste dia: consumi a fila e passei a afirmar que "não houve conversa
 * hoje", com 130 mensagens gravadas aqui do lado.
 *
 * A fila é o que falta responder; o log é a memória. São coisas diferentes e
 * a sessão precisa das duas.
 *
 * Corta cada mensagem em ~260 chars de propósito: o log tem 196 KB e isso entra
 * em TODA sessão. Memória cara ninguém mantém ligada.
 */
function ultimasTrocas() {
  let linhas;
  try {
    linhas = fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean);
  } catch {
    return null; // sem log ainda: primeira sessão da vida
  }

  const trocas = [];
  for (let i = linhas.length - 1; i >= 0 && trocas.length < LEMBRAR; i--) {
    let u;
    try {
      u = JSON.parse(linhas[i]);
    } catch {
      continue;
    }
    const m = u && u.message;
    const texto = String((m && m.text) || "").trim();
    if (!texto) continue;
    // ruído do terminal do Frank — não é conversa
    if (/^(⚙️|🔄|✓)\s/.test(texto)) continue;

    const quem = m.from
      ? m.from.is_bot
        ? (m.from.first_name || "bot")
        : (m.from.first_name || "humano")
      : "?";
    const quando = m.date
      ? new Date(m.date * 1000).toISOString().slice(5, 16).replace("T", " ")
      : "";
    const corpo = texto.replace(/\s+/g, " ").slice(0, CORTE);
    trocas.push(`  [${quando}] ${quem}: ${corpo}${texto.length > CORTE ? "…" : ""}`);
  }
  return trocas.length ? trocas.reverse().join("\n") : null;
}

const sair = (contexto) => {
  if (contexto) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: contexto,
      },
    }));
  }
  process.exit(0);
};

execFile(process.execPath, [FERRAMENTA, "--espiar"], { timeout: 15000 }, (err, stdout) => {
  if (err) return sair(null);              // canal fora do ar nao trava sessao
  const texto = String(stdout || "").trim();

  const cabecalho =
    "# CANAL TELEGRAM (grupo BrothersAI) — Johnny + Frank + Claude\n" +
    "Ferramenta: `node _frank/ferramentas/telegram.cjs`\n" +
    "  `--espiar` vê sem consumir · `--ler` consome · `--para frank` para FALAR com o Frank\n" +
    "⚠️ Claude→Frank EXIGE `/msg@Frank_agent_007_bot` na 1ª linha — o `--para frank` monta isso sozinho.\n" +
    "⚠️ 1 assunto = 1 mensagem. Duplicata no canal é o começo do ruído que faz parar de ler.\n" +
    "⛔ Agente não autoriza agente: dinheiro e acesso são decisão do Johnny.\n";

  const memoria = ultimasTrocas();
  const relembrar = memoria
    ? "\n## 🧠 O QUE JÁ FOI CONVERSADO (do log local — pode já ter sido respondido)\n" +
      "Você não lembra disto sozinho: a sessão anterior morreu. Não repita o que já foi dito,\n" +
      "e não afirme que 'não houve conversa' sem olhar aqui.\n\n" +
      memoria +
      "\n"
    : "";

  if (!texto) {
    return sair(
      cabecalho +
      relembrar +
      "\nFila VAZIA agora — nada pendente para responder.\n",
    );
  }

  sair(
    cabecalho +
    relembrar +
    "\n🔔 TEM MENSAGEM ESPERANDO (chegou enquanto a sessão anterior estava fechada).\n" +
    "Leia isto antes de responder o Johnny — pode conter ordem, incidente ou erro em produção:\n\n" +
    texto +
    "\n\n(Ainda NÃO consumida. Use `--ler` para consumir quando for tratar.)\n",
  );
});
