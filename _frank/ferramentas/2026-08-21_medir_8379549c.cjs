/**
 * Medição REPRODUZÍVEL do incidente 8379549c (foto sobe pro banco de
 * referências e NÃO entra na geração; aluno gera com ref velha e paga).
 *
 * Critério ESTRITO (o mesmo do Vigia em 21/08 12h, agora persistido):
 *   - geração criada em [19/08 15:10:33Z, agora]
 *   - input_image_paths com EXATAMENTE 1 ref
 *   - existem fotos do aluno no R2 (prefixo <uid>/refs/) enviadas nos
 *     15 minutos ANTERIORES à geração
 *   - NENHUMA delas foi usada na geração
 *   - a ref usada é MAIS VELHA (LastModified) que esses uploads
 *
 * Também imprime, por geração, se JÁ existe estorno
 * (credit_transactions ref_type='generation_refund' com ref_id = geração).
 *
 * Uso: node _frank/ferramentas/2026-08-21_medir_8379549c.cjs [--ate ISO]
 */
const { supa, r2, s3, BUCKETS } = require("./_comum.cjs");

/** Lista PAGINADA (ContinuationToken) — a listar() do _comum trunca em 1000 calada. */
async function listarTudo(bucket, prefixo, minBytes = 1000) {
  const out = [];
  let token;
  do {
    const r = await r2().send(new s3.ListObjectsV2Command({
      Bucket: bucket, Prefix: prefixo, ContinuationToken: token,
    }));
    out.push(...(r.Contents ?? []));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out.filter((o) => (o.Size ?? 0) > minBytes);
}

const INICIO = "2026-08-19T15:10:33.173Z";
const JANELA_MS = 15 * 60 * 1000;

/**
 * Roda a medição e DEVOLVE { suspeitas, emails, estornos, gens, umaRef } —
 * exportada pra que o script de ESTORNO use exatamente o mesmo critério,
 * sem transcrever id na mão (transcrição já quase mandou e-mail errado, #876).
 */
async function medir(FIM = new Date().toISOString()) {
  const db = supa();
  console.log(`Janela: ${INICIO} -> ${FIM}`);

  // 1. todas as gerações da janela, PAGINADO, erro cru impresso
  const gens = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("image_generations")
      .select("id,user_id,created_at,status,credits_cost,input_image_paths,input_image_path")
      .gte("created_at", INICIO)
      .lte("created_at", FIM)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) { console.error("ERRO CRU (image_generations):", JSON.stringify(error)); process.exit(1); }
    gens.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Gerações na janela (todas): ${gens.length}`);

  // 2. candidatas: exatamente 1 ref usada
  const umaRef = gens.filter((g) => (g.input_image_paths ?? []).length === 1);
  console.log(`Com exatamente 1 ref: ${umaRef.length}`);

  // 3. lista R2 refs/ por usuário (uma vez por usuário)
  const bucket = BUCKETS.imagens();
  const porUser = new Map();
  for (const g of umaRef) {
    if (!porUser.has(g.user_id)) porUser.set(g.user_id, null);
  }
  for (const uid of porUser.keys()) {
    porUser.set(uid, await listarTudo(bucket, `${uid}/refs/`, 1000));
  }

  // 4. critério estrito
  const suspeitas = [];
  for (const g of umaRef) {
    const refUsada = g.input_image_paths[0];
    const objetos = porUser.get(g.user_id) ?? [];
    const tGen = new Date(g.created_at).getTime();
    const recentes = objetos.filter((o) => {
      const t = new Date(o.LastModified).getTime();
      return t >= tGen - JANELA_MS && t <= tGen;
    });
    if (!recentes.length) continue;
    if (recentes.some((o) => o.Key === refUsada)) continue; // usou a recente: ok
    const objUsado = objetos.find((o) => o.Key === refUsada);
    const tUsada = objUsado ? new Date(objUsado.LastModified).getTime() : 0;
    const maisNova = Math.max(...recentes.map((o) => new Date(o.LastModified).getTime()));
    if (tUsada >= maisNova) continue; // ref usada é mais nova: escolha legítima
    suspeitas.push({ g, recentes: recentes.map((o) => o.Key), refUsada });
  }

  // 5. e-mail por usuário + estorno já existente
  const uids = [...new Set(suspeitas.map((s) => s.g.user_id))];
  const emails = new Map();
  if (uids.length) {
    const { data, error } = await db.from("profiles").select("id,email").in("id", uids);
    if (error) { console.error("ERRO CRU (profiles):", JSON.stringify(error)); process.exit(1); }
    for (const p of data) emails.set(p.id, p.email);
  }
  const genIds = suspeitas.map((s) => s.g.id);
  const estornos = new Map();
  if (genIds.length) {
    // Estorno de IMAGEM na plataforma é ref_type='image_refund' (finalize.ts:99).
    // 'generation_refund' é a convenção do ÁUDIO — checa os dois pra não
    // repetir o falso negativo do playbook (procurar o tipo errado = zero).
    const { data, error } = await db
      .from("credit_transactions")
      .select("id,ref_id,amount,created_at,ref_type")
      .in("ref_type", ["image_refund", "generation_refund"])
      .in("ref_id", genIds);
    if (error) { console.error("ERRO CRU (credit_transactions):", JSON.stringify(error)); process.exit(1); }
    for (const t of data) estornos.set(t.ref_id, t);
  }

  // 6. relatório
  let total = 0;
  const porAluno = new Map();
  console.log("\n=== SUSPEITAS (critério estrito) ===");
  for (const s of suspeitas) {
    const em = emails.get(s.g.user_id) ?? s.g.user_id;
    const est = estornos.get(s.g.id);
    total += s.g.credits_cost ?? 0;
    const a = porAluno.get(em) ?? { gens: 0, cr: 0 };
    a.gens += 1; a.cr += s.g.credits_cost ?? 0;
    porAluno.set(em, a);
    console.log(
      `  ${s.g.created_at}  ${s.g.id}  ${em}  ${s.g.credits_cost}cr  status=${s.g.status}` +
      `  estornado=${est ? `SIM(${est.amount} em ${est.created_at})` : "NAO"}` +
      `\n    usou: ${s.refUsada}\n    ignorou (${s.recentes.length}): ${s.recentes.join(", ")}`,
    );
  }
  console.log("\n=== POR ALUNO ===");
  for (const [em, a] of porAluno) console.log(`  ${em}  ${a.gens} gerações  ${a.cr} cr`);
  console.log(`\nTOTAL: ${suspeitas.length} gerações | ${porAluno.size} alunos | ${total} créditos`);
  console.log(`(denominador: ${gens.length} gerações na janela, ${umaRef.length} com 1 ref, ${porUser.size} usuários com R2 listado)`);

  return { suspeitas, emails, estornos, gens, umaRef };
}

module.exports = { medir, INICIO };

if (require.main === module) {
  const ateArg = process.argv.indexOf("--ate");
  medir(ateArg > -1 ? process.argv[ateArg + 1] : undefined).catch((e) => {
    console.error("ERRO CRU:", e);
    process.exit(1);
  });
}
