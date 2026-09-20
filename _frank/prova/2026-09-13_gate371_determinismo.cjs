/**
 * Régua do #371 — mede os DOIS lados do gate de rosto do Vídeo Clone.
 *
 * Estende `_Bugs/2026-09-13_gate_alice.cjs` (que só media a Alice, 3 rodadas)
 * com as duas coisas que faltavam pra poder mexer no portão:
 *   (A) DETERMINISMO   — N rodadas por imagem; qualquer imagem que não dê N/N
 *                        do mesmo veredito é FLIP e reprova a rodada.
 *   (B) CONTROLE NEGATIVO — conjunto de imagens que TEM que continuar barrado.
 *                        Um portão que aprova tudo não é conserto, é portão
 *                        desligado. As duas tentativas anteriores de consertar
 *                        este gate morreram exatamente aqui.
 *
 * Carrega o `checkFrontalFace` DE PRODUÇÃO por jiti e ABORTA se o export
 * sumir — não existe cópia da régua aqui dentro, de propósito.
 *
 * Leitura pura: não grava em banco, não cobra ninguém, não dispara GPU.
 * Custo: visão Haiku, centavos por rodada.
 *
 * ──────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO SAIU DE `_Bugs/` (20/09)
 *
 * O PR #373 e o commit de merge `e5c5b2e1` citam esta régua, por caminho,
 * como a prova que autoriza a decisão sobre a cláusula de olhar. Só que
 * `_Bugs/` é ignorado pelo git (`.gitignore:87`, ZERO arquivo rastreado lá):
 * a prova citada era, por política do repo, impossível de estar no repo.
 * As duas cópias viviam em `~/.cache/worktrees/` — diretório de cache, com
 * worktree vizinha já marcada `prunable` — e divergiam entre si (189 vs 169
 * linhas). Este repo JÁ perdeu trabalho assim: ver a mensagem de `d3824d15`
 * ("estava inteiro e NAO COMMITADO no worktree, a um 'git checkout .' de
 * sumir — 3o falso-negativo do board em 2 dias").
 *
 * O PR #373 deixou escrito que a decisão de remover a cláusula de olhar
 * "deve ser revertida com a medição na mão" se o negativo vazar. Reverter
 * com a medição na mão exige que a medição exista. Por isso ela agora mora
 * em `_frank/prova/`, que É rastreado.
 *
 * uso:
 *   node _frank/prova/2026-09-13_gate371_determinismo.cjs [--n 5]
 *              [--so-negativo] [--so-positivo] [--json]
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { BUCKETS, urlAssinada, existe, r2, s3, RAIZ } = require(
  path.join(__dirname, "..", "ferramentas", "_comum.cjs"),
);

const N = Number((process.argv.find((a) => a.startsWith("--n")) || "").split(/[= ]/)[1]
  || process.argv[process.argv.indexOf("--n") + 1] || 5);
const JSON_OUT = process.argv.includes("--json");
const SO_NEG = process.argv.includes("--so-negativo");
const SO_POS = process.argv.includes("--so-positivo");

/* ==================================================================== *
 * O GABARITO É ANCORADO NO CONTRATO — e o contrato mudou em 20/09.     *
 *                                                                      *
 * O rótulo de referência desta régua nasceu como "rosto de frente,     *
 * OLHOS NA LENTE e boca visível". Os olhos na lente são critério de    *
 * OLHAR — exatamente o que o PR #373 removeu do portão. O contrato em  *
 * produção hoje é, textualmente:                                       *
 *                                                                      *
 *     POSE DA CABEÇA (±30° de yaw/pitch/roll) + BOCA VISÍVEL.          *
 *     "Direção do olhar não é critério — e não precisa ser, porque     *
 *      quem sincroniza no lip-sync é a boca."                          *
 *                                                                      *
 * Gabarito que contradiz o contrato embarcado é pior que gabarito      *
 * nenhum: ele pinta de VERMELHO um gate correto, e o próximo que ler   *
 * ou reverte um conserto bom, ou mexe no prompt pra caçar verde. Por   *
 * isso os rótulos abaixo foram re-ancorados no contrato, com uma regra *
 * explícita de quem pode mudar de rótulo:                              *
 *                                                                      *
 *   • ALVO      — os DOIS leitores independentes (eu e o `olho`,       *
 *                 card 196741d8) concordam que cabe no contrato.       *
 *   • NEGATIVO  — os DOIS leitores concordam que NÃO cabe. Só sai de   *
 *                 ALVO pra cá com os dois de acordo; nunca pra fazer   *
 *                 a régua fechar verde.                                *
 *   • DISPUTADO — os leitores DIVERGEM. Não conta no veredito, é       *
 *                 medido e listado. Resolve com goniometria, não com   *
 *                 opinião nem afrouxando o texto do prompt.            *
 * ==================================================================== */
