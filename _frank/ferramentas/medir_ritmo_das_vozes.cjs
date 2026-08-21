#!/usr/bin/env node
/**
 * medir_ritmo_das_vozes.cjs — mede a PAUSA NATURAL de cada voz no áudio de
 * referência que o próprio aluno gravou, e propõe o `tts_silence_ms` dela.
 *
 * POR QUE EXISTE (pergunta do Johnny, 21/08). O worker roda com
 * `silence_ms=0, crossfade_ms=60` (handler.py:1342-1344): nenhuma pausa entre
 * frases e 60ms de fusão. Por isso a fala sai emendada — é a queixa de "frases
 * coladas", e ela atinge 746 das 747 vozes prontas.
 *
 * O conserto por voz existe desde 01/06 e só a Katia tem (220/0). Medi o áudio
 * dela antes e depois: MESMO texto, 14 pausas contra 9-11 (11 contra 5 a
 * -40dB). Funciona.
 *
 * ⚠️ MAS UM VALOR FIXO PRA TODOS ESTÁ ERRADO, e a pergunta do Johnny é o
 * motivo: "cada voz tem um ritmo, isso não vai deixar uma pausada e outra
 * acelerada?". Fui medir 8 vozes diferentes e ele tem razão — a pausa natural
 * vai de 119ms a 1.051ms, quase 9× de diferença. Um 220 fixo daria ao que fala
 * emendado o dobro da pausa dele, e ao que fala pausado um quinto.
 *
 * ⚠️ E A CALIBRAÇÃO MOSTRA QUE 220 NÃO É "O NATURAL DA KATIA": a pausa de
 * frase dela é ~466ms; 220 é menos da metade. Ou seja, o valor que funcionou é
 * um MEIO-TERMO, não o ritmo dela. Por isso esta ferramenta **só mede e
 * propõe** — quanto da pausa natural inserir é decisão de OUVIDO, e nenhum
 * agente aqui ouve (regra 9-D).
 *
 * O MÉTODO, e por que dois limiares:
 *   d=0.12 → pega também intervalo entre palavras (ritmo "rápido" da pessoa)
 *   d=0.15 → isola a pausa de FRASE, que é o que o worker insere entre chunks
 * A distribuição é bimodal (palavras ~150ms, frases ~450ms), então o salto
 * entre os dois limiares é grande e esperado.
 *
 * Uso:
 *   node _frank/ferramentas/medir_ritmo_das_vozes.cjs             # 40 vozes
 *   node _frank/ferramentas/medir_ritmo_das_vozes.cjs --todas
 *   node _frank/ferramentas/medir_ritmo_das_vozes.cjs --n 100
 *
 * NÃO grava nada no banco. Aplicar é passo separado e consciente.
 */
const { supa, r2, s3, BUCKETS } = require("./_comum.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const argv = process.argv.slice(2);
const TODAS = argv.includes("--todas");
const N = (() => {
  const i = argv.indexOf("--n");
  return i >= 0 ? Number(argv[i + 1]) || 40 : 40;
})();

/** Piso e teto: ninguém recebe pausa absurda por causa de uma gravação atípica. */
const PISO_MS = 120;
const TETO_MS = 450;

const db = supa();
const cli = r2();
const TMP = path.join(os.tmpdir(), "ritmo-vozes");

/** Silêncios do arquivo, em ms, ordenados. `d` separa palavra de frase. */
function silencios(arquivo, d) {
  // ⚠️ O ffmpeg escreve o silencedetect em STDERR, não em stdout — e o
  // `execFileSync` só devolve stdout. A primeira versão usava execFileSync e
  // TODAS as 25 vozes vieram vazias, como se ninguém tivesse pausa nenhuma.
  // `spawnSync` dá os dois; juntar é obrigatório.
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", arquivo, "-af", `silencedetect=noise=-35dB:d=${d}`, "-f", "null", "-"],
    { encoding: "utf8", timeout: 120000, maxBuffer: 32 * 1024 * 1024 },
  );
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return [...saida.matchAll(/silence_duration: ([0-9.]+)/g)]
    .map((m) => Math.round(Number(m[1]) * 1000))
    .sort((a, b) => a - b);
}

