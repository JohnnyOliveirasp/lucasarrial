/**
 * CONTROLE POSITIVO da PALAVRA DECAPITADA (#234) — o ouvido consegue ouvir UM corte?
 *
 *   node _frank/ferramentas/2026-09-21_controle_positivo_decapitada.cjs [--dir=...]
 *
 * POR QUE EXISTE
 * --------------
 * O par cego de hoje (2026-09-21_par_cego_decapitada.cjs) deu um resultado que
 * tem DUAS leituras e nenhuma forma de escolher entre elas:
 *
 *   régua diz LIMPO     -> ouvido concordou 5 de 5
 *   régua diz REPROVADO -> ouvido confirmou 1 de 5, e a única confirmada é a
 *                          que tinha 5/5 fronteiras ruins. As 4 perdidas têm
 *                          UMA fronteira marcada em 4 a 10.
 *
 *   (a) a régua INFLA: marcar 1 fronteira em 10 é alarme falso; ou
 *   (b) o OUVIDO não pega um corte único perdido em 50s de áudio.
 *
 * Escrever (a) no cartão sem descartar (b) seria repetir o erro que a nota de
 * 20/09 do #226 pegou em si mesma ("derrubo o rótulo que eu mesmo ia publicar").
 * A diferença entre (a) e (b) vale dinheiro: se for (a), os 19,5% de hoje são
 * inflados e ligar o gate derruba entrega boa; se for (b), o número é real e o
 * ouvido não serve de juiz para esta classe.
 *
 * O QUE ESTA FERRAMENTA FAZ
 * -------------------------
 * Fabrica o defeito com a mão, num áudio que a régua E o ouvido já disseram que
 * está LIMPO (duplamente confirmado). Acha um silêncio interno e remove os ~90ms
 * de fala imediatamente ANTES dele — a última sílaba morre e a palavra cai seca
 * no silêncio, que é exatamente a anatomia que o laudo de 20/09 descreveu
 * ("a sílaba final é decepada abruptamente antes do silêncio entre as frases").
 *
 * Aí manda ao ouvido uma mistura CEGA de áudios adulterados e áudios intactos.
 *   ouvido acha os adulterados -> ele TEM sensibilidade pra corte único,
 *                                 logo os 4 que ele perdeu são falha da RÉGUA (a)
 *   ouvido perde os adulterados -> ele NÃO serve de juiz aqui (b), e o par cego
 *                                 de hoje não pode ser citado contra a régua
 *
 * SÓ LEITURA no banco e no R2. Não gasta GPU, não gasta crédito de aluno, não
 * toca em produção: o corte é feito em CÓPIA local com ffmpeg. Nenhum áudio de
 * aluno é alterado na origem.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};

const ORIGEM = arg("origem", "/tmp/par_cego_decapitada");
const DIR = arg("dir", "/tmp/controle_positivo_decapitada");
const MS_CORTE = parseInt(arg("ms", "90"), 10);

// Áudios que a régua disse LIMPO e o ouvido confirmou SEM CORTE no teste cego
// de hoje. Só estes servem de base: adulterar um que já tem defeito não mede nada.
const LIMPOS_CONFIRMADOS = ["AUDIO_01", "AUDIO_05", "AUDIO_06", "AUDIO_08", "AUDIO_10"];
// 3 viram adulterados, 2 vão intactos como distratores.
const ADULTERAR = ["AUDIO_01", "AUDIO_06", "AUDIO_10"];

function ffprobeDuracao(arquivo) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", arquivo,
  ]).toString().trim();
  return parseFloat(out);
}

/**
 * Silêncios internos via ffmpeg silencedetect. Devolve [{inicio, fim}].
 *
 * ARMADILHA QUE ME PEGOU (21/09): o silencedetect escreve no STDERR, e o
 * ffmpeg com `-f null -` sai com código 0. Quem tenta capturar pelo `catch` do
 * execFileSync nunca recebe nada (não houve exceção) e lê stdout, que é vazio —
 * resultado: "nenhum silêncio interno utilizável" em áudio cheio de silêncio, e
 * um controle positivo que nasceria com ZERO adulterado sem ninguém perceber.
 * Por isso aqui é spawnSync lendo .stderr explicitamente.
 */
