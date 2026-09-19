/**
 * Decisão PURA do estorno NO MOMENTO DO DELETE do histórico de imagens
 * (caso cesarsantos.gestor 19/09, geração 508e6d11: -525 cr às 11:08:19Z,
 * queixa às 11:27Z, row apagada, zero estorno).
 *
 * O defeito: o estorno de imagem mora SÓ dentro de `failImageGeneration`, que
 * precisa da row. O DELETE de /api/v1/images hard-deleta sem olhar `status` —
 * então apagar um card em `pending`/`generating` (exatamente o que a pessoa faz
 * pra escapar do spinner) destrói a única linha capaz de devolver o crédito.
 * Pior que o dinheiro preso: some a PROVA de que a casa devia. Depois do delete
 * ninguém distingue "entregou e o aluno limpou a galeria" de "nunca entregou".
 *
 * ⚠️ ESCOPO: daqui pra frente, no instante do delete, onde a informação ainda
 * existe. NADA retroativo. A classe histórica (1.113 débitos image_generation
 * sem row e sem estorno, 317 pessoas, 653.886 cr desde 01/07, medida em 19/09)
 * é, na esmagadora maioria, limpeza legítima de galeria — gente que RECEBEU a
 * imagem e apagou depois. Estornar aquilo em massa seria devolver dinheiro de
 * trabalho entregue.
 *
 * Por que módulo puro, sem NENHUM import: é o padrão da casa (refs-pure.ts,
 * estorno-orfao.ts) — a rota fica só como I/O e a regra roda em
 * `npx tsx --test` sem o alias `@/`, que não resolve em teste.
 */

/** Status possíveis de `image_generations.status` (lib/db/types.ts:18). */
export type StatusImagem = "pending" | "generating" | "ready" | "failed";

export type LinhaParaApagar = {
  id: string;
  /** `status` cru do banco — pode vir nulo/desconhecido em row antiga. */
  status?: string | null;
};

/** Contagem do extrato para UM ref_id, casada por ref_type + ref_id. */
export type ExtratoDoRef = {
  /** Débitos `ref_type='image_generation'`, amount < 0, deste ref_id. */
  debitos: number;
  /**
   * Estornos deste ref_id contados por `ref_type='image_refund'`.
   *
   * ⚠️ NUNCA conte estorno por `kind`: o estorno grava `kind='extra_purchase'`
   * (RPC add_extra_credits). Conferir por `kind` já quase pagou 13 alunos em
   * dobro nesta casa, e já fez a casa dizer a uma aluna que tinha estornado
   * sem ter estornado.
   */
  estornos: number;
};

export type DecisaoAoApagar =
  /** Em voo + débito casado + sem estorno casado: devolve ANTES de apagar. */
  | "estornar_antes_de_apagar"
  /** Em voo + débito casado, mas o estorno já saiu: apaga sem creditar de novo. */
  | "ja_estornado"
  /** Em voo sem débito casado (equipe/admin/bypass): nada a devolver. */
  | "sem_debito"
  /**
   * `ready` (entregue) ou `failed` (já estornado pelo failImageGeneration na
   * hora da falha — finalize.ts:78-110) ou status desconhecido: apaga como
   * sempre apagou, sem tocar em crédito.
   */
  | "apagar_sem_estorno";

/**
 * Em voo = a casa cobrou e ainda não entregou nada. São os dois únicos status
 * que `failImageGeneration` aceita reivindicar (finalize.ts:88), e por isso os
 * únicos em que o crédito continua devido no instante do delete.
 */
export function emVoo(status?: string | null): boolean {
  return status === "pending" || status === "generating";
}

