#!/usr/bin/env node
/**
 * 2026-09-19_medir_entonacao_final.cjs — mede se a voz SOBE ou DESCE no fim de
 * cada frase. É a régua de ENTONAÇÃO que faltava na casa.
 *
 * POR QUE EXISTE (ronda das falhas 19/09 ~20hZ, cartão 4ce9f365 / Ellen).
 * A queixa dela é "a pergunta sai lida como afirmação, sem subida de tom".
 * Nenhuma régua do repositório responde isso: `medir_pausas_da_entrega.cjs`
 * mede ritmo e silêncio, `medir_ritmo_das_vozes.cjs` mede pausa da referência,
 * `medir_velocidade_voz.cjs` mede articulação. TODAS medem TEMPO. Entonação é
 * ALTURA (F0), e ninguém media.
 *
 * ⚠️ O MOTIVO DE SER CÓDIGO E NÃO "MANDAR UM MODELO OUVIR" — medido hoje, e é
 * o achado que obriga esta ferramenta a existir. A ordem de 17/09 manda
 * despachar percepção pro agente `olho`. Fiz isso neste cartão e ele devolveu
 * um parecer DETALHADO sobre curva ascendente/descendente. Depois desconfiei e
 * apliquei um CONTROLE CEGO: mandei três arquivos — um bipe de 440Hz, um
 * silêncio puro e a fala — perguntando só qual era qual. Ele respondeu "não
 * consigo abrir nem ouvir" para os TRÊS, inclusive para o bipe contra o
 * silêncio, que qualquer ouvido separa. Ou seja: o parecer detalhado anterior
 * era CONFABULADO a partir do texto que eu mandei junto, não escutado.
 * Modelo que não ouve não vira ouvido por ser chamado de ouvido. F0 vira.
 *
 * O MÉTODO (sem dependência: só ffmpeg + autocorrelação em JS puro)
 *   1. ffmpeg decodifica pra PCM 16kHz mono s16le.
 *   2. Janelas de 40ms a cada 10ms. Frame é VOZEADO se a energia passa do
 *      limiar E a autocorrelação acha período estável em 70–400Hz.
 *   3. Corta em TRECHOS DE FALA separados por silêncio >= --min-pausa.
 *   4. Em cada trecho mede a MEDIANA de F0 no miolo e no RABO (últimos --rabo
 *      ms vozeados), e devolve a diferença em SEMITONS.
 *          +  = subiu (cara de pergunta)
 *          -  = desceu (cara de afirmação)
 *
 * ⚠️ ARMADILHA DA OITAVA, e por que a mediana e não a média: autocorrelação
 * erra em oitava (acha 2x ou 1/2 do F0 real) em frames de borda, e UM erro
 * desses joga a média inteira fora. A mediana aguenta. Frames fora de
 * 70–400Hz são descartados antes, não "corrigidos" — corrigir esconderia o
 * erro em vez de mostrá-lo.
 *
 * ⚠️ O QUE ESTA RÉGUA NÃO DIZ: ela não diz se o áudio é AGRADÁVEL, nem se o
 * timbre é metálico, nem se a voz "parece robô". Isso é ouvido e a casa não
 * tem. Ela diz UMA coisa, medida: a altura subiu ou desceu no fim da frase.
 *
 * Uso:
 *   node _frank/ferramentas/2026-09-19_medir_entonacao_final.cjs <audio> [...]
 *     [--min-pausa 0.15]  silêncio que separa trechos (s)
 *     [--rabo 350]        tamanho do rabo medido (ms)
 *     [--db -35]          limiar de silêncio, igual ao medir_pausas
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const args = process.argv.slice(2);
const ARQS = args.filter((a) => !a.startsWith("--"));
function opt(nome, padrao) {
  const i = args.indexOf("--" + nome);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : padrao;
}
const MIN_PAUSA = opt("min-pausa", 0.15);
const RABO_MS = opt("rabo", 350);
const DB = opt("db", -35);

if (!ARQS.length) {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
  process.exit(0);
}

const SR = 16000;
const JAN = Math.round(0.04 * SR); // 40ms
const HOP = Math.round(0.01 * SR); // 10ms
const F0_MIN = 70, F0_MAX = 400;
const LAG_MIN = Math.floor(SR / F0_MAX);
const LAG_MAX = Math.ceil(SR / F0_MIN);

function pcm(arq) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", arq, "-ac", "1", "-ar", String(SR),
    "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) {
    console.error("ffmpeg falhou em " + arq + ": " + String(r.stderr));
    process.exit(1);
  }
  const b = r.stdout;
  const x = new Float32Array(b.length >> 1);
  for (let i = 0; i < x.length; i++) x[i] = b.readInt16LE(i << 1) / 32768;
  return x;
}

/** F0 por autocorrelação normalizada. Devolve 0 se não achar período confiável. */
function f0Frame(x, ini) {
  let energia = 0;
  for (let i = 0; i < JAN; i++) energia += x[ini + i] * x[ini + i];
  const rms = Math.sqrt(energia / JAN);
  if (rms < 1e-4) return { f0: 0, rms };

  // remove média (DC) — senão a autocorrelação vira platô e o pico some
  let m = 0;
  for (let i = 0; i < JAN; i++) m += x[ini + i];
  m /= JAN;

  let melhorLag = 0, melhorR = 0;
  const r0 = energia - JAN * m * m;
  if (r0 <= 0) return { f0: 0, rms };
  for (let lag = LAG_MIN; lag <= LAG_MAX; lag++) {
    let s = 0;
    for (let i = 0; i + lag < JAN; i++) s += (x[ini + i] - m) * (x[ini + i + lag] - m);
    const r = s / r0;
    if (r > melhorR) { melhorR = r; melhorLag = lag; }
  }
  // 0.35 = piso de confiança. Abaixo disso é ruído/fricativa, não tom.
  if (melhorR < 0.35 || !melhorLag) return { f0: 0, rms };
  const f = SR / melhorLag;
  return { f0: f >= F0_MIN && f <= F0_MAX ? f : 0, rms };
}

