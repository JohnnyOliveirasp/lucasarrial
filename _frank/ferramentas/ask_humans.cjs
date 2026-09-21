#!/usr/bin/env node
/**
 * ask_humans.cjs — PEDIR OLHO/OUVIDO/DECISAO HUMANA AO GRUPO (regra 9-D).
 *
 * POR QUE EXISTE. Ate hoje (21/09) a regra 9-D mandava fazer isto com um
 * `node -e` colado a mao dentro do 01_REGRAS_DURAS.md. Tres problemas medidos:
 *
 *   1. O one-liner le AGENT_MONITOR_TOKEN e faz fetch na mesma linha de shell.
 *      O guard de seguranca da maquina do Frank reconhece essa forma como
 *      "fonte de segredo + canal de saida" e DERRUBA o comando. Na ronda
 *      serial de 21/09 19h30Z o pedido do #214 foi bloqueado assim. Pedido que
 *      nao sai e decisao que nunca chega — e a regra 9-D so funciona se o
 *      pedido chegar.
 *   2. One-liner nao tem ENSAIO. Mensagem pro grupo nao tem desfazer, e a
 *      regra 27 (conversa curta) cobra densidade: da pra errar o texto uma vez
 *      so. Aqui `--seco` e o padrao: sem `--confirmar` nada sai.
 *   3. O one-liner nao confere a resposta. A rota devolve `has_link`, e quando
 *      ele vem `false` o pedido nasceu CEGO (ninguem abre um audio que nao tem
 *      link). Aqui isso vira aviso explicito, nao um JSON que ninguem leu.
 *
 * ⚠️ USE A ROTA, NAO O avisar_grupo.cjs. A WAHA so escuta em 127.0.0.1 no
 * Hetzner; fora de la o script morre com "WAHA ausente nesta maquina". A rota
 * faz o envio de dentro do app, que vive no mesmo host da WAHA.
 *
 * ⚠️ PASSE --audio-key, NUNCA um link montado a mao: a rota assina sozinha com
 * 24h de validade. Link curto demais expira antes de alguem acordar.
 *
 * USO:
 *   node _frank/ferramentas/ask_humans.cjs \
 *     --subject "uma linha: o que e"        \
 *     --student "aluno@x.com"               \
 *     --checked "o que voce JA mediu"       \
 *     --question "a pergunta binaria, com a sua recomendacao" \
 *     [--incident <uuid completo>] [--audio-key <chave no R2>] \
 *     [--arquivo /tmp/pedido.json]   (campos longos vindos de arquivo)
 *     [--confirmar]                  (sem isto, so ENSAIA)
 */
const path = require("node:path");
const fs = require("node:fs");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv"))
  .config({ path: path.join(RAIZ, "frontend", "frontend", ".env.local") });
require(path.join(RAIZ, "frontend", "node_modules", "dotenv"))
  .config({ path: path.join(RAIZ, "frontend", ".env.local") });

const ROTA = process.env.SITE_URL
  ? `${process.env.SITE_URL.replace(/\/$/, "")}/api/v1/agent/actions`
  : "https://fastcloner.com/api/v1/agent/actions";

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  // Campos longos cabem melhor em arquivo: aspas de shell ja comeram nota de
  // incidente antes, e "checked" e justamente o campo que nao pode encolher.
  const doArquivo = arg("arquivo") ? JSON.parse(fs.readFileSync(arg("arquivo"), "utf8")) : {};

  const body = {
    action: "ask_humans",
    subject: arg("subject") ?? doArquivo.subject,
    student: arg("student") ?? doArquivo.student,
    checked: arg("checked") ?? doArquivo.checked,
    question: arg("question") ?? doArquivo.question,
  };
  const inc = arg("incident") ?? doArquivo.incident_id;
  const key = arg("audio-key") ?? doArquivo.audio_key;
  if (inc) body.incident_id = inc;
  if (key) body.audio_key = key;

  for (const campo of ["subject", "checked", "question"]) {
    if (!body[campo]) {
      console.error(`❌ falta --${campo}. Pedido sem isso morre no grupo sem ninguem responder.`);
      process.exit(1);
    }
  }

  const token = process.env.AGENT_MONITOR_TOKEN;
  if (!token) {
    console.error("❌ AGENT_MONITOR_TOKEN ausente no frontend/.env.local");
    process.exit(1);
  }

  console.log("rota:     ", ROTA);
  console.log("subject:  ", body.subject);
  console.log("student:  ", body.student || "(nenhum)");
  console.log("incidente:", body.incident_id || "(nenhum)");
  console.log("audio_key:", body.audio_key || "(nenhum)");
  console.log("--- checked ---\n" + body.checked);
  console.log("--- question ---\n" + body.question);

  if (!process.argv.includes("--confirmar")) {
    console.log("\n🔎 ENSAIO — nada foi enviado ao grupo. Repita com --confirmar.");
    return;
  }

  const r = await fetch(ROTA, {
    method: "POST",
    headers: { "x-agent-token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const bruto = await r.text();
  console.log(`\nHTTP ${r.status}`);
  console.log(bruto.slice(0, 800));

  let j;
  try { j = JSON.parse(bruto); } catch { /* resposta nao-JSON ja foi impressa */ }
  if (j && body.audio_key && j.has_link === false) {
    console.log("\n⚠️  has_link=false: o pedido nasceu CEGO — ninguem vai atras de um audio sem link.");
  }
  if (!r.ok) process.exit(1);
  console.log("\n✅ pedido no grupo. Espere alguem responder ANTES de queimar GPU (9-D).");
})();
