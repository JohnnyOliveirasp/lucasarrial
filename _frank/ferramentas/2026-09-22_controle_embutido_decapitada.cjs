/**
 * CONTROLE POSITIVO **EMBUTIDO** da PALAVRA DECAPITADA (#234, f8587cef).
 *
 *   node _frank/ferramentas/2026-09-22_controle_embutido_decapitada.cjs \
 *        [--origem=/tmp/par_cego_n12] [--dir=/tmp/controle_embutido] \
 *        --adulterar=AUDIO_02,AUDIO_04,AUDIO_09,AUDIO_20 \
 *        --intactos=AUDIO_03,AUDIO_12,AUDIO_21 \
 *        --reais=AUDIO_11,AUDIO_15,AUDIO_16,AUDIO_23,AUDIO_24 \
 *        [--ms=90]
 *
 * POR QUE EXISTE — O DEFEITO DE DESENHO QUE ELE CONSERTA
 * -----------------------------------------------------
 * Em 21/09 o par cego (n=10) e o controle positivo (n=5) rodaram SEPARADOS. O
 * controle deu 5/5 e por isso a rodada pôde dizer "o ouvido é sensível, logo o
 * que ele não achou não estava lá".
 *
 * Em 22/09 eu subi o par cego para n=24, em 2 lotes de 12, e **não embuti
 * controle nenhum**. O resultado voltou uniforme: 23 de 24 "SEM CORTE", todos
 * com "confiança alta", e o único "CORTE" caiu num áudio que a régua diz LIMPO.
 * Entre as 23 negativas estão gerações com fronteira decapitada CONFIRMADA
 * offline pelo `cauda_decepada.cjs`, com segundo na mão (a 3907e758 tem CINCO).
 *
 * Isso tem duas leituras e o teste de 22/09, como foi desenhado, NÃO separa:
 *   (a) a régua marca fronteira abrupta que o ouvido não ouve — inclusive em
 *       densidade alta (seria a tese de 21/09, agora mais forte); ou
 *   (b) o ouvido DEGRADA sob carga: com 12 arquivos num pedido só ele carimba
 *       "SEM CORTE | alta" em tudo e não está medindo nada.
 *
 * A uniformidade das respostas é o cheiro de (b), mas cheiro não é medição.
 * Publicar (a) sem descartar (b) seria exatamente o erro que a nota de 20/09 do
 * #226 pegou em si mesma, e que a de 21/09 evitou de propósito.
 *
 * O CONSERTO: o controle vai DENTRO do lote, na MESMA carga.
 * ---------------------------------------------------------
 * O controle de 21/09 rodou com 5 arquivos. Se o ouvido degrada a partir de ~12,
 * um controle de 5 é aprovado e não prova nada sobre um lote de 12. Aqui os
 * fabricados viajam MISTURADOS com os reais, no mesmo pedido e no mesmo tamanho
 * de lote, então o controle mede o ouvido NAS CONDIÇÕES EM QUE ELE JULGOU.
 *
 * COMO SE LÊ O RESULTADO
 * ----------------------
 *   acha os ADULTERADOS e perde os REAIS -> o ouvido estava acordado; o que ele
 *       não ouviu nos reais não é audível. Sustenta (a).
 *   perde os ADULTERADOS -> lote VAZIO de informação. O par cego de 22/09 não
 *       pode ser citado nem a favor nem contra a régua, e o caminho é lote menor.
 *   acha os INTACTOS -> alarme falso; o ouvido não serve de juiz nesta carga.
 *
 * SÓ LEITURA. O corte é feito em CÓPIA local com ffmpeg; nenhum áudio de aluno é
 * alterado na origem. Não gasta GPU, não gasta whisper, não toca em crédito.
 *
 * ARMADILHA HERDADA (medida em 21/09, mantida aqui): o `silencedetect` escreve
 * no STDERR e o ffmpeg sai com código 0 — quem lê stdout recebe vazio e fabrica
 * ZERO adulterado sem perceber. Por isso é spawnSync lendo `.stderr`, e por isso
 * o script MORRE se produzir menos adulterados do que foram pedidos: controle
 * positivo que nasce vazio é pior que não ter controle.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};
const lista = (nome) => (arg(nome, "") ? arg(nome, "").split(",").map((s) => s.trim()).filter(Boolean) : []);

const ORIGEM = arg("origem", "/tmp/par_cego_n12");
const DIR = arg("dir", "/tmp/controle_embutido");
const MS_CORTE = parseInt(arg("ms", "90"), 10);
const ADULTERAR = lista("adulterar");
const INTACTOS = lista("intactos");
const REAIS = lista("reais");

if (!ADULTERAR.length) {
  console.error("❌ --adulterar= é obrigatório. Sem fabricado não há controle.");
  process.exit(1);
}

function ffprobeDuracao(arquivo) {
  return parseFloat(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", arquivo,
  ]).toString().trim());
}

function silenciosInternos(arquivo) {
  const r = spawnSync("ffmpeg", ["-i", arquivo, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"],
    { encoding: "utf8" });
  const err = (r.stderr || "") + (r.stdout || "");
  const sil = [];
  const re = /silence_start:\s*([0-9.]+)[\s\S]*?silence_end:\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(err)) !== null) sil.push({ inicio: parseFloat(m[1]), fim: parseFloat(m[2]) });
  if (!sil.length && !/silence_start/.test(err)) {
    console.error(`  ⚠️  silencedetect NAO devolveu nada para ${arquivo} — instrumento mudo, nao audio limpo.`);
  }
  return sil;
}

/** Embaralho DETERMINÍSTICO (sem Math.random): a rodada tem que ser refeita
 *  por quem for conferir. Ordena pelo rótulo de origem invertido. */
