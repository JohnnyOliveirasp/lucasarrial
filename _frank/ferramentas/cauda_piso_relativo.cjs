#!/usr/bin/env node
/**
 * cauda_piso_relativo.cjs — o detector de fronteira com PISO RELATIVO que a
 * nota 30 do #234 pediu, e o motivo dele existir é uma cegueira medida.
 *
 * ── O PROBLEMA QUE ISTO RESOLVE ───────────────────────────────────────────
 * `cauda_decepada.cjs` acha a palavra decapitada na ENTREGA e acerta na âncora
 * humana (81d4f3f4 @34,494s). Mas ele define fronteira como uma corrida de
 * >=120ms abaixo de -90dB — SILÊNCIO DIGITAL. Isso vale em mp3 de TTS, que tem
 * zeros exatos entre frases, e é estruturalmente inaplicável em GRAVAÇÃO
 * HUMANA, que tem piso de ruído: medido na voz 7fbeb738, a janela mais
 * silenciosa da referência é -65,9dB, ou seja 24dB ACIMA do limiar. Nunca
 * haverá 120ms abaixo de -90dB, então a régua não pode marcar nada — nem num
 * defeito que exista.
 *
 * Foi isso que aconteceu em 09/09: a hipótese "a decapitação é herdada do
 * áudio de referência" foi testada com uma cópia literal da régua da entrega,
 * deu "0 decepadas em 12/12 do polo ALTO e 17/17 do polo ZERO", e isso NÃO era
 * refutação — era n=0 fronteiras em 28 das 29 vozes. Zero de instrumento cego.
 * A hipótese segue NÃO TESTADA.
 *
 * ── O QUE MUDA ────────────────────────────────────────────────────────────
 * Tudo aqui é relativo AO PRÓPRIO ARQUIVO, medido no envelope dele:
 *
 *   piso      = p05 do envelope + MARGEM_PISO   (em vez de -90dB fixo)
 *   fala      = p95 do envelope                 (o nível em que esta voz fala)
 *   limiar de "ainda estava falando" = fala - QUEDA_PLATO
 *
 * As constantes vêm de calibrar o frame relativo CONTRA o absoluto na entrega,
 * onde o absoluto é conhecidamente válido: QUEDA_PLATO = 25dB porque a fala de
 * TTS entregue tem p95 ~-15dB e o limiar absoluto do platô é -40dB.
 *
 * ── A TRAVA QUE A NOTA 30 EXIGIU, E ELA É INEGOCIÁVEL ─────────────────────
 * Detector novo não aponta pra base nenhuma antes de reproduzir a âncora
 * confirmada por gente. `--ancora` mede os 3 arquivos classificados à mão e
 * EXIGE: 81d4f3f4 marcado em t=34,494 (a Katia ouviu, o e-mail da casa de
 * 04/09 descreveu "some de uma vez, em um centésimo de segundo"), 47dc0f6e e
 * 1498fbe5 limpos. Reprovou, não serve — e um resultado dele em cima de
 * qualquer polo nasce inválido.
 *
 * ⚠️ Isto NÃO substitui o cauda_decepada.cjs. Lá o piso absoluto é o certo (o
 * silêncio da entrega é digital de verdade) e a prova acumulada de 4.345
 * entregas está calibrada nele. Este aqui existe para o lado onde aquele não
 * enxerga: a REFERÊNCIA.
 *
 * ⚠️ Ele mora em _frank/ferramentas/ e não em _Bugs/ de propósito: `_Bugs/`
 * é gitignored (.gitignore:87), e foi por isso que as duas ferramentas de
 * medição das rondas de 08/09 e 09/09 evaporaram sem deixar uma linha.
 *
 * Uso:
 *   node _frank/ferramentas/cauda_piso_relativo.cjs --ancora
 *       roda a trava acima. SEMPRE antes de acreditar em qualquer resultado.
 *   node _frank/ferramentas/cauda_piso_relativo.cjs --geracao <id> [<id>...]
 *   node _frank/ferramentas/cauda_piso_relativo.cjs --voz <id> [<id>...]
 *       mede a referência (reference_audio_path) das vozes dadas.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
const cd = require(path.join(__dirname, "_cauda.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(c.RAIZ, "frontend", ".env.local"),
});

const tem = (n) => process.argv.includes(n);

const SR = 48000;
const JAN = 0.020;          // 20ms — mesma resolução do detector absoluto
const PASSO = 0.005;        // grade de 5ms para o envelope
const MARGEM_PISO = 6;      // dB acima do p05 ainda conta como silêncio
const QUEDA_PLATO = 25;     // dB abaixo do p95: "ainda estava falando"
const MIN_SIL = 0.120;      // mesma corrida mínima do detector absoluto
const JANELA_REL = 0.400;   // mesma janela de busca do release

// Âncoras: as MESMAS 3 classificadas à mão pelo Johnny em 02/09. A de corte
// tem o ponto exato fixado pela nota 29 — não basta marcar o arquivo, tem que
// marcar o SEGUNDO certo, senão está acertando por acidente.
const ANCORAS = [
  { ref: "81d4f3f4", esperado: "cortado", t: 34.494 },
  { ref: "47dc0f6e", esperado: "limpo" },
  { ref: "1498fbe5", esperado: "limpo" },
];

function pcm(arquivo) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", arquivo, "-ac", "1",
    "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).slice(0, 200)}`);
  const b = r.stdout;
  if (!b || b.length < 4) throw new Error("ffmpeg devolveu pcm vazio");
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

/** dB RMS da janela de 20ms que TERMINA em `fim` (ancorada, não em grade). */
function db(x, fim) {
  const n = Math.round(SR * JAN);
  const i = Math.max(0, fim - n);
  let s = 0;
  for (let k = i; k < fim; k++) s += x[k] * x[k];
  const r = Math.sqrt(s / Math.max(1, fim - i));
  return r > 0 ? 20 * Math.log10(r) : -200;
}

