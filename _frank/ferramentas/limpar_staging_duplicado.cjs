#!/usr/bin/env node
/**
 * limpar_staging_duplicado.cjs — apaga do R2 o ORIGINAL das fotos que já foram
 * copiadas pra `refs/`. Incidente c82c77e4.
 *
 * POR QUE EXISTE (21/08): até o `87d8c80`, o upload gravava em
 * `<uid>/images/<uuid>/input_X` e a adoção COPIAVA pra `<uid>/refs/<hash>_X`
 * sem apagar a origem. Resultado: 788 pares idênticos, 57 alunos, 1,5 GB em
 * 44h. O `87d8c80` estanca a sangria (upload novo já apaga o staging), mas não
 * devolve o disco do que ficou pra trás. Esta ferramenta faz isso.
 *
 * ⚠️ O CONSERTO INGÊNUO QUEBRA PRODUÇÃO. Medido pelo Frank em 21/08: mesmo
 * depois da mudança de 19/08, 31 payloads de geração ainda apontam DIRETO pro
 * original em `images/<uuid>/input_`. Apagar tudo que tem par em `refs/`
 * apagaria a foto de entrada dessas gerações — o exato defeito que a pasta
 * `refs/` foi criada pra curar em 19/08. Seria trocar 1,5 GB de disco por
 * histórico quebrado de aluno.
 *
 * POR ISSO SÓ APAGA COM AS TRÊS CONDIÇÕES:
 *  1. a chave está em `<uid>/images/` (nunca toca em `refs/`);
 *  2. existe uma cópia em `<uid>/refs/` com o MESMO tamanho em bytes;
 *  3. NENHUMA geração referencia a chave — conferido nas duas colunas
 *     (`input_image_path` singular e `input_image_paths` array).
 * Erro de consulta NÃO é "não tem referência": na dúvida, não apaga.
 *
 * Uso:
 *   node _frank/ferramentas/limpar_staging_duplicado.cjs               # ENSAIO
 *   node _frank/ferramentas/limpar_staging_duplicado.cjs --confirmar   # apaga
 */
const { supa, r2, s3, BUCKETS } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const db = supa();
const cli = r2();
const bucket = BUCKETS.imagens();

/** Nome do arquivo sem os prefixos que cada lado acrescenta. */
function nomeBase(key) {
  const ultimo = key.split("/").pop() ?? "";
  return ultimo
    .replace(/^input_/, "") // staging: <uuid>/input_NOME
    .replace(/^[0-9a-f]{8}_/, ""); // refs:    <hash8>_NOME
}

/** A MESMA checagem do apagarStagingAdotado() em lib/images/refs.ts. */
async function referenciada(key) {
  const [a, b] = await Promise.all([
    db.from("image_generations").select("id").eq("input_image_path", key).limit(1),
    db.from("image_generations").select("id").contains("input_image_paths", [key]).limit(1),
  ]);
  if (a.error || b.error) return true; // erro => trata como referenciada
  return (a.data?.length ?? 0) > 0 || (b.data?.length ?? 0) > 0;
}

(async () => {
  console.log(`\n# limpar_staging_duplicado — ${CONFIRMAR ? "VALENDO" : "ENSAIO (nada será apagado)"}\n`);

  // 1. varre o bucket inteiro, separando staging de refs por usuário.
  const staging = new Map(); // uid -> [{key,size}]
  const refs = new Map(); // uid -> Map<nomeBase, size>
  let tok;
  let paginas = 0;
  do {
    const out = await cli.send(
      new s3.ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000, ContinuationToken: tok }),
    );
    for (const o of out.Contents ?? []) {
      let m = o.Key.match(/^([0-9a-f-]{36})\/images\/[0-9a-f-]{36}\/input_/);
      if (m) {
        if (!staging.has(m[1])) staging.set(m[1], []);
        staging.get(m[1]).push({ key: o.Key, size: o.Size });
        continue;
      }
      m = o.Key.match(/^([0-9a-f-]{36})\/refs\//);
      if (m) {
        if (!refs.has(m[1])) refs.set(m[1], new Map());
        refs.get(m[1]).set(`${nomeBase(o.Key)}|${o.Size}`, o.Size);
      }
    }
    tok = out.NextContinuationToken;
    paginas++;
  } while (tok && paginas < 120);

  const totalStaging = [...staging.values()].reduce((n, a) => n + a.length, 0);
  console.log(`staging encontrado: ${totalStaging} arquivo(s) de ${staging.size} aluno(s)`);

  // 2. quem tem par em refs/ (mesmo nome E mesmo tamanho).
  const candidatos = [];
  for (const [uid, arquivos] of staging) {
    const meus = refs.get(uid);
    if (!meus) continue;
    for (const a of arquivos) {
      if (meus.has(`${nomeBase(a.key)}|${a.size}`)) candidatos.push({ uid, ...a });
    }
  }
  console.log(`com cópia idêntica em refs/: ${candidatos.length}`);

  // 3. tira os que alguma geração ainda usa.
  const alvos = [];
  let protegidos = 0;
  for (const c of candidatos) {
    if (await referenciada(c.key)) {
      protegidos++;
      continue;
    }
    alvos.push(c);
  }
  const bytes = alvos.reduce((n, a) => n + a.size, 0);
  console.log(`PROTEGIDOS (uma geração ainda usa): ${protegidos}`);
  console.log(`\n=== A APAGAR = ${alvos.length}  (${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB) ===`);

  if (!alvos.length) {
    console.log("  nada duplicado sobrando.");
    return;
  }
  const porAluno = new Map();
  for (const a of alvos) porAluno.set(a.uid, (porAluno.get(a.uid) ?? 0) + 1);
  console.log(`  espalhados por ${porAluno.size} aluno(s)`);
  for (const a of alvos.slice(0, 5)) {
    console.log(`   ex: ${a.key.slice(37)}  ${(a.size / 1024).toFixed(0)} KB`);
  }

  if (!CONFIRMAR) {
    console.log(`\n--- ENSAIO: apagaria ${alvos.length} arquivos. Nada foi tocado.`);
    console.log("--- Repita com --confirmar pra valer.");
    return;
  }

  let ok = 0;
  for (const a of alvos) {
    try {
      await cli.send(new s3.DeleteObjectCommand({ Bucket: bucket, Key: a.key }));
      ok++;
    } catch (e) {
      console.error(`  FALHOU ${a.key.slice(37)}: ${e.message}`);
    }
  }
  console.log(`\n✅ ${ok}/${alvos.length} originais apagados — ${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB liberados.`);
  console.log("   As cópias em refs/ (que o aluno vê e usa) estão intactas.");
})();
