/**
 * /api/v1/images
 *   GET    → lista as imagens geradas do usuário (com presigned URL do resultado)
 *   DELETE → apaga em lote { ids: string[] } (R2 da referência + resultado + banco)
 *
 * Histórico de imagens. Apagar é irreversível.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  apagarDoHistorico,
  type ExtratoDoRef,
  type ResultadoDelete,
} from "@/lib/images/delete-estorno";
import { failImageGeneration } from "@/lib/images/finalize";
import { chavesApagaveisDoHistorico } from "@/lib/images/refs-pure";
import { translatePromptTo } from "@/lib/llm/translate-image-prompt";
import { imagesBucket } from "@/lib/r2/client";
import { deleteKeys } from "@/lib/r2/delete";
import { createPresignedGet } from "@/lib/r2/presigned";

/** Quantas traduções lazy por request (1x por imagem; o resto vem na próxima). */
const TRANSLATE_CAP = 8;

/** ref_type do débito de imagem no extrato (generate/route.ts:291). */
const REF_TYPE_DEBITO = "image_generation";
/**
 * ref_type do estorno de imagem (finalize.ts:108 e :150). É a chave de
 * idempotência — NUNCA usar `kind`, que no estorno grava "extra_purchase".
 */
const REF_TYPE_ESTORNO = "image_refund";

/**
 * Falha da destruição em si (R2 ou banco), já depois do dinheiro resolvido.
 * Sobe como exceção porque a porta `apagar` devolve contagem, não resultado —
 * e é a última etapa, então subir não pula nenhuma garantia de crédito.
 */
class FalhaAoApagar extends Error {}

/**
 * Lê o extrato dos ref_ids pedidos e devolve, por ref_id, quantos débitos de
 * geração e quantos estornos existem. É a única fonte de verdade tanto da
 * dívida quanto da idempotência (mesmo par ref_type+ref_id do
 * refundOriginalDebit, failure-alert.ts:78-96).
 *
 * Lança se a leitura falhar: sem extrato não dá pra saber se a casa deve, e
 * apagar no escuro é exatamente o defeito que este caminho existe pra curar.
 */
