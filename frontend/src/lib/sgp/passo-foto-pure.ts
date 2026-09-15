/**
 * Tela 2 do SGP (foto) — as regras PURAS do botão "Continuar".
 *
 * Nasceu do caso amanda.rosaleal@gmail.com (13/09): ela passou o dia com 6
 * fotos aprovadas e o botão cinza, sem UMA linha na tela dizendo o que
 * faltava (faltavam os 5 checkboxes). O contador de fotos já estava verde,
 * então não havia como ela adivinhar.
 *
 * O motivo do bloqueio passa a sair DAQUI, e o `disabled` do botão também —
 * assim a tela não pode dizer uma coisa e o botão fazer outra.
 *
 * NÃO afrouxa nada: as três condições são exatamente as de antes
 * (>= SGP_FOTOS_MIN aprovadas, nada em voo, os 5 itens de CIENCIA_FOTO).
 * A trava de verdade continua no servidor, em api/v1/sgp/foto/concluir.
 */
import { CIENCIA_FOTO, SGP_FOTOS_MIN } from "./types.ts";

export type MotivoBloqueioFoto =
  | { tipo: "ocupado" }
  | { tipo: "fotos"; faltam: number }
  | { tipo: "ciencia"; faltam: number };

export type EstadoPassoFoto = {
  /** Fotos com status "aprovada". */
  aprovadas: number;
  /** Alguma foto ainda subindo ou sendo analisada. */
  ocupado: boolean;
  /** Quantos dos itens de CIENCIA_FOTO estão marcados. */
  ciencia: number;
};

/**
 * Tudo que impede o "Continuar" agora. Lista vazia = pode ir.
 * Devolve TODOS os motivos (falta foto E falta confirmação é um caso real),
 * pra tela não consertar um e descobrir o outro só no clique seguinte.
 */
export function motivosBloqueioFoto({ aprovadas, ocupado, ciencia }: EstadoPassoFoto): MotivoBloqueioFoto[] {
  // Com foto em voo os números ainda vão mudar: dizer "faltam 2 fotos" no
  // meio do upload é uma mentira de meio segundo que assusta o aluno.
  if (ocupado) return [{ tipo: "ocupado" }];
  const motivos: MotivoBloqueioFoto[] = [];
  if (aprovadas < SGP_FOTOS_MIN) motivos.push({ tipo: "fotos", faltam: SGP_FOTOS_MIN - aprovadas });
  if (ciencia < CIENCIA_FOTO.length) motivos.push({ tipo: "ciencia", faltam: CIENCIA_FOTO.length - ciencia });
  return motivos;
}

export function podeContinuarFoto(estado: EstadoPassoFoto): boolean {
  return motivosBloqueioFoto(estado).length === 0;
}

/**
 * Higieniza a lista de ciência que vem de fora (banco ou corpo do request):
 * só itens conhecidos, sem repetição, sempre na ordem de CIENCIA_FOTO.
 *
 * O "sem repetição" importa: sem ele, cinco cópias de "luz" contam como cinco
 * itens marcados.
 */
export function cienciaValida(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const marcados = new Set(raw.filter((c): c is string => typeof c === "string"));
  return CIENCIA_FOTO.filter((c) => marcados.has(c));
}

/**
 * Dá pra gravar o RASCUNHO dos checkboxes por cima de `ciencia_foto`?
 *
 * Só enquanto o pedido está na tela 2 e ninguém registrou a ciência ainda.
 * Depois do /concluir, `ciencia_foto` deixa de ser rascunho e passa a ser o
 * registro do consentimento (o par com `ciencia_foto_at`) — uma volta à tela
 * 2 desmarcando um item não pode reescrever isso.
 */
export function podeGuardarRascunhoCiencia(pedido: { status: string; ciencia_foto_at: string | null }): boolean {
  return pedido.status === "foto" && !pedido.ciencia_foto_at;
}