/**
 * Decide o que fazer com UMA row antes de apagá-la.
 *
 * Regras (cartão 19/09):
 *  - só estorna em `pending`/`generating` — `ready`/`failed` seguem como hoje;
 *  - só estorna se houver DÉBITO casado por ref_id (sem débito, nada credita);
 *  - idempotência por CONTAGEM no par (ref_type de estorno, ref_id), o mesmo
 *    mecanismo do refundOriginalDebit (failure-alert.ts:90-96): enquanto
 *    houver mais débitos que estornos, ainda se deve.
 */
export function decidirAoApagar(a: {
  status?: string | null;
  debitos: number;
  estornos: number;
}): DecisaoAoApagar {
  if (!emVoo(a.status)) return "apagar_sem_estorno";
  if (a.debitos <= 0) return "sem_debito";
  if (a.estornos >= a.debitos) return "ja_estornado";
  return "estornar_antes_de_apagar";
}

export type ItemDoPlano = { id: string; decisao: DecisaoAoApagar };

/**
 * Plano do lote inteiro. `extrato` é o que a rota leu do banco, por ref_id;
 * ref_id ausente do mapa = zero débito e zero estorno.
 */
export function planoDeApagar(
  rows: LinhaParaApagar[],
  extrato: Record<string, ExtratoDoRef | undefined>,
): ItemDoPlano[] {
  return rows.map((r) => {
    const e = extrato[r.id] ?? { debitos: 0, estornos: 0 };
    return {
      id: r.id,
      decisao: decidirAoApagar({ status: r.status, debitos: e.debitos, estornos: e.estornos }),
    };
  });
}

/** Ids que precisam de estorno emitido antes de qualquer delete. */
export function idsQuePrecisamEstorno(plano: ItemDoPlano[]): string[] {
  return plano.filter((p) => p.decisao === "estornar_antes_de_apagar").map((p) => p.id);
}

/**
 * Confirmação PÓS-estorno, relida do extrato: o caminho de produção
 * (handleTechFailure) é best-effort e NUNCA lança — ele engole a falha da RPC e
 * volta void. Então "chamei o estorno" não é prova de que o crédito voltou; a
 * prova é a linha de estorno no extrato. Se não voltou, a row NÃO pode ser
 * apagada: melhor o card ficar do que o dinheiro sumir junto com a prova.
 */
export function estornoConfirmado(a: { debitos: number; estornosDepois: number }): boolean {
  return a.estornosDepois >= a.debitos;
}

export type VerificacaoPosEstorno =
  /** Crédito de volta no extrato (ou nada era devido): pode apagar. */
  | "pode_apagar"
  /**
   * A row virou `ready` entre o plano e o estorno: a corrida
   * webhook×poll entregou no último instante e o claim de
   * `failImageGeneration` (finalize.ts:88) voltou vazio de propósito — não há
   * estorno a esperar, porque não há mais nada devido. Apaga como `ready`.
   */
  | "entregue_no_ultimo_instante"
  /** Chamamos o estorno e o crédito NÃO voltou: não apagar, não perder a prova. */
  | "estorno_nao_confirmado";

/**
 * Sem esta releitura de `status`, um card que ficou `ready` no milissegundo
 * entre o plano e o estorno ficaria preso pra sempre: o claim perdido não
 * gera linha de estorno, e a conferência por extrato sozinha leria isso como
 * "estorno falhou" e bloquearia o delete de uma imagem ENTREGUE.
 */
export function conferirDepoisDoEstorno(a: {
  statusAgora?: string | null;
  debitos: number;
  estornosDepois: number;
}): VerificacaoPosEstorno {
  if (a.statusAgora === "ready") return "entregue_no_ultimo_instante";
  return estornoConfirmado({ debitos: a.debitos, estornosDepois: a.estornosDepois })
    ? "pode_apagar"
    : "estorno_nao_confirmado";
}

/**
 * I/O injetado. A ORDEM entre estas chamadas é a regra de dinheiro desta
 * rotina, e por isso ela mora aqui (testada), não na rota: a rota só liga os
 * fios com Supabase/R2 de verdade.
 */
