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
 * pelo caminho novo. Por isso `deveEstornarTreino` decide pelo DÉBITO QUE
 * EXISTE no extrato, não por inferência sobre quem é o aluno.
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
 * Estorna o treino que falhou?
 *
 * SÓ devolve o que de fato saiu. `temDebito` é a existência da linha de débito
 * (`kind='training'`, `ref_type='voice'`, `ref_id=<voiceId>`) no extrato — a
 * mesma linha que `treino.ts` e o `start-training` gravam. Sem linha, não
 * houve cobrança, e "estornar" seria CONCEDER crédito novo.
 *
 * `bypass` fica como segunda trava (cinto e suspensório): equipe não é cobrada,
 * então também não recebe estorno, mesmo que alguma linha antiga exista.
 */
export function deveEstornarTreino(args: {
  bypass: boolean;
  temDebito: boolean;
}): boolean {
  if (args.bypass) return false;
  return args.temDebito;
}