const ALICE = "2b937e70-800b-4c1f-9d02-463b51f90b74";

/* ALVO — tem que PASSAR. Consenso dos dois leitores sob POSE+BOCA. */
const POSITIVO = [
  ["alice/128b3050 upload 23:54", `${ALICE}/uploads/128b3050-9cda-496d-a190-f2869c9b5375.jpeg`],
  ["alice/4100fc07 GERADA 20:35", `${ALICE}/images/4100fc07-4801-484d-a722-fca0a5bcfbdb/result.png`],
  // queixo recolhido COM a cabeça dentro dos 30°: é o caso que o conserto
  // existe pra destravar. Sob o contrato velho caía na cláusula categórica.
  ["alice/0e6a538a upload 18:07", `${ALICE}/uploads/0e6a538a-e177-4b17-9fab-8b5d1f53148a.jpeg`],
  // rosto da casa (fixture da fumaça): frontal de manual, sem dado de aluno.
  // Serve de piso: se ESTE for barrado, o problema não é o prompt, é o modelo.
  ["casa/foto.jpg (fixture)", "_casa/fumaca-video-clone/v1/foto.jpg", "generations-ai-verse-clone"],
];

/* ------------------------------------------------------------------ *
 * DISPUTADO — medido, listado, NÃO entra no veredito.                 *
 *                                                                     *
 * Nestas três o gate lê "passa de 30°" de forma estável (0/5, sempre  *
 * a mesma frase) e o `olho` leu frontal=sim. Os dois leitores estão   *
 * olhando o MESMO eixo do contrato — pose — e discordando do valor.   *
 * Isso não se decide por voto: decide medindo o ângulo da cabeça.     *
 * É o passo que o próprio PR #373 nomeou pra não fechar o #371.       *
 *                                                                     *
 * 5f610dda e 8cd4c73c são BYTE A BYTE o mesmo arquivo (md5            *
 * 73c4cc82bc77168e3897502168ef45ce, 116.869 b). Ficam as duas de      *
 * propósito: é o par que prova o sorteio sem depender de julgamento   *
 * nenhum. No gate velho deram placar DIFERENTE; a partir da           *
 * `temperature: 0` têm que dar o MESMO veredito, seja ele qual for —  *
 * e isso a régua checa abaixo, independente do rótulo.                *
 * ------------------------------------------------------------------ */
const DISPUTADO = [
  ["alice/b5c6dea7 upload 23:52", `${ALICE}/uploads/b5c6dea7-b81b-44de-98a9-ece11cb7102e.jpeg`],
  ["alice/5f610dda upload 20:26", `${ALICE}/uploads/5f610dda-dac1-45fe-bda2-fc0c93bfd37f.jpeg`],
  ["alice/8cd4c73c upload 20:22 (= 5f610dda)", `${ALICE}/uploads/8cd4c73c-ec60-48d8-bb15-fe10aca88d35.jpeg`],
];

