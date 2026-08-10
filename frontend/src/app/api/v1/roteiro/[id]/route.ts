/**
 * DELETE /api/v1/roteiro/[id] — apaga um roteiro do histórico do aluno.
 * O filtro por user_id no delete é o que impede apagar roteiro de outro.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { forbidden, jsonOk, notFound, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { roteiroAllowedEmail } from "@/lib/roteiro/access";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await roteiroAllowedEmail(auth.email))) return forbidden("Recurso em pré-produção.");

  const { id } = await params;
  const { data, error } = await getAdmin()
    .from("scripts")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id");

  if (error) return serverError("Não consegui apagar o roteiro.");
  if (!data || data.length === 0) return notFound("Roteiro");
  return jsonOk({ deleted: id });
}
