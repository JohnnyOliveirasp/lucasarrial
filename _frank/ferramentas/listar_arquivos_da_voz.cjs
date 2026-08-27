/**
 * LISTA OS ARQUIVOS BRUTOS DE UMA VOZ, um por um, com duração REAL.
 *
 * Existe porque a armadilha medida (ordem 2026-08-20) manda, em treino que
 * falha ou voz reprovada, "listar os ARQUIVOS da voz PRIMEIRO, antes de olhar
 * worker/ffmpeg" — foto do Drive entrando em `raw_audio_paths` já cravou causa
 * errada duas vezes (caso Cláudio Sityá: 20 arquivos, 7 pdf, e o produto
 * culpou o aluno por "arquivo corrompido").
 *
 * O que ele responde, que o banco sozinho NÃO responde:
 *   - cada item de `raw_audio_paths` é mesmo ÁUDIO? (ffprobe, não extensão)
 *   - o objeto EXISTE no R2? (linha no banco não é prova)
 *   - quanto dura CADA um? — `voices.duration_seconds` só tem o total, e é o
 *     total que decide o portão de 20min (`MIN_DURATION_SECONDS = 20*60`).
 *
 * Por que a duração individual importa: quando o aluno diz "usa só as duas
 * gravações que ficaram boas", duas podem não fechar 20min. Sem esta lista
 * você promete um retreino que o portão recusa e o aluno é humilhado de novo
 * achando que a culpa é dele (trap documentada na passagem de 21/08).
 *
 * SÓ LÊ. Não toca em banco, crédito, R2 nem GPU. Sem whisper, custo zero.
 *
 *   node _frank/ferramentas/listar_arquivos_da_voz.cjs <voiceId|prefixo8>
 *   node _frank/ferramentas/listar_arquivos_da_voz.cjs <voiceId> --json
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));

const ALVO = process.argv[2];
const JSON_OUT = process.argv.includes("--json");
if (!ALVO) {
  console.error("uso: listar_arquivos_da_voz.cjs <voiceId|prefixo8> [--json]");
  process.exit(1);
}

const PORTAO_SEG = 20 * 60; // MIN_DURATION_SECONDS em voice-creator.tsx:11

function hhmmss(seg) {
  if (seg == null) return "?";
  // Arredonda o TOTAL antes de quebrar em min/s: fazer `round(seg % 60)`
  // separado imprime "4min60s" para 299,99s — número que não existe e que
  // esconde justamente o caso de borda do portão (recusa por 0,04s).
  const t = Math.round(seg);
  return `${Math.floor(t / 60)}min${String(t % 60).padStart(2, "0")}s`;
}

/** Duração real pelo ffprobe. Devolve null se não for mídia decodificável. */
function duracaoReal(arquivo) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name",
     "-of", "default=noprint_wrappers=1", arquivo],
    { encoding: "utf8" },
  );
  // spawnSync (não execFileSync): execFileSync não devolve stderr em exit 0 e
  // já produziu "0 pausas" em instrumento cego (a2b528a4 / medir_pausas).
  if (r.status !== 0) return { seg: null, tipo: null, codec: null, erro: (r.stderr || "").trim().slice(0, 160) };
  const txt = r.stdout || "";
  const mDur = txt.match(/duration=([0-9.]+)/);
  const mTipo = txt.match(/codec_type=(\w+)/);
  const mCodec = txt.match(/codec_name=(\w+)/);
  return {
    seg: mDur ? Number(mDur[1]) : null,
    tipo: mTipo ? mTipo[1] : null,
    codec: mCodec ? mCodec[1] : null,
    erro: null,
  };
}