/* As duas chaves gêmeas, pra checagem de determinismo por IDENTIDADE. */
const GEMEAS = [
  `${ALICE}/uploads/5f610dda-dac1-45fe-bda2-fc0c93bfd37f.jpeg`,
  `${ALICE}/uploads/8cd4c73c-ec60-48d8-bb15-fe10aca88d35.jpeg`,
];

/* ------------------------------------------------------------------ *
 * NEGATIVO — tem que continuar BARRADO.                               *
 * Classes que fizeram o portão nascer (#131/#121) + as três que a     *
 * mensagem do gate promete filtrar. Olhei todas antes de rotular.     *
 * ------------------------------------------------------------------ */
const NEGATIVO = [
  // Saiu de ALVO em 20/09 pelos DOIS leitores, não por conveniência: o `olho`
  // (card 196741d8) leu "cabeça tombada em ângulo oblíquo, enquadramento não
  // frontal" e o gate lê ">30° de rotação", estável 0/5. Concordam no eixo do
  // contrato (pose) E no valor. O rótulo velho ("olhos na lente") julgava
  // olhar, que saiu do contrato.
  ["alice/2b274f51 upload 17:56", `${ALICE}/uploads/2b274f51-cebe-4636-9a71-f3bbbdd4a4a8.png`],
  // O CASO FUNDADOR. #131, aluno itamar.vanzin, 10.120c cobrados.
  // ATENÇÃO — a etiqueta deste caso foi CORRIGIDA em 20/09. O texto antigo
  // dizia "o que o desqualifica é o OLHAR, cravado na tábua". Medido contra a
  // main de hoje, sem cláusula de olhar nenhuma: continua barrado 0/5 e a
  // recusa diz "a cabeça está virada para baixo e para o lado, ultrapassando
  // 30 graus". Ele é barrado por POSE. Era a premissa que sustentava a
  // cláusula de gaze, e ela era falsa.
  ["itamar/8cd37f59 GERADA (#131, cabeça >30° pra baixo e pro lado)",
    "9ed49b6d-faf3-4fbb-821c-f6755e98c080/images/8cd37f59-0108-477a-8cbd-a5122d74d214/result.png"],
  // perfil fechado + olhar no laptop
  ["perfil/a1981606 (perfil, olha o laptop)",
    "6659c6c5-3ba3-4294-a5c2-53aa1513e387/images/a1981606-96d9-408c-895d-00bfde9d1f53/result.png"],
  // cabeça virada ~50-60°, olhar fora do quadro
  ["perfil/9fd481d1 (virada ~50-60, olhar fora)",
    "b38da967-4b9d-4ac3-b5d3-2b72d98b3a02/images/9fd481d1-6a3f-4cb3-8737-0588556ff345/result.png"],
  // casal de costas: NENHUM rosto no quadro
  ["nuca/0f07ae45 (de costas, sem rosto)",
    "2f12a5a3-0cb9-4d71-ba26-65e792dbaefb/images/0f07ae45-4697-4a93-b146-e447c4ab52cc/result.png"],
];

/* Sintéticos: as duas classes que a produção não me deu exemplo real.
 * Montados na hora com ffmpeg, publicados num prefixo da casa e apagados no
 * fim. O de boca tapada sai do rosto da CASA, não de aluno — é o mesmo pixel
 * do controle positivo com a boca ocluída, então isola o eixo da boca sem
 * arrastar nenhum outro fator junto. */
const PREFIXO_SYN = "_casa/gate-371/tmp";
const SINTETICOS = [
  {
    rotulo: "syn/boca tapada (rosto da casa + tarja)",
    de: { bucket: "generations-ai-verse-clone", chave: "_casa/fumaca-video-clone/v1/foto.jpg" },
    vf: "drawbox=x=190:y=345:w=120:h=70:color=black@1.0:t=fill",
  },
  {
    rotulo: "syn/sem pessoa (recorte de céu e mar)",
    de: { bucket: null, chave: "2f12a5a3-0cb9-4d71-ba26-65e792dbaefb/images/0f07ae45-4697-4a93-b146-e447c4ab52cc/result.png" },
    vf: "crop=941:700:0:0",
  },
];

