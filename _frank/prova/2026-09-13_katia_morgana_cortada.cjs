/**
 * 13/09 — a Katia disse HOJE (11:10Z, respondendo à Fast) duas coisas:
 *   "as frases terminam abruptas, como se estivessem no meio"
 *   "a palavra Morgana está cortada no final"
 * e a Fast prometeu a ela um retorno da equipe técnica. Este script é esse
 * retorno: decide, com régua, o que ela está ouvindo.
 *
 * TRÊS HIPÓTESES, e as duas primeiras JÁ CAÍRAM nesta ronda:
 *   H1 decapitação de envelope (#234)  -> CAIU. cauda_decepada nas 2 gerações de
 *      hoje: release 175ms/125ms, plato -56,4/-49,4 dB. A régua (release<=35 E
 *      plato>-40) não marca nenhuma. O arquivo NÃO é cortado na onda.
 *   H2 palavra que não foi gerada      -> CAIU. whisper palavra a palavra lê
 *      "...ao portal da Morgana." nas duas. Nenhuma palavra some.
 *   H3 RITMO: o áudio sai muito acima da fala dela, e o alongamento final de
 *      frase (o "esticar" natural da última sílaba) é comido junto. Aí toda
 *      frase soa interrompida e a última palavra soa cortada — mesmo com todos
 *      os fonemas presentes. É a hipótese que este script testa.
 *
 * COMO SE TESTA H3, sem ouvido: numa fala natural a ÚLTIMA palavra da frase é
 * mais LONGA que a média (sentence-final lengthening). Se a razão
 * final/média for ~1 ou menor, o alongamento sumiu — e "abrupto" deixa de ser
 * impressão e vira medida.
 *
 * Compara as 2 de hoje com a referência do treino DELA (mesma voz, fala real),
 * porque um número solto não separa nada — o que separa é o contraste.
 *
 * Não gasta GPU, não toca em crédito, não escreve no banco.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const c = require(path.join(__dirname, "..", "ferramentas", "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(c.RAIZ, "frontend", ".env.local"),
});

const VOZ = "c127b74e-c41a-4464-9a5e-efe32ba0ca36";
const IDS = [
  ["60cf27fa-ad39-4f0d-aef7-b6c681ecdddb", "gerado 13:50"],
  ["ed61d09c-944c-49d7-9eb4-4ee7c493da6c", "gerado 13:53"],
];

async function words(file) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), path.basename(file));
  fd.append("model", "whisper-1");
  fd.append("language", "pt");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 200));
  return j.words || [];
}

/** Alongamento final: dur da última palavra / mediana das demais. */
function perfil(w, rotulo) {
  if (w.length < 5) { console.log(`  ${rotulo}: poucas palavras`); return; }
  const durs = w.map((x) => Math.max(0, x.end - x.start));
  const ultima = durs[durs.length - 1];
  const resto = durs.slice(0, -1).sort((a, b) => a - b);
  const med = resto[resto.length >> 1];
  const artic = w.length / durs.reduce((a, b) => a + b, 0);
  console.log(`  ${rotulo}`);
  console.log(`    última palavra          : "${w[w.length - 1].word}" ${(ultima * 1000).toFixed(0)}ms`);
  console.log(`    mediana das outras      : ${(med * 1000).toFixed(0)}ms`);
  console.log(`    ALONGAMENTO FINAL       : ${(ultima / med).toFixed(2)}x  ${ultima / med < 1.15 ? "<<< SEM ALONGAMENTO (soa cortada)" : "(alonga, soa concluída)"}`);
  console.log(`    articulação             : ${artic.toFixed(2)} pal/s`);
}

(async () => {
  const db = c.supa();

  // 1) a fala REAL dela, do treino — o padrão-ouro de comparação
  const { data: v } = await db.from("voices")
    .select("reference_audio_path, speech_rate_wps").eq("id", VOZ).single();
  if (v?.reference_audio_path) {
    const url = await c.urlAssinada(c.BUCKETS.vozes(), v.reference_audio_path, 900);
    const tmp = path.join(os.tmpdir(), "katia_ref.mp3");
    fs.writeFileSync(tmp, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log(`\n═══ REFERÊNCIA DO TREINO (a Katia falando de verdade) · régua ${v.speech_rate_wps} pal/s`);
    const w = await words(tmp);
    // na referência, olha as últimas palavras antes de cada pausa longa
    perfil(w, "arquivo inteiro");
    fs.unlinkSync(tmp);
  }

  // 2) as duas de hoje
  for (const [id, rot] of IDS) {
    const { data: g } = await db.from("generations")
      .select("audio_path").eq("id", id).single();
    const url = await c.urlAssinada(c.BUCKETS.geracoes(), g.audio_path, 900);
    const tmp = path.join(os.tmpdir(), `k_${id.slice(0, 8)}.mp3`);
    fs.writeFileSync(tmp, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log(`\n═══ ${id.slice(0, 8)} · ${rot}`);
    const w = await words(tmp);
    perfil(w, "arquivo inteiro");
    console.log(`    palavras (ms)           : ${w.map((x) => `${x.word}:${Math.round((x.end - x.start) * 1000)}`).join(" ")}`);
    fs.unlinkSync(tmp);
  }
})();
