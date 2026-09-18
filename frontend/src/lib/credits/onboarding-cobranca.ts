/**
 * QUEM PAGA O CLONE QUE A CASA MONTA — regra pura, sem imports.
 *
 * ── O defeito que este arquivo fecha (medido 09/09/2026) ──────────────────
 * O onboarding do SGP debitava da carteira do COMPRADOR o material que a casa
 * entrega como parte do produto: 10.000 (treino de voz, `treino.ts`) + 525
 * (avatar, `avatares.ts`) = **10.525**. Só que comprar o SGP (produto 7283229)
 * NÃO concede crédito nenhum — é regra comercial da casa. O débito caía numa
 * carteira vazia e o saldo ia a **-10.525**. Medidos 12 perfis exatamente
 * nesse estado (-126.300 no total), todos `plan=free`, sem `access_until`.
 *
 * O desenho de 21/08 (migration 88) permitia o negativo DE PROPÓSITO, mas com
 * uma premissa explícita: *"a dívida é descontada sozinha quando os 100k
 * entrarem"*. Na PLANILHA a premissa vale — a linha é de aluno que vai assinar.
 * No SGP ela é falsa: o comprador do SGP pode nunca assinar, e aí a dívida não
 * é um adiantamento, é uma cobrança que nunca se resolve.
 *
 * ── Por que NÃO CONCEDER em vez de não debitar ────────────────────────────
 * A alternativa era creditar 10.525 antes de debitar (saldo final 0, extrato
 * "redondo"). Foi descartada: crédito concedido é crédito GASTÁVEL, e o
 * estorno automático de treino falho (`finalize-training`) devolveria 10.000
 * REAIS a um comprador que não assinou — dando a ele poder de compra que a
 * regra comercial nega. Não debitar mantém o saldo em 0: nem dívida, nem
 * crédito que não deveria existir. É a mudança mínima que corrige o defeito
 * sem abrir um segundo.
 *
 * ── A simetria que não pode quebrar ───────────────────────────────────────
 * Débito e estorno são um PAR. Em 17/08 o Johnny já corrigiu exatamente este
 * erro na direção oposta: o treino era por conta da casa mas o estorno de
 * falha devolvia 10k nunca cobrados. Se agora o SGP para de debitar e o
 * estorno continuar decidindo por `bypassesBilling`, o bug de 17/08 VOLTA
 * pelo caminho novo. Por isso `valorDoEstornoDeTreino` decide pelo EXTRATO —
 * pelo saldo que aquele `ref_id` ainda deve —, não por inferência sobre quem
 * é o aluno.
 */

/** Origem do onboarding. Muda quem paga a conta do material entregue. */
export type OrigemOnboarding =
  /** Planilha (mig 88): aluno vai assinar, dívida é adiantamento. COBRA. */
  | "planilha"
  /** SGP: o comprador já pagou o produto; o clone é entrega nossa. NÃO COBRA. */
  | "sgp";

/**
 * Cobra este onboarding do aluno?
 *
 * Duas razões independentes para NÃO cobrar, e as duas continuam valendo:
 * - `bypass` — equipe/admin nunca paga (allowlist, decisão de 08/06).
 * - origem `sgp` — o material é entrega do produto que ele já comprou.
 */
export function deveCobrarOnboarding(args: {
  origem: OrigemOnboarding;
  bypass: boolean;
}): boolean {
  if (args.bypass) return false;
  return args.origem !== "sgp";
}

/**
 * QUANTO estornar do treino que falhou? (0 = não estorna)
 *
 * ── Por que deixou de ser "existe débito?" (medido 18/09/2026) ────────────
 * Até aqui a pergunta era booleana: *existe uma linha de débito para esta
 * voz?* Ela era escopada por voz (`ref_id`) desde o início — o furo NUNCA foi
 * falta de escopo. O furo era não olhar o que já tinha VOLTADO.
 *
 * A mesma voz pode falhar mais de uma vez: o fluxo de resgate re-executa o
 * treino, e cada falha passa por aqui. Na 1ª falha estorna certo; na 2ª, o
 * débito original AINDA está no extrato (estornar não apaga a linha, acrescenta
 * a linha oposta), então "existe débito" responde `true` de novo e a casa paga
 * o MESMO débito duas vezes. Caso real: voz 600173a6, 18/09 — débito -10.000
 * às 14:43, estorno +10.000 às 14:44, retry falha às 15:31 e sai um SEGUNDO
 * estorno +10.000. Saldo do ref: +10.000 criados do nada.
 *
 * Por isso a pergunta agora é de SALDO, não de existência: some o que saiu com
 * o que já voltou para este `ref_id` e devolva só o que ainda falta. Débito sem
 * estorno → devolve; débito já estornado → saldo 0, devolve NADA; dois débitos
 * e um estorno → devolve só o que ficou pendente.
 *
 * ── O teto, e por que ele existe ──────────────────────────────────────────
 * `teto` (o custo de UMA tentativa) limita quanto uma única falha pode
 * devolver. Cada falha estorna a tentativa dela, não a dívida acumulada da voz
 * inteira: se duas tentativas foram cobradas e as duas falharem, cada passagem
 * por aqui devolve uma. Sem o teto, a primeira falha sozinha limparia as duas.
 *
 * ── O que continua valendo ────────────────────────────────────────────────
 * `bypass` segue como segunda trava (cinto e suspensório): equipe não é
 * cobrada, então também não recebe estorno, mesmo que exista linha antiga.
 * E a simetria de 17/08 continua intacta — quem não foi cobrado tem saldo
 * pendente 0 e recebe 0, que é a mesma resposta de antes.
 *
 * @param saldoPendente Soma algébrica dos lançamentos DESTE `ref_id`: débitos
 *   (negativos) + estornos já lançados (positivos). NEGATIVO = ainda se deve
 *   ao aluno. Zero ou positivo = não há o que devolver.
 * @param teto Custo de uma tentativa; máximo que esta falha pode devolver.
 * @returns Quanto creditar, sempre >= 0. `0` significa NÃO estornar.
 */
export function valorDoEstornoDeTreino(args: {
  bypass: boolean;
  saldoPendente: number;
  teto: number;
}): number {
  if (args.bypass) return 0;
  // Conservador no lixo: número inválido vira "não devo nada". Deixar de
  // devolver o suporte resolve; conceder crédito que nunca saiu ninguém vê.
  if (!Number.isFinite(args.saldoPendente) || args.saldoPendente >= 0) return 0;
  if (!Number.isFinite(args.teto) || args.teto <= 0) return 0;
  const devido = -args.saldoPendente;
  return Math.min(devido, args.teto);
}
