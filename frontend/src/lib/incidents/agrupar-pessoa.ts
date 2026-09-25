/**
 * AGRUPAMENTO POR PESSOA do painel de Falhas (pedido do Johnny, 24/09).
 *
 * O PROBLEMA QUE ISTO RESOLVE: a tela listava por CHAMADO, então a mesma
 * pessoa aparecia várias vezes e parecia duplicata/bug. Medido em 24/09:
 * 46 pessoas para 104 chamados — foi exatamente o que o Johnny estranhou
 * ("por que o nome dele aparece 2x?"). Palavras dele: "agrupa por PESSOA,
 * com os pedidos dentro de cada uma."
 *
 * REGRAS (as três são deliberadas, não acidente de implementação):
 *
 * 1. A pessoa é o E-MAIL NORMALIZADO (minúsculo, sem espaço nas pontas).
 *    É a mesma chave que já resolveu o problema gêmeo na fila do SGP
 *    (dedupe por pessoa via e-mail minúsculo, medição de 17/09). A grafia
 *    ORIGINAL da primeira aparição é preservada pra tela.
 *
 * 2. NADA SE PERDE. Chamado com N e-mails entra no grupo de CADA uma das N
 *    pessoas — sumir com ele de um dos grupos seria esconder de uma pessoa
 *    um chamado que é dela. Chamado SEM e-mail nenhum vira um grupo solto
 *    de um chamado só (chave null), rendido como a linha de hoje: juntar
 *    todos os sem-e-mail num balaio único colaria casos sem relação.
 *    Consequência honesta: a SOMA dos itens dentro dos grupos pode passar
 *    do total de chamados (compartilhados contam em cada pessoa) — quem
 *    conta chamado conta chamado DISTINTO, nunca a soma dos grupos.
 *
 * 3. A ORDEM vem da lista de entrada. A API já ordena por last_seen_at
 *    desc; o grupo assume a posição do seu chamado MAIS RECENTE (primeira
 *    aparição na entrada), e dentro do grupo os chamados mantêm a ordem
 *    recebida. Sem parse de data aqui: módulo puro não reordena o que a
 *    consulta já ordenou.
 *
 * SEM migration, SEM coluna nova (migrations 104-109 pendentes; regra do
 * Johnny: resolver só na leitura/apresentação). Módulo PURO, zero imports,
 * padrão da casa — os testes moram em agrupar-pessoa.test.ts.
 */

export type IncidenteAgrupavel = {
  id: string;
  affected_emails?: readonly string[] | null;
};

export type GrupoPessoa<T> = {
  /** E-mail normalizado (minúsculo/trim) — ou null: chamado sem e-mail, grupo solto. */
  chave: string | null;
  /** A grafia original da PRIMEIRA aparição, pra tela não gritar em minúsculo forçado. */
  email: string | null;
  /** Os chamados desta pessoa, na ordem em que a entrada os trouxe. */
  incidentes: T[];
};

/** E-mail → chave de pessoa. Vazio/não-string → null (não agrupa por lixo). */
export function chaveEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

export function agruparPorPessoa<T extends IncidenteAgrupavel>(
  incidentes: readonly T[],
): GrupoPessoa<T>[] {
  const grupos: GrupoPessoa<T>[] = [];
  const porChave = new Map<string, GrupoPessoa<T>>();
  for (const inc of incidentes) {
    const emails = Array.isArray(inc.affected_emails) ? inc.affected_emails : [];
    // O mesmo e-mail repetido DENTRO de um chamado não pode duplicar o
    // chamado no grupo da pessoa — deduplicar por chave, por chamado.
    const vistas = new Set<string>();
    let entrouEmAlguem = false;
    for (const raw of emails) {
      const chave = chaveEmail(raw);
      if (!chave || vistas.has(chave)) continue;
      vistas.add(chave);
      entrouEmAlguem = true;
      let g = porChave.get(chave);
      if (!g) {
        g = { chave, email: String(raw).trim(), incidentes: [] };
        porChave.set(chave, g);
        grupos.push(g);
      }
      g.incidentes.push(inc);
    }
    if (!entrouEmAlguem) grupos.push({ chave: null, email: null, incidentes: [inc] });
  }
  return grupos;
}

/**
 * Conferência de conservação: nº de chamados DISTINTOS espalhados nos grupos.
 * Tem que bater com o tamanho da entrada — agrupar não pode virar esconder
 * (regra 3 do pedido). O contador da tela usa CHAMADO DISTINTO, nunca a soma
 * dos grupos (que infla com os compartilhados).
 */
export function totalChamadosDistintos(grupos: readonly GrupoPessoa<IncidenteAgrupavel>[]): number {
  const ids = new Set<string>();
  for (const g of grupos) for (const inc of g.incidentes) ids.add(inc.id);
  return ids.size;
}

/** Quantas PESSOAS identificadas há na tela (grupos soltos sem e-mail ficam de fora). */
export function contarPessoas(grupos: readonly GrupoPessoa<unknown>[]): number {
  return grupos.reduce((n, g) => (g.chave !== null ? n + 1 : n), 0);
}