const mediana = (a) => (a.length ? a[Math.floor(a.length / 2)] : null);

(async () => {
  const r = await db
    .from("voices")
    .select("id, name, status, reference_audio_path, tts_silence_ms, tts_crossfade_ms, user_id")
    .eq("status", "ready")
    .not("reference_audio_path", "is", null);
  if (r.error) {
    console.error("ERRO ao ler voices:", r.error.message);
    process.exit(1);
  }

  const todas = r.data ?? [];
  // Amostra ESPALHADA (não as N primeiras): pegar só as mais antigas daria um
  // retrato de um período, não do acervo.
  const passo = TODAS ? 1 : Math.max(1, Math.floor(todas.length / N));
  const alvo = TODAS ? todas : todas.filter((_, i) => i % passo === 0).slice(0, N);

  console.log(`\n# medir_ritmo_das_vozes — SÓ MEDE, não grava`);
  console.log(`# vozes prontas com referência: ${todas.length} | medindo: ${alvo.length}\n`);
  fs.mkdirSync(TMP, { recursive: true });

  console.log("voz      | nome                 | palavra | FRASE  | proposto | hoje");
  console.log("---------|----------------------|---------|--------|----------|-----");

  const linhas = [];
  for (const v of alvo) {
    const arq = path.join(TMP, `${v.id}.wav`);
    if (!fs.existsSync(arq)) {
      try {
        const o = await cli.send(
          new s3.GetObjectCommand({ Bucket: BUCKETS.vozes(), Key: v.reference_audio_path }),
        );
        const buf = [];
        for await (const b of o.Body) buf.push(b);
        fs.writeFileSync(arq, Buffer.concat(buf));
      } catch (e) {
        console.log(`${v.id.slice(0, 8)} | ${String(v.name).slice(0, 20).padEnd(20)} | FALHOU baixar: ${String(e.message).slice(0, 40)}`);
        continue;
      }
    }
    const palavra = mediana(silencios(arq, 0.12));
    const frase = mediana(silencios(arq, 0.15));
    // A proposta é a pausa de FRASE (é ela que o worker insere entre chunks),
    // presa entre piso e teto. Sem frase medível, cai na de palavra.
    const bruto = frase ?? palavra;
    const proposto = bruto === null ? null : Math.min(TETO_MS, Math.max(PISO_MS, bruto));
    const hoje = v.tts_silence_ms == null ? "—" : String(v.tts_silence_ms);
    console.log(
      `${v.id.slice(0, 8)} | ${String(v.name ?? "").slice(0, 20).padEnd(20)} | ` +
        `${String(palavra ?? "-").padStart(6)}ms | ${String(frase ?? "-").padStart(5)}ms | ` +
        `${String(proposto ?? "-").padStart(7)}ms | ${hoje}`,
    );
    if (proposto !== null) linhas.push({ id: v.id, name: v.name, palavra, frase, proposto });
  }

  if (!linhas.length) return;
  const props = linhas.map((x) => x.proposto).sort((a, b) => a - b);
  const brutos = linhas.map((x) => x.frase ?? x.palavra).sort((a, b) => a - b);
  console.log(`\n=== ${linhas.length} vozes medidas ===`);
  console.log(`  pausa de frase CRUA: ${brutos[0]}ms a ${brutos[brutos.length - 1]}ms (mediana ${mediana(brutos)}ms)`);
  console.log(`  proposto (piso ${PISO_MS} / teto ${TETO_MS}): ${props[0]}ms a ${props[props.length - 1]}ms (mediana ${mediana(props)}ms)`);
  console.log(`  bateram no PISO: ${linhas.filter((x) => x.proposto === PISO_MS).length}`);
  console.log(`  bateram no TETO: ${linhas.filter((x) => x.proposto === TETO_MS).length}`);
  fs.writeFileSync(
    path.join(process.cwd(), "_Bugs", "erro_21ago", "ritmo_vozes.json"),
    JSON.stringify(linhas, null, 1),
  );
  console.log(`\n  lista salva em _Bugs/erro_21ago/ritmo_vozes.json`);
  console.log(`  ⚠️ NADA foi gravado no banco. Aplicar é passo separado.`);
})();