/** Envelope em grade de 5ms + os percentis que definem o frame do arquivo. */
function envelope(x) {
  const passo = Math.round(SR * PASSO);
  const env = [];
  for (let i = passo; i <= x.length; i += passo) env.push(db(x, i));
  const ord = [...env].sort((a, b) => a - b);
  const p = (q) => ord[Math.min(ord.length - 1, Math.max(0, Math.floor(q * ord.length)))];
  return { env, passo, p05: p(0.05), p50: p(0.5), p95: p(0.95) };
}

/**
 * Fronteiras pelo piso DO ARQUIVO. Devolve as mesmas features do detector
 * absoluto (t, release_ms, plato_db, sil_s) para poder comparar lado a lado,
 * mais o frame usado — sem o frame, o número não é interpretável.
 */
function analisar(arquivo) {
  const x = pcm(arquivo);
  const { env, passo, p05, p50, p95 } = envelope(x);
  const piso = p05 + MARGEM_PISO;
  const limiarVoz = p95 - QUEDA_PLATO;
  const nmin = Math.round(MIN_SIL / PASSO);

  const fr = [];
  let i = 0;
  while (i < env.length) {
    if (env[i] <= piso) {
      let j = i;
      while (j < env.length && env[j] <= piso) j++;
      if (j - i >= nmin && i > 0) {
        const pos = i * passo;   // 1ª amostra da corrida de silêncio
        let release = null;
        for (let ms = 0; ms <= JANELA_REL * 1000; ms += 5) {
          if (db(x, Math.max(1, pos - Math.round(SR * ms / 1000))) > limiarVoz) { release = ms; break; }
        }
        fr.push({
          t: +(pos / SR).toFixed(3),
          release_ms: release,
          plato_db: +db(x, Math.max(1, pos - Math.round(SR * 0.060))).toFixed(1),
          sil_s: +((j - i) * PASSO).toFixed(3),
          // "quão alta a voz estava" medido NO FRAME do arquivo: é isto que
          // dá pra comparar entre entrega (TTS) e referência (gravação).
          plato_rel: +(db(x, Math.max(1, pos - Math.round(SR * 0.060))) - p95).toFixed(1),
        });
      }
      i = j;
    } else i++;
  }
  // ⚠️ TRAVA DE FRAME DEGENERADO — descoberta medindo, 09/09, e ela é a
  // diferença entre um detector e um gerador de manchete falsa.
  // Se a faixa dinâmica do arquivo (p95-p05) for menor que QUEDA_PLATO +
  // MARGEM_PISO, o limiarVoz cai ABAIXO do piso: o próprio silêncio já conta
  // como "voz acima do limiar", a busca regressiva acerta em ms=0 e TODA
  // fronteira sai com release=0, ou seja 100% de falso positivo POR
  // CONSTRUÇÃO. Medido na voz 7fbeb738 (p05=-60,9 p95=-36,0 → faixa 24,9dB
  // contra os 31dB necessários): 8 de 8 fronteiras "decepadas", todas com
  // release=0. Sem esta trava, esse arquivo viraria "polo ZERO tem 100% de
  // decapitação na referência" — que é o erro que a nota 30 pediu pra não
  // repetir, só que invertido: antes era cegueira, aqui seria alucinação.
  const faixa = p95 - p05;
  const frameValido = limiarVoz > piso;
  return {
    fronteiras: fr,
    frame: { p05, p50, p95, piso, limiarVoz, faixa, valido: frameValido },
    dur: x.length / SR,
  };
}

