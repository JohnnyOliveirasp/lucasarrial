#!/usr/bin/env node
/**
 * ler_grupo.cjs — LÊ a timeline do grupo da equipe. Irmão do avisar_grupo.cjs.
 *
 * POR QUE EXISTE (lição 8-B, 22/09): a regra manda conferir NO DESTINO que uma
 * mensagem entrou antes de dar o post como feito — saída otimista de script não
 * é prova de efeito. Só que até 23/09 não existia ferramenta commitada que
 * LESSE o grupo: o avisar_grupo.cjs só escreve, e a verificação de 22/09 foi
 * ad-hoc e não sobrou no repo. Este script é o instrumento que faltava.
 *
 * É SOMENTE LEITURA. Não envia nada, não baixa mídia, não marca como lido.
 *
 * USO (no servidor, de qualquer pasta do repo):
 *   node _frank/ferramentas/ler_grupo.cjs                     # últimas 50
 *   node _frank/ferramentas/ler_grupo.cjs --ultimas 20        # últimas 20
 *   node _frank/ferramentas/ler_grupo.cjs --de-nos            # só as NOSSAS
 *   node _frank/ferramentas/ler_grupo.cjs --buscar "incidente ce6e"
 *
 *   --de-nos e --buscar filtram DENTRO das últimas N buscadas; se o que você
 *   procura é antigo, aumente --ultimas (ex.: --ultimas 200 --buscar "...").
 *
 * Imprime, uma linha por mensagem, em ordem cronológica (velha → nova):
 *   <timestamp ISO>  <NOS|eles>  <corpo truncado>
 *
 * ── ONDE ISTO RODA (leia antes de reclamar de erro de config) ───────────────
 * A WAHA só escuta em 127.0.0.1 no SERVIDOR (Hetzner). Este script só funciona
 * rodando LÁ, onde o frontend/.env.local tem WAHA_API_URL/WAHA_API_KEY.
 *
 * Da máquina LOCAL:
 *   • NÃO monte um comando remoto que junte a leitura do segredo com o canal
 *     de saída (o padrão `ssh host 'grep .env.local ... && curl ...'` do
 *     whatsapp_audio.cjs). O guard do FrankClaw (deploy/guard.py) NEGA quando
 *     vê fonte de segredo junto de canal de saída — restrição real medida em
 *     23/09. Não contorne o guard.
 *   • O caminho certo é executar ESTE script no próprio servidor (sessão ssh
 *     interativa, ou o cron/ronda que já roda lá chama ele direto). Se surgir
 *     necessidade de leitura a partir da máquina local, a decisão de como
 *     abrir esse canal é do Johnny — proponha, não improvise.
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

/** Grupo interno da equipe — mesmo default do avisar_grupo.cjs. */
const GRUPO = process.env.AGENT_TEAM_GROUP_JID || "120363428193217427@g.us";

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};

(async () => {
  const ultimas = Number(arg("--ultimas") || 50);
  const deNos = process.argv.includes("--de-nos");
  const buscar = arg("--buscar");

  if (!Number.isInteger(ultimas) || ultimas < 1 || ultimas > 1000) {
    console.error("--ultimas precisa ser um inteiro entre 1 e 1000.");
    process.exit(1);
  }

  const url = process.env.WAHA_API_URL;
  const key = process.env.WAHA_API_KEY;
  if (!url || !key) {
    console.error(
      "WAHA_API_URL/WAHA_API_KEY ausentes nesta máquina.\n" +
        "A WAHA só escuta em 127.0.0.1 no servidor — rode este script LÁ.\n" +
        "(Não monte grep-de-segredo + curl num ssh só: o guard nega. Veja o cabeçalho.)",
    );
    process.exit(1);
  }

  // GET /api/messages — leitura pura; downloadMedia=false pra não puxar mídia.
  const q = new URLSearchParams({
    chatId: GRUPO,
    limit: String(ultimas),
    downloadMedia: "false",
    session: "default",
  });
  const res = await fetch(`${url.replace(/\/$/, "")}/api/messages?${q}`, {
    headers: { "X-Api-Key": key },
  });
  if (!res.ok) {
    console.error(`WAHA ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const dados = await res.json();
  if (!Array.isArray(dados)) {
    console.error(
      `resposta inesperada da WAHA (esperava array): ${JSON.stringify(dados).slice(0, 300)}`,
    );
    process.exit(1);
  }

  const alvo = buscar ? buscar.toLowerCase() : null;
  const linhas = dados
    .filter((m) => !deNos || m.fromMe === true)
    .filter((m) => !alvo || String(m.body || "").toLowerCase().includes(alvo))
    // WAHA devolve da mais nova pra mais velha; timeline lê melhor em ordem.
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .map((m) => {
      const quando = m.timestamp
        ? new Date(m.timestamp * 1000).toISOString().replace(/\.\d{3}Z$/, "Z")
        : "????-??-??T??:??:??Z";
      const autor = m.fromMe
        ? "NOS "
        : `eles${m.participant ? ` (${String(m.participant).replace(/@.*$/, "")})` : ""}`;
      const corpo = String(m.body || "")
        .replace(/\s+/g, " ")
        .trim();
      const texto = corpo
        ? corpo.length > 160
          ? `${corpo.slice(0, 157)}...`
          : corpo
        : "[sem texto / mídia]";
      return `${quando}  ${autor}  ${texto}`;
    });

  if (!linhas.length) {
    const filtro = [deNos ? "--de-nos" : null, buscar ? `--buscar "${buscar}"` : null]
      .filter(Boolean)
      .join(" ");
    console.log(
      filtro
        ? `nada bateu com ${filtro} nas últimas ${ultimas} mensagens do grupo — aumente --ultimas se procura algo antigo.`
        : `o grupo não devolveu mensagem nenhuma (chat ${GRUPO}).`,
    );
    return;
  }

  for (const l of linhas) console.log(l);
  console.log(
    `\n${linhas.length} de ${dados.length} mensagens (grupo ${GRUPO}, últimas ${ultimas} pedidas).`,
  );
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
