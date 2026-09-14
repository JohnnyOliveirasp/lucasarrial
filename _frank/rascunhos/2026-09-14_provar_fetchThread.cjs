/**
 * PROVA DO #387 — exercita o fetchThread DE VERDADE contra a caixa viva.
 *
 * O Vigia nao tinha credencial de caixa no sandbox dele e disse isso na cara:
 * "NAO exercitei contra IMAP nenhum". As 4 coisas que ele listou como nao
 * verificadas sao exatamente as que derrubam o patch em silencio:
 *   (1) o Namecheap aceita UID SEARCH FROM/TO? (o fetchUnseen so usa UNSEEN)
 *   (2) a pasta de enviados descoberta casa o TO do aluno?
 *   (3) o fio sai intercalado na ordem certa?
 *   (4) quanto custa em segundos por resposta?
 *
 * Eu TENHO a credencial. Entao rodo o codigo real (via jiti, o mesmo truque do
 * ler_caixa.cjs) em vez de reimplementar — reimplementacao prova a minha copia,
 * nao o patch.
 *
 * SO LEITURA: SELECT + UID SEARCH + BODY.PEEK. Nenhuma flag muda, nada e
 * enviado, nada e gravado.
 *
 *   node _frank/ferramentas/../rascunhos/2026-09-14_provar_fetchThread.cjs <email>
 */
const path = require("node:path");
const RAIZ = path.join(__dirname, "..", "..");

require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

if (!process.env.SUPPORT_MAIL_PASSWORD) {
  console.error("SUPPORT_MAIL_PASSWORD ausente — sem credencial, sem prova.");
  process.exit(1);
}

const createJiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"));
const jiti = createJiti(path.join(RAIZ, "frontend"), {
  interopDefault: true,
  alias: { "@": path.join(RAIZ, "frontend", "src") },
});

const alvo = (process.argv[2] || "").trim();
if (!alvo) {
  console.error("uso: node 2026-09-14_provar_fetchThread.cjs <email>");
  process.exit(1);
}

(async () => {
  const mod = jiti(path.join(RAIZ, "frontend", "src", "lib", "agent", "mail-imap.ts"));
  if (typeof mod.fetchThread !== "function") {
    console.error("fetchThread nao exportado — o patch nao esta aplicado nesta arvore.");
    process.exit(1);
  }

  console.log(`\n=== fetchThread("${alvo}") — codigo real, caixa viva ===`);
  const t0 = Date.now();
  let fio;
  try {
    fio = await mod.fetchThread(alvo);
  } catch (e) {
    console.error(`\n❌ LANCOU EXCECAO (o patch promete que nunca sobe): ${e && e.message}`);
    process.exit(2);
  }
  const ms = Date.now() - t0;

  console.log(`tempo: ${ms} ms · mensagens no fio: ${fio.length}\n`);

  if (!fio.length) {
    console.log("⚠️  FIO VAZIO. Isto e o modo de falha SILENCIOSO do patch:");
    console.log("   a Fast responde como antes e ninguem percebe que o fio nunca veio.");
    console.log("   Causas possiveis: SEARCH FROM/TO recusado, pasta de enviados errada,");
    console.log("   ou simplesmente nunca houve troca com este endereco.");
  }

  let anteriorData = -Infinity;
  let foraDeOrdem = 0;
  for (const m of fio) {
    if (m.date < anteriorData) foraDeOrdem += 1;
    anteriorData = m.date;
    const quem = m.from_me ? "CASA " : "ALUNO";
    const quando = m.date ? new Date(m.date).toISOString().slice(0, 16).replace("T", " ") : "sem data";
    const corpo = m.text.replace(/\s+/g, " ").slice(0, 110);
    console.log(`  [${quem}] ${quando} · id=${m.messageId ? "sim" : "AUSENTE"}`);
    console.log(`          ${corpo}`);
  }

  const ladoCasa = fio.filter((m) => m.from_me).length;
  const ladoAluno = fio.length - ladoCasa;

  console.log(`\n--- veredito ---`);
  console.log(`INBOX (aluno):            ${ladoAluno}  ${ladoAluno ? "OK" : "nada"}`);
  console.log(`Pasta de enviados (casa): ${ladoCasa}  ${ladoCasa ? "OK — SEARCH TO funciona e a pasta casa" : "VAZIO — SEARCH TO ou a pasta de enviados falhou"}`);
  console.log(`ordem cronologica:        ${foraDeOrdem === 0 ? "OK" : `${foraDeOrdem} fora de ordem`}`);
  console.log(`Message-ID em todas:      ${fio.every((m) => m.messageId) ? "OK (dedup da msg atual vai funcionar)" : "FALTA em alguma (dedup cai no fallback por texto)"}`);
  console.log(`custo por resposta:       ${ms} ms (teto do patch: 20.000 ms)`);
})().catch((e) => {
  console.error("FALHOU:", e && e.message);
  process.exit(1);
});
