/**
 * PERICIA CADA ARQUIVO BRUTO DE UMA VOZ ATE O FIM — decodifica, nao so le o
 * cabecalho.
 *
 * POR QUE EXISTE (#475, josiclareth, 19/09):
 * O treino morreu com `[Errno 1094995529] Invalid data found when processing
 * input: dataset/voice_0032.wav` e o produto disse pra aluna que "um dos
 * arquivos ENVIADOS chegou corrompido". Os 9 que ela enviou sao `raw/*.mp3`;
 * `voice_0032.wav` nao e nenhum deles. Mas a hipotese alternativa viva —
 * um take dela chegou truncado e so quebra quando o worker o fatia — nao pode
 * ser descartada por aritmetica de nome de arquivo. Tem que DECODIFICAR.
 *
 * O `listar_arquivos_da_voz.cjs` responde "isto e audio e dura X" (ffprobe le
 * cabecalho + faz uma passada barata). Ele NAO responde "isto decodifica ate o
 * ultimo frame sem erro". Um MP3 truncado no meio costuma passar no ffprobe e
 * morrer no decode — que e exatamente o passo onde o worker morreu.
 *
 * O QUE MEDE, por arquivo:
 *   1. decode COMPLETO com `-err_detect explode` (a receita do playbook U)
 *   2. bytes/segundo — prova de truncamento melhor que "o arquivo abre"
 *      (playbook U: "e assim que se prova que um arquivo NAO esta truncado,
 *       em vez de chutar 'arquivo corrompido'")
 *   3. pico em dBFS (astats) — pega o take mudo, que e erro do usuario
 *
 * ⚠️⚠️ O CODIGO DE SAIDA DO FFMPEG NAO SERVE PRA ISTO — medido em 19/09.
 * O playbook U manda "erro no `-err_detect explode`" = MP3 corrompido, mas nao
 * diz COMO ler o erro. A 1a versao deste script leu o exit code. Controle
 * negativo feito na hora (um take real da propria aluna, truncado a 900KB, e
 * outro com 4000 bytes aleatorios escritos no miolo):
 *
 *     truncado    → exit 0  · stderr "filesize and duration do not match"
 *     corrompido  → exit 0  · stderr "Header missing" + "Invalid data found"
 *     arquivo bom → exit 0  · stderr VAZIO
 *
 * Ou seja: `exit != 0` NUNCA dispara, e um veredito "N/N limpos" tirado dele e
 * um ZERO MENTIROSO da familia do playbook W — parece saude e e o detector
 * desligado. O discriminador que FUNCIONA e **stderr nao-vazio**.
 * Por isso este script roda o proprio controle negativo a cada execucao e se
 * RECUSA a emitir veredito se o detector nao acusar o arquivo sabidamente
 * corrompido. Instrumento que nao prova que enxerga nao mede nada.
 *
 * ARMADILHAS DO PLAYBOOK U, JA EMBUTIDAS:
 *  - `spawnSync` e leitura de stderr SEMPRE, nunca so no catch. O `astats`
 *    escreve em stderr mesmo quando da certo; a versao com `execFileSync`
 *    imprimiu ERRO_DECODE nas 54 falhas de 18/08, inclusive num arquivo que
 *    sabidamente decodificava. Saida uniforme demais e bug meu, nao epidemia.
 *  - NAO herdar a causa do incidente irmao. `db17c668` fechou como "MP3
 *    corrompido" e essa hipotese estava errada no caso seguinte.
 *  - o veredito por arquivo e impresso CRU (codigo de saida + stderr) antes de
 *    qualquer classificacao minha, pra quem ler poder discordar da minha regua.
 *
 * SO LE. Nao toca em banco, credito, GPU nem escreve no R2. Custo zero.
 *
 *   node _frank/ferramentas/2026-09-19_periciar_takes_da_voz.cjs <voiceId|prefixo8>
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));

const ALVO = process.argv[2];
if (!ALVO) {
  console.error("uso: 2026-09-19_periciar_takes_da_voz.cjs <voiceId|prefixo8>");
  process.exit(1);
}

/** spawnSync que SEMPRE devolve stderr, dando certo ou errado (armadilha U). */
function roda(bin, args) {
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return {
    code: r.status,
    err: String(r.stderr || ""),
    out: String(r.stdout || ""),
    falhouAoLancar: !!r.error,
  };
}

/**
 * O decode que VALE: o veredito sai do stderr, nunca do exit code (ver cabecalho).
 * Devolve {sujo:boolean, err:string, code:number}.
 */
function decodeExplode(arq) {
  const r = roda("ffmpeg", ["-v", "warning", "-err_detect", "explode", "-i", arq, "-f", "null", "-"]);
  return { sujo: r.err.trim().length > 0, err: r.err.trim(), code: r.code };
}

