#!/usr/bin/env node
/**
 * medir_pausas_da_entrega.cjs — mede o áudio que o ALUNO recebeu: quanto dele é
 * fala e quanto é silêncio. Compara duas ou mais gerações lado a lado (A/B).
 *
 * POR QUE EXISTE (caso Katia, incidente 47 / ce6e157d, 25/08). As duas outras
 * réguas do repositório medem a ENTRADA: `medir_ritmo_das_vozes.cjs` mede a
 * pausa natural no áudio de referência, `medir_velocidade_voz.cjs` mede a
 * articulação nos arquivos brutos do treino. Nenhuma das duas olha a SAÍDA —
 * e a queixa do aluno é sempre sobre a saída.
 *
 * A separação que importa, e que foi o que resolveu o caso: `duração` sozinha
 * não diz nada. Um áudio pode encurtar porque a fala acelerou (problema de
 * ritmo, tratado no QA de rate) OU porque o silêncio sumiu (problema de
 * montagem). São causas diferentes e times diferentes. Este script separa as
 * duas: mede a ARTICULAÇÃO (palavras por segundo FALANDO, pausas descontadas)
 * e o SILÊNCIO (nº de pausas, mediana, total) no mesmo passe.
 *
 * No caso Katia, o mesmo texto na mesma voz deu 36,98s (21/08) contra 34,15s
 * (25/08) — mas a articulação era idêntica (3,205 pal/s) e o tempo falando era
 * igual na casa do centésimo (30,89s). A queda inteira era silêncio que sumiu:
 * 6,09s contra 2,96s. Sem essa separação, a leitura óbvia ("ficou mais rápido")
 * teria mandado o time consertar o lugar errado.
 *
 * ⚠️ ARMADILHA DO ZERO, medida na própria construção deste script: a 1ª versão
 * reportou "0 pausas" nos três áudios. `execFileSync` NÃO devolve stderr quando
 * o processo sai 0 — e o ffmpeg sai 0. O silencedetect escreve em stderr, então
 * a leitura só acontecia no catch, que nunca era acionado. Zero que vem de
 * instrumento cego não é medição. Aqui usa `spawnSync` (stderr sempre) e o
 * script ABORTA se o log do silencedetect não aparecer, em vez de devolver 0.
 *
 * Não altera nada: só lê o banco e baixa do R2. Não gasta GPU e não toca em
 * crédito. Custo: ~R$0,02 de whisper por áudio.
 *
 * Uso (de qualquer pasta do projeto):
 *   node _frank/ferramentas/medir_pausas_da_entrega.cjs <generationId> [<generationId> ...]
 *   node _frank/ferramentas/medir_pausas_da_entrega.cjs <id> <id> --palavras "morgana,padroes"
 *       --palavras: procura essas palavras e diz em que segundo cada uma cai e
 *       quanto dura (serve pra conferir marcação de tempo que o aluno mandou).
 *   [--db -35] [--min-pausa 0.15]   limiar e duração mínima do silencedetect
 *
 * Aceita id completo ou prefixo (recusa prefixo ambíguo, em vez de medir o
 * áudio errado em silêncio).
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({ path: path.join(c.RAIZ, "frontend", ".env.local") });

const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const DB = parseFloat(arg("--db", "-35"));
const MIN_PAUSA = parseFloat(arg("--min-pausa", "0.15"));
const PALAVRAS = (arg("--palavras", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** uuid é uuid, não texto: `like` não existe pra esse tipo. Prefixo vira FAIXA. */
function faixaUuid(ref) {
  const hex = ref.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{1,32}$/.test(hex)) throw new Error(`"${ref}" não parece id`);
  const vestir = (s) => `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
  return { lo: vestir(hex.padEnd(32, "0")), hi: vestir(hex.padEnd(32, "f")) };
}

/** prefixo -> geração única. Recusa ambíguo e inexistente. */
async function resolver(ref) {
  const s = c.supa();
  const { lo, hi } = faixaUuid(ref);
  const { data, error } = await s.from("generations")
    .select("id,voice_id,audio_path,duration_seconds,created_at,status")
    .gte("id", lo).lte("id", hi).limit(5);
  if (error) throw new Error(`supabase: ${error.message}`);
  if (!data || !data.length) throw new Error(`geração "${ref}" não existe`);
  if (data.length > 1) throw new Error(`prefixo "${ref}" é ambíguo (${data.length}): ${data.map((g) => g.id.slice(0, 8)).join(", ")}`);
  if (!data[0].audio_path) throw new Error(`geração ${ref} não tem audio_path (status ${data[0].status})`);
  return data[0];
}

async function baixar(g) {
  const dest = path.join(os.tmpdir(), `entrega_${g.id.slice(0, 8)}.mp3`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  const r = await fetch(await c.urlAssinada(c.BUCKETS.geracoes(), g.audio_path, 900));
  if (!r.ok) throw new Error(`download ${g.id.slice(0, 8)}: HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

