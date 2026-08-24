#!/usr/bin/env node
/**
 * reconciliar_imagem_kie.cjs — fecha uma `image_generations` que ficou presa em
 * `pending`/`generating` perguntando ao Kie qual foi o desfecho REAL.
 *
 * POR QUE EXISTE (22/08). `syncImageTask` (lib/images/sync.ts) só roda por duas
 * portas: o poll do `GET /images/[id]` (ou seja, o aluno com a tela ABERTA) e o
 * webhook do Kie. Quando o webhook não chega e ninguém está com a tela aberta —
 * o caso do onboarding, em que a pessoa nem tem acesso ao app — a row fica presa
 * pra sempre. Não existe nenhuma varredura que reconcilie isso.
 * Medido em 22/08: 3 rows presas, a mais velha de 25/07 (28 dias). Duas o Kie já
 * tinha marcado `fail` havia semanas; uma o Kie tinha entregue com SUCESSO em 74
 * segundos e a imagem estava lá, sem ninguém pra buscar.
 *
 * A varredura diária também era cega: ela só olhava `pending` e não `generating`
 * (mesma lição do `b9c5a0d1` — enumerar estado ruim fica cego).
 *
 * O QUE ELE FAZ:
 *   - lê a row, exige status pending/generating e kie_task_id;
 *   - consulta `recordInfo` do Kie (leitura, NÃO gasta GPU nem cria task nova);
 *   - success → baixa o resultado, grava no R2 em <user>/images/<id>/result.<ext>
 *     (mesma chave do `buildImageResultKey`) e marca `ready` com `image_path`;
 *   - fail    → marca `failed` com a mensagem amigável + `kie_raw_error` cru;
 *   - generating/waiting → não faz nada e diz que ainda está viva.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO:
 *   - NÃO mexe em crédito. Nem estorna, nem cobra. O estorno do fluxo normal
 *     (`handleTechFailure`) tem regra própria e caso a caso pode conflitar com
 *     decisão de crédito já tomada (ex.: trial zerado em 18/08). Quem decide
 *     estorno é gente, e o estorno vai numa transação explícita e registrada.
 *   - NÃO cria task nova no Kie (nada de retry silencioso gastando dinheiro).
 *
 * Uso:
 *   node _frank/ferramentas/reconciliar_imagem_kie.cjs <generationId>              # ENSAIO
 *   node _frank/ferramentas/reconciliar_imagem_kie.cjs <generationId> --confirmar  # grava
 *   node _frank/ferramentas/reconciliar_imagem_kie.cjs --todas [--confirmar]       # todas as presas
 */
const { supa, r2, s3 } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const TODAS = process.argv.includes("--todas");
const ALVO = process.argv.slice(2).find((a) => !a.startsWith("--"));

const db = supa();
const BUCKET_IMAGENS = () =>
  process.env.R2_BUCKET_IMAGES || process.env.R2_BUCKET_VOICES;

const CT_POR_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** Mesma escolha de extensão do lib/images/finalize.ts. */
function escolherExt(url, contentType) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  const m = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
  const ext = m?.[1]?.toLowerCase();
  return ext && CT_POR_EXT[ext] ? ext : "png";
}

/** Mesma mensagem do friendlyImageError, MENOS a promessa de estorno: esta
 *  ferramenta não estorna, então não pode prometer que estornou. */
function mensagemAmigavel(raw) {
  const base = /fetch failed|internal error|timeout|try again|temporar/i.test(raw)
    ? "O gerador de imagens ficou sobrecarregado e esta geração falhou."
    : "Não foi possível gerar esta imagem.";
  return `${base} Tente de novo — se os créditos não voltarem sozinhos, fale com o suporte.`;
}

