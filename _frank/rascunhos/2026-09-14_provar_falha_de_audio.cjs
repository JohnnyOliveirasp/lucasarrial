#!/usr/bin/env node
/**
 * PROVA do falhaDeAudio (#cacca8a1) — executa a funcao DE PRODUCAO via jiti,
 * nao uma copia. Copia de regra foi o que criou o vao do #351.
 *
 * O que precisa ficar provado:
 *  1. o erro REAL aparece no log da casa (era isso que o `catch {}` matava);
 *  2. 413 e 400 viram frase que o aluno consegue AGIR;
 *  3. 401/429/500 NAO acusam o arquivo do aluno (defeito nosso nao vira culpa dele);
 *  4. toda saida diz que nao houve cobranca.
 *
 * CONTROLE NEGATIVO incluido: se o console.error nao for chamado, o teste
 * REPROVA. Sem isso eu estaria provando so a string e nao a visibilidade, que
 * e o defeito inteiro.
 */
const path = require("node:path");
const FRONT = path.join(__dirname, "..", "..", "frontend");
require(path.join(FRONT, "node_modules", "dotenv")).config({
  path: path.join(FRONT, ".env.local"),
});

const jiti = require(path.join(FRONT, "node_modules", "jiti"))(FRONT, {
  interopDefault: true,
  alias: { "@": path.join(FRONT, "src") },
});

const { falhaDeAudio } = jiti(path.join(FRONT, "src/lib/video/transcribe.ts"));
if (typeof falhaDeAudio !== "function") {
  console.error("ABORTADO: falhaDeAudio sumiu do modulo de producao.");
  process.exit(1);
}

const CASOS = [
  {
    nome: "413 (arquivo acima de 25 MB) — causa do aluno, acionavel",
    erro: new Error("Whisper API 413: Maximum content size limit (26214400) exceeded"),
    exige: [/25 MB/, /MP3/, /Nenhum cr[eé]dito foi cobrado/],
    proibe: [/corrompido/],
  },
  {
    nome: "400 (formato que o Whisper nao decodifica) — causa do aluno",
    erro: new Error('Whisper API 400: {"error":{"message":"Invalid file format."}}'),
    exige: [/formato n[aã]o [eé] aceito|corrompido/, /Nenhum cr[eé]dito foi cobrado/],
    proibe: [/25 MB/],
  },
  {
    nome: "401 (chave nossa vencida) — defeito da CASA, nao pode acusar o arquivo",
    erro: new Error("Whisper API 401: incorrect api key"),
    exige: [/Tente novamente/, /Nenhum cr[eé]dito foi cobrado/],
    proibe: [/corrompido/, /25 MB/, /formato/],
  },
  {
    nome: "429 (rate limit nosso) — idem",
    erro: new Error("Whisper API 429: rate limit reached"),
    exige: [/Tente novamente/, /Nenhum cr[eé]dito foi cobrado/],
    proibe: [/corrompido/, /25 MB/],
  },
  {
    nome: "R2 fora / chave ausente — generico, mas REGISTRADO",
    erro: new Error("OPENAI_API_KEY not configured"),
    exige: [/Tente novamente/, /Nenhum cr[eé]dito foi cobrado/],
    proibe: [/corrompido/, /25 MB/],
  },
  {
    nome: "rotulo 'gravacao' (import-take): substantivo E genero corretos",
    erro: new Error("Whisper API 413: Maximum content size limit exceeded"),
    opts: { rotulo: "gravação", feminino: true },
    exige: [/Essa grava[cç][aã]o/, /25 MB/],
    proibe: [/Esse áudio passou/, /Esse grava/],
  },
  {
    nome: "generico no feminino tambem concorda ('processar essa gravação')",
    erro: new Error("Whisper API 500: upstream"),
    opts: { rotulo: "gravação", feminino: true },
    exige: [/processar essa grava[cç][aã]o/],
    proibe: [/esse grava/],
  },
];

let falhas = 0;
for (const c of CASOS) {
  // Controle negativo: capturo o console.error pra provar que a casa ENXERGA.
  const original = console.error;
  const logado = [];
  console.error = (...a) => logado.push(a.join(" "));
  let msg;
  try {
    msg = falhaDeAudio(c.erro, { rota: "prova", user: "uid-teste", audioKey: "k/teste.mp3" }, c.opts || {});
  } finally {
    console.error = original;
  }

  const problemas = [];
  if (logado.length === 0) {
    problemas.push("NAO registrou nada — a casa continuaria cega (este e o defeito inteiro)");
  } else {
    // Comparo o campo `erro` DEPOIS de desserializar. A 1a versao comparava
    // substring crua e reprovou o caso 400 por causa das aspas escapadas do
    // JSON — o log estava certo e o teste, errado. Teste que erra sozinho
    // treina a gente a ignorar teste.
    const linha = logado.join(" | ");
    const bruto = linha.slice(linha.indexOf("{"));
    let gravado = null;
    try {
      gravado = JSON.parse(bruto);
    } catch {
      problemas.push("o log nao saiu como JSON legivel");
    }
    if (gravado && gravado.erro !== c.erro.message) {
      problemas.push(`registrou erro DIFERENTE do real: ${gravado && gravado.erro}`);
    }
    if (gravado && gravado.user !== "uid-teste") {
      problemas.push("registrou sem o usuario (nao da pra achar o aluno)");
    }
  }
  for (const re of c.exige) if (!re.test(msg)) problemas.push(`faltou casar ${re}`);
  for (const re of c.proibe) if (re.test(msg)) problemas.push(`disse o que NAO devia: ${re}`);

  if (problemas.length) {
    falhas++;
    console.log(`\n❌ ${c.nome}`);
    problemas.forEach((p) => console.log(`     - ${p}`));
    console.log(`     msg: ${msg}`);
  } else {
    console.log(`\n✅ ${c.nome}`);
    console.log(`     log: ${logado[0]}`);
    console.log(`     msg: ${msg}`);
  }
}

console.log(`\n${falhas === 0 ? "TODOS OS CASOS PASSARAM" : `${falhas} CASO(S) REPROVADO(S)`} — ${CASOS.length} casos`);
process.exit(falhas === 0 ? 0 : 1);
