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
  FILTRO_PADRAO,
  listarAcervo,
  listarTemas,
  normalizarOrdem,
} from "@/lib/virais/acervo";
import { descartar, descartarNaoReservados, reservar } from "@/lib/virais/pessoal";

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
    const admin = getAdmin();
    // As fichas de tema vêm junto: a tela precisa delas em toda carga e o
    // agrupamento é uma query só (função virais_temas, migração 74).
    const [videos, temas] = await Promise.all([
      listarAcervo(
        admin,
        {
          ...FILTRO_PADRAO,
          minLikes: inteiro("min_likes", 0),
          dias: inteiro("dias", 0),
          limite: inteiro("limite", FILTRO_PADRAO.limite),
          termo: (p.get("termo") ?? "").trim().slice(0, 60),
          tema: (p.get("tema") ?? "").trim().slice(0, 120),
          ordem: normalizarOrdem(p.get("ordem")),
          // `meus=1` é a tela "Meus Virais": só o que EU reservei.
          apenasReservados: p.get("meus") === "1" || p.get("selecionados") === "1",
        },
        gate.auth.user_id,
      ),
      listarTemas(admin).catch(() => []),
    ]);
    return jsonOk({
      total: videos.length,
      reservados: videos.filter((v) => v.reservado).length,
      temas,
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

  // Seleção múltipla (estilo caixa de e-mail): descarta exatamente o que veio.
  // Descarte é PESSOAL (mig 75): some da MINHA grade, fica na dos outros.
  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (ids.length === 0) return badRequest("Nenhum vídeo selecionado.");
    try {
      return jsonOk({ apagados: await descartar(getAdmin(), gate.auth.user_id, ids) });
    } catch (e) {
      console.error("[virais/apagar]", e instanceof Error ? e.message : e);
      return serverError("Não consegui apagar agora.");
    }
  }

  const termo =
    body.escopo === "termo" && typeof body.termo_busca === "string"
      ? body.termo_busca.trim()
      : null;

  try {
    const apagados = await descartarNaoReservados(getAdmin(), gate.auth.user_id, termo);
    return jsonOk({ apagados });
  } catch (e) {
    console.error("[virais/limpar]", e instanceof Error ? e.message : e);
    return serverError("Não consegui limpar agora.");
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { id?: unknown; reservado?: unknown; selecionado?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return badRequest("Faltou o id do vídeo.");
  // `selecionado` é o nome antigo do mesmo gesto — aceito pra não quebrar
  // aba aberta com a versão anterior da tela.
  const reservado = body.reservado === true || body.selecionado === true;

  try {
    await reservar(getAdmin(), gate.auth.user_id, id, reservado);
    return jsonOk({ id, reservado });
  } catch (e) {
    console.error("[virais/reservar]", e instanceof Error ? e.message : e);
    return serverError("Não consegui salvar.");
  }
}
