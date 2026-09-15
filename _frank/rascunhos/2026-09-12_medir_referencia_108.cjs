#!/usr/bin/env node
/**
 * 2026-09-12_medir_referencia_108.cjs — MEDIÇÃO (não cura) das referências.
 *
 * POR QUE NÃO USEI SÓ O `--medir` DA FERRAMENTA:
 * `conferir_transcript_referencia.cjs --medir` compara as pontas usando UMA
 * leitura do clipe inteiro. Mas a nota #193 escrita na PRÓPRIA ferramenta prova
 * que o whisper INVENTA o final quando o clipe corta no meio da fala (3 leituras
 * do mesmo clipe = 3 finais diferentes). Logo "cauda_diverge" de leitura única
 * NÃO distingue divergência real de alucinação — e foi assim que 2 de 6 curas
 * pioraram o dado. O portão de estabilidade (3 leituras dos últimos 4s, exigir
 * cauda IDÊNTICA) existe na ferramenta, mas só no caminho `--curar`.
 * Aqui ele é aplicado na MEDIÇÃO.
 *
 * Mede duas coisas SEPARADAS, que o chamado 108 vinha confundindo:
 *   (a) DIVERGÊNCIA texto×áudio  — o transcript não descreve o áudio (bug do eco)
 *   (b) CORTE SECO no meio da fala — o áudio termina sem silêncio no fim
 *       (defeito de prosódia; o texto pode estar perfeitamente fiel)
 * (b) é medido direto pelos word timestamps: folga = duração - fim da última
 * palavra. Sem folga = o áudio foi cortado em cima da fala.
 *
 * SÓ LEITURA: não escreve em `voices`, não cura, não aceita --confirmar.
 * uso: node 2026-09-12_medir_referencia_108.cjs [--limite N]
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const c = require(path.join(__dirname, "..", "ferramentas", "_comum.cjs"));

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DIR = path.join(c.RAIZ, "frontend", "_Bugs", "chamado_108_referencias");
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) || [];

// Folga mínima entre o fim da última palavra e o fim do clipe. Abaixo disso o
// corte encostou na fala: é corte seco, não fim natural de frase.
const FOLGA_MIN_S = 0.15;
const CAUDA_S = 4;      // igual à ferramenta (#193)
const LEITURAS = 3;     // idem: cauda instável = alucinação

async function transcrever(buf, nome = "ref.wav") {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "audio/wav" }), nome);
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
  if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 150));
  return j;
}

function duracao(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dur-"));
  const f = path.join(dir, "a.wav");
  try {
    fs.writeFileSync(f, buf);
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", f], { encoding: "utf8" });
    return parseFloat(out.trim()) || 0;
  } catch { return 0; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** 3 leituras dos últimos CAUDA_S segundos: cauda idêntica = real; variando = alucinação. */