function dur(arq) {
  const r = roda("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", arq,
  ]);
  const n = parseFloat(r.out.trim());
  return Number.isFinite(n) ? n : null;
}

(async () => {
  const db = c.supa();

  // `voices.id` e uuid: `like` explode com "operator does not exist: uuid ~~".
  // Com uuid inteiro vai de `eq`; com prefixo de 8, varre e filtra em JS.
  const COLS = "id,name,status,duration_seconds,raw_audio_paths,user_id,created_at";
  let v = null;
  if (/^[0-9a-f-]{36}$/i.test(ALVO)) {
    const { data, error } = await db.from("voices").select(COLS).eq("id", ALVO);
    if (error) { console.error("ERRO na consulta:", error.message); process.exit(1); }
    v = (data || [])[0];
  } else {
    // pagina: o Supabase corta em 1000 linhas e um zero aqui seria mentiroso
    for (let de = 0; de < 20000 && !v; de += 1000) {
      const { data, error } = await db.from("voices").select(COLS)
        .order("created_at", { ascending: false }).range(de, de + 999);
      if (error) { console.error("ERRO na consulta:", error.message); process.exit(1); }
      if (!data || !data.length) break;
      v = data.find((x) => String(x.id).startsWith(ALVO.toLowerCase()));
      if (data.length < 1000) break;
    }
  }
  if (!v) { console.error("voz nao encontrada:", ALVO); process.exit(1); }

  const chaves = Array.isArray(v.raw_audio_paths) ? v.raw_audio_paths : [];
  console.log(`\n🎙️  "${v.name}" · ${v.id}`);
  console.log(`   status ${v.status} · banco diz ${v.duration_seconds}s · ${chaves.length} arquivo(s)\n`);

  const bucket = c.BUCKETS.vozes();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pericia-"));
  const linhas = [];
  let primeiroBom = null; // serve de cobaia pro controle negativo la embaixo

  for (let i = 0; i < chaves.length; i++) {
    const key = chaves[i];
    const nome = key.split("/").pop();
    const local = path.join(tmp, `${i}_${nome}`);

    const existe = await c.existe(bucket, key);
    if (!existe) {
      console.log(`[${i}] ${nome}\n     ⛔ NAO EXISTE no R2 — nao da pra periciar\n`);
      linhas.push({ i, nome, veredito: "AUSENTE_NO_R2" });
      continue;
    }

    const url = await c.urlAssinada(bucket, key, 900);
    const baixa = roda("curl", ["-sS", "-f", "-o", local, url]);
    if (baixa.code !== 0 || !fs.existsSync(local)) {
      console.log(`[${i}] ${nome}\n     ⛔ download falhou (curl ${baixa.code}): ${baixa.err.trim().slice(0, 200)}\n`);
      linhas.push({ i, nome, veredito: "DOWNLOAD_FALHOU" });
      continue;
    }

    const bytes = fs.statSync(local).size;
    const segundos = dur(local);

    // 1. decode COMPLETO (veredito pelo stderr, nao pelo exit — ver cabecalho)
    const dec = decodeExplode(local);
    primeiroBom = primeiroBom || (dec.sujo ? null : local);
    // 2. pico real
    const st = roda("ffmpeg", ["-hide_banner", "-nostats", "-i", local,
      "-af", "astats=measure_perchannel=none", "-f", "null", "-"]);
    const mPico = st.err.match(/Peak level dB:\s*(-?[\d.]+|-inf)/);
    const pico = mPico ? mPico[1] : "?";

    const bps = segundos ? bytes / segundos : null;

    console.log(`[${i}] ${nome}`);
    console.log(`     ${bytes} bytes · ${segundos != null ? segundos.toFixed(2) + "s" : "duracao ?"} · ${bps ? bps.toFixed(0) + " B/s" : "B/s ?"} · pico ${pico} dBFS`);
    console.log(`     decode -err_detect explode → exit ${dec.code} · stderr ${dec.sujo ? "SUJO" : "vazio"}  (o que vale e o stderr)`);
    if (dec.sujo) {
      for (const l of dec.err.split("\n").slice(0, 6)) console.log(`       | ${l}`);
    } else {
      console.log(`       | (stderr vazio)`);
    }
    console.log("");

    linhas.push({ i, nome, bytes, segundos, bps, pico, sujo: dec.sujo, decodeCode: dec.code, decodeErr: dec.err });
  }

  // ---- CONTROLE NEGATIVO: o detector enxerga defeito? ----
  // Sem isto, "N/N limpos" nao distingue "os arquivos estao bons" de "meu
  // detector esta cego". Cobaia = um arquivo REAL deste mesmo conjunto, pra
  // provar o detector no material que estou periciando, nao num fixture.
  console.log("=".repeat(70));
  console.log("CONTROLE NEGATIVO DO INSTRUMENTO (antes de qualquer veredito)");
  console.log("=".repeat(70));
  let detectorProvado = false;
  if (!primeiroBom) {
    console.log("  ⚠️  nenhum arquivo limpo pra usar de cobaia — controle NAO feito");
  } else {
    const cobaia = path.join(tmp, "_controle_corrompido.mp3");
    fs.copyFileSync(primeiroBom, cobaia);
    const fd = fs.openSync(cobaia, "r+");
    const meio = Math.floor(fs.statSync(cobaia).size / 2);
    fs.writeSync(fd, Buffer.alloc(4000, 0xa5), 0, 4000, meio); // lixo no miolo
    fs.closeSync(fd);

    const tTrunc = path.join(tmp, "_controle_truncado.mp3");
    const buf = fs.readFileSync(primeiroBom);
    fs.writeFileSync(tTrunc, buf.subarray(0, Math.floor(buf.length * 0.7)));

    const rC = decodeExplode(cobaia);
    const rT = decodeExplode(tTrunc);
    const rB = decodeExplode(primeiroBom);
    console.log(`  cobaia CORROMPIDA  → exit ${rC.code} · stderr ${rC.sujo ? "SUJO ✅ (detector acusou)" : "vazio ❌ (detector CEGO)"}`);
    if (rC.sujo) console.log(`       | ${rC.err.split("\n")[0]}`);
    console.log(`  cobaia TRUNCADA    → exit ${rT.code} · stderr ${rT.sujo ? "SUJO ✅ (detector acusou)" : "vazio ❌ (detector CEGO)"}`);
    if (rT.sujo) console.log(`       | ${rT.err.split("\n")[0]}`);
    console.log(`  mesmo arquivo INTACTO → stderr ${rB.sujo ? "SUJO ❌ (falso positivo!)" : "vazio ✅"}`);
    console.log(`  (exit code foi ${rC.code}/${rT.code}/${rB.code} nos tres — por isso ele NAO serve de veredito)`);
    detectorProvado = rC.sujo && rT.sujo && !rB.sujo;
  }

  if (!detectorProvado) {
    console.log("\n⛔ O DETECTOR NAO PASSOU NO PROPRIO CONTROLE.");
    console.log("   Nao emito veredito sobre os arquivos do aluno: seria um zero mentiroso.");
    console.log(`   arquivos em ${tmp}`);
    process.exit(2);
  }
  console.log("  ✅ detector provado nesta execucao — o veredito abaixo tem lastro.\n");

  // ---- leitura, separada da medicao crua acima ----
  console.log("=".repeat(70));
  console.log("LEITURA (a medicao crua esta acima; discorde dela se quiser)");
  console.log("=".repeat(70));

  const periciados = linhas.filter((l) => l.sujo != null);
  const quebrados = periciados.filter((l) => l.sujo);
  const mudos = periciados.filter((l) => l.pico === "-inf" || parseFloat(l.pico) < -60);

  const taxas = periciados.map((l) => l.bps).filter((x) => Number.isFinite(x));
  if (taxas.length) {
    const med = taxas.reduce((a, b) => a + b, 0) / taxas.length;
    const fora = periciados.filter((l) => Number.isFinite(l.bps) && Math.abs(l.bps - med) / med > 0.25);
    console.log(`\nbytes/segundo: media ${med.toFixed(0)} · fora de ±25%: ${fora.length}`);
    for (const f of fora) console.log(`   [${f.i}] ${f.nome} → ${f.bps.toFixed(0)} B/s`);
    if (!fora.length) console.log("   nenhum arquivo destoa — nao ha sinal de truncamento por taxa");
  }

  console.log(`\nDECODE ATE O FIM: ${periciados.length - quebrados.length}/${periciados.length} limpos (criterio: stderr vazio, detector provado acima)`);
  if (quebrados.length) {
    console.log("   ⛔ QUEBRADOS (isto sustentaria 'arquivo do aluno corrompido'):");
    for (const q of quebrados) console.log(`      [${q.i}] ${q.nome} → ${q.decodeErr.split("\n")[0]}`);
  } else {
    console.log("   ✅ nenhum arquivo do aluno quebra no decode completo.");
    console.log("      → a hipotese 'take truncado que so quebra ao virar chunk' NAO se sustenta");
    console.log("        neste conjunto, e a mensagem que culpa o envio dela fica sem lastro.");
  }

  console.log(`\nMUDOS (pico < -60 dBFS): ${mudos.length}`);
  for (const m of mudos) console.log(`   [${m.i}] ${m.nome} pico ${m.pico}`);

  console.log(`\narquivos baixados em ${tmp} (apague quando terminar)`);
})().catch((e) => { console.error("EXPLODIU:", e); process.exit(1); });
