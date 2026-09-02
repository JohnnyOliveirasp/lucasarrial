#!/usr/bin/env node
/**
 * cauda_decepada.cjs — acha PALAVRA DECAPITADA no áudio que o aluno recebeu.
 *
 * POR QUE EXISTE (caso Katia, geração 81d4f3f4, medido 02/09). A palavra "você"
 * que fecha a 4ª frase termina em 34,50s com a voz ainda ALTA e cai direto em
 * silêncio digital. As outras 3 frases do mesmo arquivo terminam decaindo
 * normalmente. É a mesma família do caso Carol Crozeta (26/08), mas no MEIO do
 * texto — e o QA de fim abrupto do worker só julga o ÚLTIMO chunk
 * (tts_qa/loop.py:290 e jobs/inference.py:377), então no meio ninguém olha.
 *
 * ⚠️ TRANSCRIÇÃO NÃO ENXERGA ESTE DEFEITO. O whisper devolve "você" inteiro
 * mesmo com o áudio decepado, por prior de linguagem — a cobertura dá 100% e o
 * áudio sai como [ready]. Só o ENVELOPE denuncia. Medir por transcrição aqui é
 * medir com régua cega.
 *
 * ⚠️ ARMADILHA DO SEEK (medida na construção): `ffmpeg -ss` no ponto exato de um
 * mp3 faz o decoder devolver ~50ms de zero FALSO e inventa um corte que não
 * existe. Aqui o arquivo é decodificado INTEIRO num passe só (sem -ss), então a
 * armadilha não se aplica — e é por isso que não se deve "otimizar" recortando.
 *
 * O QUE MEDE, e por que não é o dB sozinho. A primeira régua tentada foi
 * "último frame audível acima de -45dB colado no silêncio". Ela NÃO separa:
 * medida no caso quebrado deu -46,4dB e um arquivo LIMPO (1498fbe5) tem
 * fronteira em -51,6dB — 5dB de margem, e o corte conhecido passaria batido. O
 * que separa é a FORMA do decaimento, não o nível onde ele para:
 *
 *   release_ms  quanto tempo a voz leva pra sair de -40dB até o silêncio
 *               quebrado (81d4f3f4 @34,494s):  10 ms
 *               limpos (9 fronteiras, 3 arquivos): 55 a 305 ms
 *   plato_db    nível 60ms ANTES do silêncio (a voz ainda estava falando?)
 *               quebrado: -28 dB   |   limpos: -37 a -55 dB
 *
 * Regra: release_ms <= 35 E plato_db > -40. As duas juntas porque cada uma
 * sozinha é fina — o limiar está calibrado em UM positivo conhecido, então o
 * script GRAVA as features de toda fronteira (JSONL) e a classificação é feita
 * depois, sem re-baixar nada. Trocar de limiar não custa uma nova varredura.
 *
 * Não altera nada: só lê o banco e baixa do R2 pra /tmp, e APAGA cada arquivo
 * logo depois de medir (cota do /tmp já derrubou o bash da máquina inteira).
 * Não gasta GPU, não gasta whisper, não toca em crédito nem em áudio de aluno.
 *
 * Uso:
 *   node _frank/ferramentas/cauda_decepada.cjs --ensaio
 *       roda só nos 3 arquivos já classificados à mão e confere se a régua os
 *       separa. SEMPRE rodar isto antes de acreditar num resultado de base.
 *   node _frank/ferramentas/cauda_decepada.cjs --varrer [--dias N] [--conc 6]
 *       varre as entregas (paginado de 1000 em 1000 — PostgREST corta em 1000
 *       em silêncio e um `select` solto MENTE o alcance).
 *   node _frank/ferramentas/cauda_decepada.cjs --relatorio
 *       reclassifica o JSONL já gravado e imprime o alcance por aluno/voz.
 *   node _frank/ferramentas/cauda_decepada.cjs <id> [<id>...]
 *       mede gerações específicas e imprime o perfil de cada fronteira.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(c.RAIZ, "frontend", ".env.local"),
});

const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const tem = (n) => process.argv.includes(n);

const SR = 48000;          // decodifica tudo no mesmo sample rate
const JAN = 0.020;         // janela de 20ms — a resolução em que o corte foi medido
const PISO = 3e-5;         // -90dB = silêncio digital. Medido: os mp3 entregues
                           // têm zeros EXATOS e o histograma tem um vale vazio
                           // entre -190dB e -80dB, então o piso é folgado.
const MIN_SIL = 0.120;     // corrida de silêncio mínima pra contar como fronteira
const REL_MAX_MS = 35;     // release <= isto = suspeito  (quebrado 10, limpo >=55)
const PLATO_DB = -40;      // e ainda estava falando 60ms antes
const SAIDA = path.join(__dirname, "..", "prova", "cauda_decepada.jsonl");

// Os 3 arquivos classificados à mão pelo Johnny em 02/09 — a régua tem que
// reproduzir esta classificação ANTES de ser apontada pra base.
const ENSAIO = [
  ["81d4f3f4", "cortado"],
  ["47dc0f6e", "limpo"],
  ["1498fbe5", "limpo"],
];

// ── Medição ────────────────────────────────────────────────────────────────
function pcm(arquivo) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", arquivo, "-ac", "1",
    "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).slice(0, 200)}`);
  const b = r.stdout;
  if (!b || b.length < 4) throw new Error("ffmpeg devolveu pcm vazio");
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

/** RMS em dB da janela de 20ms que TERMINA em `fim` (ancorada, não em grade). */
function db(x, fim) {
  const n = Math.round(SR * JAN);
  const i = Math.max(0, fim - n);
  let s = 0;
  for (let k = i; k < fim; k++) s += x[k] * x[k];
  const r = Math.sqrt(s / Math.max(1, fim - i));
  return r > 0 ? 20 * Math.log10(r) : -200;
}