export type PortasDoDelete = {
  /** Débitos e estornos por ref_id. Pode lançar — leitura falha aborta tudo. */
  lerExtrato(refIds: string[]): Promise<Record<string, ExtratoDoRef | undefined>>;
  /**
   * Caminho de PRODUÇÃO do estorno (failImageGeneration → handleTechFailure).
   * Best-effort por contrato: NÃO lança e NÃO promete nada. Quem diz se o
   * crédito voltou é o extrato relido depois.
   */
  estornar(refId: string): Promise<void>;
  /** `status` atual das rows (pega quem virou `ready` na corrida). */
  lerStatusAgora(ids: string[]): Promise<Record<string, string | null | undefined>>;
  /** Destrói de verdade (R2 + banco). Só pode ser chamada com o dinheiro em dia. */
  apagar(ids: string[]): Promise<number>;
};

export type ResultadoDelete =
  | { ok: true; apagados: number; estornados: string[] }
  | { ok: false; motivo: "extrato_ilegivel"; erro: unknown; bloqueados: string[] }
  | { ok: false; motivo: "estorno_nao_confirmado"; erro?: undefined; bloqueados: string[] };

/**
 * O cérebro do DELETE do histórico de imagens.
 *
 * Invariante que este código existe pra garantir: **nenhuma row sai do banco
 * com crédito devido pendurado nela.** Em ordem —
 *   1. quem está em voo (pending/generating) tem o extrato lido;
 *   2. quem tem débito casado e nenhum estorno casado recebe o estorno;
 *   3. o extrato é RELIDO: só a linha de estorno prova que o crédito voltou;
 *   4. se algum não confirmou, NADA é apagado no lote — a segunda tentativa é
 *      segura porque o estorno é idempotente por contagem;
 *   5. só então apaga.
 *
 * `ready`/`failed` nunca passam por estorno: `ready` foi entregue e `failed` já
 * foi estornado por failImageGeneration no instante da falha.
 */
export async function apagarDoHistorico(
  rows: LinhaParaApagar[],
  portas: PortasDoDelete,
): Promise<ResultadoDelete> {
  const todosIds = rows.map((r) => r.id);
  const emVooIds = rows.filter((r) => emVoo(r.status)).map((r) => r.id);
  if (emVooIds.length === 0) {
    return { ok: true, apagados: await portas.apagar(todosIds), estornados: [] };
  }

  let extrato: Record<string, ExtratoDoRef | undefined>;
  try {
    extrato = await portas.lerExtrato(emVooIds);
  } catch (erro) {
    // Sem extrato não dá pra saber se a casa deve. Apagar no escuro é o
    // defeito original; abortar é o comportamento seguro.
    return { ok: false, motivo: "extrato_ilegivel", erro, bloqueados: emVooIds };
  }

  const aEstornar = idsQuePrecisamEstorno(planoDeApagar(rows, extrato));
  if (aEstornar.length === 0) {
    return { ok: true, apagados: await portas.apagar(todosIds), estornados: [] };
  }

  for (const id of aEstornar) await portas.estornar(id);

  let depois: Record<string, ExtratoDoRef | undefined>;
  try {
    depois = await portas.lerExtrato(aEstornar);
  } catch (erro) {
    return { ok: false, motivo: "extrato_ilegivel", erro, bloqueados: aEstornar };
  }
  const statusAgora = await portas.lerStatusAgora(aEstornar);

  const bloqueados = aEstornar.filter(
    (id) =>
      conferirDepoisDoEstorno({
        statusAgora: statusAgora[id],
        debitos: extrato[id]?.debitos ?? 0,
        estornosDepois: depois[id]?.estornos ?? 0,
      }) === "estorno_nao_confirmado",
  );
  if (bloqueados.length > 0) return { ok: false, motivo: "estorno_nao_confirmado", bloqueados };

  return { ok: true, apagados: await portas.apagar(todosIds), estornados: aEstornar };
}