function silenciosInternos(arquivo) {
  const r = spawnSync("ffmpeg", ["-i", arquivo, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"],
    { encoding: "utf8" });
  const err = (r.stderr || "") + (r.stdout || "");
  const sil = [];
  const re = /silence_start:\s*([0-9.]+)[\s\S]*?silence_end:\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(err)) !== null) sil.push({ inicio: parseFloat(m[1]), fim: parseFloat(m[2]) });
  if (!sil.length && !/silence_start/.test(err)) {
    console.error(`  ⚠️  silencedetect nao devolveu NADA para ${arquivo} — instrumento mudo, nao audio limpo.`);
  }
  return sil;
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const manifestoOrigem = JSON.parse(fs.readFileSync(path.join(ORIGEM, "MANIFESTO_CEGO.json"), "utf8"));
  const porRotulo = Object.fromEntries(manifestoOrigem.map((m) => [m.rotulo, m]));

  const gabarito = [];
  const saida = [];
  let i = 0;

  for (const rotulo of LIMPOS_CONFIRMADOS) {
    const orig = porRotulo[rotulo];
    if (!orig) { console.log(`  ⚠️  ${rotulo} nao esta no manifesto de origem — pulado`); continue; }
    i++;
    const novoRotulo = `TESTE_${String(i).padStart(2, "0")}`;
    const destino = path.join(DIR, `${novoRotulo}.mp3`);

    if (!ADULTERAR.includes(rotulo)) {
      fs.copyFileSync(orig.arquivo, destino);
      gabarito.push({ rotulo: novoRotulo, origem: rotulo, estado: "INTACTO", em: null });
      saida.push({ rotulo: novoRotulo, arquivo: destino, duracao_s: ffprobeDuracao(destino), texto_pedido: orig.texto_pedido });
      continue;
    }

    const dur = ffprobeDuracao(orig.arquivo);
    const sil = silenciosInternos(orig.arquivo).filter((s) => s.inicio > 3 && s.fim < dur - 3);
    if (!sil.length) {
      console.log(`  ⚠️  ${rotulo}: nenhum silencio interno utilizavel — vai INTACTO`);
      fs.copyFileSync(orig.arquivo, destino);
      gabarito.push({ rotulo: novoRotulo, origem: rotulo, estado: "INTACTO (sem silencio p/ adulterar)", em: null });
      saida.push({ rotulo: novoRotulo, arquivo: destino, duracao_s: dur, texto_pedido: orig.texto_pedido });
      continue;
    }

    // Pega um silêncio do meio (determinístico), e decepa os MS_CORTE ms de fala
    // imediatamente antes dele: a palavra perde a sílaba final e cai seca.
    const alvo = sil[Math.floor(sil.length / 2)];
    const corteEm = alvo.inicio;
    const inicioRemocao = Math.max(0.2, corteEm - MS_CORTE / 1000);

    const parteA = path.join(DIR, `_a_${novoRotulo}.wav`);
    const parteB = path.join(DIR, `_b_${novoRotulo}.wav`);
    const lista = path.join(DIR, `_lista_${novoRotulo}.txt`);
    execFileSync("ffmpeg", ["-y", "-i", orig.arquivo, "-t", String(inicioRemocao), "-c:a", "pcm_s16le", parteA],
      { stdio: "ignore" });
    execFileSync("ffmpeg", ["-y", "-i", orig.arquivo, "-ss", String(corteEm), "-c:a", "pcm_s16le", parteB],
      { stdio: "ignore" });
    fs.writeFileSync(lista, `file '${parteA}'\nfile '${parteB}'\n`);
    execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", lista, "-c:a", "libmp3lame", "-q:a", "2", destino],
      { stdio: "ignore" });
    for (const f of [parteA, parteB, lista]) fs.unlinkSync(f);

    gabarito.push({
      rotulo: novoRotulo, origem: rotulo, estado: "ADULTERADO",
      em: `${inicioRemocao.toFixed(2)}s (removidos ${MS_CORTE}ms antes do silencio em ${corteEm.toFixed(2)}s)`,
    });
    saida.push({ rotulo: novoRotulo, arquivo: destino, duracao_s: ffprobeDuracao(destino), texto_pedido: orig.texto_pedido });
  }

  const caminhoManifesto = path.join(DIR, "MANIFESTO_CEGO.json");
  fs.writeFileSync(caminhoManifesto, JSON.stringify(saida, null, 2));

  console.log(`✔ ${saida.length} audio(s) preparado(s) em ${DIR}`);
  console.log(`  manifesto CEGO: ${caminhoManifesto}`);
  console.log(`\n${"=".repeat(70)}`);
  console.log("🔑 GABARITO — NAO MANDE ISTO PARA QUEM VAI OUVIR");
  console.log("=".repeat(70));
  for (const g of gabarito) {
    console.log(`  ${g.rotulo}  ${g.estado.padEnd(12)}  (era ${g.origem})  ${g.em || ""}`);
  }
  const nAd = gabarito.filter((g) => g.estado === "ADULTERADO").length;
  console.log(`\n  ${nAd} adulterado(s), ${gabarito.length - nAd} intacto(s).`);
  console.log("  LEITURA: se o ouvido achar os adulterados, ele TEM sensibilidade");
  console.log("  pra corte unico -> os 4 que ele perdeu no par cego sao falha da REGUA.");
  console.log("  Se perder os adulterados, o ouvido NAO serve de juiz nesta classe.");
})();