/** Início de cada corrida de silêncio digital longa + o fim do arquivo. */
function fronteiras(x) {
  const nmin = Math.round(SR * MIN_SIL);
  const out = [];
  let i = 0;
  while (i < x.length) {
    if (Math.abs(x[i]) <= PISO) {
      let j = i;
      while (j < x.length && Math.abs(x[j]) <= PISO) j++;
      // i>0: silêncio de ABERTURA não tem palavra antes pra decapitar
      if (j - i >= nmin && i > 0) out.push({ pos: i, sil: (j - i) / SR });
      i = j;
    } else i++;
  }
  if (!out.length || out[out.length - 1].pos < x.length - nmin) {
    out.push({ pos: x.length, sil: 0 });   // corte seco no último sample
  }
  return out;
}

/** As duas features da fronteira. `release` = ms desde a última janela >-40dB. */
function medir(x, pos) {
  let release = null;
  for (let ms = 0; ms <= 400; ms += 5) {
    if (db(x, Math.max(1, pos - Math.round(SR * ms / 1000))) > PLATO_DB) { release = ms; break; }
  }
  return {
    t: +(pos / SR).toFixed(3),
    release_ms: release,
    plato_db: +db(x, Math.max(1, pos - Math.round(SR * 0.060))).toFixed(1),
    ultimo_db: +db(x, pos).toFixed(1),
  };
}

const suspeita = (f) => f.release_ms !== null && f.release_ms <= REL_MAX_MS && f.plato_db > PLATO_DB;

function analisar(arquivo) {
  const x = pcm(arquivo);
  return fronteiras(x).map((b) => ({ ...medir(x, b.pos), sil_s: +b.sil.toFixed(3) }));
}

