#!/usr/bin/env node
/**
 * retirar_amostra.cjs — retira do histórico do aluno uma "Amostra automática"
 * que NÃO deveria estar lá.
 *
 * POR QUE EXISTE (incidente 5c3f1f8b / #65, medido 25/08):
 * o resgate de treino (`resgatar_voz.cjs`) rodou na voz `f6f82819` do Marcelo
 * em cima de um arquivo que já estava VETADO por conter DUAS pessoas. O treino
 * COMPLETOU (500 steps, 330s) e o `finalize-training` fez o que faz sempre:
 * gravou a amostra automática como linha `ready` em `generations`. Depois a voz
 * foi devolvida pra `failed` — mas **a linha da amostra ficou**.
 *
 * `GET /api/v1/generations` lista por `user_id`, SEM olhar o status da voz. Ou
 * seja: o aluno abre o histórico e tem um áudio tocável, com o nome da voz
 * dele, que **não é a voz dele** (F0 mediana 197,5Hz, 91,6% das janelas na
 * faixa feminina — a referência automática pegou a entrevistadora). Voz
 * `failed` no banco não esconde nada do aluno.
 *
 * ⚠️ NÃO é varredura em massa de propósito. Medido na base inteira: 3 linhas
 * nesse estado, e só ESTA é de voz `failed` com locutor errado provado. As
 * outras duas são de voz `awaiting_training` — amostra da voz do PRÓPRIO aluno,
 * de um treino que deu certo antes. Apagar aquilo seria tirar coisa legítima do
 * histórico de quem não pediu nada. Quem escolhe o alvo é gente, por id.
 *
 * Só apaga o que você nomear, confere o nº de linhas do `.select()` depois de
 * gravar (UPDATE/DELETE por id inexistente afeta 0 linhas EM SILÊNCIO) e
 * confirma no R2 com HeadObject **depois** de apagar.
 *
 * Uso:
 *   node retirar_amostra.cjs <generationId>              # ensaia
 *   node retirar_amostra.cjs <generationId> --confirmar   # executa
 *   node retirar_amostra.cjs --listar                     # mostra a classe
 */
const path = require("node:path");
const c = require(path.join(__dirname, "_comum.cjs"));
const s3 = require(path.join(c.RAIZ, "frontend", "node_modules", "@aws-sdk", "client-s3"));

const CONFIRMAR = process.argv.includes("--confirmar");
const LISTAR = process.argv.includes("--listar");
const ALVO = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;

async function listar(db) {
  const { data, error } = await db
    .from("generations")
    .select("id, user_id, voice_id, status, created_at, audio_path")
    .eq("name", "Amostra automática")
    .eq("status", "ready");
  if (error) throw new Error(`falha lendo generations: ${JSON.stringify(error)}`);
  const vozIds = [...new Set((data ?? []).map((g) => g.voice_id))];
  const { data: vozes } = await db.from("voices").select("id, name, status").in("id", vozIds);
  const porId = new Map((vozes ?? []).map((v) => [v.id, v]));
  const suspeitas = (data ?? []).filter((g) => porId.get(g.voice_id)?.status !== "ready");
  console.log(`amostras 'ready' com voz NÃO-ready: ${suspeitas.length}`);
  for (const g of suspeitas) {
    const v = porId.get(g.voice_id);
    console.log(`  ${g.id} · voz "${v?.name}" [${v?.status}] · ${g.created_at}`);
  }
  return suspeitas;
}

(async () => {
  const db = c.supa();

  if (LISTAR || !ALVO) {
    await listar(db);
    if (!ALVO) {
      console.log("\nuso: node retirar_amostra.cjs <generationId> [--confirmar]");
      return;
    }
    console.log("");
  }

  // ── 1. Estado ANTES, lido do banco (não do que eu acho que está lá) ──────
  const { data: linha, error: erroLer } = await db
    .from("generations")
    .select("id, user_id, voice_id, name, status, audio_path, created_at")
    .eq("id", ALVO)
    .maybeSingle();
  if (erroLer) throw new Error(`falha lendo a linha: ${JSON.stringify(erroLer)}`);
  if (!linha) {
    console.error(`ABORTADO: generation ${ALVO} não existe — DELETE afetaria 0 linhas em silêncio.`);
    process.exit(1);
  }
  if (linha.name !== "Amostra automática") {
    console.error(`ABORTADO: a linha é "${linha.name}", não uma amostra automática. Esta ferramenta não apaga geração de aluno.`);
    process.exit(1);
  }

  const { data: voz } = await db.from("voices").select("id, name, status").eq("id", linha.voice_id).maybeSingle();
  const bucket = c.BUCKETS.geracoes();
  const chave = linha.audio_path;
  const antes = await c.existe(bucket, chave);

  console.log("ALVO");
  console.log(`  generation : ${linha.id} [${linha.status}] criada ${linha.created_at}`);
  console.log(`  voz        : ${voz?.name} (${voz?.id}) [${voz?.status}]`);
  console.log(`  objeto R2  : ${bucket}/${chave} — ${antes ? "EXISTE" : "ausente"}`);

  // ── 2. Trava: voz `ready` significa amostra legítima. Não apago. ─────────
  if (voz?.status === "ready") {
    console.error("\nABORTADO: a voz está READY — esta amostra é entrega legítima do aluno.");
    process.exit(1);
  }

  if (!CONFIRMAR) {
    console.log("\n[ENSAIO] nada foi apagado. Rode com --confirmar pra executar.");
    console.log("         ensaio NÃO é entrega.");
    return;
  }

  // ── 3. Apaga a linha e CONFERE quantas linhas voltaram ───────────────────
  const { data: apagadas, error: erroDel } = await db
    .from("generations")
    .delete()
    .eq("id", ALVO)
    .select("id");
  if (erroDel) throw new Error(`falha apagando a linha: ${JSON.stringify(erroDel)}`);
  const n = (apagadas ?? []).length;
  console.log(`\nbanco: ${n} linha(s) apagada(s)`);
  if (n !== 1) {
    console.error("ABORTADO NO MEIO: esperava 1 linha. NÃO toquei no R2.");
    process.exit(1);
  }

  // ── 4. Apaga o objeto e CONFERE com HeadObject DEPOIS ────────────────────
  if (antes) {
    await c.r2().send(new s3.DeleteObjectCommand({ Bucket: bucket, Key: chave }));
    const depois = await c.existe(bucket, chave);
    console.log(`R2: ${depois ? "AINDA EXISTE (falhou)" : "objeto removido (HeadObject confirma ausência)"}`);
    if (depois) process.exit(1);
  }

  // ── 5. Prova final: a linha sumiu mesmo ─────────────────────────────────
  const { data: sobrou } = await db.from("generations").select("id").eq("id", ALVO);
  console.log(`conferência final: ${(sobrou ?? []).length} linha(s) com esse id (esperado 0)`);
  console.log("\nFEITO.");
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