async function kieRecordInfo(taskId) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY ausente no frontend/.env.local");
  const res = await fetch(
    `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const raw = await res.text();
  if (!res.ok) throw new Error(`recordInfo HTTP ${res.status}: ${raw.slice(0, 200)}`);
  const j = JSON.parse(raw);
  const d = j.data || {};
  let resultUrls = [];
  try {
    resultUrls = JSON.parse(d.resultJson || "{}").resultUrls || [];
  } catch {
    /* resultJson ausente/inválido — trata como sem resultado */
  }
  return { state: d.state, failCode: d.failCode, failMsg: d.failMsg, resultUrls };
}

async function reconciliar(row) {
  const rot = `${row.id.slice(0, 8)} (${row.status}, task ${row.kie_task_id?.slice(0, 8)})`;
  if (!row.kie_task_id) {
    console.log(`  ⏭️  ${rot}: sem kie_task_id — nada a perguntar ao Kie.`);
    return;
  }

  const info = await kieRecordInfo(row.kie_task_id);
  console.log(`  Kie diz: state=${info.state} failCode=${info.failCode || "-"} urls=${info.resultUrls.length}`);

  if (info.state === "success") {
    const url = info.resultUrls[0];
    if (!url) {
      console.log(`  ⚠️  ${rot}: Kie diz sucesso mas não devolveu URL. Não vou adivinhar — pulei.`);
      return;
    }
    if (!CONFIRMAR) {
      console.log(`  ENSAIO: baixaria ${url.slice(0, 80)}… e marcaria ready.`);
      return;
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`download do resultado falhou: HTTP ${res.status}`);
    const ct = res.headers.get("content-type");
    const ext = escolherExt(url, ct);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`resultado suspeito: só ${bytes.length} bytes`);
    const key = `${row.user_id}/images/${row.id}/result.${ext}`;

    await r2().send(
      new s3.PutObjectCommand({
        Bucket: BUCKET_IMAGENS(),
        Key: key,
        Body: bytes,
        ContentType: CT_POR_EXT[ext] ?? "image/png",
      }),
    );
    // prova de que o objeto existe DEPOIS de gravar (linha no banco não é prova)
    await r2().send(new s3.HeadObjectCommand({ Bucket: BUCKET_IMAGENS(), Key: key }));

    const { data, error } = await db
      .from("image_generations")
      .update({ status: "ready", image_path: key, error_message: null })
      .eq("id", row.id)
      .in("status", ["pending", "generating"])
      .select("id, status, image_path");
    if (error) throw new Error(`UPDATE falhou: ${error.message}`);
    console.log(`  ✅ ${rot}: READY. ${bytes.length} bytes no R2 (${key}). Linhas afetadas: ${(data ?? []).length}`);
    return;
  }

  if (info.state === "fail") {
    const raw = info.failMsg || info.failCode || "geração falhou";
    if (!CONFIRMAR) {
      console.log(`  ENSAIO: marcaria failed com "${raw.slice(0, 80)}". NÃO estornaria crédito (de propósito).`);
      return;
    }
    const { data, error } = await db
      .from("image_generations")
      .update({
        status: "failed",
        error_message: mensagemAmigavel(raw).slice(0, 500),
        kie_raw_error: raw.slice(0, 1000),
      })
      .eq("id", row.id)
      .in("status", ["pending", "generating"])
      .select("id, status");
    if (error) throw new Error(`UPDATE falhou: ${error.message}`);
    console.log(`  ✅ ${rot}: FAILED gravado. Linhas afetadas: ${(data ?? []).length}. Crédito NÃO tocado.`);
    return;
  }

  console.log(`  ⏳ ${rot}: Kie ainda diz "${info.state}" — segue viva, não mexi.`);
}

(async () => {
  console.log(`# reconciliar_imagem_kie — ${CONFIRMAR ? "EXECUÇÃO" : "ENSAIO (nada será gravado)"}`);

  let rows;
  if (TODAS) {
    const { data, error } = await db
      .from("image_generations")
      .select("id, user_id, status, kie_task_id, created_at")
      .in("status", ["pending", "generating"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(`SELECT falhou: ${error.message}`);
    rows = data ?? [];
  } else {
    if (!ALVO) {
      console.error("uso: reconciliar_imagem_kie.cjs <generationId> [--confirmar] | --todas [--confirmar]");
      process.exit(1);
    }
    const { data, error } = await db
      .from("image_generations")
      .select("id, user_id, status, kie_task_id, created_at")
      .eq("id", ALVO)
      .select();
    if (error) throw new Error(`SELECT falhou: ${error.message}`);
    rows = data ?? [];
    if (rows.length === 0) throw new Error(`geração ${ALVO} não existe — não vou dar UPDATE em id inexistente`);
  }

  console.log(`# ${rows.length} row(s) presa(s)\n`);
  for (const row of rows) {
    const idade = ((Date.now() - new Date(row.created_at).getTime()) / 3600000).toFixed(1);
    console.log(`- ${row.id} · ${row.status} · ${idade}h`);
    try {
      await reconciliar(row);
    } catch (e) {
      console.error(`  ❌ ${row.id}: ${e.message}`);
    }
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
