#!/usr/bin/env node
/**
 * curar_mp3_xing.cjs — conserta o MP3 ja entregue que ANUNCIA duracao menor do
 * que tem, fazendo o player cortar o final do audio do aluno.
 *
 * POR QUE EXISTE (incidente 96, medido em 23/08):
 * `ffmpegWavToMp3` escrevia a saida em `pipe:1`, que nao e seekavel. O
 * libmp3lame so grava o header Xing/Info (obrigatorio pra VBR) se puder voltar
 * ao inicio do arquivo no fim do encode. Sem o header, o player estima a
 * duracao pelo bitrate do primeiro frame assumindo CBR — e com `-qscale:a 2`
 * (VBR) a estimativa sai CURTA. O arquivo no R2 esta INTEIRO; o que mente e a
 * duracao anunciada. Quanto mais longo o texto, mais o aluno perde.
 *
 * O conserto do CODIGO entrou na main em 23/08 (commit 9633444, PR #38) e vale
 * pra geracao NOVA. Este script e a REMEDIACAO do que ja foi entregue.
 *
 * COMO CONSERTA, E POR QUE NAO PERDE QUALIDADE:
 * `ffmpeg -i ruim.mp3 -c copy bom.mp3` remuxa: copia os frames MP3 bit a bit
 * (NAO reencoda, nao passa por decodificador) e, porque a saida agora e um
 * arquivo seekavel, escreve o header Xing correto. Sem GPU, sem credito, sem
 * perda de qualidade. Medido em 23/08 no pior caso de producao (f7bb3185):
 * anunciava 95,6s de 112,7s reais -> passou a anunciar 112,728s.
 *
 * ⚠️ A DIFERENCA DE ~0,011s no PCM decodificado depois do conserto e ESPERADA e
 * nao e perda: com o header Xing presente o decodificador passa a respeitar o
 * encoder delay/padding do LAME e apara o silencio tecnico do fim. O audio
 * audivel e o mesmo. O script CONFERE que a diferenca fica dentro da tolerancia
 * e ABORTA o arquivo se passar disso.
 *
 * SEGURANCA (as armadilhas ja medidas viram regra aqui):
 *  - ENSAIO NAO E ENTREGA: sem `--confirmar` ele so mede e mostra.
 *  - BACKUP ANTES: grava `<chave>.pre-xing-backup.mp3` e so segue se o backup
 *    existir de fato no R2 (HeadObject depois de gravar). Se ja existir backup,
 *    NAO sobrescreve — o original de verdade e o do primeiro conserto.
 *  - CONFERE DEPOIS DE GRAVAR, nunca antes: rebaixa o objeto do R2 e remede
 *    header x decodificado. Se nao bater, RESTAURA o backup e aborta.
 *  - NAO TOCA EM CREDITO e NAO TOCA NO BANCO. So o objeto no R2.
 *  - Idempotente: arquivo que ja tem Xing correto e PULADO, nao reprocessado.
 *
 * USO:
 *   node _frank/ferramentas/curar_mp3_xing.cjs --aluno <email>
 *   node _frank/ferramentas/curar_mp3_xing.cjs --geracao <id|prefixo>
 *   node _frank/ferramentas/curar_mp3_xing.cjs --aluno <email> --confirmar
 *   node _frank/ferramentas/curar_mp3_xing.cjs --restaurar --geracao <id> --confirmar
 *     [--tolerancia 0.05]  perda em segundos a partir da qual vale consertar
 */
const path = require("node:path");
const fsp = require("node:fs/promises");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { supa, r2, s3, BUCKETS } = require(path.join(__dirname, "_comum.cjs"));

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const SUFIXO_BACKUP = ".pre-xing-backup.mp3";
// Diferenca de PCM aceitavel depois do remux (encoder delay/padding do LAME).
const TOL_PCM_S = 0.06;

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args);
    const out = [], err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", rej);
    p.on("close", (c) =>
      c === 0
        ? res(Buffer.concat(out))
        : rej(new Error(`${cmd} saiu ${c}: ${Buffer.concat(err).toString().slice(0, 300)}`)));
    p.stdin.end();
  });
}