/** duração REAL do arquivo — não a anunciada no banco (que já mentiu antes: incidente a2b528a4). */
function duracaoReal(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });
  const v = parseFloat((r.stdout || "").trim());
  if (!Number.isFinite(v)) throw new Error(`ffprobe não devolveu duração para ${f}: ${(r.stderr || "").slice(0, 120)}`);
  return v;
}

function silencio(f) {
  const r = spawnSync("ffmpeg", ["-v", "info", "-i", f, "-af", `silencedetect=noise=${DB}dB:d=${MIN_PAUSA}`, "-f", "null", "-"], { encoding: "utf8" });
  const err = r.stderr || "";
  // sem esta trava, ffmpeg mudo vira "0 pausas" e o relatório mente com cara de medição
  if (!/silencedetect|Stream mapping/.test(err)) throw new Error(`ffmpeg não produziu log de silencedetect para ${f} — não acredite no zero`);
  const durs = [...err.matchAll(/silence_duration:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const inis = [...err.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]));
  const ord = durs.slice().sort((a, b) => a - b);
  return { n: durs.length, mediana: ord.length ? ord[Math.floor(ord.length / 2)] : null, total: durs.reduce((a, b) => a + b, 0), inicios: inis };
}

async function palavras(f) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(f)], { type: "audio/mpeg" }), "a.mp3");
  fd.append("model", "whisper-1"); fd.append("language", "pt"); fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 200));
  return (j.words || []).map((x) => ({ t: x.word, ini: x.start, fim: x.end }));
}

(async () => {
  const flags = new Set(["--db", "--min-pausa", "--palavras"]);
  const argv = process.argv.slice(2);
  const ids = argv.filter((a, i) => /^[0-9a-f]{6}[0-9a-f-]*$/i.test(a) && !flags.has(argv[i - 1]));
  if (!ids.length) { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); return; }

  const linhas = [];
  for (const ref of ids) {
    const g = await resolver(ref);
    const f = await baixar(g);
    const dur = duracaoReal(f);
    const sil = silencio(f);
    const w = await palavras(f);
    const falando = dur - sil.total;
    const art = falando > 0 ? w.length / falando : null;
    linhas.push({ id8: g.id.slice(0, 8), criada: String(g.created_at).slice(0, 16).replace("T", " "), dur, sil, palavras: w.length, falando, art, w });
    console.log(`\n=== ${g.id.slice(0, 8)}  (${String(g.created_at).slice(0, 16).replace("T", " ")})`);
    console.log(`  duração real  ${dur.toFixed(2)}s   |  ${w.length} palavras`);
    console.log(`  SILÊNCIO      ${sil.n} pausas >=${MIN_PAUSA}s @${DB}dB  |  mediana ${sil.mediana !== null ? (sil.mediana * 1000).toFixed(0) + "ms" : "-"}  |  total ${sil.total.toFixed(2)}s`);
    console.log(`  FALA          ${falando.toFixed(2)}s falando  |  articulação ${art ? art.toFixed(3) : "-"} palavras/s`);
    for (const p of PALAVRAS) {
      const hit = w.find((x) => norm(x.t) === norm(p));
      console.log(`    "${p}": ${hit ? `em ${hit.ini.toFixed(2)}s, dura ${(hit.fim - hit.ini).toFixed(2)}s` : "AUSENTE no áudio"}`);
    }
  }

  if (linhas.length > 1) {
    const b = linhas[0];
    console.log(`\n--- COMPARATIVO (base ${b.id8}) ---`);
    for (const l of linhas.slice(1)) {
      const dd = l.dur - b.dur, ds = l.sil.total - b.sil.total, df = l.falando - b.falando, da = (l.art || 0) - (b.art || 0);
      console.log(`${l.id8}: duração ${dd >= 0 ? "+" : ""}${dd.toFixed(2)}s | silêncio ${ds >= 0 ? "+" : ""}${ds.toFixed(2)}s | tempo falando ${df >= 0 ? "+" : ""}${df.toFixed(2)}s | articulação ${da >= 0 ? "+" : ""}${da.toFixed(3)} pal/s`);
      // a leitura que o caso Katia ensinou
      if (Math.abs(da) < 0.05 && Math.abs(ds) > 0.5) console.log(`   ↳ articulação IGUAL e silêncio mudou ${ds.toFixed(2)}s: é MONTAGEM (pausa), não ritmo de fala.`);
      else if (Math.abs(da) >= 0.05 && Math.abs(df) > 0.5) console.log(`   ↳ articulação mudou ${da.toFixed(3)} pal/s: é RITMO DE FALA, não montagem.`);
    }
  }
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
