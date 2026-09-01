#!/usr/bin/env node
/**
 * reconciliar_cena_estudio.cjs — ressuscita cena do Vídeo Estúdio que foi
 * marcada `failed` (ou ficou presa) quando o Kie JÁ TINHA ENTREGADO o vídeo.
 *
 * POR QUE EXISTE (27/08). Às 01h11-01h12Z de 27/08, 8 cenas de 3 alunos
 * (pizolatip, allysoncruz.nutri, priscillarosseti) foram de `animating` para
 * `failed` + estorno de 1.800 créditos cada, com o erro cru
 *   `salvar cena: No value provided for input HTTP label: Bucket.`
 * Esse erro é do SDK da AWS e significa uma coisa só: `Bucket` chegou VAZIO no
 * `PutObjectCommand` de `lib/studio/scenes.ts:355`. Ou seja `imagesBucket()`
 * devolveu "" — o que só acontece quando NEM `R2_BUCKET_IMAGES` NEM
 * `R2_BUCKET_VOICES` existem no ambiente (medido: a produção não tem
 * `R2_BUCKET_IMAGES` e vive do fallback pro de vozes, `voices-clone-ai-verse`).
 *
 * O estrago: o erro é NOSSO (configuração), mas quem pagou foi a cena do aluno.
 * `failScene` não distingue "o Kie falhou" de "eu não consegui guardar o que o
 * Kie entregou" — nos dois casos ele mata a cena. Conferido no Kie depois:
 * as 8 tasks estavam `state=success` e as 8 URLs respondiam HTTP 200 (1,1MB a
 * 4,2MB). O vídeo do aluno existia; foi jogado fora por variável de ambiente.
 *
 * O QUE ELE FAZ:
 *   - lê a cena, exige `kie_task_id` e status `failed`/`animating`;
 *   - consulta `recordInfo` do Kie (LEITURA — não cria task, não gasta GPU);
 *   - `success` → baixa o vídeo, grava no R2 na MESMA chave do `sceneBankKey`
 *     (`<user>/studio-bank/<sceneId>.mp4`), CONFERE com HeadObject DEPOIS de
 *     gravar, e só então marca `ready` + `video_path`, conferindo o nº de
 *     linhas do `.select()`;
 *   - qualquer outro estado → não toca em nada e diz o que viu.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO:
 *   - NÃO mexe em crédito. As 8 já foram estornadas pelo `handleTechFailure`;
 *     o estorno FICA (o erro foi nosso, a casa paga). Recobrar 1.800 de quem
 *     esperou 8-14 dias está fora de questão, e cobrar/estornar é decisão de
 *     gente, em transação explícita — mesma regra do reconciliar_imagem_kie.
 *   - NÃO cria task nova no Kie (nada de retry silencioso gastando dinheiro).
 *   - NÃO inventa bucket: usa a MESMA resolução do app e ABORTA se vier vazio,
 *     que é exatamente a falha que causou o incidente.
 *
 * Uso:
 *   node _frank/ferramentas/reconciliar_cena_estudio.cjs <sceneId|prefixo8>
 *   node _frank/ferramentas/reconciliar_cena_estudio.cjs <id> --confirmar
 *   node _frank/ferramentas/reconciliar_cena_estudio.cjs --todas [--confirmar]
 *        --todas = toda cena `failed` com kie_task_id cujo Kie deu success
 */
const { supa, r2, s3 } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const TODAS = process.argv.includes("--todas");
const ALVO = process.argv.slice(2).find((a) => !a.startsWith("--"));

const db = supa();
const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

/** Mesma resolução do `imagesBucket()` do app — mas ABORTA em vez de devolver "". */
function bucketCenas() {
  const b = process.env.R2_BUCKET_IMAGES || process.env.R2_BUCKET_VOICES;
  if (!b) {
    throw new Error(
      "R2_BUCKET_IMAGES e R2_BUCKET_VOICES ausentes: bucket vazio. " +
        "É ESTA a causa do incidente 147/148 — abortando em vez de repetir o erro.",
    );
  }
  return b;
}