/**
 * Régua no frame relativo: corte rápido E voz ainda alta PARA ESTE ARQUIVO.
 * Só pode ser aplicada quando o frame é válido — quem chamar precisa checar
 * `frame.valido` antes, e `imprimir()`/`medirVozes()` recusam sozinhos.
 */
const suspeitaRel = (f) => cd.normalizarRelease(f.release_ms) <= cd.REL_MAX_MS
  && f.plato_rel > -QUEDA_PLATO;

async function baixar(bucket, key, dir, tag) {
  const dest = path.join(dir, `pr_${tag}${path.extname(key) || ".bin"}`);
  const r = await fetch(await c.urlAssinada(bucket, key, 3600));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

function faixaUuid(ref) {
  const hex = ref.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{1,32}$/.test(hex)) throw new Error(`"${ref}" não parece id`);
  const v = (s) => `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
  return { lo: v(hex.padEnd(32, "0")), hi: v(hex.padEnd(32, "f")) };
}

/** ⚠️ .like() em coluna uuid não casa nada e volta vazio EM SILÊNCIO (nota 30). */
async function porPrefixo(tabela, colunas, ref) {
  const { lo, hi } = faixaUuid(ref);
  const { data, error } = await c.supa().from(tabela).select(colunas)
    .gte("id", lo).lte("id", hi).limit(5);
  if (error) throw new Error(`supabase: ${error.message}`);
  if (!data || !data.length) throw new Error(`${tabela} "${ref}" não existe`);
  if (data.length > 1) throw new Error(`prefixo "${ref}" ambíguo (${data.length})`);
  return data[0];
}

function imprimir(nome, a, marcar) {
  const f = a.frame;
  console.log(`\n${nome} — ${a.fronteiras.length} fronteiras · dur ${a.dur.toFixed(1)}s`);
  console.log(`   frame do arquivo: p05=${f.p05.toFixed(1)}dB p50=${f.p50.toFixed(1)}dB ` +
    `p95=${f.p95.toFixed(1)}dB → piso=${f.piso.toFixed(1)}dB limiarVoz=${f.limiarVoz.toFixed(1)}dB` +
    ` · faixa=${f.faixa.toFixed(1)}dB`);
  if (!f.valido) {
    console.log(`   ⚠️ FRAME DEGENERADO (limiarVoz ${f.limiarVoz.toFixed(1)} <= piso ${f.piso.toFixed(1)}):`);
    console.log(`      a faixa dinâmica ${f.faixa.toFixed(1)}dB é menor que os ${QUEDA_PLATO + MARGEM_PISO}dB`);
    console.log(`      que a régua precisa. TODA fronteira sairia com release=0 e seria`);
    console.log(`      marcada — 100% de falso positivo por construção. NÃO CLASSIFICO.`);
    return;
  }
  for (const b of a.fronteiras.filter(marcar ? suspeitaRel : () => true).slice(0, 12)) {
    console.log(`   t=${String(b.t).padStart(8)}s sil=${String(b.sil_s).padStart(6)}s ` +
      `release=${cd.mostrarRelease(b.release_ms).padStart(4)}ms ` +
      `plato=${String(b.plato_db).padStart(6)}dB rel=${String(b.plato_rel).padStart(6)}dB` +
      (suspeitaRel(b) ? "   <<< DECAPITADA" : ""));
  }
}

async function ancora() {
  console.log("TRAVA DA ÂNCORA — o detector tem que reproduzir o que gente ouviu\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pisorel_"));
  let ok = true;
  try {
    for (const A of ANCORAS) {
      const g = await porPrefixo("generations", "id,audio_path,duration_seconds", A.ref);
      const f = await baixar(c.BUCKETS.geracoes(), g.audio_path, dir, A.ref);
      const a = analisar(f);
      fs.unlinkSync(f);
      const marcadas = a.fronteiras.filter(suspeitaRel);
      const veredicto = marcadas.length ? "cortado" : "limpo";
      let bate = veredicto === A.esperado;
      let detalhe = "";
      if (A.t !== undefined) {
        // não basta acertar o arquivo: tem que acertar o SEGUNDO
        const perto = marcadas.find((b) => Math.abs(b.t - A.t) < 0.15);
        bate = bate && !!perto;
        detalhe = perto ? ` · pegou t=${perto.t}s (esperado ${A.t}s)` : ` · NÃO pegou t=${A.t}s`;
      }
      ok = ok && bate;
      console.log(`${bate ? "OK   " : "FALHA"} ${A.ref} esperado=${A.esperado} medido=${veredicto}${detalhe}`);
      imprimir(`   ${A.ref}`, a, false);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${ok ? "Detector APROVADO na âncora — pode apontar pra base."
    : "Detector REPROVADO — qualquer resultado dele nasce inválido (nota 30 do #234)."}`);
  if (!ok) process.exitCode = 1;
}

