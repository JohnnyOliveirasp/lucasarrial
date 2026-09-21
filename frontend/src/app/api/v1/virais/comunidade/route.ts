/**
 * /api/v1/virais/comunidade — o acervo de virais que os ALUNOS enviaram.
 *
 *   GET    ?meus=1&pagina=2 → lista (todos, ou só os meus envios)
 *   DELETE ?id=…&motivo=…   → tira do ar (ADMIN); a linha nunca é apagada
 *
 * Aberto a qualquer aluno logado de propósito: o acervo é coletivo, essa é a
 * ideia do produto. A tela de garimpo da casa (/app/lab/virais) continua
 * admin-only e lê outra coisa.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, forbidden, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { isAdmin } from "@/lib/admin/guard";
import { listarComunidade } from "@/lib/virais/comunidade";

export const dynamic = "force-dynamic";

const POR_PAGINA = 24;

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const params = new URL(request.url).searchParams;
  const pagina = Math.max(1, Number(params.get("pagina") ?? 1) || 1);
  const apenasMeus = params.get("meus") === "1";

  try {
    const { videos, total } = await listarComunidade(getAdmin(), {
      userId: auth.user_id,
      apenasMeus,
      limite: POR_PAGINA,
      offset: (pagina - 1) * POR_PAGINA,
    });
    return jsonOk({ videos, total, pagina, porPagina: POR_PAGINA });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao listar os virais");
  }
}

/**
 * Remoção — só admin. É o ÚNICO freio do acervo (não há fila de aprovação),
 * então ela não apaga a linha: guarda quem removeu, quando e por quê, e o
 * vídeo some da vitrine. Reenviar o mesmo link não ressuscita (ver /enviar).
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await isAdmin(auth.email))) return forbidden("Só a equipe remove vídeo do acervo");

  const params = new URL(request.url).searchParams;
  const id = (params.get("id") ?? "").trim();
  if (!id) return badRequest("Informe o id do vídeo");
  const motivo = (params.get("motivo") ?? "").trim() || null;

  const { error } = await getAdmin()
    .from("viral_videos")
    .update({
      removido_em: new Date().toISOString(),
      removido_por: auth.email ?? auth.user_id,
      removido_motivo: motivo,
      publico: false,
    })
    .eq("id", id);
  if (error) return serverError(error.message);

  return jsonOk({ ok: true });
}