const rodar = async (fn, url) => {
  try {
    const r = await fn(url);
    if (r.skipped) return { v: "SKIPPED", txt: "SKIPPED(fail-open)" };
    if (r.ok) return { v: "PASSA", txt: "PASSA" };
    return { v: "BARRA", txt: `BARRA: ${r.reason}` };
  } catch (e) {
    return { v: "ERRO", txt: "ERRO: " + (e && e.message) };
  }
};

(async () => {
  const jiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"))(__filename, { interopDefault: true });
  const mod = jiti(path.join(RAIZ, "frontend", "src", "lib", "video-clone", "face-gate.ts"));
  if (typeof mod.checkFrontalFace !== "function") {
    throw new Error("checkFrontalFace sumiu da producao - abortando (a regua nao tem copia da regra)");
  }
  const bImg = BUCKETS.imagens();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gate371-"));
  const publicados = [];

  // monta e publica os sintéticos
  const sinteticos = [];
  if (!SO_POS) {
    for (const s of SINTETICOS) {
      const bOrig = s.de.bucket || bImg;
      if (!(await existe(bOrig, s.de.chave))) { console.log(`AVISO: base do sintetico sumiu (${s.rotulo}) - PULADO`); continue; }
      const entrada = path.join(tmp, "in_" + path.basename(s.de.chave));
      const saida = path.join(tmp, "out_" + Buffer.from(s.rotulo).toString("hex").slice(0, 10) + ".png");
      const r = await fetch(await urlAssinada(bOrig, s.de.chave, 900));
      fs.writeFileSync(entrada, Buffer.from(await r.arrayBuffer()));
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", entrada, "-vf", s.vf, saida]);
      const chave = `${PREFIXO_SYN}/${path.basename(saida)}`;
      await r2().send(new s3.PutObjectCommand({
        Bucket: bImg, Key: chave, Body: fs.readFileSync(saida), ContentType: "image/png",
      }));
      publicados.push(chave);
      sinteticos.push([s.rotulo, chave]);
    }
  }

  const alvos = [];
  if (!SO_NEG) {
    POSITIVO.forEach(([r, k, b]) => alvos.push({ rotulo: r, chave: k, bucket: b || bImg, espera: "PASSA" }));
    // DISPUTADO roda junto (o determinismo e as gêmeas valem pra ele também),
    // mas `espera: null` o mantém fora do veredito.
    DISPUTADO.forEach(([r, k, b]) => alvos.push({ rotulo: r, chave: k, bucket: b || bImg, espera: null }));
  }
  if (!SO_POS) {
    NEGATIVO.forEach(([r, k]) => alvos.push({ rotulo: r, chave: k, bucket: bImg, espera: "BARRA" }));
    sinteticos.forEach(([r, k]) => alvos.push({ rotulo: r, chave: k, bucket: bImg, espera: "BARRA" }));
  }

  console.log(`gate de PRODUCAO, ${N} rodadas por imagem — (A) determinismo e (C) controle negativo\n`);
  const linhas = [];
  for (const a of alvos) {
    if (!(await existe(a.bucket, a.chave))) { console.log(`SUMIU DO R2: ${a.rotulo}`); continue; }
    const url = await urlAssinada(a.bucket, a.chave, 1800);
    const vs = [];
    for (let i = 0; i < N; i++) vs.push(await rodar(mod.checkFrontalFace, url));
    const distintos = [...new Set(vs.map((x) => x.v))];
    const flip = distintos.length > 1;
    const veredito = distintos.length === 1 ? distintos[0] : "FLIP";
    const disputado = a.espera === null;
    const bate = !flip && (disputado || veredito === a.espera);
    linhas.push({ rotulo: a.rotulo, chave: a.chave, espera: a.espera, disputado, veredito, flip, bate, respostas: vs.map((x) => x.txt) });
    const placar = `${vs.filter((x) => x.v === "PASSA").length}/${N} PASSA`;
    console.log(`${disputado ? "  ?? " : bate ? "OK  " : "FALHA"} ${a.rotulo}`);
    console.log(`      espera ${disputado ? "DISPUTADO (fora do veredito)" : a.espera} | deu ${veredito} | ${placar}${flip ? "  <<< FLIP" : ""}`);
    [...new Set(vs.map((x) => x.txt))].forEach((t) => console.log(`      . ${t}`));
    console.log("");
  }

  // limpa o que publicou
  for (const k of publicados) {
    try { await r2().send(new s3.DeleteObjectCommand({ Bucket: bImg, Key: k })); } catch (e) { console.log("nao consegui apagar", k, e.message); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  const flips = linhas.filter((l) => l.flip);
  const errados = linhas.filter((l) => !l.flip && !l.bate);
  console.log("=".repeat(70));
  console.log(`(A) DETERMINISMO ......... ${flips.length === 0 ? "PASSOU" : "REPROVOU"} — ${flips.length} imagem(ns) com flip em ${N} rodadas`);
  flips.forEach((l) => console.log(`      FLIP: ${l.rotulo}`));

  /* (A2) DETERMINISMO POR IDENTIDADE — a prova que não depende de julgar foto.
   * Mesmo md5 tem que dar o mesmo veredito. Era AQUI que o gate velho se
   * entregava: as duas gêmeas davam placar diferente. */
  const g = linhas.filter((l) => GEMEAS.includes(l.chave));
  if (g.length === 2) {
    const igual = g[0].veredito === g[1].veredito;
    console.log(`(A2) GÊMEAS BYTE-IDÊNTICAS ${igual ? "PASSOU" : "REPROVOU"} — mesmo arquivo, veredito ${igual ? `igual (${g[0].veredito})` : `DIFERENTE (${g[0].veredito} vs ${g[1].veredito})`}`);
    if (!igual) errados.push({ rotulo: "gêmeas byte-idênticas com veredito diferente" });
  }

  const pos = linhas.filter((l) => l.espera === "PASSA");
  const neg = linhas.filter((l) => l.espera === "BARRA");
  const dis = linhas.filter((l) => l.disputado);
  console.log(`(B) POSITIVO (passa) ..... ${pos.filter((l) => l.bate).length}/${pos.length}`);
  console.log(`(C) CONTROLE NEGATIVO .... ${neg.filter((l) => l.bate).length}/${neg.length} continuam barrados`);
  neg.filter((l) => !l.bate).forEach((l) => console.log(`      VAZOU: ${l.rotulo} -> ${l.veredito}`));
  errados.forEach((l) => console.log(`      divergente: ${l.rotulo} espera ${l.espera} deu ${l.veredito}`));
  if (dis.length) {
    console.log(`(D) DISPUTADO ............ ${dis.length} imagem(ns) FORA do veredito — leitores divergem no ângulo`);
    dis.forEach((l) => console.log(`      ${l.veredito}: ${l.rotulo}`));
    console.log("      resolve medindo o ângulo da cabeça (goniometria), NÃO afrouxando o prompt.");
    console.log("      enquanto estiver aqui, o #371 NÃO fecha.");
  }
  const verde = flips.length === 0 && errados.length === 0;
  console.log(`\nVEREDITO: ${verde ? "VERDE — contrato POSE+BOCA honrado" : "VERMELHO — NAO abrir PR"}`);
  if (verde && dis.length) console.log("         (verde NÃO significa #371 fechado — ver DISPUTADO acima)");
  if (JSON_OUT) fs.writeFileSync(path.join(__dirname, "gate371_resultado.json"), JSON.stringify(linhas, null, 2));
  process.exit(verde ? 0 : 1);
})().catch((e) => { console.error("FALHOU:", e); process.exit(2); });
