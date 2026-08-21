#!/usr/bin/env node
/**
 * destravar_quadro_imagem.cjs — devolve a referência do estúdio pra quem ficou
 * com o quadro vazio e o botão "Gerar" morto.
 *
 * POR QUE EXISTE (21/08). `canSubmit` exige `Boolean(fixedRef)`: com o quadro
 * vazio o botão Gerar fica DESABILITADO, sem erro e sem explicação. Do lado do
 * aluno o sintoma é "a plataforma não está deixando gerar imagem" — foi assim
 * que a Joanna descreveu no print que o Lucas trouxe. Desde 19/08 15:10 o
 * upload em lote só alimenta o banco de referências e NUNCA preenche o quadro;
 * quem estava com `image_ref_key` NULL não tinha nem o padrão do servidor pra
 * salvar. A saída existia (escolher a foto no banco e promover), mas ninguém
 * descobre isso sozinho — a Joanna subiu a MESMA foto três vezes em três
 * minutos achando que o upload era o problema.
 *
 * O `f48358c` consertou a CAUSA (lote com quadro vazio agora preenche o
 * quadro), mas quem já travou só se beneficia se subir foto de novo. Esta
 * ferramenta destrava sem o aluno precisar fazer nada.
 *
 * O QUE ELE FAZ, e só isso: grava em `profiles.image_ref_key` a ÚLTIMA foto
 * que o próprio aluno já subiu pra `refs/`. O `GET /api/v1/images/ref-default`
 * passa a devolvê-la e o quadro preenche sozinho no próximo acesso.
 *
 * O QUE ELE NÃO FAZ, de propósito:
 *  - NÃO concede crédito, não cobra, não gasta GPU, não escreve pra aluno.
 *  - NÃO inventa foto: usa arquivo que já está no R2 daquele usuário.
 *  - NÃO sobrescreve quem já tem `image_ref_key` — só preenche o que está NULL.
 *  - NÃO prende ninguém à escolha: o aluno troca em "Trocar foto", em "Usar
 *    como referência" (banco) ou pelo Histórico.
 *
 * Uso:
 *   node _frank/ferramentas/destravar_quadro_imagem.cjs               # ENSAIO
 *   node _frank/ferramentas/destravar_quadro_imagem.cjs --confirmar   # grava
 *
 * Idempotente: rodar de novo depois de aplicado não acha ninguém.
 */
const { supa, r2, s3, BUCKETS } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
/** Quando o upload em lote parou de preencher o quadro. */
const CORTE = "2026-08-19T15:10:00Z";

const db = supa();

/** Lê a tabela inteira PAGINADA — o Supabase corta em 1000. */
async function tudo(tabela, colunas, filtro) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    let q = db.from(tabela).select(colunas).range(de, de + 999);
    if (filtro) q = filtro(q);
    const r = await q;
    if (r.error) {
      console.error(`ERRO ao ler ${tabela}[${de}]:`, r.error.message);
      process.exit(1);
    }
    out.push(...(r.data ?? []));
    if ((r.data ?? []).length < 1000) break;
  }
  return out;
}

(async () => {
  console.log(`\n# destravar_quadro_imagem — ${CONFIRMAR ? "VALENDO" : "ENSAIO (nada será gravado)"}`);
  console.log(`# corte: ${CORTE}\n`);

  // 1. quem GEROU imagem desde o corte — esses não estão travados.
  const ger = await tudo("image_generations", "user_id", (q) => q.gte("created_at", CORTE));
  const gerou = new Set(ger.map((x) => x.user_id));
  console.log(`gerações desde o corte: ${ger.length} (de ${gerou.size} alunos)`);

  // 2. quem SUBIU foto pro banco desde o corte (varre o R2).
  const cli = r2();
  const bucket = BUCKETS.imagens();
  const donos = new Map(); // uid -> { key, quando }
  let tok;
  let paginas = 0;
  do {
    const out = await cli.send(
      new s3.ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000, ContinuationToken: tok }),
    );
    for (const o of out.Contents ?? []) {
      const m = o.Key.match(/^([0-9a-f-]{36})\/refs\//);
      if (!m) continue;
      if (new Date(o.LastModified) < new Date(CORTE)) continue;
      const atual = donos.get(m[1]);
      if (!atual || o.LastModified > atual.quando) {
        donos.set(m[1], { key: o.Key, quando: o.LastModified });
      }
    }
    tok = out.NextContinuationToken;
    paginas++;
  } while (tok && paginas < 80);
  console.log(`alunos com foto no banco desde o corte: ${donos.size}`);

  // 3. TRAVADO = subiu foto, não gerou nada, e o perfil está sem referência.
  const perfis = await tudo("profiles", "id, email, image_ref_key, credits_subscription, credits_extra, access_until");
  const porId = new Map(perfis.map((p) => [p.id, p]));

  const alvos = [];
  for (const [uid, info] of donos) {
    if (gerou.has(uid)) continue;
    const p = porId.get(uid);
    if (!p) continue;
    // Já tem referência definida no servidor: não sobrescreve a escolha dele.
    if ((p.image_ref_key ?? "").trim()) continue;
    alvos.push({ uid, email: p.email, key: info.key, quando: info.quando, perfil: p });
  }

  console.log(`\n=== A DESTRAVAR = ${alvos.length} ===`);
  if (!alvos.length) {
    console.log("  ninguém com o quadro vazio — nada a fazer.");
    return;
  }

  const agora = new Date();
  alvos.sort((a, b) => a.email.localeCompare(b.email));
  for (const a of alvos) {
    const cr = (a.perfil.credits_subscription ?? 0) + (a.perfil.credits_extra ?? 0);
    const pagante = a.perfil.access_until && new Date(a.perfil.access_until) > agora;
    console.log(
      `  ${pagante ? "PAGANTE" : "       "} ${a.email.padEnd(38)} ${cr.toLocaleString().padStart(9)} cr` +
        `  <- ${a.key.slice(a.uid.length + 1)}`,
    );
  }

  if (!CONFIRMAR) {
    console.log(`\n--- ENSAIO: gravaria image_ref_key em ${alvos.length} perfis. Nada foi feito.`);
    console.log("--- Repita com --confirmar pra valer.");
    return;
  }

  let ok = 0;
  for (const a of alvos) {
    const r = await db.from("profiles").update({ image_ref_key: a.key }).eq("id", a.uid);
    if (r.error) {
      console.error(`  FALHOU ${a.email}: ${r.error.message}`);
      continue;
    }
    ok++;
  }
  console.log(`\n✅ ${ok}/${alvos.length} perfis destravados.`);
  console.log("   O quadro preenche sozinho no próximo acesso deles.");
  console.log("   Quem estiver com a aba aberta talvez precise recarregar a página uma vez.");
})();
