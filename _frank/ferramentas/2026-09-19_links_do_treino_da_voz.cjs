#!/usr/bin/env node
/**
 * 2026-09-19_links_do_treino_da_voz.cjs — devolve ao aluno os ÁUDIOS ORIGINAIS
 * que ele subiu no treino da voz, como links assinados.
 *
 * POR QUE EXISTE: o aluno não consegue baixar isso sozinho. Medido em 19/09:
 * a tela `/app/voice-cloning/[id]` mostra só a CONTAGEM de arquivos
 * (`fileCount`, page.tsx:61-62) e a API `GET /api/v1/voices/[id]` **promete no
 * cabeçalho** "presigned download URLs onde aplicável" e **não assina nada** —
 * não há uma única chamada de presign no arquivo. Então "peça pelo painel" é
 * resposta falsa: o caminho não existe. Enquanto não existir, a entrega é esta
 * aqui, manual e rastreável.
 *
 * O QUE ELE FAZ DE DIFERENTE DE UM `ls`: **deduplica por ETag**. O uploader
 * grava o mesmo arquivo várias vezes com prefixo e hash diferentes — no caso
 * que originou esta ferramenta (#347) eram **9 objetos para 3 arquivos
 * distintos**, com um áudio de WhatsApp repetido 5x. Mandar 9 links para 3
 * arquivos faz o aluno baixar o mesmo áudio cinco vezes e achar que a casa se
 * atrapalhou. ETag do R2/S3 é o md5 do objeto quando não é multipart, que é o
 * caso destes (todos < 5 MB) — para os multipart o ETag tem sufixo `-N` e a
 * dedupe é ignorada de propósito, em vez de mentir.
 *
 * SOMENTE LEITURA: lista, dá HEAD e assina GET. Não grava, não apaga, não
 * treina, não gasta crédito nem GPU.
 *
 * USO:
 *   node _frank/ferramentas/2026-09-19_links_do_treino_da_voz.cjs <email>
 *        [--voz <voice_id>]   se o aluno tiver mais de uma voz
 *        [--dias N]           validade do link (default 7, máximo do SigV4)
 *        [--todos]            não deduplica: um link por objeto
 *        [--json]
 */
const { supa, r2, s3, BUCKETS, urlAssinada } = require("./_comum.cjs");

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const TODOS = args.includes("--todos");
const JSONOUT = args.includes("--json");
const DIAS = Number(opt("dias", 7));

if (!email) {
  console.error("uso: node 2026-09-19_links_do_treino_da_voz.cjs <email> [--voz id] [--dias 7] [--todos] [--json]");
  process.exit(1);
}
// SigV4 não assina além de 7 dias: recusar alto é melhor que gerar link morto.
if (!(DIAS > 0 && DIAS <= 7)) {
  console.error(`--dias=${DIAS} inválido: o SigV4 assina no máximo 7 dias.`);
  process.exit(1);
}

(async () => {
  const db = supa();

  const { data: perfis, error: ePerfil } = await db
    .from("profiles")
    .select("id, email, display_name")
    .eq("email", email);
  if (ePerfil) throw new Error(`profiles: ${ePerfil.message}`);
  if (!perfis?.length) {
    console.error(`❌ nenhuma conta com o e-mail ${email}. O pedido pode ter vindo de formulário (SGP) com e-mail diferente do cadastro — confira antes de responder.`);
    process.exit(2);
  }
  if (perfis.length > 1) {
    console.error(`❌ ${perfis.length} contas com o mesmo e-mail — ambíguo, resolva na mão.`);
    process.exit(2);
  }
  const perfil = perfis[0];

  let { data: vozes, error: eVoz } = await db
    .from("voices")
    .select("id, name, status, created_at, raw_audio_paths")
    .eq("user_id", perfil.id)
    .order("created_at", { ascending: false });
  if (eVoz) throw new Error(`voices: ${eVoz.message}`);

  const vozId = opt("voz", null);
  if (vozId) vozes = (vozes || []).filter((v) => v.id === vozId);
  if (!vozes?.length) {
    console.error("❌ nenhuma voz encontrada para esta conta.");
    process.exit(2);
  }
  if (vozes.length > 1 && !vozId) {
    console.error(`⚠️ ${vozes.length} vozes nesta conta — escolha uma com --voz <id>:`);
    for (const v of vozes) console.error(`   ${v.id}  "${v.name}"  ${v.status}  ${v.created_at}`);
    process.exit(2);
  }
  const voz = vozes[0];

  const bucket = BUCKETS.vozes();
  const caminhos = Array.isArray(voz.raw_audio_paths) ? voz.raw_audio_paths : [];

  console.log(`👤 ${perfil.display_name || "(sem nome)"} <${perfil.email}>`);
  console.log(`🎙️  voz "${voz.name}" ${voz.id} [${voz.status}] criada ${voz.created_at}`);
  console.log(`📄 raw_audio_paths no banco: ${caminhos.length}`);
  console.log(`🪣 bucket: ${bucket}\n`);

  // HEAD em cada caminho: o banco listar NÃO prova que o objeto existe.
  const achados = [];
  const sumidos = [];
  for (const key of caminhos) {
    try {
      const h = await r2().send(new s3.HeadObjectCommand({ Bucket: bucket, Key: key }));
      achados.push({ key, size: h.ContentLength, etag: (h.ETag || "").replace(/"/g, "") });
    } catch {
      sumidos.push(key);
    }
  }

  if (sumidos.length) {
    console.log(`🕳️  ${sumidos.length} caminho(s) no banco SEM objeto no R2 — não prometa estes ao aluno:`);
    for (const k of sumidos) console.log("   " + k);
    console.log("");
  }

  // Dedupe por ETag. Multipart (ETag com "-N") não é md5 do conteúdo: não dedupa.
  const grupos = new Map();
  for (const a of achados) {
    const chave = TODOS || a.etag.includes("-") ? `${a.key}` : a.etag;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(a);
  }

  const segundos = DIAS * 24 * 3600;
  const entregaveis = [];
  for (const [, dups] of grupos) {
    const principal = dups[0];
    const nome = principal.key.split("/").pop().replace(/^\d+_[0-9a-f]+_/, "");
    entregaveis.push({
      arquivo: nome,
      key: principal.key,
      bytes: principal.size,
      copias: dups.length,
      url: await urlAssinada(bucket, principal.key, segundos),
    });
  }

  console.log(`✅ objetos no R2: ${achados.length} · arquivos DISTINTOS: ${entregaveis.length}`);
  if (!TODOS && achados.length !== entregaveis.length) {
    console.log(`   (${achados.length - entregaveis.length} eram cópias byte-a-byte do mesmo áudio — dedup por ETag)`);
  }
  console.log(`🔗 links válidos por ${DIAS} dia(s)\n`);

  if (JSONOUT) {
    console.log(JSON.stringify({ aluno: perfil.email, voz: voz.id, entregaveis, sumidos }, null, 2));
    return;
  }
  for (const e of entregaveis) {
    const mb = (e.bytes / 1048576).toFixed(2);
    console.log(`── ${e.arquivo}  (${mb} MB${e.copias > 1 ? `, estava gravado ${e.copias}x` : ""})`);
    console.log(e.url + "\n");
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
