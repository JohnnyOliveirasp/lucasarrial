#!/usr/bin/env node
/**
 * normalizar_referencia.cjs — a referência de 30s da voz no VOLUME certo.
 *
 * POR QUE EXISTE (caso Pepe, 24/08): o VoxCPM gera em modo "continue este
 * áudio" — ele copia o NÍVEL da referência. A referência do Pepe foi cortada
 * do arquivo mais baixo dos 7 que ele mandou (-37 LUFS; os outros -24) e toda
 * geração dele saiu em -37 LUFS = 5x mais fraca que uma geração normal (-24).
 * No volume máximo do PC ainda soava baixo, e "não parecia com ele". A LoRA
 * (timbre) estava certa; retreinar não resolvia.
 *
 * O que faz: baixa ref/auto.wav, mede LUFS, normaliza pra -23 LUFS (EBU R128,
 * pico -1.5 dBTP) com ffmpeg, guarda backup (.bak-<data>.wav no R2) e sobe a
 * nova no MESMO caminho. Transcrição e LoRA não mudam. Sem GPU. Reversível.
 *
 * Uso (de qualquer pasta):
 *   node _frank/ferramentas/normalizar_referencia.cjs <voiceId|prefixo>            # mede e simula
 *   node _frank/ferramentas/normalizar_referencia.cjs <voiceId|prefixo> --confirmar
 *   node _frank/ferramentas/normalizar_referencia.cjs --varrer [--abaixo -30]     # lista vozes com ref baixa
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync, spawnSync } = require("node:child_process");
// o loudnorm imprime no STDERR — execFileSync().toString() só traz o stdout (deu NaN)
const ffErr = (args) => { const r = spawnSync("ffmpeg", args, { encoding: "utf8" }); return (r.stderr || "") + (r.stdout || ""); };
const c = require(path.join(__dirname, "_comum.cjs"));

const ALVO = -23;
const CONFIRMAR = process.argv.includes("--confirmar");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };

function medir(file) {
  const out = ffErr(["-hide_banner", "-i", file, "-af", "loudnorm=print_format=summary", "-f", "null", "-"]);
  const g = (re) => parseFloat((out.match(re) || [])[1]);
  return { lufs: g(/Input Integrated:\s+([-\d.]+)/), pico: g(/Input True Peak:\s+([-\d.]+)/), lra: g(/Input LRA:\s+([-\d.]+)/) };
}

async function baixar(bucket, key, dest) {
  const url = await c.urlAssinada(bucket, key, 600);
  fs.writeFileSync(dest, Buffer.from(await (await fetch(url)).arrayBuffer()));
}

async function varrer() {
  const abaixo = parseFloat(arg("--abaixo") || "-30");
  const s = c.supa();
  const { data: vozes } = await s.from("voices").select("id,name,user_id,reference_audio_path").eq("status", "ready").not("reference_audio_path", "is", null);
  const bucket = c.BUCKETS.vozes();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "refs-"));
  const baixas = [];
  console.log(`medindo ${vozes.length} referências…`);
  for (const v of vozes) {
    const f = path.join(tmp, v.id + ".wav");
    try { await baixar(bucket, v.reference_audio_path, f); const m = medir(f); fs.unlinkSync(f);
      if (m.lufs < abaixo) { baixas.push({ id: v.id, nome: v.name, lufs: m.lufs }); console.log(`  ${v.id.slice(0, 8)} ${String(m.lufs).padStart(6)} LUFS  ${v.name}`); }
    } catch (e) { console.log(`  ${v.id.slice(0, 8)} ERRO ${e.message.slice(0, 40)}`); }
  }
  console.log(`\n${baixas.length} de ${vozes.length} abaixo de ${abaixo} LUFS`);
  fs.writeFileSync(path.join(__dirname, "..", "..", "frontend", "_Bugs", "chamado_108_referencias", "refs_baixas.json"), JSON.stringify(baixas, null, 1));
}

async function uma(prefixo) {
  const s = c.supa();
  // uuid não aceita ilike: faixa [prefixo000…, prefixofff…] cobre o prefixo.
  const hex = prefixo.replace(/-/g, "").toLowerCase();
  const fmt = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  const lo = fmt(hex.padEnd(32, "0")), hi = fmt(hex.padEnd(32, "f"));
  const { data: vs } = await s.from("voices").select("id,name,user_id,reference_audio_path,status").gte("id", lo).lte("id", hi);
  if (!vs || vs.length !== 1) throw new Error(`prefixo acha ${vs?.length ?? 0} vozes`);
  const v = vs[0];
  if (!v.reference_audio_path) throw new Error("voz sem referência");
  const bucket = c.BUCKETS.vozes();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ref-"));
  const orig = path.join(tmp, "orig.wav"), nova = path.join(tmp, "nova.wav");
  await baixar(bucket, v.reference_audio_path, orig);
  const antes = medir(orig);
  console.log(`voz "${v.name}" (${v.id}) [${v.status}]\nref: ${v.reference_audio_path}\nANTES: ${antes.lufs} LUFS · pico ${antes.pico} dBTP · LRA ${antes.lra}`);
  // 2 passadas: medir e aplicar com os valores medidos (loudnorm linear, sem bombear)
  const j = JSON.parse((ffErr(["-hide_banner", "-i", orig, "-af", `loudnorm=I=${ALVO}:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]).match(/\{[\s\S]*\}/) || ["{}"])[0]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", orig, "-af",
    `loudnorm=I=${ALVO}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`,
    "-ar", "16000", "-ac", "1", nova]);
  const depois = medir(nova);
  console.log(`DEPOIS: ${depois.lufs} LUFS · pico ${depois.pico} dBTP · LRA ${depois.lra}`);
  if (!CONFIRMAR) { console.log("\n(simulação — nada foi alterado. rode com --confirmar)"); return; }
  const stamp = new Date().toISOString().slice(0, 10);
  const bak = v.reference_audio_path.replace(/\.wav$/, `.bak-${stamp}.wav`);
  await c.r2().send(new c.s3.CopyObjectCommand({ Bucket: bucket, CopySource: `${bucket}/${v.reference_audio_path}`, Key: bak }));
  await c.r2().send(new c.s3.PutObjectCommand({ Bucket: bucket, Key: v.reference_audio_path, Body: fs.readFileSync(nova), ContentType: "audio/wav" }));
  console.log(`✅ referência normalizada no lugar · backup: ${bak}`);
}

(async () => {
  if (process.argv.includes("--varrer")) return varrer();
  const p = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!p) { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); return; }
  await uma(p);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
