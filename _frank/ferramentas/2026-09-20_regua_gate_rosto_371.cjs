/**
 * #371 — A RÉGUA QUE O COMENTÁRIO DO BRANCH CITAVA E QUE NÃO EXISTIA.
 *
 * O `face-gate.ts` do branch `feat/371-gate-deterministico` diz, no comentário:
 * "A régua que mede é `_Bugs/2026-09-13_gate371_determinismo.cjs`, 5 rodadas por
 * imagem" e "Medido: ver a tabela do PR". Em 13/09 14hZ eu fui conferir: o
 * arquivo NÃO existia (nem no branch, nem na main, nem em `_Bugs/`) e o PR NUNCA
 * foi aberto. Ou seja, a única prova de que o conserto não desliga o portão era
 * uma citação para o vazio. Esta é a régua de verdade.
 *
 * ── O QUE ELA MEDE ────────────────────────────────────────────────────────
 * Roda o MESMO conjunto de imagens nos DOIS gates, N rodadas cada:
 *   - gate ANTES  = `face-gate.ts` da `main`      (`--antes <dir>`)
 *   - gate DEPOIS = `face-gate.ts` do branch      (`--wt <dir>`)
 * Carrega os dois por **jiti, cada um da sua própria árvore** — não reimplementa
 * a régua e aborta se o export sumir de qualquer um dos lados (foi a CÓPIA da
 * regra de MIME que criou o vão do #351).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠️ CORREÇÃO DE 20/09 — O GABARITO DESTA RÉGUA ESTAVA ERRADO, E O GABARITO
 *    ERRADO ERA PARTE DO DEFEITO.
 * ══════════════════════════════════════════════════════════════════════════
 * A versão de 13/09 rotulava as SETE imagens da Alice como papel "alvo", isto
 * é: "todas têm que passar". Com esse gabarito, a medição do branch deu "7 de
 * 14 casos divergem, e os 7 são todos da Alice" e concluiu-se que a cláusula
 * de GAZE tinha ficado agressiva demais. O branch ficou 7 dias parado sem PR
 * por causa dessa leitura.
 *
 * Em 20/09 eu baixei as sete e OLHEI uma a uma (recorte da região dos olhos,
 * ampliado — os arquivos ficaram em /tmp/gate371-img/). Quatro delas NÃO são
 * alvo: são NEGATIVO. A Alice olha claramente para o lado, fora da lente, em
 * quatro das sete. Barrar essas quatro é o portão fazendo o trabalho dele.
 *
 * Isto importa mais do que parece: com o gabarito de 13/09, um conserto que
 * acertasse em cheio seria reprovado por "divergir" justamente onde ele
 * passou a acertar. A régua estava punindo o comportamento correto.
 *
 * Gabarito conferido a olho em 20/09, imagem por imagem:
 *   4100fc07 (a GERADA, 525 créditos) · olhos NA LENTE, boca visível → ALVO
 *   b5c6dea7 · câmera acima da linha dos olhos, olhos NA LENTE      → ALVO
 *   2b274f51 · close, queixo recolhido, olhos NA LENTE              → ALVO
 *   128b3050 · rosto de frente, olhar desviado para o lado          → NEGATIVO
 *   0e6a538a · olhar para o lado + queixo recolhido                 → NEGATIVO
 *   5f610dda · olhar para o lado                                    → NEGATIVO
 *   8cd4c73c · MESMO ARQUIVO que 5f610dda (md5 idêntico)            → NEGATIVO
 *
 * O md5 dos dois últimos foi reconferido em 20/09 baixando os dois objetos do
 * R2: `73c4cc82bc77168e3897502168ef45ce` nos dois. Eles ficam AMBOS na lista
 * de propósito — dois nomes para o mesmo byte são a sonda de determinismo mais
 * barata que existe: se o placar deles divergir, o gate está sorteando, e não
 * há discussão de gabarito que explique isso.
 *
 * ⚠️ 128b3050 é o caso mais AMBÍGUO do conjunto e está declarado como tal.
 * O desvio do olhar é real mas modesto, e a maquiagem (delineador alongado nos
 * dois cantos) atrapalha a leitura da esclera. Segunda leitura independente,
 * instruída a discordar, concordou com a classificação e apontou a MESMA
 * imagem como a mais ambígua das quatro. Se algum dia esta régua tiver UM
 * flip, aposte nesta antes de suspeitar das outras.
 *
 * ── POR QUE O CONTROLE NEGATIVO É O CORAÇÃO DISTO ─────────────────────────
 * Objeção do Vigia (13/09 12hZ e 14hZ), e ela está certa: **"sem controle
 * negativo provando que perfil, nuca e boca tapada continuam BARRADOS, gate que
 * aprova tudo não é conserto, é gate desligado."** Um conserto que faz as
 * imagens da Alice passarem é indistinguível de `return true` se ninguém medir
 * o que tem que continuar barrado.
 *
 * Em 13/09 o controle negativo era UMA imagem (a do Itamar) — apesar de a nota
 * daquele dia afirmar "controle negativo SEGURA, 6 de 6", número que eu não
 * consegui reconciliar com o array e que portanto NÃO herdei. Em 20/09 ele foi
 * ampliado para DEZ, cobrindo as classes que o Vigia nomeou e que faltavam:
 * perfil de verdade, nuca, boca tapada e foto sem pessoa nenhuma.
 *
 * ⚠️ De onde vieram: da tabela `face_gate_recusas` (o rastro que o #372 criou)
 * e da `image_generations`. MAS — e isto é o ponto — as recusas daquela tabela
 * foram produzidas pelo gate VELHO, que é justamente o que está sob suspeita.
 * Herdar o rótulo delas seria enfiar o bug dentro do gabarito de novo. Então
 * cada candidata foi ABERTA e olhada antes de entrar, e TRÊS foram rejeitadas
 * como falso positivo do gate velho (viraram alvo informativo, ver abaixo).
 *
 * ── OS TRÊS PAPÉIS QUE DÃO VEREDITO ───────────────────────────────────────
 *   1. ALVO — tem que PASSAR 5/5. São as 3 imagens da Alice em que ela olha
 *      para a lente. É por elas que o conserto existe.
 *   2. NEGATIVO — tem que BARRAR 5/5. Se qualquer uma passar, REPROVADO, por
 *      melhor que seja o resto.
 *   3. POSITIVO — a referência frontal que o Itamar escolheu, item por item a
 *      cartilha que o suporte manda. Tem que passar nos dois gates; se ela
 *      barrar, o instrumento é que está errado.
 *
 * E um quarto papel que NÃO dá veredito:
 *   4. ALVO_NOVO — falsos positivos do gate velho achados nesta ronda, em
 *      alunos que não são a Alice. Entram medidos e impressos, mas FORA do
 *      pass/fail, porque o critério de aceite do cartão nomeia só as 3 da
 *      Alice e eu não vou mexer no critério por conta própria no meio da
 *      medição. Servem para mostrar se o conserto generaliza.
 *
 * Leitura pura: não grava nada, não toca em crédito de ninguém, não dispara GPU.
 * Custo = vision Haiku (centavos), pago pela casa, não pelo aluno.
 *
 * USO: node _Bugs/2026-09-13_gate371_determinismo.cjs [--rodadas 5] [--wt <dir>] [--antes <dir>] [--md <arquivo>]
 */
