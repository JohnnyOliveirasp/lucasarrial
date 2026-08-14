/**
 * GET   /api/v1/virais/videos — o acervo de virais (a grade de miniaturas).
 * PATCH /api/v1/virais/videos — marca/desmarca "quero baixar este".
 *
 * Só o marcado desce pro R2 depois; a busca pode trazer centenas e o bucket
 * não pode virar depósito (regra do Johnny 14/08).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  apagarPorIds,
  FILTRO_PADRAO,
  limparAcervo,
  listarAcervo,
  marcarSelecao,
} from "@/lib/virais/acervo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  const p = request.nextUrl.searchParams;
  const inteiro = (chave: string, padrao: number) => {
    const n = Number.parseInt(p.get(chave) ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : padrao;
  };

  try {
    const videos = await listarAcervo(getAdmin(), {
      ...FILTRO_PADRAO,
      minLikes: inteiro("min_likes", 0),
      dias: inteiro("dias", 0),
      limite: inteiro("limite", FILTRO_PADRAO.limite),
      termo: (p.get("termo") ?? "").trim().slice(0, 60),
      apenasSelecionados: p.get("selecionados") === "1",
    });
    return jsonOk({
      total: videos.length,
      selecionados: videos.filter((v) => v.selecionado).length,
      videos,
    });
  } catch (e) {
    console.error("[virais/videos]", e instanceof Error ? e.message : e);
    return serverError("Não consegui carregar os vídeos.");
  }
}

/**
 * DELETE — faxina do acervo. Apaga os NÃO marcados (tudo, ou só de uma busca).
 * O que está marcado nunca sai: é a curadoria do usuário.
 */
export async function DELETE(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { escopo?: unknown; termo_busca?: unknown; ids?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }

  // Seleção múltipla (estilo caixa de e-mail): apaga exatamente o que veio.
  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (ids.length === 0) return badRequest("Nenhum vídeo selecionado.");
    try {
      return jsonOk({ apagados: await apagarPorIds(getAdmin(), ids) });
    } catch (e) {
      console.error("[virais/apagar]", e instanceof Error ? e.message : e);
      return serverError("Não consegui apagar agora.");
    }
  }

  const escopo = body.escopo === "termo" ? "termo" : "nao_marcados";
  const termo = typeof body.termo_busca === "string" ? body.termo_busca.trim() : null;

  try {
    const apagados = await limparAcervo(getAdmin(), escopo, termo);
    return jsonOk({ apagados });
  } catch (e) {
    console.error("[virais/limpar]", e instanceof Error ? e.message : e);
    return serverError("Não consegui limpar agora.");
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { id?: unknown; selecionado?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return badRequest("Faltou o id do vídeo.");
  const selecionado = body.selecionado === true;

  try {
    await marcarSelecao(getAdmin(), id, selecionado, gate.auth.user_id);
    return jsonOk({ id, selecionado });
  } catch (e) {
    console.error("[virais/selecionar]", e instanceof Error ? e.message : e);
    return serverError("Não consegui salvar a seleção.");
  }
}
