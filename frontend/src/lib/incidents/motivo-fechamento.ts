/**
 * Motivo de fechamento PARA EXIBIÇÃO — incidente #560 (24/09).
 *
 * O problema: 37 cartões fechados com `resolution_note` vazio. A tentação era
 * um backfill copiando a última `agent_note` pro campo — MEDIDO e RECUSADO:
 * 13 dos 37 têm como última nota uma OBJEÇÃO do Vigia ("discordo deste
 * fechamento, regra 14-A: anoto, não reabro"). Copiar isso pro campo que a
 * tela exibe como O MOTIVO DO FECHAMENTO inverte o sentido do registro, e
 * ninguém desconfia porque a tela parece preenchida.
 *
 * Campo vazio é honesto: diz "ninguém escreveu o porquê". Por isso o conserto
 * é de EXIBIÇÃO, não de dados: quando o motivo não existe mas há anotações,
 * a tela mostra a última anotação COM RÓTULO dizendo que aquilo NÃO é a
 * justificativa do fechamento — é só a última coisa que alguém escreveu.
 * Zero escrita no banco.
 *
 * Usado por: frontend/src/app/[locale]/admin/falhas/page.tsx e
 * src/app/api/v1/agent/health-report/route.ts.
 */

import type { NotaIncidente } from "./baixa";

/** O rótulo é OBRIGATÓRIO — é ele que impede a nota de passar por motivo. */
export const ROTULO_SEM_MOTIVO = "Sem motivo registrado no fechamento.";

const temTexto = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;

/**
 * Última anotação com texto utilizável. Anda de trás pra frente pulando
 * entradas sem `note` (ou com `note` vazio). `agent_notes` corrompido
 * (string em vez de array — já aconteceu, ver anotar_incidente.cjs) ou
 * ausente devolve null: não inventamos nota de lugar nenhum.
 */
export function ultimaNotaComTexto(agentNotes: unknown): NotaIncidente | null {
  if (!Array.isArray(agentNotes)) return null;
  for (let i = agentNotes.length - 1; i >= 0; i--) {
    const n = agentNotes[i] as { note?: unknown } | null;
    if (n && typeof n === "object" && temTexto(n.note)) return n as NotaIncidente;
  }
  return null;
}

/**
 * O texto rotulado que a tela pode exibir no lugar do motivo vazio, ou null
 * quando não há o que exibir (motivo real existe, ou não há nota nenhuma —
 * nesse caso o vazio fica vazio, que é o honesto).
 *
 * `formatarData` deixa cada tela usar o formato dela (o painel usa dt();
 * o health-report fica no ISO cru).
 */
export function fallbackMotivoRotulado(
  resolutionNote: string | null | undefined,
  agentNotes: unknown,
  formatarData: (iso: string) => string = (iso) => iso,
): string | null {
  if (temTexto(resolutionNote)) return null;
  const nota = ultimaNotaComTexto(agentNotes);
  if (!nota) return null;
  const quando = temTexto(nota.at) ? formatarData(nota.at) : "data desconhecida";
  const quem = temTexto(nota.by) ? nota.by : "autor desconhecido";
  return `${ROTULO_SEM_MOTIVO} Última anotação (${quando}, ${quem}): ${nota.note}`;
}

/**
 * O que exibir como motivo do fechamento: o `resolution_note` quando existe;
 * senão o fallback rotulado; senão null (nada a mostrar).
 */
export function motivoFechamentoExibicao(
  resolutionNote: string | null | undefined,
  agentNotes: unknown,
  formatarData?: (iso: string) => string,
): string | null {
  if (temTexto(resolutionNote)) return resolutionNote;
  return fallbackMotivoRotulado(resolutionNote, agentNotes, formatarData);
}