const path = require("node:path");
const fs = require("node:fs");
const { BUCKETS, urlAssinada, existe, RAIZ } = require(path.join(__dirname, "..", "_frank", "ferramentas", "_comum.cjs"));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const RODADAS = Number(arg("--rodadas", 5));
const WT_DEPOIS = arg("--wt", "/tmp/wt-371");
/**
 * `--antes` existe para esta régua poder rodar DE DENTRO do worktree. Sem ele
 * o lado ANTES era sempre `RAIZ`, e `RAIZ` é resolvido a partir do
 * `_comum.cjs` que o require pegou — rodando do worktree, ANTES e DEPOIS
 * viravam a MESMA árvore e a comparação media nada.
 */
const WT_ANTES = arg("--antes", RAIZ);
const MD = arg("--md", null);

const ALICE = "2b937e70-800b-4c1f-9d02-463b51f90b74";
const ITAMAR = "9ed49b6d-faf3-4fbb-821c-f6755e98c080";

// papel: "alvo" (passa) · "negativo" (BARRA) · "positivo" (passa) · "alvo_novo" (informativo)
const IMAGENS = [
  // ── ALVO: a Alice olhando para a lente. É por isto que o conserto existe.
  ["alvo", "alice 4100fc07 GERADA 20:35 (525c, olhos na lente)", `${ALICE}/images/4100fc07-4801-484d-a722-fca0a5bcfbdb/result.png`],
  ["alvo", "alice b5c6dea7 upload 23:52 (camera acima, olhos na lente)", `${ALICE}/uploads/b5c6dea7-b81b-44de-98a9-ece11cb7102e.jpeg`],
  ["alvo", "alice 2b274f51 upload 17:56 (close, queixo recolhido, olhos na lente)", `${ALICE}/uploads/2b274f51-cebe-4636-9a71-f3bbbdd4a4a8.png`],

  // ── NEGATIVO: a Alice olhando para FORA da lente. Barrar é o portão certo.
  ["negativo", "alice 128b3050 upload 23:54 (olhar pro lado) [AMBIGUA]", `${ALICE}/uploads/128b3050-9cda-496d-a190-f2869c9b5375.jpeg`],
  ["negativo", "alice 0e6a538a upload 18:07 (olhar pro lado)", `${ALICE}/uploads/0e6a538a-e177-4b17-9fab-8b5d1f53148a.jpeg`],
  ["negativo", "alice 5f610dda upload 20:26 (olhar pro lado)", `${ALICE}/uploads/5f610dda-dac1-45fe-bda2-fc0c93bfd37f.jpeg`],
  ["negativo", "alice 8cd4c73c upload 20:22 (MESMO md5 que 5f610dda)", `${ALICE}/uploads/8cd4c73c-ec60-48d8-bb15-fe10aca88d35.jpeg`],

  // ── NEGATIVO: a razão de o portão existir (#131) e as classes que faltavam.
  ["negativo", "#131 itamar 8cd37f59 GERADA (olhos na tabua)", `${ITAMAR}/images/8cd37f59-0108-477a-8cbd-a5122d74d214/result.png`],
  ["negativo", "olhos presos no celular na mao (261859d5)", "261859d5-8ffe-4285-ae68-3a4a27bd9a1b/images/cbb41b1c-ecdd-45da-a304-92db7009db86/result.png"],
  ["negativo", "PERFIL de verdade + boca no bocal do saxofone (bc7f5dd4)", "bc7f5dd4-620f-45d4-adaa-31bb318478b6/uploads/0c755341-3249-439c-b485-ef04efdcd308.png"],
  ["negativo", "BOCA TAPADA por mascara cirurgica, olhando pra camera (c397ee7b)", "c397ee7b-68c6-425e-916f-8b7f239bb870/uploads/480e2b5d-89b0-47c7-b928-16e4a41a38c2.jpeg"],
  ["negativo", "NUCA: casal de costas pra camera (2f12a5a3)", "2f12a5a3-0cb9-4d71-ba26-65e792dbaefb/images/0c227c61-cacf-42dd-87c3-1374ff154684/result.png"],
  ["negativo", "NUCA: mulher e crianca caminhando de costas (f5c47a76)", "f5c47a76-3f63-4406-ad07-4d5de53ee8e5/images/20991d5d-50a6-4131-a264-e2410e4da781/result.png"],
  ["negativo", "SEM PESSOA: print de artigo cientifico (f3c0c474)", "f3c0c474-1506-423b-9de4-b19c57eb1b65/images/fde9e87a-6f74-4f47-9200-a70a5218f521/result.png"],
  ["negativo", "SEM PESSOA: fundo cyberpunk wireframe (493a285c)", "493a285c-3d3e-4241-967a-c7559a25d7d0/images/9dafc36f-aeba-48ed-a501-b16a2a0bb2c7/result.png"],

  // ── POSITIVO: a cartilha que o suporte manda, na foto que o proprio aluno escolheu.
  ["positivo", "#131 itamar 40b59813 ref (frontal, cartilha)", `${ITAMAR}/refs/40b59813_Retrato_profissional_com_fundo_neutro_2___2_.png`],

  /**
   * ── ALVO_NOVO (informativo, FORA do pass/fail) ──────────────────────────
   * Recusas REAIS de producao que eu abri em 20/09 e que, a olho, NAO deviam
   * ter sido recusadas. O gate velho barrou cada uma destas pessoas com uma
   * frase que a propria imagem desmente. Nao sao a Alice: sao a evidencia de
   * que o defeito nao era um aluno azarado.
   */
  ["alvo_novo", "40f5d152 1c5474b4 — recusada por 'olhando pra baixo'; olha NA LENTE", "40f5d152-a3e8-4eb4-86a4-c6fb60a87956/uploads/1c5474b4-0614-4a16-aed6-9327351227d9.jpeg"],
  ["alvo_novo", "e5c7d55a dd1f6423 — recusada por 'mao cobrindo a boca'; boca VISIVEL", "e5c7d55a-f190-4e46-b15d-6b51467e58d5/images/dd1f6423-2045-4e4e-be18-e5cc7b2a3c20/result.png"],
  ["alvo_novo", "cfb9b8e1 db2ff920 — recusada por 'microfone cobrindo a boca'; boca VISIVEL", "cfb9b8e1-8494-49ae-abb7-c3af7151751b/images/db2ff920-124e-4a4e-9fc3-c00eb84ac03c/result.png"],
];

