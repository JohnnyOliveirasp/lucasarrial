/**
 * Fechamento e REABERTURA de incidente — o único lugar do app que decide o que
 * acontece com `resolved_at` / `resolved_by` / `resolved_commit` quando o
 * status muda.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE (leia antes de escrever o sétimo conserto)
 *
 * Esta família de bug já foi "consertada" seis vezes, sempre do mesmo jeito:
 * alguém acha UM caminho de escrita, corrige aquele caminho na mão, e meses
 * depois aparece outro caminho que ninguém lembrou.
 *
 *   1. 981f2fb  rotas só gravavam resolved_at em 'fixed', nunca em 'ignored'
 *   2. ce25390  ingest fechava sem resolved_by
 *   3. b06343c  reabertura MANUAL não limpava os campos
 *   4. 490690b  anotar_incidente.cjs guardava a data do fechamento antigo
 *   5. (—)      ferramentas em _frank/ não gravavam os campos
 *   6. ESTE     reabertura AUTOMÁTICA (reportar.ts) não limpava
 *
 * O padrão não é descuido. É que a garantia estava na DISCIPLINA de quem
 * escreve, e sempre existe um caminho que ninguém lembrou. Duas provas
 * medidas em 02/09 de que disciplina por chamador não segura:
 *
 *   · o conserto (3) escreveu a limpeza INLINE e DUPLICADA em duas rotas;
 *     `entregar.ts` copiou o padrão mas esqueceu o terceiro campo —
 *     limpa resolved_at e resolved_by e deixa `resolved_commit` órfão.
 *     Resultado vivo no banco: 4 incidentes (#171, #192, #202, #226) em
 *     'investigating' carregando resolved_commit de um fechamento que já
 *     foi desfeito.
 *   · o helper proposto na branch feat/incidents-resolved-at (não mergeada)
 *     também cobria só DOIS dos três campos — ou seja, até a tentativa de
 *     centralizar herdou o mesmo ponto cego.
 *
 * Por isso: quem mexe em status passa por aqui, e o backstop de verdade é o
 * trigger do banco (scripts/102_incidents_resolved_guard.sql — NÃO aplicado,
 * depende de aval do Johnny), que cobre também os ~70 scripts ad-hoc em
 * _Bugs/ e _frank/ que escrevem com service-role e nunca vão importar deste
 * arquivo.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Status que significam "incidente fechado" (terminais). */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set(["fixed", "ignored"]);

/** Os três campos que descrevem um fechamento. Mudou um, mudaram todos. */
export type CamposFechamento = {
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_commit: string | null;
};

/** O que o fechamento grava. `resolved_commit` fica de fora quando o chamador
 *  não informou commit — ver a ressalva em `closureFields`. */
export type CamposAoFechar = {
  resolved_at: string;
  resolved_by: string;
  resolved_commit?: string | null;
};

/**
 * A limpeza da REABERTURA — os TRÊS campos, sempre juntos.
 *
 * Um incidente que voltou pra open/investigating/fixing não pode continuar
 * carregando o carimbo do fechamento anterior: o registro passa a afirmar
 * duas coisas ao mesmo tempo (aberto E resolvido), e o detector de zumbi
 * mede em cima disso.
 *
 * Espalhe no update que reabre:
 *
 *   .update({ status: "open", ...limparFechamento() })
 *
 * Não aceita argumento de propósito: não existe reabertura que deva preservar
 * um dos campos. Foi exatamente o "só esses dois" que deixou os 4 órfãos.
 */
export function limparFechamento(): CamposFechamento {
  return { resolved_at: null, resolved_by: null, resolved_commit: null };
}

/**
 * Os campos que acompanham uma troca de status deliberada:
 *
 *   · fixed/ignored          → carimbo preenchido;
 *   · qualquer outro status  → carimbo limpo (ver `limparFechamento`).
 *
 * Espalhe no update/insert:
 *
 *   .update({ status, ...closureFields(status, g.auth.email) })
 *
 * ⚠️ Só use quando a escrita É uma troca de status deliberada. Um bump de
 * ocorrência que MANTÉM o status de um incidente já fechado não deve passar
 * por aqui — recarimbaria a data de um fechamento histórico, e data inventada
 * é pior que campo vazio.
 *
 * `at` existe pro caso do incidente que já nasce fechado, onde o momento do
 * fechamento é o da ocorrência e não o de agora.
 *
 * ⚠️ `commit` é OPCIONAL e, quando não informado, `resolved_commit` sai de
 * fora do objeto em vez de virar `null`. É deliberado: as rotas montam o
 * patch lendo `resolved_commit` do corpo da requisição ANTES de espalhar
 * estes campos, e forçar `null` aqui apagaria o commit que o chamador acabou
 * de informar. Na REABERTURA é o oposto — lá o campo tem que ser limpo
 * sempre, e por isso `limparFechamento()` devolve os três.
 */
export function closureFields(
  status: string,
  resolvedBy: string,
  at?: string,
  commit?: string | null,
): CamposFechamento | CamposAoFechar {
  if (!CLOSED_STATUSES.has(status)) return limparFechamento();
  return {
    resolved_at: at ?? new Date().toISOString(),
    resolved_by: resolvedBy,
    ...(commit === undefined ? {} : { resolved_commit: commit }),
  };
}
