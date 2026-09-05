/**
 * POST   /api/v1/admin/incidents/[id]/aluno-respondido → "já falei com o aluno".
 * DELETE /api/v1/admin/incidents/[id]/aluno-respondido → desfaz (clique errado).
 *
 * O QUE ISTO NÃO FAZ, e é o ponto do pedido do Lucas (04/09): NÃO resolve, NÃO
 * fecha, NÃO muda o status e NÃO esconde o defeito. Grava apenas que UM HUMANO
 * JÁ RESPONDEU O ALUNO — o que tira a linha da fila de ATENDIMENTO e deixa o
 * conserto técnico exatamente onde estava. As duas coisas viviam coladas num
 * botão só ("Marcar corrigido") e por isso o time olhava 24 chamados sem
 * conseguir dar baixa em nenhum.
 *
 * `SUPORTE_OK`: quem fala com o aluno é o time de suporte. Rota de escrita
 * admin-only aqui seria botão que a pessoa vê e não consegue clicar — combina
 * com lib/admin/nav.ts, onde /admin/falhas já é dos dois papéis.
 *
 * SEM MIGRATION, de propósito (regra do Johnny: migration se propõe, não se
 * aplica). A baixa mora em `agent_notes` — jsonb que já existe — como nota com
 * `tipo`. Ver @/lib/incidents/baixa para o desenho e o porquê.
 *
 * ⚠️ LIMITE DECLARADO: `agent_notes` é lido, alterado e reescrito inteiro
 * (mesmo padrão do `add_note` em /api/v1/agent/actions). Duas baixas
 * simultâneas no MESMO chamado podem perder uma das notas. Não foi resolvido
 * aqui porque a correção honesta é fazer o append no banco (jsonb_insert ou
 * tabela própria) e as duas exigem migration — fica registrado como dívida em
 * vez de virar um problema silencioso.
 */
import type { NextRequest } from "next/server";
import { gateAdmin, SUPORTE_OK } from "@/lib/admin/api";
import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  alunoRespondido,
  notaAlunoRespondido,
  notaAlunoRespondidoDesfeito,
  type NotaIncidente,
} from "@/lib/incidents/baixa";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lerNotas(id: string): Promise<NotaIncidente[] | null> {
  const { data } = await getAdmin()
    .from("incidents" as never)
    .select("agent_notes")
    .eq("id", id)
    .maybeSingle();
  const inc = data as unknown as { agent_notes: NotaIncidente[] | null } | null;
  if (!inc) return null;
  return Array.isArray(inc.agent_notes) ? inc.agent_notes : [];
}

async function gravarNotas(id: string, notas: NotaIncidente[]): Promise<string | null> {
  const { error } = await getAdmin()
    .from("incidents" as never)
    .update({ agent_notes: notas } as never)
    .eq("id", id);
  return error?.message ?? null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const { id } = await params;
  if (!UUID.test(id)) return badRequest("Invalid 'id'");

  // `email` é `string | null` no AuthResult. Cai pro user_id em vez de gravar
  // null: baixa sem dono identificável não serve pra quem depois pergunta
  // "quem falou com ele?". Mesmo raciocínio de closureFields.
  const quem = g.auth.email ?? g.auth.user_id;
  const body = await request.json().catch(() => ({}));
  const observacao = typeof body?.nota === "string" ? body.nota.slice(0, 500) : null;

  try {
    const notas = await lerNotas(id);
    if (notas === null) return notFound("Incidente");

    // Clicar duas vezes não vira duas baixas: a segunda não acrescenta nada.
    // Sem isto o chamado acumularia notas idênticas e a data da baixa passaria
    // a ser a do último clique, não a do atendimento de verdade.
    const jaTem = alunoRespondido({ agent_notes: notas });
    if (jaTem) return jsonOk({ ok: true, ja_estava: true, aluno_respondido: jaTem });

    const nota = notaAlunoRespondido({ by: quem, at: new Date().toISOString(), observacao });
    const erro = await gravarNotas(id, [...notas, nota]);
    if (erro) return serverError(erro);

    logger.info("audit", "incidents.aluno_respondido", { by: g.auth.email, incident: id });
    return jsonOk({ ok: true, aluno_respondido: { at: nota.at, by: nota.by } });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao registrar a baixa");
  }
}

/**
 * Desfaz a baixa. NÃO apaga a nota anterior — acrescenta uma nota de
 * "desfeito", e quem vale é a última. Apagar linha de `agent_notes` seria
 * destruir rastro, e baixa sem rastro é o mesmo que não ter baixa.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await gateAdmin(request, SUPORTE_OK);
  if ("res" in g) return g.res;

  const { id } = await params;
  if (!UUID.test(id)) return badRequest("Invalid 'id'");
  const quem = g.auth.email ?? g.auth.user_id;

  try {
    const notas = await lerNotas(id);
    if (notas === null) return notFound("Incidente");
    if (!alunoRespondido({ agent_notes: notas })) return jsonOk({ ok: true, ja_estava: false });

    const nota = notaAlunoRespondidoDesfeito({ by: quem, at: new Date().toISOString() });
    const erro = await gravarNotas(id, [...notas, nota]);
    if (erro) return serverError(erro);

    logger.info("audit", "incidents.aluno_respondido_desfeito", { by: g.auth.email, incident: id });
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao desfazer a baixa");
  }
}