function carregar(raiz, rotulo) {
  const jiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"))(__filename, { interopDefault: true });
  const alvo = path.join(raiz, "frontend", "src", "lib", "video-clone", "face-gate.ts");
  if (!fs.existsSync(alvo)) throw new Error(`face-gate.ts nao existe em ${rotulo} (${alvo})`);
  const mod = jiti(alvo);
  if (typeof mod.checkFrontalFace !== "function") throw new Error(`checkFrontalFace sumiu do gate ${rotulo} - abortando`);
  return mod.checkFrontalFace;
}

(async () => {
  if (path.resolve(WT_ANTES) === path.resolve(WT_DEPOIS)) {
    throw new Error(`ANTES e DEPOIS apontam para a MESMA arvore (${WT_ANTES}) - a comparacao nao mede nada`);
  }
  const bucket = BUCKETS.imagens();
  const gates = [["ANTES (main)", carregar(WT_ANTES, "ANTES")], ["DEPOIS (branch)", carregar(WT_DEPOIS, "DEPOIS")]];

  // Nada de zero de instrumento cego: confere que TODO objeto existe antes de medir.
  for (const [, rotulo, key] of IMAGENS) {
    if (!(await existe(bucket, key))) throw new Error(`objeto AUSENTE no R2, abortando: ${rotulo} (${key})`);
  }
  console.log(`${IMAGENS.length} imagens conferidas no R2 · ${RODADAS} rodadas por imagem por gate`);
  console.log(`ANTES  = ${WT_ANTES}`);
  console.log(`DEPOIS = ${WT_DEPOIS}\n`);

  const placar = {};
  for (const [nomeGate, gate] of gates) {
    console.log(`\n══════ ${nomeGate} ══════`);
    for (const [papel, rotulo, key] of IMAGENS) {
      const url = await urlAssinada(bucket, key, 1800);
      const vs = [];
      for (let i = 0; i < RODADAS; i++) {
        try {
          const r = await gate(url);
          vs.push(r.skipped ? { v: "SKIP", m: `fail-open:${r.skipped}` } : r.ok ? { v: "PASSA", m: "" } : { v: "BARRA", m: r.reason || "" });
        } catch (e) { vs.push({ v: "ERRO", m: (e && e.message) || "" }); }
      }
      const passa = vs.filter((x) => x.v === "PASSA").length;
      const skip = vs.filter((x) => x.v === "SKIP").length;
      placar[`${nomeGate}|${rotulo}`] = { papel, passa, skip, total: RODADAS, vs };
      const flip = passa > 0 && passa < RODADAS ? "  ⚠️ FLIPA" : "";
      console.log(`[${papel.toUpperCase()}] ${rotulo} -> ${passa}/${RODADAS} PASSA${skip ? ` (${skip} fail-open)` : ""}${flip}`);
      const motivos = [...new Set(vs.filter((x) => x.v === "BARRA").map((x) => x.m))];
      motivos.forEach((m) => console.log(`        barra: "${m}"`));
    }
  }

  // ── VEREDITO ────────────────────────────────────────────────────────────
  console.log("\n\n══════════ VEREDITO ══════════");
  const dep = (r) => placar[`DEPOIS (branch)|${r}`];
  const ant = (r) => placar[`ANTES (main)|${r}`];
  const doPapel = (p) => IMAGENS.filter((i) => i[0] === p);

  let reprovado = false;
  const falhas = [];

  for (const [, rotulo] of doPapel("negativo")) {
    const d = dep(rotulo);
    const ok = d.passa === 0;
    if (!ok) { reprovado = true; falhas.push(`NEGATIVO vazou: ${rotulo} (${d.passa}/${d.total})`); }
    console.log(`CONTROLE NEGATIVO  ${ok ? "✅ segurou" : "❌ VAZOU"}: ${rotulo} passou ${d.passa}/${d.total} no gate NOVO (antes: ${ant(rotulo).passa}/${ant(rotulo).total})`);
  }
  for (const [, rotulo] of doPapel("positivo")) {
    const d = dep(rotulo);
    const ok = d.passa === d.total;
    if (!ok) { reprovado = true; falhas.push(`POSITIVO barrou: ${rotulo} (${d.passa}/${d.total})`); }
    console.log(`CONTROLE POSITIVO  ${ok ? "✅ passou" : "❌ BARROU"}: ${rotulo} passou ${d.passa}/${d.total} no gate NOVO (antes: ${ant(rotulo).passa}/${ant(rotulo).total})`);
  }

  /**
   * ⚠️ A TRAVA QUE FALTAVA, E ELA NASCEU DE UM ERRO MEU NESTA MESMA RONDA.
   *
   * A 1ª versão desta régua dava o veredito olhando SÓ os dois controles. Ela
   * imprimiu "✅ APROVADO" para um conserto que levou a Alice de 3/35 para
   * **0/35** — porque os controles realmente seguraram. Estava literalmente
   * correto e mesmo assim era um sinal verde para mergear o contrário do
   * conserto: o portão deixou de sortear e passou a dizer "não" SEMPRE, para a
   * dona do incidente, inclusive na foto em que ela olha cravado na lente.
   *
   * Controle que segura não é conserto que funciona. Quem o conserto existe
   * para desbloquear tem que passar a passar — senão o que subiu foi só uma
   * recusa mais consistente.
   *
   * Em 20/09 a trava ficou mais DURA: não basta "melhorou na soma". Cada alvo
   * tem que passar 5/5, individualmente. Soma esconde o caso em que um alvo
   * destrava e outro afunda, e foi exatamente esse tipo de compensação que o
   * gabarito errado de 13/09 mascarou.
   */
  console.log("");
  for (const [, rotulo] of doPapel("alvo")) {
    const d = dep(rotulo), a = ant(rotulo);
    const ok = d.passa === d.total;
    if (!ok) { reprovado = true; falhas.push(`ALVO nao fechou: ${rotulo} (${d.passa}/${d.total})`); }
    console.log(`ALVO  ${ok ? "✅ passa" : "❌ NAO FECHOU"}: ${rotulo} — antes ${a.passa}/${a.total} → depois ${d.passa}/${d.total}`);
  }

  // Sorteio em QUALQUER papel reprova: gate que sorteia não é gate.
  const sorteia = IMAGENS.filter(([, r]) => { const d = dep(r); return d.passa > 0 && d.passa < d.total; });
  if (sorteia.length) { reprovado = true; falhas.push(`${sorteia.length} imagem(ns) SORTEIAM no gate novo`); }
  console.log(`\nIMAGENS QUE SORTEIAM no gate NOVO (nem 0 nem ${RODADAS}): ${sorteia.length}${sorteia.length ? " ❌ " + sorteia.map((i) => i[1]).join(" · ") : " ✅"}`);
  const sorteiaAntes = IMAGENS.filter(([, r]) => { const a = ant(r); return a.passa > 0 && a.passa < a.total; });
  console.log(`(na main, para comparar: ${sorteiaAntes.length}${sorteiaAntes.length ? " — " + sorteiaAntes.map((i) => i[1]).join(" · ") : ""})`);

  // Informativo, FORA do pass/fail.
  const novos = doPapel("alvo_novo");
  if (novos.length) {
    console.log(`\n── ALVO_NOVO (informativo, nao entra no veredito) ──`);
    for (const [, rotulo] of novos) {
      const d = dep(rotulo), a = ant(rotulo);
      console.log(`  ${d.passa === d.total ? "✅" : "⚠️ "} ${rotulo} — antes ${a.passa}/${a.total} → depois ${d.passa}/${d.total}`);
    }
  }

  // ── TABELA PRO CORPO DO PR ──────────────────────────────────────────────
  if (MD) {
    const linhas = ["| imagem | papel | ANTES (main) | DEPOIS (branch) | fecha? |", "|---|---|---|---|---|"];
    for (const [papel, rotulo] of IMAGENS) {
      const a = ant(rotulo), d = dep(rotulo);
      const esperado = papel === "negativo" ? 0 : d.total;
      const fecha = papel === "alvo_novo" ? "(informativo)" : (d.passa === esperado ? "✅" : "❌");
      linhas.push(`| ${rotulo} | ${papel} | ${a.passa}/${a.total} | ${d.passa}/${d.total} | ${fecha} |`);
    }
    fs.writeFileSync(MD, linhas.join("\n") + "\n");
    console.log(`\ntabela markdown escrita em ${MD}`);
  }

  if (falhas.length) { console.log("\nO QUE NAO FECHOU:"); falhas.forEach((f) => console.log("  - " + f)); }
  console.log(`\n${reprovado ? "❌ REPROVADO — NAO MERGEAR" : "✅ APROVADO: controles seguraram, alvos passaram 5/5 e nada sorteia"}`);
  process.exit(reprovado ? 1 : 0);
})().catch((e) => { console.error("FALHOU:", e && e.message); process.exit(1); });
