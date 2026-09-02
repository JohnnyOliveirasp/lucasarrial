#!/usr/bin/env node
/**
 * medir_pontuacao.cjs — mede ANTES x DEPOIS o efeito do prompt do whisper na
 * pontuação, e portanto no número de candidatas de fabricar_referencia.cjs.
 *
 * POR QUE EXISTE (02/09, voz 1d332ef0): a chamada do whisper era feita sem
 * `prompt` e a gravação de 60min voltou com 10 fins de frase em 4.866 palavras
 * → 0 candidatas → "nenhuma candidata", que o operador lê como "voz sem trecho
 * aproveitável". Falso impossível. Pra provar que o prompt conserta E que não
 * regride as vozes que já funcionavam, é preciso medir as duas transcrições da
 * MESMA voz lado a lado — é o que esta ferramenta faz.
 *
 * NÃO toca em banco, R2, GPU nem em referência de aluno: só lê o cache local
 * em frontend/_Bugs/chamado_108_referencias/<voz8>/ e, quando falta o cache do
 * modo pedido, chama o whisper em cima do raw16k.mp3 que já está no disco.
 * Reaproveita as funções de fabricar_referencia.cjs (require), então mede
 * exatamente o mesmo algoritmo que a ferramenta de verdade usa.
 *
 * Uso:
 *   node _frank/ferramentas/medir_pontuacao.cjs <voz8|voiceId> [...]  [--transcrever]
 *     --transcrever  se faltar o cache de um dos modos, chama o whisper (custa
 *                    ~US$ 0,006/min de áudio). Sem a flag, só reporta "ausente".
 */
const path = require("node:path");
const fs = require("node:fs");
const c = require(path.join(__dirname, "_comum.cjs"));
const F = require(path.join(__dirname, "fabricar_referencia.cjs"));

const BASE = path.join(c.RAIZ, "frontend", "_Bugs", "chamado_108_referencias");
const TRANSCREVER = process.argv.includes("--transcrever");
const VOZES = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!VOZES.length) { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(0); }

/** Roda o mesmo pipeline de fabricar_referencia sobre uma transcrição já pronta. */
function medir(j) {
  const al = F.marcarFimDeFrase(j.words, j.segments);
  const fins = al.W.filter((w) => w.fim).length;
  const fimDeSegmento = j.segments.filter((g) => F.TERMINAL.test((g.text || "").trim())).length;
  const cands = F.candidatas(j.words, j.segments);
  const dur = j.duration || (al.W.length ? al.W[al.W.length - 1].end : 0);
  return {
    dur, palavras: al.W.length, segmentos: j.segments.length,
    alinhamento: al.total ? al.casadas / al.total : 0,
    fins, fimDeSegmento, candidatas: cands.length,
    // uma marca a cada N palavras — é o número que explica o 0 candidatas
    porFim: fins ? al.W.length / fins : Infinity,
  };
}

const linha = (rot, m) => m === null
  ? `  ${rot.padEnd(12)} cache ausente (use --transcrever)`
  : `  ${rot.padEnd(12)} fins de frase ${String(m.fins).padStart(4)} (1 a cada ${m.porFim === Infinity ? "∞" : m.porFim.toFixed(0)} palavras · ${m.fimDeSegmento} em fim de segmento) · CANDIDATAS ${String(m.candidatas).padStart(4)} · alinhamento ${(100 * m.alinhamento).toFixed(1)}%`;

(async () => {
  for (const v of VOZES) {
    const v8 = v.slice(0, 8);
    const dir = path.join(BASE, v8);
    if (!fs.existsSync(dir)) { console.log(`\n=== ${v8}: pasta não existe em ${BASE} — pulando`); continue; }
    const mp3 = path.join(dir, "raw16k.mp3");
    const res = {};
    for (const [rot, prompt] of [["ANTES (cru)", null], ["DEPOIS (prompt)", F.PROMPT_PT]]) {
      const dest = F.cacheTranscricao(dir, prompt);
      if (!fs.existsSync(dest)) {
        if (!TRANSCREVER) { res[rot] = null; continue; }
        if (!fs.existsSync(mp3)) { console.log(`  ${rot}: sem raw16k.mp3 local, não dá pra transcrever`); res[rot] = null; continue; }
        process.stderr.write(`  … transcrevendo ${v8} (${rot})\n`);
        await F.transcrever(mp3, dest, prompt);
      }
      res[rot] = medir(JSON.parse(fs.readFileSync(dest, "utf8")));
    }
    const q = res["ANTES (cru)"] || res["DEPOIS (prompt)"];
    console.log(`\n=== ${v8} · bruto ${q ? Math.round(q.dur) : "?"}s · ${q ? q.palavras : "?"} palavras`);
    for (const rot of ["ANTES (cru)", "DEPOIS (prompt)"]) console.log(linha(rot, res[rot]));
    const a = res["ANTES (cru)"], d = res["DEPOIS (prompt)"];
    if (a && d) {
      const seta = d.candidatas > a.candidatas ? "↑" : d.candidatas < a.candidatas ? "↓ REGREDIU" : "=";
      console.log(`  → candidatas ${a.candidatas} ${seta} ${d.candidatas} · fins ${a.fins} → ${d.fins}`);
    }
  }
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