async function medirVozes(refs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pisorel_"));
  try {
    for (const ref of refs) {
      const v = await porPrefixo("voices", "id,reference_audio_path,name", ref);
      if (!v.reference_audio_path) { console.log(`\n${ref} — SEM reference_audio_path`); continue; }
      try {
        const f = await baixar(c.BUCKETS.vozes(), v.reference_audio_path, dir, ref);
        const a = analisar(f);
        fs.unlinkSync(f);
        imprimir(`voz ${ref} (${v.reference_audio_path})`, a, false);
        console.log(a.frame.valido
          ? `   => ${a.fronteiras.filter(suspeitaRel).length} decepada(s) de ${a.fronteiras.length} fronteiras`
          : `   => NÃO CLASSIFICÁVEL (frame degenerado) — não conte esta voz em nenhum polo`);
      } catch (e) { console.log(`\nvoz ${ref} — ERRO: ${e.message}`); }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

async function medirGeracoes(refs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pisorel_"));
  try {
    for (const ref of refs) {
      const g = await porPrefixo("generations", "id,audio_path", ref);
      const f = await baixar(c.BUCKETS.geracoes(), g.audio_path, dir, ref);
      const a = analisar(f);
      fs.unlinkSync(f);
      imprimir(`geração ${ref}`, a, false);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

(async () => {
  const resto = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (tem("--ancora")) return ancora();
  if (tem("--voz")) return medirVozes(resto);
  if (tem("--geracao")) return medirGeracoes(resto);
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
