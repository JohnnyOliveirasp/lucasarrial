/**
 * O vocabulário de status de incidente — fonte única.
 *
 * POR QUE ESTE ARQUIVO EXISTE: a lista estava escrita à mão em DUAS rotas
 * (`admin/incidents/[id]` e `agent/actions`) e no `page.tsx` da aba Falhas.
 * Três cópias da mesma verdade significam que um status novo entra numa e não
 * entra na outra — e o sintoma é o pior possível: a tela oferece o botão, a
 * rota devolve "Invalid 'status'", e quem clicou acha que o painel quebrou.
 *
 * ⚠️ MEDIDO EM 04/09 (antes de acrescentar `suporte_necessario`): a coluna
 * `incidents.status` é `text NOT NULL DEFAULT 'open'` e NÃO tem CHECK
 * constraint — as únicas constraints da tabela são `incidents_pkey` e
 * `incidents_categoria_check`. Ou seja: status novo entra SEM migration, e a
 * validação que existe de verdade é esta lista aqui. Se um dia alguém criar o
 * CHECK no banco, ele tem que nascer a partir desta lista.
 */

/** Todos os status que um incidente pode ter. */
export const INCIDENT_STATUSES = [
  "open",
  "investigating",
  "fixing",
  /** A bola está com o ALUNO — volta sozinho quando ele responde (espera.ts). */
  "aguardando_aluno",
  /**
   * "Depende do time de suporte" (pedido do Lucas, 04/09). Não é fechamento e
   * não é espera do aluno: é trabalho HUMANO nosso que está na fila deles.
   * Continua contando como incidente ativo de propósito — o objetivo do pedido
   * era dar uma gaveta pro time, não uma forma de sumir com o caso.
   */
  "suporte_necessario",
  "fixed",
  "ignored",
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

const VALIDOS: ReadonlySet<string> = new Set(INCIDENT_STATUSES);

export function isIncidentStatus(valor: unknown): valor is IncidentStatus {
  return typeof valor === "string" && VALIDOS.has(valor);
}
