/**
 * #371 — O PAR CONTRADITÓRIO: duas fotos quase idênticas, vereditos opostos.
 *
 * POR QUE ESTA RÉGUA EXISTE, SENDO QUE JÁ HÁ DUAS
 * ================================================
 * As duas réguas que o #371 já tem discordam UMA DA OUTRA no gabarito:
 *   - `_Bugs/2026-09-13_gate371_determinismo.cjs` .... as 7 fotos da Alice = "alvo"
 *   - `_frank/.../2026-09-20_regua_gate_rosto_371.cjs` .. 3 "alvo" + 4 "negativo"
 * A segunda marca as 4 como negativo porque "a Alice olha para o lado". O
 * contrato do portão (`face-gate.ts:74`) ACEITA olhar para o lado, com todas as
 * letras: "eyes narrowed, closed, or pointing away from the lens" -> true.
 *
 * Enquanto o gabarito for discutível, nenhuma das duas fecha a discussão. Esta
 * régua foge do gabarito inteiro: ela não pergunta "esta foto deveria passar?".
 * Ela pergunta uma coisa que NÃO depende de opinião nenhuma:
 *
 *     duas fotos quase idênticas podem receber vereditos OPOSTOS?
 *
 * `b5c6dea7` e `0e6a538a` são o mesmo enquadramento, a mesma pessoa, a mesma
 * roupa, o mesmo sofá, minutos de diferença. Medido em 20/09, a `0e6a538a`
 * PASSA 5/5 e a `b5c6dea7` é BARRADA 0/5 — e, olhando as duas, a barrada é a
 * MAIS frontal das duas (olhos na lente; na outra o olhar desvia).
 *
 * Se o par confirmar, está provado que a decisão do portão não é explicada pelo
 * contrato dele, INDEPENDENTE de quem tem razão sobre o gabarito. É por isso
 * que esta régua é curta: ela testa 2 imagens, não 9, e a conclusão dela não
 * pode ser derrubada por "mas o gabarito estava errado".
 *
 * ⚠️ Ela imprime a RAZÃO CRUA que o modelo devolve. A razão importa tanto
 * quanto o veredito: em 20/09 o controle negativo do #371 foi barrado com o
 * texto "a cabeça está virada para baixo e para o lado, ultrapassando 30 graus"
 * enquanto a medição geométrica (landmarks) dava pitch 9,8° / yaw 17,4° — ou
 * seja, o modelo CITA um número que a geometria desmente. Sem imprimir a razão,
 * isso fica invisível.
 *
 * USO: node _frank/ferramentas/2026-09-20_par_contraditorio_371.cjs [--rodadas 5]
 */
const path = require("node:path");
const { BUCKETS, urlAssinada, existe, RAIZ } = require(path.join(__dirname, "_comum.cjs"));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const RODADAS = Number(arg("--rodadas", 5));

const ALICE = "2b937e70-800b-4c1f-9d02-463b51f90b74";
const ITAMAR = "9ed49b6d-faf3-4fbb-821c-f6755e98c080";

// O par + o controle negativo histórico, que é o que sustentava a tese antiga.
const IMAGENS = [
  ["par", "alice b5c6dea7 (olhos NA lente)", `${ALICE}/uploads/b5c6dea7-b81b-44de-98a9-ece11cb7102e.jpeg`],
  ["par", "alice 0e6a538a (olhar DESVIADO)", `${ALICE}/uploads/0e6a538a-e177-4b17-9fab-8b5d1f53148a.jpeg`],
  ["controle-", "itamar 8cd37f59 (olhos na tabua)", `${ITAMAR}/images/8cd37f59-0108-477a-8cbd-a5122d74d214/result.png`],
  ["controle+", "itamar 40b59813 (frontal)", `${ITAMAR}/refs/40b59813_Retrato_profissional_com_fundo_neutro_2___2_.png`],
];

function carregarGateDeProducao() {
  const jiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"))(__filename, { interopDefault: true });
  const alvo = path.join(RAIZ, "frontend", "src", "lib", "video-clone", "face-gate.ts");
  if (!require("node:fs").existsSync(alvo)) throw new Error(`face-gate.ts nao existe em ${alvo}`);
  const mod = jiti(alvo);
  if (typeof mod.checkFrontalFace !== "function") throw new Error("checkFrontalFace sumiu do gate - abortando");
  return mod.checkFrontalFace;
}

(async () => {
  const gate = carregarGateDeProducao();
  const bucket = BUCKETS.imagens();

  // Nada de zero de instrumento cego.
  for (const [, rotulo, key] of IMAGENS) {
    if (!(await existe(bucket, key))) throw new Error(`objeto AUSENTE no R2, abortando: ${rotulo} (${key})`);
  }
  console.log(`gate carregado da MAIN (producao) · ${IMAGENS.length} imagens · ${RODADAS} rodadas\n`);

  const placar = {};
  for (const [papel, rotulo, key] of IMAGENS) {
    const url = await urlAssinada(bucket, key, 1800);
    const vs = [];
    for (let i = 0; i < RODADAS; i++) {
      try {
        const r = await gate(url);
        vs.push(r.skipped ? { v: "SKIP", m: "fail-open" } : r.ok ? { v: "PASSA", m: "" } : { v: "BARRA", m: (r.reason || "").trim() });
      } catch (e) { vs.push({ v: "ERRO", m: (e && e.message) || "" }); }
    }
    const passa = vs.filter((x) => x.v === "PASSA").length;
    const skip = vs.filter((x) => x.v === "SKIP").length;
    placar[rotulo] = { papel, passa, skip };
    const flip = passa !== 0 && passa !== RODADAS ? "  ⚠️ SORTEIA" : "";
    console.log(`[${papel}] ${rotulo}`);
    console.log(`     ${passa}/${RODADAS} PASSA${skip ? ` (${skip} fail-open)` : ""}${flip}`);
    const razoes = [...new Set(vs.filter((x) => x.m).map((x) => x.m))];
    for (const r of razoes) console.log(`     razao: "${r}"`);
    console.log();
  }

  // ---------- veredito ----------
  const a = placar["alice b5c6dea7 (olhos NA lente)"];
  const b = placar["alice 0e6a538a (olhar DESVIADO)"];
  console.log("=".repeat(74));
  if (!a || !b) { console.log("par nao mediu - inconclusivo"); process.exit(2); }

  if (a.skip || b.skip) {
    console.log(">>> INCONCLUSIVO: houve fail-open no par (o gate nao olhou).");
    process.exit(2);
  }
  if (a.passa === b.passa) {
    console.log(`>>> O PAR NAO SE CONTRADIZ HOJE: as duas deram ${a.passa}/${RODADAS}.`);
    console.log("    A tese do par contraditorio NAO se sustenta nesta medicao.");
  } else {
    console.log(">>> PAR CONTRADITORIO CONFIRMADO.");
    console.log(`    b5c6dea7 (olhos NA lente) .... ${a.passa}/${RODADAS}`);
    console.log(`    0e6a538a (olhar DESVIADO) .... ${b.passa}/${RODADAS}`);
    console.log("    Mesmo enquadramento, vereditos opostos. A decisao do portao");
    console.log("    nao e explicada pelo contrato dele — e isso independe de");
    console.log("    qual dos dois gabaritos rivais esta certo.");
  }
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
