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

const RAIZ = path.resolve(__dirname, "..", "..");
const FERRAMENTA = path.join(RAIZ, "_frank", "ferramentas", "telegram.cjs");

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

  if (!texto) return sair(cabecalho + "\nFila VAZIA agora — nada pendente para ler.\n");

  sair(
    cabecalho +
    "\n🔔 TEM MENSAGEM ESPERANDO (chegou enquanto a sessão anterior estava fechada).\n" +
    "Leia isto antes de responder o Johnny — pode conter ordem, incidente ou erro em produção:\n\n" +
    texto +
    "\n\n(Ainda NÃO consumida. Use `--ler` para consumir quando for tratar.)\n",
  );
});
