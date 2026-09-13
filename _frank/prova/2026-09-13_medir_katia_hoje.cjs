/**
 * 13/09 — mede as DUAS gerações que a Katia fez hoje (60cf27fa 13:50 e
 * ed61d09c 13:53, mesmo texto de 121 chars) contra a régua da voz dela
 * (voices.speech_rate_wps = 2,97 pal/s, gravada em 04/09).
 *
 * POR QUE: o card ce6e157d anda em círculo desde 19/08. A medição de 12/09
 * nomeou duas dívidas — (a) o esticamento de ritmo bate no teto e entrega fora
 * da régua sem avisar, (b) coverage/faltantes_* confundem TROCA com OMISSÃO.
 * Hoje ela gerou o mesmo texto duas vezes em 3min29s (sinal clássico de "saiu
 * errado, deixa eu tentar de novo") e a telemetria das duas NÃO TEM NENHUM
 * campo rate_* — ou seja o ajuste de ritmo nem rodou.
 *
 * O que este script decide:
 *   1. A fala entregue hoje está na régua dela? (articulação, pausas fora)
 *   2. O "Bem vinda" saiu "Bem vindo" de novo? (transcrição palavra a palavra)
 *
 * ⚠️ NÃO usa coverage/faltantes_* como prova de nada: a lição de 12/09 é que
 * essa métrica lê palavra TROCADA como palavra FALTANDO. Aqui se olha o texto
 * transcrito de verdade.
 *
 * Não gasta GPU, não toca em crédito, não escreve no banco. Só lê, baixa pra
 * /tmp, transcreve (whisper-1, ~R$0,02) e APAGA o arquivo.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const c = require(path.join(__dirname, "..", "ferramentas", "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(c.RAIZ, "frontend", ".env.local"),
});

const IDS = [
  "60cf27fa-ad39-4f0d-aef7-b6c681ecdddb",
  "ed61d09c-944c-49d7-9eb4-4ee7c493da6c",
];
const REGUA = 2.97; // voices.speech_rate_wps da voz c127b74e

async function whisperWords(file) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }),
    path.basename(file));
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
  return j;
}

(async () => {
  const db = c.supa();
  for (const id of IDS) {
    const { data: g, error } = await db
      .from("generations")
      .select("id, created_at, audio_path, duration_seconds, text_raw")
      .eq("id", id)
      .single();
    if (error) { console.log(`ERRO ${id}: ${error.message}`); continue; }

    const url = await c.urlAssinada(c.BUCKETS.geracoes(), g.audio_path, 900);
    const tmp = path.join(os.tmpdir(), `katia_${id.slice(0, 8)}.mp3`);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync(tmp, buf);

    const dur = Number(
      execFileSync("ffprobe", ["-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", tmp]).toString().trim(),
    );

    const j = await whisperWords(tmp);
    const w = j.words || [];
    // ARTICULAÇÃO = palavras / tempo FALANDO (pausas fora). É a mesma conta do
    // medir_velocidade_voz.cjs, pra poder comparar com a régua no mesmo pé.
    const falando = w.reduce((a, x) => a + Math.max(0, x.end - x.start), 0);
    const artic = falando > 0 ? w.length / falando : null;
    // Bruta = palavras / duração do arquivo (só pra dimensionar o quanto de
    // pausa existe; NÃO é a régua).
    const bruta = dur > 0 ? w.length / dur : null;

    console.log(`\n═══ ${id.slice(0, 8)} · ${g.created_at} · ${buf.length} bytes`);
    console.log(`  duração medida no arquivo : ${dur.toFixed(2)}s (banco diz ${g.duration_seconds}s)`);
    console.log(`  palavras transcritas      : ${w.length}`);
    console.log(`  ARTICULAÇÃO               : ${artic ? artic.toFixed(2) : "?"} pal/s`);
    console.log(`  régua da voz dela         : ${REGUA} pal/s`);
    if (artic) {
      const desvio = (artic / REGUA - 1) * 100;
      console.log(`  DESVIO                    : ${desvio > 0 ? "+" : ""}${desvio.toFixed(1)}%  ${Math.abs(desvio) > 20 ? "<<< FORA DA RÉGUA" : ""}`);
    }
    console.log(`  bruta (com pausas)        : ${bruta ? bruta.toFixed(2) : "?"} pal/s`);
    console.log(`  ESCRITO : ${g.text_raw}`);
    console.log(`  OUVIDO  : ${(j.text || "").trim()}`);

    // troca de gênero: as palavras que ela escreveu vs o que o whisper ouviu
    const alvo = ["vinda", "vindo", "para", "pra", "volta"];
    const ouvidas = w.map((x) => String(x.word).toLowerCase().replace(/[^a-zà-ú]/gi, ""))
      .filter((x) => alvo.includes(x));
    console.log(`  palavras-chave ouvidas    : ${JSON.stringify(ouvidas)}`);

    fs.unlinkSync(tmp);
  }
})();