async function caudaEstavel(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cauda-"));
  const ent = path.join(dir, "ref.wav"), sai = path.join(dir, "cauda.wav");
  fs.writeFileSync(ent, buf);
  try {
    execFileSync("ffmpeg", ["-v", "error", "-sseof", `-${CAUDA_S}`, "-i", ent, "-y", sai]);
    const cauda = fs.readFileSync(sai);
    const l = [];
    for (let i = 0; i < LEITURAS; i++) l.push(norm((await transcrever(cauda, "cauda.wav")).text).join(" "));
    return { estavel: l.every((x) => x === l[0]) && l[0].length > 0, cauda: l[0], leituras: l };
  } catch (e) {
    return { estavel: false, cauda: "", leituras: [], erro: e.message.slice(0, 80) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

(async () => {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");
  const amostra = JSON.parse(fs.readFileSync(path.join(DIR, "amostra_estratificada.json"), "utf8"));
  const limite = parseInt(arg("--limite") || String(amostra.length), 10);
  const alvo = amostra.slice(0, limite);
  const bucket = c.BUCKETS.vozes();
  const res = [];
  console.log(`medindo ${alvo.length} vozes (só leitura; ~R$0,023 cada)\n`);

  for (const v of alvo) {
    const linha = { id: v.id, polo: v.polo, email: v.email, trained_at: v.trained_at };
    try {
      const buf = Buffer.from(await (await fetch(await c.urlAssinada(bucket, v.path, 600))).arrayBuffer());
      const dur = duracao(buf);
      const j = await transcrever(buf);
      const palavras = j.words || [];
      const fimUlt = palavras.length ? Number(palavras[palavras.length - 1].end) : null;
      const folga = (dur && fimUlt !== null) ? +(dur - fimUlt).toFixed(3) : null;

      const T = norm(v.transcript), A = norm(j.text);
      // (a) veredito INGÊNUO: reproduz o que o `--medir` da ferramenta diria.
      const ingenuo = (T.length && A.length)
        ? ((T[T.length - 1] === A[A.length - 1] || T.slice(-2).join(" ") === A.slice(-2).join(" ")) && T[0] === A[0] ? "ok" : "diverge")
        : "vazio";

      // (a) veredito COM PORTÃO: só acusa se a cauda medida for estável.
      const est = await caudaEstavel(buf);
      let veredito;
      if (!est.estavel) veredito = "INCONCLUSIVO_whisper_instavel";
      else if (T.join(" ").endsWith(est.cauda)) veredito = "ok_texto_bate_audio";
      else veredito = "DIVERGENCIA_CONFIRMADA";

      Object.assign(linha, {
        duracao_s: +dur.toFixed(2), fim_ultima_palavra_s: fimUlt, folga_final_s: folga,
        corte_seco: folga !== null ? folga < FOLGA_MIN_S : null,
        veredito, veredito_ingenuo: ingenuo,
        cauda_estavel: est.estavel, cauda_medida: est.cauda,
        leituras_cauda: est.leituras,
        cauda_texto: T.slice(-4).join(" "), ouvido_fim: A.slice(-6).join(" "),
      });
      console.log(`  ${v.polo} ${v.id.slice(0, 8)} folga=${folga}s seco=${linha.corte_seco} ingenuo=${ingenuo} -> ${veredito}`);
    } catch (e) {
      linha.erro = e.message.slice(0, 120);
      console.log(`  ERR ${v.id.slice(0, 8)} ${linha.erro}`);
    }
    res.push(linha);
  }

  fs.writeFileSync(path.join(DIR, "medicao_108_2026-09-12.json"), JSON.stringify(res, null, 1));

  const val = res.filter((r) => !r.erro);
  const tab = (f) => { const m = {}; val.forEach((r) => { const k = f(r); m[k] = (m[k] || 0) + 1; }); return m; };
  console.log("\n== por polo x veredito ==");
  for (const p of ["A", "B", "C"]) {
    const g = val.filter((r) => r.polo === p);
    if (!g.length) continue;
    const d = g.filter((r) => r.veredito === "DIVERGENCIA_CONFIRMADA").length;
    const i = g.filter((r) => r.veredito.startsWith("INCONCLUSIVO")).length;
    const ok = g.filter((r) => r.veredito.startsWith("ok")).length;
    const seco = g.filter((r) => r.corte_seco === true).length;
    const fp = g.filter((r) => r.veredito_ingenuo === "diverge" && r.veredito !== "DIVERGENCIA_CONFIRMADA").length;
    console.log(`polo ${p} n=${g.length}: confirmada=${d} inconclusivo=${i} ok=${ok} | corte_seco=${seco} | falso_positivo_do_medir=${fp}`);
  }
  console.log("\nveredito geral:", JSON.stringify(tab((r) => r.veredito)));
  console.log("ingenuo (o que o --medir diria):", JSON.stringify(tab((r) => r.veredito_ingenuo)));
  console.log(`\nerros: ${res.length - val.length} | arquivo: ${path.join(DIR, "medicao_108_2026-09-12.json")}`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
