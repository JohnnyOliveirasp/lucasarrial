/**
 * /api/v1/sgp/foto — uma foto da tela 2 do SGP (sem conta: vale a sessão).
 *
 *   POST   { key } → a foto já está no R2; o sistema JULGA (visão) e guarda
 *          ✅/❌ com motivo no pedido. A cópia pras Imagens de Referência
 *          acontece só no "Confirmar e Enviar", quando a conta existe.
 *   DELETE ?key= → tira a foto da lista.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { anexarFoto, mensagemDaRecusaDeFoto, removerFoto } from "@/lib/sgp/anexar";
import { ehRepetida, impressaoDaFoto } from "@/lib/sgp/impressao-foto";
import { julgarFoto } from "@/lib/sgp/julgar-foto";
import { pedidoDaSessaoOuNull } from "@/lib/sgp/sessao";
import { SGP_FOTOS_MAX, type SgpFoto } from "@/lib/sgp/types";

export async function POST(request: NextRequest) {
  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";

  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido?.email_verificado_at) return badRequest("Confirme o seu e-mail na primeira tela.");
    if (!key.startsWith(`sgp/${pedido.sessao}/`)) return badRequest("Essa foto não é deste pedido");
    // ATALHO, NÃO DECISÃO. Estas duas checagens rodam sobre o snapshot que veio
    // do banco e existem só pra não gastar uma chamada paga de visão numa foto
    // que já dá pra recusar agora. Sob concorrência elas FURAM (o snapshot
    // envelhece enquanto a visão responde) — quem decide de verdade é o passo
    // atômico lá embaixo, com a linha travada. Ver #238.
    const atuais = (pedido.fotos ?? []).filter((f) => f.key !== key);
    if (atuais.length >= SGP_FOTOS_MAX) return badRequest(`Máximo de ${SGP_FOTOS_MAX} fotos.`);

    // Foto repetida não vira referência: o modelo aprenderia a mesma pose
    // duas vezes e o aluno acha que entregou 4 ângulos (Johnny 29/08).
    const impressao = await impressaoDaFoto(imagesBucket(), key);
    if (ehRepetida(impressao, atuais)) {
      return badRequest("Você já enviou esta foto. Escolha outra, de um ângulo diferente.");
    }

    const url = await createPresignedGet(imagesBucket(), key, 15 * 60);
    const v = await julgarFoto(url);
    if (v.indeciso) return jsonOk({ foto: null, indeciso: true }, 202);

    const foto: SgpFoto = {
      key,
      status: v.aprovada ? "aprovada" : "reprovada",
      tipo: v.tipo,
      sorrindo: v.sorrindo,
      rosto_visivel: v.rostoVisivel,
      perfil: v.perfil,
      sha256: impressao.sha256,
      dhash: impressao.dhash,
      motivos: v.motivos,
    };
    // O append de verdade: linha travada no Postgres, teto e "repetida"
    // reavaliados sobre o array atual. Recusa aqui vira mensagem, NUNCA
    // descarte silencioso — era exatamente isso que sumia com a foto do aluno.
    const r = await anexarFoto(pedido.sessao, foto, SGP_FOTOS_MAX);
    if (!r.ok) return badRequest(mensagemDaRecusaDeFoto(r.motivo, SGP_FOTOS_MAX));
    return jsonOk({ foto });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao analisar a foto");
  }
}

export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  try {
    const pedido = await pedidoDaSessaoOuNull();
    if (!pedido) return badRequest("Comece pela tela de dados.");
    // Numa instrução só: filtrar em JS e gravar por cima apagaria a foto que um
    // POST concorrente acabou de anexar (#238).
    await removerFoto(pedido.sessao, key);
    return jsonOk({ ok: true });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao remover a foto");
  }
}