(async () => {
  const supa = c.supa();

  // Prefixo de 8 vira faixa de uuid — uuid não aceita `like` (mesma trava do
  // medir_pausas) — e id ambíguo é RECUSADO, nunca escolhido em silêncio.
  let q = supa.from("voices").select("id, user_id, name, status, duration_seconds, raw_audio_paths, error_message, created_at");
  const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ALVO);
  if (ehUuid) q = q.eq("id", ALVO);
  else q = q.gte("id", `${ALVO}-0000-0000-0000-000000000000`).lte("id", `${ALVO}-ffff-ffff-ffff-ffffffffffff`);

  const { data: vozes, error } = await q;
  if (error) throw new Error(`supabase: ${error.message}`);
  if (!vozes?.length) throw new Error(`voz não encontrada: ${ALVO}`);
  if (vozes.length > 1) throw new Error(`prefixo AMBÍGUO (${vozes.length} vozes) — passe o uuid inteiro`);
  const voz = vozes[0];

  const paths = Array.isArray(voz.raw_audio_paths) ? voz.raw_audio_paths : [];
  const bucket = c.BUCKETS.vozes();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vozarq-"));
  const linhas = [];

  for (const [i, key] of paths.entries()) {
    const nome = key.split("/").pop();
    const existe = await c.existe(bucket, key);
    if (!existe) {
      linhas.push({ i, nome, key, existe: false, seg: null, tipo: null, codec: null });
      continue;
    }
    const url = await c.urlAssinada(bucket, key, 900);
    const dest = path.join(tmp, `${i}_${nome}`);
    const res = await fetch(url);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    const d = duracaoReal(dest);
    const bytes = fs.statSync(dest).size;
    fs.unlinkSync(dest);
    linhas.push({ i, nome, key, existe: true, bytes, ...d });
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  const audios = linhas.filter((l) => l.tipo === "audio" || l.tipo === "video");
  const soAudio = linhas.filter((l) => l.tipo === "audio");
  const naoAudio = linhas.filter((l) => l.existe && l.tipo !== "audio");
  const sumOk = soAudio.reduce((a, l) => a + (l.seg || 0), 0);

  if (JSON_OUT) {
    console.log(JSON.stringify({ voz: { id: voz.id, name: voz.name, status: voz.status, duration_seconds: voz.duration_seconds }, arquivos: linhas, soma_audio_seg: sumOk }, null, 2));
    return;
  }

  console.log(`\n🎙️  "${voz.name}" · ${voz.id}`);
  console.log(`   status ${voz.status} · banco diz ${hhmmss(voz.duration_seconds)} (${voz.duration_seconds}s) · ${paths.length} arquivo(s)`);
  if (voz.error_message) console.log(`   erro gravado: ${String(voz.error_message).slice(0, 160)}`);
  console.log("");

  for (const l of linhas) {
    if (!l.existe) { console.log(`   [${l.i}] ${l.nome}  ⛔ NÃO EXISTE no R2`); continue; }
    if (l.tipo !== "audio") {
      console.log(`   [${l.i}] ${l.nome}  ⛔ NÃO É ÁUDIO (${l.tipo ?? "indecodificável"}${l.codec ? "/" + l.codec : ""})${l.erro ? " · " + l.erro : ""}`);
      continue;
    }
    console.log(`   [${l.i}] ${l.nome}  ${hhmmss(l.seg)}  (${l.codec}, ${(l.bytes / 1e6).toFixed(1)}MB)`);
  }

  console.log("");
  console.log(`   ÁUDIO de verdade: ${soAudio.length}/${paths.length} · soma ${hhmmss(sumOk)} (${Math.round(sumOk)}s)`);
  if (naoAudio.length) {
    console.log(`   ⚠️  ${naoAudio.length} arquivo(s) NÃO são áudio — o treino falha por CAUSA NOSSA, não do aluno.`);
  }
  const falta = PORTAO_SEG - sumOk;
  if (falta > 0) console.log(`   ⛔ PORTÃO DE 20min: faltam ${hhmmss(falta)} — este conjunto seria RECUSADO.`);
  else console.log(`   ✅ PORTÃO DE 20min: passa com ${hhmmss(sumOk - PORTAO_SEG)} de folga.`);
  console.log(`   (o portão real é 20min — a mensagem do produto diz 10min e está errada; nunca repita 10 pro aluno)\n`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