const embaralho = (a, b) =>
  a.origem.split("").reverse().join("").localeCompare(b.origem.split("").reverse().join(""));

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const manifestoOrigem = JSON.parse(fs.readFileSync(path.join(ORIGEM, "MANIFESTO_CEGO.json"), "utf8"));
  const porRotulo = Object.fromEntries(manifestoOrigem.map((m) => [m.rotulo, m]));

  const pendentes = [];
  for (const r of ADULTERAR) pendentes.push({ origem: r, papel: "ADULTERAR" });
  for (const r of INTACTOS) pendentes.push({ origem: r, papel: "INTACTO" });
  for (const r of REAIS) pendentes.push({ origem: r, papel: "REAL" });
  pendentes.sort(embaralho);

  const gabarito = [];
  const manifesto = [];
  let i = 0;
  let adulteradosDeVerdade = 0;

  for (const p of pendentes) {
    const orig = porRotulo[p.origem];
    if (!orig) { console.log(`  ⚠️  ${p.origem} nao esta no manifesto de origem — pulado`); continue; }
    i++;
    const rot = `TESTE_${String(i).padStart(2, "0")}`;
    const destino = path.join(DIR, `${rot}.mp3`);

    if (p.papel !== "ADULTERAR") {
      fs.copyFileSync(orig.arquivo, destino);
      gabarito.push({ rotulo: rot, origem: p.origem, estado: p.papel, em: null });
      manifesto.push({ rotulo: rot, arquivo: destino, duracao_s: ffprobeDuracao(destino), texto_pedido: orig.texto_pedido });
      continue;
    }

    const dur = ffprobeDuracao(orig.arquivo);
    const sil = silenciosInternos(orig.arquivo).filter((s) => s.inicio > 3 && s.fim < dur - 3);
    if (!sil.length) {
      console.log(`  ⚠️  ${p.origem}: sem silencio interno utilizavel — vai INTACTO (nao conta como controle)`);
      fs.copyFileSync(orig.arquivo, destino);
      gabarito.push({ rotulo: rot, origem: p.origem, estado: "INTACTO (falhou adulteracao)", em: null });
      manifesto.push({ rotulo: rot, arquivo: destino, duracao_s: dur, texto_pedido: orig.texto_pedido });
      continue;
    }

    const alvo = sil[Math.floor(sil.length / 2)];
    const corteEm = alvo.inicio;
    const inicioRemocao = Math.max(0.2, corteEm - MS_CORTE / 1000);

    const a = path.join(DIR, `_a_${rot}.wav`);
    const b = path.join(DIR, `_b_${rot}.wav`);
    const txt = path.join(DIR, `_l_${rot}.txt`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", orig.arquivo, "-t", String(inicioRemocao), a]);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(corteEm), "-i", orig.arquivo, b]);
    fs.writeFileSync(txt, `file '${a}'\nfile '${b}'\n`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", txt, "-c:a", "libmp3lame", "-q:a", "2", destino]);
    for (const f of [a, b, txt]) { try { fs.unlinkSync(f); } catch {} }

    adulteradosDeVerdade++;
    gabarito.push({ rotulo: rot, origem: p.origem, estado: "ADULTERADO", em: Number(inicioRemocao.toFixed(3)) });
    manifesto.push({ rotulo: rot, arquivo: destino, duracao_s: ffprobeDuracao(destino), texto_pedido: orig.texto_pedido });
  }

  if (adulteradosDeVerdade < ADULTERAR.length) {
    console.error(`\n❌ pedi ${ADULTERAR.length} adulterado(s) e sairam ${adulteradosDeVerdade}.`);
    console.error("   Controle positivo incompleto NAO vale — corrija a base antes de mandar ao ouvido.");
    process.exit(1);
  }

  fs.writeFileSync(path.join(DIR, "MANIFESTO_CEGO.json"), JSON.stringify(manifesto, null, 2));

  console.log(`\n✔ ${manifesto.length} arquivo(s) em ${DIR}`);
  console.log(`  manifesto CEGO (é este que vai pro ouvido): ${path.join(DIR, "MANIFESTO_CEGO.json")}`);
  console.log(`  ${adulteradosDeVerdade} adulterado(s) · ${INTACTOS.length} intacto(s) · ${REAIS.length} real(is)`);
  console.log("\n" + "=".repeat(70));
  console.log("🔑 GABARITO — NAO MANDE ISTO PARA QUEM VAI OUVIR");
  console.log("=".repeat(70));
  for (const g of gabarito) {
    console.log(`  ${g.rotulo}  ${g.estado.padEnd(28)} origem=${g.origem}` + (g.em !== null ? `  corte fabricado em ${g.em}s` : ""));
  }
})();