/** Duracao que o PLAYER ve (header do container). */
async function durHeader(file) {
  const o = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", file]);
  return parseFloat(o.toString());
}
/** Duracao REAL: decodifica tudo e conta amostra. Nunca confie no header. */
async function durDecodificada(file) {
  const pcm = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", file,
    "-f", "s16le", "-ac", "1", "-ar", "44100", "pipe:1"]);
  return pcm.length / 2 / 44100;
}
function temXing(buf) {
  return buf.slice(0, 4096).toString("latin1").includes("Xing");
}

async function baixar(bucket, key) {
  const o = await r2().send(new s3.GetObjectCommand({ Bucket: bucket, Key: key }));
  const buf = Buffer.from(await o.Body.transformToByteArray());
  const h = await r2().send(new s3.HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (h.ContentLength != null && buf.length !== h.ContentLength) {
    throw new Error(`download parcial: ${buf.length} de ${h.ContentLength} bytes`);
  }
  return { buf, contentType: h.ContentType || "audio/mpeg" };
}
async function subir(bucket, key, buf, contentType) {
  await r2().send(new s3.PutObjectCommand({
    Bucket: bucket, Key: key, Body: buf, ContentType: contentType || "audio/mpeg",
  }));
}
async function existe(bucket, key) {
  try { await r2().send(new s3.HeadObjectCommand({ Bucket: bucket, Key: key })); return true; }
  catch { return false; }
}

/**
 * ⚠️ PAGINA SEMPRE. O PostgREST corta em 1000 linhas EM SILENCIO — sem erro e
 * sem aviso. Em 23/08 existiam 2.634 geracoes `ready` com mp3: uma consulta
 * ingenua traria 1.000, o resumo diria "terminei" e 1.634 alunos ficariam com
 * o audio cortado enquanto o incidente era fechado por engano. E a armadilha
 * ja medida na ordem de 20/08. Nao troque por um `.select()` solto.
 */
async function paginar(montaQuery) {
  const PAG = 1000;
  const tudo = [];
  for (let de = 0; ; de += PAG) {
    const { data, error } = await montaQuery().range(de, de + PAG - 1);
    if (error) throw new Error(`erro cru do Supabase: ${JSON.stringify(error)}`);
    tudo.push(...data);
    if (data.length < PAG) return tudo;
  }
}

async function alvos(args) {
  const cli = supa();
  const base = () => cli.from("generations")
    .select("id,user_id,audio_path,duration_seconds,created_at,status")
    .eq("status", "ready").like("audio_path", "%.mp3")
    .order("created_at", { ascending: false });

  if (args.geracao) {
    const SEL = "id,user_id,audio_path,duration_seconds,created_at,status";
    const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const alvo = args.geracao.toLowerCase();

    // ⚠️ `like` em coluna uuid NAO existe no Postgres: devolve
    // `42883 operator does not exist: uuid ~~ unknown`. A versao anterior
    // usava `.like("id", ...)` e por isso a flag --geracao NUNCA funcionou,
    // nem com id completo — apesar de estar documentada no README. Quem
    // precisou curar arquivo (a Katia, em 23/08) so conseguiu via --aluno.
    if (RE_UUID.test(alvo)) {
      const { data, error } = await cli.from("generations").select(SEL).eq("id", alvo);
      if (error) throw new Error(`erro cru do Supabase: ${JSON.stringify(error)}`);
      if (!data.length) throw new Error(`nenhuma geracao com id '${args.geracao}'`);
      return data;
    }

    // Prefixo: o filtro tem que ser em JS, porque o banco nao aplica LIKE em
    // uuid. Pagina (o corte de 1000 do PostgREST e silencioso) e resolve aqui.
    const universo = await paginar(() => cli.from("generations").select(SEL)
      .order("created_at", { ascending: false }));
    const achados = universo.filter((g) => String(g.id).toLowerCase().startsWith(alvo));
    if (!achados.length) throw new Error(`nenhuma geracao com prefixo '${args.geracao}'`);
    if (achados.length > 1) throw new Error(`prefixo '${args.geracao}' e ambiguo (${achados.length})`);
    return achados;
  }
  if (args.aluno) {
    const { data: u, error: eu } = await cli.from("profiles").select("id,email").eq("email", args.aluno);
    if (eu) throw new Error(`erro cru do Supabase: ${JSON.stringify(eu)}`);
    if (!u || !u.length) throw new Error(`aluno '${args.aluno}' nao encontrado`);
    if (u.length > 1) throw new Error(`mais de uma conta com '${args.aluno}' — resolva o homonimo antes`);
    return paginar(() => base().eq("user_id", u[0].id));
  }
  // --todos: a frota inteira, paginada.
  const todos = await paginar(base);
  console.log(`universo: ${todos.length} geracoes ready com mp3 (paginado, nao e o corte de 1000)`);
  if (args.limite && args.limite < todos.length) {
    console.log(`⚠️ LIMITE ${args.limite}: ficam ${todos.length - args.limite} FORA desta rodada. Nao e cobertura total.`);
  }
  return args.limite ? todos.slice(0, args.limite) : todos;
}

async function restaurar(g, bucket, confirmar) {
  const key = g.audio_path, bkp = key + SUFIXO_BACKUP;
  if (!(await existe(bucket, bkp))) { console.log(`  sem backup pra ${key} — nada a restaurar`); return; }
  if (!confirmar) { console.log(`  [ENSAIO] restauraria ${bkp} -> ${key}`); return; }
  const { buf, contentType } = await baixar(bucket, bkp);
  await subir(bucket, key, buf, contentType);
  const dep = await baixar(bucket, key);
  console.log(`  RESTAURADO ${key} (${dep.buf.length} bytes, confere=${dep.buf.length === buf.length})`);
}

(async () => {
  const a = process.argv.slice(2);
  const args = {
    aluno: a.includes("--aluno") ? a[a.indexOf("--aluno") + 1] : null,
    geracao: a.includes("--geracao") ? a[a.indexOf("--geracao") + 1] : null,
    confirmar: a.includes("--confirmar"),
    restaurar: a.includes("--restaurar"),
    todos: a.includes("--todos"),
    limite: a.includes("--limite") ? Number(a[a.indexOf("--limite") + 1]) : null,
    tol: a.includes("--tolerancia") ? Number(a[a.indexOf("--tolerancia") + 1]) : 0.05,
  };
  if (!args.aluno && !args.geracao && !args.todos) {
    console.error("uso: --aluno <email> | --geracao <id> | --todos [--limite N]  [--confirmar] [--restaurar] [--tolerancia 0.05]");
    process.exit(1);
  }
  // Restaurar em massa nao existe de proposito: desfazer 2.634 objetos sem
  // alvo nomeado e mais perigoso que o defeito que o script conserta.
  if (args.restaurar && args.todos) {
    console.error("--restaurar exige --aluno ou --geracao; nao existe restauracao em massa");
    process.exit(1);
  }
  const bucket = BUCKETS.geracoes();
  const lista = await alvos(args);
  console.log(`${lista.length} geracao(oes) ready com mp3${args.confirmar ? "" : "  [ENSAIO — nada sera gravado]"}\n`);

  let curados = 0, pulados = 0, falhos = 0, ganhoTotal = 0;
  for (const g of lista) {
    const key = g.audio_path;
    const tmpA = path.join(os.tmpdir(), `xing-a-${randomUUID()}.mp3`);
    const tmpB = path.join(os.tmpdir(), `xing-b-${randomUUID()}.mp3`);
    try {
      if (args.restaurar) { console.log(`${g.id.slice(0, 8)}  ${key}`); await restaurar(g, bucket, args.confirmar); continue; }

      const { buf, contentType } = await baixar(bucket, key);
      await fsp.writeFile(tmpA, buf);
      const hAntes = await durHeader(tmpA);
      const dAntes = await durDecodificada(tmpA);
      const perda = dAntes - hAntes;
      const marca = `${g.id.slice(0, 8)}  ${String(g.created_at).slice(0, 16)}  Xing=${temXing(buf) ? "sim" : "NAO"}  header=${hAntes.toFixed(3)}s  real=${dAntes.toFixed(3)}s  perda=${perda.toFixed(3)}s`;

      if (temXing(buf) && perda <= args.tol) { console.log(`${marca}  -> ja esta bom, PULADO`); pulados++; continue; }
      if (perda <= args.tol) { console.log(`${marca}  -> perda dentro da tolerancia, PULADO`); pulados++; continue; }

      // remux sem reencodar
      await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", tmpA, "-c", "copy", tmpB]);
      const novo = await fsp.readFile(tmpB);
      const hDepois = await durHeader(tmpB);
      const dDepois = await durDecodificada(tmpB);

      if (!temXing(novo)) throw new Error("remux nao produziu header Xing — abortado");
      if (Math.abs(dDepois - dAntes) > TOL_PCM_S) {
        throw new Error(`audio mudou alem da tolerancia (${dAntes.toFixed(3)}s -> ${dDepois.toFixed(3)}s) — abortado`);
      }
      if (Math.abs(hDepois - dDepois) > 0.15) {
        throw new Error(`header remuxado ainda diverge (${hDepois.toFixed(3)} x ${dDepois.toFixed(3)}) — abortado`);
      }

      if (!args.confirmar) {
        console.log(`${marca}\n   [ENSAIO] consertaria -> header ${hDepois.toFixed(3)}s (devolve ${perda.toFixed(3)}s ao aluno), backup em ${path.basename(key)}${SUFIXO_BACKUP}`);
        ganhoTotal += perda; curados++; continue;
      }

      // backup primeiro, e so segue se ele existir DE VERDADE
      const bkp = key + SUFIXO_BACKUP;
      if (await existe(bucket, bkp)) {
        console.log(`${marca}\n   backup ja existia (${path.basename(bkp)}) — preservado, nao sobrescrevi`);
      } else {
        await subir(bucket, bkp, buf, contentType);
        if (!(await existe(bucket, bkp))) throw new Error("backup nao apareceu no R2 — abortado antes de tocar no original");
      }

      await subir(bucket, key, novo, contentType);

      // confere DEPOIS de gravar, rebaixando do R2
      const dep = await baixar(bucket, key);
      await fsp.writeFile(tmpA, dep.buf);
      const hFim = await durHeader(tmpA);
      const dFim = await durDecodificada(tmpA);
      if (!temXing(dep.buf) || Math.abs(hFim - dFim) > 0.15) {
        const orig = await baixar(bucket, bkp);
        await subir(bucket, key, orig.buf, orig.contentType);
        throw new Error(`conferencia pos-gravacao falhou (header ${hFim.toFixed(3)} x real ${dFim.toFixed(3)}) — ORIGINAL RESTAURADO`);
      }
      console.log(`${marca}\n   CURADO: header ${hAntes.toFixed(3)}s -> ${hFim.toFixed(3)}s | real ${dFim.toFixed(3)}s | devolvidos ${perda.toFixed(3)}s | ContentType=${dep.contentType} | backup=${path.basename(bkp)}`);
      curados++; ganhoTotal += perda;
    } catch (e) {
      console.log(`${g.id.slice(0, 8)}  FALHOU: ${e.message}`);
      falhos++;
    } finally {
      await fsp.rm(tmpA, { force: true }).catch(() => {});
      await fsp.rm(tmpB, { force: true }).catch(() => {});
    }
  }
  console.log(`\nRESUMO${args.confirmar ? "" : " (ENSAIO)"}: ${curados} ${args.confirmar ? "curados" : "a curar"} | ${pulados} pulados | ${falhos} falhos | audio devolvido ao aluno: ${ganhoTotal.toFixed(2)}s`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