function mediana(v) {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1];
}
const semitons = (a, b) => (a > 0 && b > 0 ? 12 * Math.log2(b / a) : NaN);

for (const arq of ARQS) {
  const x = pcm(arq);
  const quadros = [];
  for (let ini = 0; ini + JAN < x.length; ini += HOP) {
    const q = f0Frame(x, ini);
    quadros.push({ t: ini / SR, ...q });
  }
  const pico = Math.max(...quadros.map((q) => q.rms));
  const limiar = pico * Math.pow(10, DB / 20);

  // trechos de fala separados por silêncio >= MIN_PAUSA
  const trechos = [];
  let atual = null, silDesde = null;
  for (const q of quadros) {
    const fala = q.rms >= limiar;
    if (fala) {
      silDesde = null;
      if (!atual) atual = { ini: q.t, fim: q.t, qs: [] };
      atual.fim = q.t;
      atual.qs.push(q);
    } else if (atual) {
      if (silDesde === null) silDesde = q.t;
      else if (q.t - silDesde >= MIN_PAUSA) { trechos.push(atual); atual = null; silDesde = null; }
    }
  }
  if (atual) trechos.push(atual);

  console.log("\n=== " + arq.split("/").pop() + "  (" + (x.length / SR).toFixed(2) + "s, " +
    trechos.length + " trechos de fala)");
  console.log("  #   início    dur    F0 miolo   F0 rabo    Δ semitons   veredito");
  for (let i = 0; i < trechos.length; i++) {
    const t = trechos[i];
    const dur = t.fim - t.ini;
    if (dur < 0.35) continue; // trecho curto demais pra ter rabo
    const voz = t.qs.filter((q) => q.f0 > 0);
    if (voz.length < 8) continue;
    const corte = t.fim - RABO_MS / 1000;
    const rabo = voz.filter((q) => q.t >= corte).map((q) => q.f0);
    const miolo = voz.filter((q) => q.t < corte).map((q) => q.f0);
    if (rabo.length < 3 || miolo.length < 3) continue;
    const mM = mediana(miolo), mR = mediana(rabo);
    const d = semitons(mM, mR);
    const vd = d >= 1.5 ? "SOBE (cara de pergunta)"
      : d <= -1.5 ? "desce (cara de afirmação)"
        : "PLANO (nem sobe nem desce)";
    console.log("  " + String(i + 1).padStart(2) + "  " + t.ini.toFixed(2).padStart(6) + "s  " +
      dur.toFixed(2).padStart(5) + "s  " + mM.toFixed(1).padStart(7) + "Hz  " +
      mR.toFixed(1).padStart(7) + "Hz  " + d.toFixed(2).padStart(9) + "   " + vd);
  }
}