/** Mesma chave do `sceneBankKey` (lib/studio/scenes.ts:75). */
const chaveCena = (userId, sceneId) => `${userId}/studio-bank/${sceneId}.mp4`;

async function kieTask(taskId) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY ausente");
  const r = await fetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Kie HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = (await r.json()).data ?? {};
  let urls = [];
  if (d.resultJson) {
    try {
      urls = JSON.parse(d.resultJson).resultUrls ?? [];
    } catch {
      /* resultJson malformado = sem resultado */
    }
  }
  return { state: d.state, urls, failMsg: d.failMsg ?? null };
}

/**
 * ⚠️ A ARMADILHA QUE ESTE SCRIPT QUASE CAIU (medida no ensaio de 27/08).
 *
 * `kie_task_id` NÃO é sempre a task do VÍDEO. A cena guarda a task da fase em
 * que estava: em `generating_still` é a task da IMAGEM, e só depois de virar
 * `animating` o campo é sobrescrito com a task do vídeo. Quando a cena morre
 * ANTES de animar — foi o caso das 26 do martinmendezagiluilar7 em 23/08, que
 * levaram HTTP 429 em `kieCreateVideoTask` (incidentes 102-107) — o campo ficou
 * com a task do STILL, e ela responde `state=success` alegremente.
 *
 * Sem esta checagem, o script baixaria um PNG e o gravaria como
 * `<cena>.mp4` com `ContentType: video/mp4`, marcando a cena `ready`: 26 vídeos
 * quebrados no acervo do aluno, com o banco jurando que estão prontos. Seria
 * um estrago MAIOR que o incidente que vim consertar.
 *
 * Por isso o alvo é confirmado pelo que o objeto É (content-type + extensão),
 * nunca pelo que o status sugere.
 */
