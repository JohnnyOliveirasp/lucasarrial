/**
 * O DÉBITO DO ONBOARDING FALHOU — regra pura de como isso vira registro.
 *
 * ── Por que este arquivo existe ───────────────────────────────────────────
 * `treino.ts` e `avatares.ts` chamavam `debitCreditsOnboarding` e DESCARTAVAM
 * o retorno (`await debit...({...})`, sem atribuir). A função devolve
 * `{ok:false}` em silêncio quando a RPC erra ou quando o perfil ainda não
 * existe (`no_profile`) — e o material JÁ FOI ENTREGUE antes dessa linha
 * (treino submetido ao RunPod, imagem criada no Kie). Resultado possível:
 * clone entregue, crédito nunca cobrado, NENHUMA linha no razão e nenhum
 * sinal em lugar nenhum.
 *
 * Pior: o `error.message` da RPC era jogado fora inteiro (`if (error) return
 * {ok:false, reason:"error"}`), então nem quem fosse ler o log depois teria o
 * motivo. A falha não deixava rastro nem no razão nem no console.
 *
 * ── O que este arquivo NÃO é ──────────────────────────────────────────────
 * NÃO é o diagnóstico das 16 pessoas com voz `ready` e razão vazio desde
 * 01/09 — essa hipótese foi MEDIDA e é FALSA. As 16 vieram todas do SGP
 * (`sgp_pedidos.voice_id` casa com a voz das 16, 16/16), onde
 * `deveCobrarOnboarding` devolve `false` e `debitCreditsOnboarding` NUNCA é
 * chamada. É a decisão autorizada de 09/09 funcionando, não um débito
 * perdido. Medição em `_frank/prova/2026-09-14_debito_onboarding_fire_and_forget.md`:
 * 61 vozes SGP desde 01/09, corte exato no deploy do PR #228 (10/09 12:46Z) —
 * 27 antes (26 debitadas + 1 da allowlist), 34 depois (0 debitadas). Zero
 * casos inexplicados.
 *
 * Este arquivo fecha o buraco de OBSERVABILIDADE que a investigação
 * encontrou de passagem. Hoje o único caminho que chega a debitar é o da
 * PLANILHA (`origem: "planilha"` → `billed: true`), e ele está parado desde
 * 29/08 (última linha em `onboarding_runs`: 2026-08-29 23:02Z). Ou seja: é
 * conserto PREVENTIVO, não sangramento em curso. Se a planilha voltar a
 * rodar, a falha grita em vez de sumir.
 *
 * ── Por que só registrar, e não desfazer ──────────────────────────────────
 * Quando o débito falha, o material já saiu. Cancelar o treino puniria o
 * aluno por um erro de contabilidade nosso, e estornar/recobrar por fora
 * seria mexer em saldo — coisa que ninguém faz sem o Johnny aprovar. O que
 * falta é o SINAL: a dívida existe e ninguém sabe. Registrar é a mudança
 * mínima que resolve o que está de fato quebrado.
 *
 * Regra pura, sem imports, pra poder ser testada — mesmo padrão do
 * `onboarding-cobranca.ts`.
 */

/** Motivo devolvido por `debitCreditsOnboarding` quando não debitou. */
export type MotivoDebitoFalho = "no_profile" | "error";

export type DebitoFalho = {
  userId: string;
  /** Quanto DEVERIA ter sido debitado e não foi. É o tamanho da dívida. */
  amount: number;
  kind: "training" | "image";
  refType?: string | null;
  refId?: string | null;
  reason: MotivoDebitoFalho;
  /**
   * Mensagem crua da RPC/PostgREST, quando houver. Existe porque era
   * exatamente ela que se perdia: sem o detalhe, "error" não diz se foi
   * timeout, permissão ou função ausente, e o log vira ruído.
   */
  detalhe?: string | null;
};

/** Prefixo único do evento — é por ele que se procura no log. */
export const MARCA_DEBITO_FALHO = "[credits] DEBITO DO ONBOARDING NAO ENTROU";

/**
 * Monta a linha de log do débito que não entrou.
 *
 * Contrato (o que os testes travam):
 * - carrega a MARCA, pra ser greppável;
 * - nomeia o material entregue (`kind` + `refType:refId`), pra dar pra achar
 *   QUAL treino/imagem ficou sem cobrança;
 * - carrega o VALOR, que é o tamanho da dívida;
 * - NUNCA engole o `detalhe` da RPC quando ele existe.
 */
export function montarAvisoDebitoFalho(f: DebitoFalho): string {
  const ref = `${f.refType ?? "-"}:${f.refId ?? "-"}`;
  const causa =
    f.reason === "no_profile"
      ? "perfil inexistente no instante do debito"
      : "a RPC debit_credits_onboarding falhou";
  const detalhe = f.detalhe ? ` detalhe=${f.detalhe}` : "";
  return (
    `${MARCA_DEBITO_FALHO}: user=${f.userId} amount=${f.amount} ` +
    `kind=${f.kind} ref=${ref} motivo=${f.reason} (${causa})${detalhe} — ` +
    `o material JA FOI ENTREGUE e nao foi cobrado; a divida existe e nao esta no razao.`
  );
}

/**
 * Resumo curto pro chamador carregar no resultado (`treino.ts`,
 * `avatares.ts`) sem inflar a assinatura. Deliberadamente NÃO vai para o
 * campo `erro` do pedido do SGP: débito é contabilidade interna, e o `erro`
 * do pedido é lido pelas rondas como falha de ENTREGA — um débito falho ali
 * viraria "pedido com erro" para um aluno cujo clone saiu perfeito.
 */
export function resumirDebitoFalho(f: DebitoFalho): string {
  return `debito nao entrou (${f.reason}): ${f.amount} cr de ${f.kind}`;
}
