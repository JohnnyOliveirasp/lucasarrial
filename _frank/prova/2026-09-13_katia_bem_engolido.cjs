/**
 * 13/09 — "Bem" sai com 0ms. É real ou é artefato do whisper?
 *
 * DE ONDE VEIO: medindo as 2 gerações da Katia de hoje palavra a palavra, todas
 * as palavras têm 120–600ms e a palavra "Bem" tem 0ms, 20ms e 40ms — nas quatro
 * ocorrências das duas frases "Bem-vinda ao ... portal". É exatamente o ponto
 * que ela reclama desde 19/08 e sobre o qual a casa já mandou DOIS diagnósticos
 * diferentes e errados (uid 2040 "a palavra sumiu", uid 2041 "trocou de gênero").
 *
 * ⚠️ POR QUE NÃO DÁ PRA ACREDITAR NO 0ms DIRETO. O whisper devolveu o texto
 * como "Bem-vinda" (token hifenizado) e depois partiu em duas palavras. Quando
 * ele parte token composto, é comum carimbar largura ZERO na primeira metade.
 * Ou seja: o 0ms pode ser do TOKENIZADOR, não do áudio. Acreditar nele sem
 * conferir é repetir a armadilha de 12/09 (coverage lendo troca como omissão) —
 * a terceira vez que este card erra o diagnóstico no mesmo lugar.
 *
 * O TESTE: olhar a ENERGIA do áudio na janela onde "Bem" deveria estar, que é
 * instrumento acústico e não depende do tokenizador.
 *   - Se houver fala de verdade (~100–250ms acima do piso) antes de "vinda",
 *     então "Bem" FOI dito e o 0ms é artefato -> hipótese CAI.
 *   - Se a janela for silêncio/blip, "Bem" foi engolido de verdade.
 *
 * VALIDAÇÃO DA SONDA (obrigatória, lição de 12/09): a mesma medida roda em
 * palavras que sabidamente existem e soam bem ("portal", "Morgana", "você").
 * Se a sonda não acender nelas, o zero dela não vale nada e eu não concluo.
 *
 * Não gasta GPU, não toca em crédito, não escreve no banco.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "..", "ferramentas", "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(c.RAIZ, "frontend", ".env.local"),
});

const IDS = [
  ["60cf27fa-ad39-4f0d-aef7-b6c681ecdddb", "13:50 (gênero certo)"],
  ["ed61d09c-944c-49d7-9eb4-4ee7c493da6c", "13:53 (gênero trocado)"],
];
const SR = 48000;
const JAN = 0.010; // 10ms

async function words(file) {
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), path.basename(file));
  fd.append("model", "whisper-1");
  fd.append("language", "pt");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 200));
  return j.words || [];
}

/** decodifica o arquivo INTEIRO num passe (sem -ss: a armadilha do seek em mp3
 *  inventa ~50ms de zero falso — mesma razão documentada no cauda_decepada). */
function pcm(arquivo) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", arquivo, "-ac", "1",
    "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error("ffmpeg: " + r.stderr.toString().slice(0, 200));
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}

/** dB RMS por janela de 10ms dentro de [t0,t1] */
function janelas(x, t0, t1) {
  const i0 = Math.max(0, Math.floor(t0 * SR));
  const i1 = Math.min(x.length, Math.ceil(t1 * SR));
  const n = Math.floor(JAN * SR);
  const out = [];
  for (let i = i0; i + n <= i1; i += n) {
    let s = 0;
    for (let k = i; k < i + n; k++) s += x[k] * x[k];
    out.push(10 * Math.log10(Math.max(s / n, 1e-12)));
  }
  return out;
}

(async () => {
  const db = c.supa();
  for (const [id, rot] of IDS) {
    const { data: g } = await db.from("generations").select("audio_path").eq("id", id).single();
    const url = await c.urlAssinada(c.BUCKETS.geracoes(), g.audio_path, 900);
    const tmp = path.join(os.tmpdir(), `kb_${id.slice(0, 8)}.mp3`);
    fs.writeFileSync(tmp, Buffer.from(await (await fetch(url)).arrayBuffer()));
    const w = await words(tmp);
    const x = pcm(tmp);

    console.log(`\n═══ ${id.slice(0, 8)} · ${rot}`);
    for (let i = 0; i < w.length; i++) {
      const p = String(w[i].word).toLowerCase().replace(/[^a-zà-ú]/gi, "");
      const alvo = ["bem", "vinda", "vindo", "portal", "morgana", "você"].includes(p);
      if (!alvo) continue;
      const dur = w[i].end - w[i].start;
      // janela do whisper, e a MESMA janela alargada 200ms pra trás: se "Bem"
      // foi dito e o carimbo é que está errado, a fala aparece no alargamento.
      const dentro = janelas(x, w[i].start, w[i].end);
      const antes = janelas(x, Math.max(0, w[i].start - 0.2), w[i].start);
      const pico = (a) => (a.length ? Math.max(...a).toFixed(1) : "—");
      const acima = (a, lim) => a.filter((d) => d > lim).length * 10; // ms acima do limiar
      console.log(
        `  "${w[i].word}" t=${w[i].start.toFixed(3)}s dur=${Math.round(dur * 1000)}ms` +
        ` | pico_dentro=${pico(dentro)}dB fala_dentro=${acima(dentro, -45)}ms` +
        ` | 200ms_antes: pico=${pico(antes)}dB fala=${acima(antes, -45)}ms`,
      );
    }
    fs.unlinkSync(tmp);
  }
  console.log(`\nLeitura: "fala" = janelas de 10ms acima de -45dB. Uma palavra`);
  console.log(`de verdade tem 100ms+ de fala. Se "Bem" tiver ~0 dentro E ~0 nos`);
  console.log(`200ms antes, ela nao foi dita — e o 0ms nao e artefato.`);
})();
