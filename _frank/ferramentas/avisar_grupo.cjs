#!/usr/bin/env node
/**
 * avisar_grupo.cjs — leva pro grupo da equipe o que precisa de olho humano.
 *
 * POR QUE EXISTE (ordem do Johnny, 19/08): tem coisa que o Frank não julga —
 * se uma voz "está boa", se uma imagem ficou aceitável. Ele não ouve nem
 * enxerga. Isso precisa de uma pessoa, e e-mail para admin ninguém lê na hora.
 * Então a Carol posta no grupo "FASTCLONER - Suporte" e alguém olha.
 *
 * ⚠️ ISTO NÃO É PARA FALAR COM ALUNO. É recado interno para a equipe. Aluno
 * continua sendo pelo `enviar_email.cjs` (SMTP do suporte@).
 *
 * USO (de qualquer pasta):
 *   node _frank/ferramentas/avisar_grupo.cjs \
 *     --aluno maria@exemplo.com \
 *     --assunto "Voz saindo com letras cortadas" \
 *     --conferi "treino concluiu ok; referência tem 38 min; houve estorno" \
 *     --pergunta "este áudio está aceitável?" \
 *     --link "https://..." \
 *     --incidente ce6e157d
 *
 *   --seco   monta a mensagem e mostra, SEM enviar (ensaie sempre antes)
 *
 * O link deve ser URL ASSINADA e vale poucas horas — sem ele ninguém vai
 * atrás, e a mensagem morre no grupo.
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

/** Grupo interno da equipe. Trocou de grupo? Só esta linha muda. */
const GRUPO = process.env.AGENT_TEAM_GROUP_JID || "120363428193217427@g.us";

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};

(async () => {
  const aluno = arg("--aluno");
  const assunto = arg("--assunto");
  const conferi = arg("--conferi");
  const pergunta = arg("--pergunta");
  const link = arg("--link");
  const incidente = arg("--incidente");
  const seco = process.argv.includes("--seco");

  if (!assunto || !pergunta) {
    console.error(
      "faltou --assunto e/ou --pergunta.\n" +
        "A pergunta é obrigatória de propósito: recado sem pedido claro vira mensagem\n" +
        "que todo mundo lê e ninguém responde.",
    );
    process.exit(1);
  }

  // Formato pensado pra quem lê no celular: o pedido primeiro, contexto depois.
  const linhas = [
    `🔎 *Precisa de um olho humano*`,
    ``,
    `*${assunto}*`,
    aluno ? `Aluno: ${aluno}` : null,
    conferi ? `Já conferi: ${conferi}` : null,
    link ? `\nAbrir: ${link}` : null,
    ``,
    `❓ ${pergunta}`,
    ``,
    `_Responda aqui mesmo — eu levo a resposta adiante._`,
    incidente ? `_(incidente ${incidente})_` : null,
  ].filter((l) => l !== null);

  const texto = linhas.join("\n");

  if (seco) {
    console.log("── MODO SECO, nada foi enviado ──");
    console.log(`para: ${GRUPO}\n`);
    console.log(texto);
    return;
  }

  const url = process.env.WAHA_API_URL;
  const key = process.env.WAHA_API_KEY;
  if (!url || !key) {
    console.error(
      "WAHA_API_URL/WAHA_API_KEY ausentes nesta máquina.\n" +
        "A WAHA só escuta em 127.0.0.1 no servidor — rode via ssh de lá, ou use --seco aqui.",
    );
    process.exit(1);
  }

  const res = await fetch(`${url.replace(/\/$/, "")}/api/sendText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: JSON.stringify({ session: "default", chatId: GRUPO, text: texto }),
  });
  if (!res.ok) {
    console.error(`WAHA ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`✅ avisado no grupo da equipe (${GRUPO})`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