// ── Banco / R2 ─────────────────────────────────────────────────────────────
function faixaUuid(ref) {
  const hex = ref.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{1,32}$/.test(hex)) throw new Error(`"${ref}" não parece id`);
  const v = (s) => `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
  return { lo: v(hex.padEnd(32, "0")), hi: v(hex.padEnd(32, "f")) };
}

async function resolver(ref) {
  const s = c.supa();
  const { lo, hi } = faixaUuid(ref);
  const { data, error } = await s.from("generations")
    .select("id,user_id,voice_id,audio_path,duration_seconds,status,created_at")
    .gte("id", lo).lte("id", hi).limit(5);
  if (error) throw new Error(`supabase: ${error.message}`);
  if (!data || !data.length) throw new Error(`geração "${ref}" não existe`);
  if (data.length > 1) throw new Error(`prefixo "${ref}" ambíguo (${data.length})`);
  if (!data[0].audio_path) throw new Error(`geração ${ref} sem audio_path (status ${data[0].status})`);
  return data[0];
}

/** PAGINADO de propósito: PostgREST corta em 1000 sem avisar e o alcance mente. */
async function todasEntregas(dias) {
  const s = c.supa();
  const out = [];
  const PAG = 1000;
  for (let de = 0; ; de += PAG) {
    let q = s.from("generations")
      .select("id,user_id,voice_id,audio_path,duration_seconds,created_at")
      .eq("status", "ready").not("audio_path", "is", null)
      .order("created_at", { ascending: false }).range(de, de + PAG - 1);
    if (dias) q = q.gte("created_at", new Date(Date.now() - dias * 864e5).toISOString());
    const { data, error } = await q;
    if (error) throw new Error(`supabase: ${error.message}`);
    if (!data || !data.length) break;
    out.push(...data);
    process.stderr.write(`\r  paginando: ${out.length}`);
    if (data.length < PAG) break;
  }
  process.stderr.write("\n");
  return out;
}

async function baixar(g, destDir) {
  const dest = path.join(destDir, `cd_${g.id}${path.extname(g.audio_path) || ".mp3"}`);
  const r = await fetch(await c.urlAssinada(c.BUCKETS.geracoes(), g.audio_path, 3600));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

// ── Modos ──────────────────────────────────────────────────────────────────
async function medirGeracao(g, destDir) {
  const f = await baixar(g, destDir);
  try {
    return analisar(f);
  } finally {
    // apaga SEMPRE: 4257 mp3 acumulados estouram a cota do /tmp e derrubam o
    // bash de todos os agentes da máquina em silêncio (medido 23/08).
    try { fs.unlinkSync(f); } catch { /* já foi */ }
  }
}

async function ensaio() {
  console.log("ENSAIO — a régua tem que reproduzir a classificação feita à mão\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cauda_"));
  let ok = true;
  for (const [ref, esperado] of ENSAIO) {
    const g = await resolver(ref);
    const fs_ = await medirGeracao(g, dir);
    const flag = fs_.filter(suspeita);
    const veredicto = flag.length ? "cortado" : "limpo";
    const bate = veredicto === esperado;
    ok = ok && bate;
    console.log(`${bate ? "OK  " : "FALHA"} ${ref}  esperado=${esperado} medido=${veredicto}  (${fs_.length} fronteiras)`);
    for (const f of fs_) {
      console.log(`        t=${String(f.t).padStart(7)}s sil=${String(f.sil_s).padStart(6)}s ` +
        `release=${String(f.release_ms === null ? ">400" : f.release_ms).padStart(4)}ms ` +
        `plato=${String(f.plato_db).padStart(6)}dB ultimo=${String(f.ultimo_db).padStart(6)}dB` +
        (suspeita(f) ? "   <<< DECAPITADA" : ""));
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${ok ? "Régua aprovada nos 3 casos." : "RÉGUA REPROVADA — não use na base."}`);
  console.log(`Limiares: release_ms <= ${REL_MAX_MS} E plato_db > ${PLATO_DB}`);
  if (!ok) process.exitCode = 1;
}

