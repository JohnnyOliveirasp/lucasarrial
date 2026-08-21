#!/usr/bin/env node
/**
 * corrigir_jfif_video.cjs — destrava projeto de vídeo cuja referência está com
 * extensão que o Kie recusa (.jfif e parentes). Incidente edc50dc6.
 *
 * POR QUE EXISTE (21/08): o Kie responde `code=500, msg=File type not
 * supported` para arquivo `.jfif`, mesmo quando o conteúdo É JPEG (conferido
 * nos primeiros bytes no R2: FFD8FFE0...). Ele recusa pela EXTENSÃO. O `.jfif`
 * não é escolha do aluno — é o que o Windows e o WhatsApp Web salvam sozinhos.
 *
 * A aluna Ketty ficou 3 dias com TODOS os projetos parados: 27 cenas, 3
 * projetos, o mesmo erro nas 27. Prova estatística no banco inteiro:
 *   projetos com .jfif  ->   27 cenas,   27 failed (100%),    0 ready
 *   projetos com jpg    -> 2241 cenas,   31 failed (  1%), 2098 ready
 *
 * O `32d12fd` normaliza a extensão no upload NOVO. Esta ferramenta conserta
 * quem JÁ está com a chave ruim gravada no projeto.
 *
 * O QUE FAZ: copia o objeto no R2 pra uma chave `.jpg` (cópia server-side, o
 * conteúdo não muda) e reescreve os caminhos no projeto.
 *
 * O QUE NÃO FAZ, de propósito:
 *  - NÃO apaga o original (se algo der errado, o arquivo antigo continua lá);
 *  - NÃO dispara geração no lugar do aluno — isso gasta crédito e GPU dele, e
 *    a regra 7 do Frank proíbe. Depois disto, o botão "regerar" funciona,
 *    porque ele já mira as cenas `failed`;
 *  - NÃO mexe em crédito. As cenas falhadas custaram 0 (image_credits_cost=0).
 *
 * Uso:
 *   node _frank/ferramentas/corrigir_jfif_video.cjs                  # ENSAIO (todos)
 *   node _frank/ferramentas/corrigir_jfif_video.cjs --confirmar
 *   node _frank/ferramentas/corrigir_jfif_video.cjs --aluno x@y.com  # só um
 */
const { supa, r2, s3, BUCKETS } = require("./_comum.cjs");

const argv = process.argv.slice(2);
const CONFIRMAR = argv.includes("--confirmar");
const ALUNO = (() => {
  const i = argv.indexOf("--aluno");
  return i >= 0 ? (argv[i + 1] || "").toLowerCase().trim() : null;
})();

const RUINS = ["jfif", "jfi", "jif", "jpe"];
const db = supa();
const cli = r2();
const bucket = BUCKETS.imagens();

const ehRuim = (k) => RUINS.includes((k.split(".").pop() || "").toLowerCase());

/**
 * As colunas de caminho são ARRAY no Postgres, não string separada por
 * vírgula. ⚠️ Tratei como string na 1ª versão e o banco recusou o UPDATE com
 * `malformed array literal` — a cópia no R2 já tinha acontecido e o projeto
 * ficou apontando pro caminho velho. Falha barulhenta, ainda bem: se o
 * Postgres tivesse aceitado a string, o projeto ficaria com UM caminho gigante
 * em vez de vários. Ler e escrever sempre como array.
 */
const lista = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);
const paraJpg = (k) => `${k.slice(0, k.lastIndexOf("."))}.jpg`;

/** Colunas do projeto que guardam lista de caminhos separada por vírgula. */
const COLUNAS = ["reference_image_paths", "product_image_paths"];

(async () => {
  console.log(`\n# corrigir_jfif_video — ${CONFIRMAR ? "VALENDO" : "ENSAIO (nada será gravado)"}`);
  if (ALUNO) console.log(`# só o aluno: ${ALUNO}`);
  console.log();

  const projetos = [];
  for (let de = 0; ; de += 1000) {
    const r = await db
      .from("video_projects")
      .select(`id, user_id, status, created_at, ${COLUNAS.join(", ")}`)
      .range(de, de + 999);
    if (r.error) {
      console.error("ERRO ao ler video_projects:", r.error.message);
      process.exit(1);
    }
    projetos.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) break;
  }

  // Só interessa projeto que ainda não terminou e tem caminho ruim.
  const alvos = [];
  for (const p of projetos) {
    if (["done", "ready", "failed", "canceled"].includes(String(p.status))) continue;
    const ruins = [];
    for (const col of COLUNAS) {
      for (const k of lista(p[col])) if (ehRuim(k)) ruins.push(k);
    }
    if (ruins.length) alvos.push({ ...p, ruins });
  }

  if (!alvos.length) {
    console.log("nenhum projeto travado por extensão — nada a fazer.");
    return;
  }

  // Resolve os e-mails de uma vez.
  const emails = new Map();
  for (const uid of new Set(alvos.map((a) => a.user_id))) {
    const r = await db.from("profiles").select("email").eq("id", uid).maybeSingle();
    emails.set(uid, r.data?.email ?? uid.slice(0, 8));
  }

  const filtrados = ALUNO ? alvos.filter((a) => emails.get(a.user_id) === ALUNO) : alvos;
  console.log(`=== PROJETOS A DESTRAVAR = ${filtrados.length} ===`);
  for (const a of filtrados) {
    console.log(`  ${a.id.slice(0, 8)} [${a.status}] ${emails.get(a.user_id)} — ${a.ruins.length} arquivo(s):`);
    for (const k of a.ruins.slice(0, 4)) console.log(`      ${k.split("/").pop()}`);
  }

  if (!CONFIRMAR) {
    console.log("\n--- ENSAIO: copiaria os arquivos pra .jpg e reescreveria os caminhos.");
    console.log("--- Nada foi tocado. Repita com --confirmar pra valer.");
    return;
  }

  for (const a of filtrados) {
    const patch = {};
    let copiados = 0;
    for (const col of COLUNAS) {
      const atual = lista(a[col]);
      if (!atual.length) continue;
      const nova = [];
      for (const k of atual) {
        if (!ehRuim(k)) {
          nova.push(k);
          continue;
        }
        const destino = paraJpg(k);
        try {
          await cli.send(
            new s3.CopyObjectCommand({
              Bucket: bucket,
              // CopySource exige encoding por segmento (nome com acento quebra).
              CopySource: `${bucket}/${k.split("/").map(encodeURIComponent).join("/")}`,
              Key: destino,
              ContentType: "image/jpeg",
              MetadataDirective: "REPLACE",
            }),
          );
          copiados++;
          nova.push(destino);
        } catch (e) {
          console.error(`  FALHOU copiar ${k.split("/").pop()}: ${e.message}`);
          nova.push(k); // mantém o antigo: melhor travado do que apontando pro vazio
        }
      }
      patch[col] = nova;
    }
    const u = await db.from("video_projects").update(patch).eq("id", a.id);
    if (u.error) {
      console.error(`  FALHOU atualizar ${a.id.slice(0, 8)}: ${u.error.message}`);
      continue;
    }
    console.log(`  ✅ ${a.id.slice(0, 8)} — ${copiados} arquivo(s) copiados pra .jpg e caminhos reescritos`);
  }

  console.log("\nPronto. O original .jfif NÃO foi apagado (rede de segurança).");
  console.log("O aluno precisa clicar em REGERAR — o botão já mira as cenas `failed`.");
  console.log("Não disparei a geração: isso gasta crédito e GPU dele, e é ele quem pede.");
})();