async function lerExtrato(
  admin: ReturnType<typeof getAdmin>,
  userId: string,
  refIds: string[],
): Promise<Record<string, ExtratoDoRef>> {
  const mapa: Record<string, ExtratoDoRef> = {};
  if (refIds.length === 0) return mapa;
  const toca = (id: string): ExtratoDoRef => (mapa[id] ??= { debitos: 0, estornos: 0 });

  const { data: debitos, error: errD } = await admin
    .from("credit_transactions")
    .select("ref_id")
    .eq("user_id", userId)
    .eq("ref_type", REF_TYPE_DEBITO)
    .in("ref_id", refIds)
    .lt("amount", 0);
  if (errD) throw new Error(`extrato (débitos): ${errD.message}`);

  const { data: estornos, error: errE } = await admin
    .from("credit_transactions")
    .select("ref_id")
    .eq("user_id", userId)
    .eq("ref_type", REF_TYPE_ESTORNO)
    .in("ref_id", refIds);
  if (errE) throw new Error(`extrato (estornos): ${errE.message}`);

  for (const r of (debitos ?? []) as { ref_id: string | null }[]) {
    if (r.ref_id) toca(r.ref_id).debitos++;
  }
  for (const r of (estornos ?? []) as { ref_id: string | null }[]) {
    if (r.ref_id) toca(r.ref_id).estornos++;
  }
  return mapa;
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  // Idioma da página (?lang=pt|en|es): o prompt exibido acompanha (pedido
  // Johnny 06/08 — a pessoa copia o prompt pra regerar no idioma dela).
  const langParam = request.nextUrl.searchParams.get("lang") ?? "pt";
  const lang: "pt" | "en" | "es" = langParam === "en" ? "en" : langParam === "es" ? "es" : "pt";

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("image_generations")
    .select(
      "id, name, prompt, prompt_en, prompt_es, aspect_ratio, resolution, credits_cost, image_path, status, error_message, created_at, video_status, video_path, video_tier, video_prompt_pt, video_error, kie_model",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list images");

  // Tradução preguiçosa com cache no banco: traduz UMA vez e reaproveita.
  let translateBudget = TRANSLATE_CAP;
  async function promptFor(g: {
    id: string;
    prompt: string;
    prompt_en: string | null;
    prompt_es: string | null;
  }): Promise<string> {
    if (lang === "pt") return g.prompt;
    const cached = lang === "en" ? g.prompt_en : g.prompt_es;
    if (cached) return cached;
    if (translateBudget <= 0) return g.prompt;
    translateBudget--;
    const translated = await translatePromptTo(lang, g.prompt);
    if (translated && translated !== g.prompt) {
      await admin
        .from("image_generations")
        .update(lang === "en" ? { prompt_en: translated } : { prompt_es: translated })
        .eq("id", g.id);
    }
    return translated;
  }

  const items = await Promise.all(
    (rows ?? []).map(async (g) => {
      let image_url: string | null = null;
      if (g.status === "ready" && g.image_path) {
        try {
          image_url = await createPresignedGet(imagesBucket(), g.image_path, 60 * 60);
        } catch {
          image_url = null;
        }
      }
      let video_url: string | null = null;
      if (g.video_status === "ready" && g.video_path) {
        try {
          video_url = await createPresignedGet(imagesBucket(), g.video_path, 60 * 60);
        } catch {
          video_url = null;
        }
      }
      return {
        id: g.id,
        name: g.name,
        prompt: g.prompt,
        // Prompt no idioma da página (copiável pra regerar).
        prompt_display: await promptFor(g),
        aspect_ratio: g.aspect_ratio,
        resolution: g.resolution,
        credits_cost: g.credits_cost,
        status: g.status,
        error_message: g.error_message,
        created_at: g.created_at,
        image_url,
        // Chave R2 do resultado — "usar como referência" no estúdio (29/07).
        image_path: g.status === "ready" ? g.image_path : null,
        // Johnny 13/08: histórico é só de GERADAS — o front usa isto pra
        // esconder uploads (kie_model === "upload") do card de histórico.
        kie_model: g.kie_model,
        video_status: g.video_status,
        video_tier: g.video_tier,
        video_prompt_pt: g.video_prompt_pt,
        video_error: g.video_error,
        video_url,
      };
    }),
  );

  return jsonOk({ images: items });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { ids?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* sem body */
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return badRequest("Nenhuma imagem selecionada");

  const admin = getAdmin();
  const { data: rows, error } = await admin
    .from("image_generations")
    // `status` e `credits_cost` entram aqui por DINHEIRO (caso
    // cesarsantos.gestor 19/09): sem `status` este DELETE apagava a row em voo
    // — a única capaz de devolver o crédito — sem devolver nada.
    .select("id, status, credits_cost, input_image_path, input_image_paths, image_path, video_path")
    .eq("user_id", auth.user_id)
    .in("id", ids);
  if (error) return serverError("Failed to load images");
  const found = rows ?? [];
  if (found.length === 0) return jsonOk({ deleted: 0 });

  // ── Dinheiro ANTES de destruir qualquer coisa ────────────────────────────
  // Apagar um card em pending/generating é o que a pessoa faz pra escapar do
  // spinner. Isso destrói a row que failImageGeneration usaria pra estornar e,
  // junto, a PROVA de que a casa devia. A ORDEM (estorna → confere no extrato →
  // só então apaga) mora em apagarDoHistorico, testada; aqui é só o I/O real.
  // Nada retroativo: só o que passa por este caminho daqui pra frente.
  let resultado: ResultadoDelete;
  try {
    resultado = await apagarDoHistorico(found, {
      lerExtrato: (refIds) => lerExtrato(admin, auth.user_id, refIds),

      // Caminho de PRODUÇÃO, não regra nova: failImageGeneration reivindica a
      // row (pending/generating → failed, atômico) e chama handleTechFailure com
      // o par image_generation/image_refund. O claim é o que fecha a corrida com
      // o webhook/poll — sem ele, duas vias estornariam o mesmo débito. Claim
      // vazio = quem ganhou já tratou.
      estornar: (refId) =>
        failImageGeneration(
          refId,
          "[card apagado do histórico com a geração em voo] o aluno desistiu da espera e apagou " +
            "o card; a casa cobrou e não entregou, então o crédito volta antes de a row (e a " +
            "prova da cobrança) sumir.",
        ),

      lerStatusAgora: async (idsPedidos) => {
        const { data } = await admin
          .from("image_generations")
          .select("id, status")
          .eq("user_id", auth.user_id)
          .in("id", idsPedidos);
        const mapa: Record<string, string | null> = {};
        for (const r of (data ?? []) as { id: string; status: string | null }[]) {
          mapa[r.id] = r.status;
        }
        return mapa;
      },

      apagar: async (idsParaApagar) => {
        try {
          // Resultado + vídeo + inputs de staging, NUNCA `{user}/refs/`
          // (incidente 1970fcaa 22/08: as gerações gravam como input a chave
          // adotada em refs/, compartilhada por outras gerações e pela
          // referência fixa do estúdio — apagar UMA geração do histórico matava
          // a foto de todas as outras).
          // Só as chaves das rows que REALMENTE vão sair (hoje o lote é tudo ou
          // nada; amarrar ao argumento evita que um futuro delete parcial apague
          // o R2 de card que ficou no banco).
          const aSair = new Set(idsParaApagar);
          const keys = chavesApagaveisDoHistorico(
            auth.user_id,
            found.filter((r) => aSair.has(r.id)),
          );
          if (keys.length) await deleteKeys(imagesBucket(), keys);
        } catch (e) {
          throw new FalhaAoApagar(e instanceof Error ? `R2: ${e.message}` : "R2 cleanup failed");
        }
        const { error: dErr } = await admin
          .from("image_generations")
          .delete()
          .eq("user_id", auth.user_id)
          .in("id", idsParaApagar);
        if (dErr) throw new FalhaAoApagar("Failed to delete images");
        return idsParaApagar.length;
      },
    });
  } catch (e) {
    // Só a porta `apagar` lança (apagarDoHistorico trata o resto internamente),
    // e ela é a ÚLTIMA etapa: o estorno já saiu e já foi conferido.
    if (e instanceof FalhaAoApagar) return serverError(e.message);
    throw e;
  }

  if (!resultado.ok) {
    if (resultado.motivo === "extrato_ilegivel") {
      console.error("[images:delete] extrato ilegível, delete abortado:", resultado.erro);
      return serverError("Não foi possível conferir os créditos desta geração. Tente de novo.");
    }
    // Lote inteiro abortado, nada apagado: a segunda tentativa é segura (o
    // estorno é idempotente por contagem, quem já voltou não volta de novo).
    // Melhor o card ficar do que o dinheiro sumir junto com a prova.
    console.error(
      `[images:delete] ESTORNO NÃO CONFIRMADO — delete abortado. user=${auth.user_id} ` +
        `ids=${resultado.bloqueados.join(",")}`,
    );
    // A mensagem que failImageGeneration deixou na row promete "créditos
    // devolvidos automaticamente". Como NÃO foram, corrige o texto: card que
    // mente sobre estorno é como não ter estornado — o aluno não reclama e a
    // casa fica com o dinheiro.
    await admin
      .from("image_generations")
      .update({
        error_message:
          "Esta geração falhou e o estorno automático NÃO saiu. O suporte já foi avisado e vai " +
          "devolver seus créditos na mão. Não apague este card: ele é a prova da cobrança.",
      })
      .eq("user_id", auth.user_id)
      .in("id", resultado.bloqueados);
    return serverError(
      "Não conseguimos devolver os créditos desta geração agora, então não apagamos o card " +
        "(ele é a prova da cobrança). O suporte já foi avisado — tente de novo em alguns minutos.",
    );
  }

  return jsonOk({ deleted: resultado.apagados });
}