async function varrer() {
  const dias = arg("--dias") ? parseInt(arg("--dias"), 10) : null;
  const conc = parseInt(arg("--conc", "6"), 10);
  console.error(`varrendo entregas${dias ? ` dos últimos ${dias}d` : " (base inteira)"}, conc=${conc}`);
  const gs = await todasEntregas(dias);
  console.error(`  ${gs.length} entregas ready com audio_path`);

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const feitos = new Set();
  if (fs.existsSync(SAIDA)) {
    for (const l of fs.readFileSync(SAIDA, "utf8").split("\n")) {
      if (l.trim()) { try { feitos.add(JSON.parse(l).id); } catch { /* linha torta */ } }
    }
    console.error(`  ${feitos.size} já medidos antes — retomando`);
  }
  const fila = gs.filter((g) => !feitos.has(g.id));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cauda_"));
  const out = fs.createWriteStream(SAIDA, { flags: "a" });
  let n = 0, erros = 0;

  async function worker() {
    for (;;) {
      const g = fila.shift();
      if (!g) return;
      let reg;
      try {
        reg = { id: g.id, user_id: g.user_id, voice_id: g.voice_id,
                created_at: g.created_at, dur: g.duration_seconds, fronteiras: await medirGeracao(g, dir) };
      } catch (e) {
        erros++;
        reg = { id: g.id, user_id: g.user_id, voice_id: g.voice_id,
                created_at: g.created_at, erro: String(e.message).slice(0, 160) };
      }
      out.write(JSON.stringify(reg) + "\n");
      if (++n % 25 === 0) process.stderr.write(`\r  medidos ${n}/${fila.length + n} (erros ${erros})`);
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  out.end();
  fs.rmSync(dir, { recursive: true, force: true });
  console.error(`\n  pronto: ${n} medidos, ${erros} erros -> ${SAIDA}`);
  relatorio();
}

function relatorio() {
  if (!fs.existsSync(SAIDA)) { console.log("sem JSONL — rode --varrer antes"); return; }
  const regs = fs.readFileSync(SAIDA, "utf8").split("\n").filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const medidos = regs.filter((r) => r.fronteiras);
  const erros = regs.filter((r) => r.erro);
  const flag = medidos.map((r) => ({ ...r, ruins: r.fronteiras.filter(suspeita) })).filter((r) => r.ruins.length);
  const alunos = new Set(flag.map((r) => r.user_id));
  const vozes = new Set(flag.map((r) => r.voice_id));

  console.log(`\n── ALCANCE ─────────────────────────────────────────────`);
  console.log(`medidos:   ${medidos.length} gerações  (${erros.length} não mediram)`);
  console.log(`fronteiras: ${medidos.reduce((a, r) => a + r.fronteiras.length, 0)}`);
  console.log(`GERAÇÕES com palavra decapitada: ${flag.length}` +
    ` (${(flag.length / Math.max(1, medidos.length) * 100).toFixed(1)}%)`);
  console.log(`ALUNOS atingidos: ${alunos.size}`);
  console.log(`VOZES atingidas:  ${vozes.size}`);
  if (erros.length) {
    const porq = {};
    for (const e of erros) { const k = e.erro.slice(0, 40); porq[k] = (porq[k] || 0) + 1; }
    console.log(`\nerros: ${Object.entries(porq).map(([k, v]) => `${v}x ${k}`).join(" | ")}`);
  }
  // sensibilidade: o limiar veio de UM positivo, então mostra o efeito de mexer
  console.log(`\nsensibilidade ao limiar (release_ms <=, com plato > ${PLATO_DB}dB):`);
  for (const lim of [15, 25, 35, 45, 55]) {
    const n = medidos.filter((r) => r.fronteiras.some((f) =>
      f.release_ms !== null && f.release_ms <= lim && f.plato_db > PLATO_DB)).length;
    console.log(`   <=${String(lim).padStart(3)}ms: ${n} gerações`);
  }
  console.log(`\ntop 15 gerações (pior fronteira):`);
  for (const r of flag.sort((a, b) => Math.min(...a.ruins.map((f) => f.release_ms)) - Math.min(...b.ruins.map((f) => f.release_ms))).slice(0, 15)) {
    const p = r.ruins.sort((a, b) => a.release_ms - b.release_ms)[0];
    console.log(`   ${r.id.slice(0, 8)} ${String(r.created_at).slice(0, 10)} voz=${String(r.voice_id).slice(0, 8)}` +
      ` t=${p.t}s release=${p.release_ms}ms plato=${p.plato_db}dB (${r.ruins.length} fronteira(s))`);
  }
}

// ── main ───────────────────────────────────────────────────────────────────
(async () => {
  if (tem("--ensaio")) return ensaio();
  if (tem("--varrer")) return varrer();
  if (tem("--relatorio")) return relatorio();
  const ids = process.argv.slice(2).filter((a) => /^[0-9a-f]{6}[0-9a-f-]*$/i.test(a));
  if (!ids.length) { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cauda_"));
  for (const ref of ids) {
    const g = await resolver(ref);
    const fr = await medirGeracao(g, dir);
    console.log(`\n${g.id} voz=${g.voice_id} ${g.created_at} — ${fr.length} fronteiras`);
    for (const f of fr) {
      console.log(`   t=${String(f.t).padStart(7)}s sil=${String(f.sil_s).padStart(6)}s ` +
        `release=${String(f.release_ms === null ? ">400" : f.release_ms).padStart(4)}ms ` +
        `plato=${String(f.plato_db).padStart(6)}dB ultimo=${String(f.ultimo_db).padStart(6)}dB` +
        (suspeita(f) ? "   <<< DECAPITADA" : ""));
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