async function ehVideo(url) {
  const semQuery = url.split("?")[0];
  const ext = (semQuery.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase() ?? null;
  let ct = null;
  try {
    const h = await fetch(url, { method: "HEAD" });
    if (h.ok) ct = h.headers.get("content-type");
  } catch {
    /* sem HEAD, decide pela extensão */
  }
  const video = ct ? ct.startsWith("video/") : ext === "mp4";
  return { video, ext, ct };
}

async function resolverCena(alvo) {
  // uuid inteiro ou prefixo — prefixo vira faixa (uuid não aceita `like`).
  const campos = "id,user_id,status,kie_task_id,video_path,debit_ref,created_at,error_message";
  if (/^[0-9a-f-]{36}$/i.test(alvo)) {
    const { data } = await db.from("studio_scenes").select(campos).eq("id", alvo);
    return data ?? [];
  }
  const lo = `${alvo}${"0".repeat(8 - alvo.length)}-0000-0000-0000-000000000000`;
  const hi = `${alvo}${"f".repeat(8 - alvo.length)}-ffff-ffff-ffff-ffffffffffff`;
  const { data } = await db.from("studio_scenes").select(campos).gte("id", lo).lte("id", hi);
  return data ?? [];
}

async function tratar(cena, bucket) {
  const id8 = cena.id.slice(0, 8);
  const rot = (m) => console.log(`  ${id8} ${m}`);
  console.log(`\n▸ cena ${id8} · status=${cena.status} · criada ${cena.created_at}`);

  if (!cena.kie_task_id) return rot("SEM kie_task_id — não há o que perguntar ao Kie. Pulando.");
  if (!["failed", "animating"].includes(cena.status))
    return rot(`status '${cena.status}' fora do alvo (só failed/animating). Pulando.`);
  if (cena.video_path) return rot(`JÁ tem video_path (${cena.video_path}). Nada a fazer.`);

  const t = await kieTask(cena.kie_task_id);
  if (t.state !== "success") return rot(`Kie state=${t.state} (fail="${t.failMsg ?? ""}") — não recuperável. Pulando.`);
  const url = t.urls[0];
  if (!url) return rot("Kie diz success mas sem resultUrls. Pulando.");

  // O resultado é mesmo um VÍDEO? Se for o still, a task guardada é da fase
  // anterior e recuperar aqui gravaria imagem com cara de vídeo. Ver ehVideo().
  const tipo = await ehVideo(url);
  if (!tipo.video) {
    return rot(
      `RECUSADO: o resultado do Kie é ${tipo.ct ?? tipo.ext ?? "desconhecido"}, não vídeo — ` +
        "esta cena morreu na fase do still e a task guardada é da IMAGEM. " +
        "Recuperar exigiria criar task de vídeo nova (custa GPU): decisão de gente, não deste script.",
    );
  }

  const chave = chaveCena(cena.user_id, cena.id);
  rot(`Kie=success · vídeo (${tipo.ct ?? tipo.ext}) · destino r2://${bucket}/${chave}`);

  if (!CONFIRMAR) return rot("ENSAIO — nada gravado. Rode com --confirmar.");

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) return rot(`ABORTADO: download do Kie deu HTTP ${resp.status}.`);
  const bytes = Buffer.from(await resp.arrayBuffer());
  if (bytes.length < 10000) return rot(`ABORTADO: só ${bytes.length} bytes, não parece vídeo.`);

  await r2().send(
    new s3.PutObjectCommand({ Bucket: bucket, Key: chave, Body: bytes, ContentType: "video/mp4" }),
  );

  // Confere DEPOIS de gravar — objeto no R2 antes de afirmar qualquer coisa.
  const head = await r2().send(new s3.HeadObjectCommand({ Bucket: bucket, Key: chave }));
  if (Number(head.ContentLength) !== bytes.length) {
    return rot(`ABORTADO: R2 devolveu ${head.ContentLength} bytes, esperado ${bytes.length}. Banco NÃO tocado.`);
  }
  rot(`R2 confirmado: ${head.ContentLength} bytes.`);

  const { data: upd, error } = await db
    .from("studio_scenes")
    .update({ status: "ready", video_path: chave, error_message: null })
    .eq("id", cena.id)
    .eq("status", cena.status) // trava: não reescreve cena que mudou no meio
    .select("id,status,video_path");
  if (error) return rot(`ERRO no update: ${error.message}`);
  if (!upd || upd.length !== 1) {
    return rot(`ABORTADO: update afetou ${upd ? upd.length : 0} linhas (esperado 1). O objeto ficou no R2.`);
  }
  rot(`OK — banco diz status=${upd[0].status}, video_path gravado. (crédito NÃO tocado: estorno fica)`);
}

(async () => {
  const bucket = bucketCenas();
  console.log(`bucket das cenas: ${bucket}${CONFIRMAR ? "" : "   [ENSAIO — sem --confirmar nada é gravado]"}`);

  let cenas;
  if (TODAS) {
    const { data } = await db
      .from("studio_scenes")
      .select("id,user_id,status,kie_task_id,video_path,debit_ref,created_at,error_message")
      .eq("status", "failed")
      .not("kie_task_id", "is", null)
      .is("video_path", null)
      .order("created_at", { ascending: true })
      .limit(1000);
    cenas = data ?? [];
  } else {
    if (!ALVO) throw new Error("informe <sceneId|prefixo8> ou --todas");
    cenas = await resolverCena(ALVO);
    if (cenas.length === 0) throw new Error(`nenhuma cena casa com '${ALVO}'`);
    if (cenas.length > 1) throw new Error(`'${ALVO}' é AMBÍGUO (${cenas.length} cenas). Passe o uuid inteiro.`);
  }

  console.log(`${cenas.length} cena(s) na mira.`);
  for (const c of cenas) {
    try {
      await tratar(c, bucket);
    } catch (e) {
      console.log(`  ${c.id.slice(0, 8)} ERRO: ${e.message}`);
    }
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
