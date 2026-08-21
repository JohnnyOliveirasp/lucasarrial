/**
 * Bug bea487b7 (20/08) — a mensagem de saldo que MENTE depois do pagamento.
 *
 * O treino automático do onboarding (lib/onboarding/treino.ts) grava em
 * voices.error_message um RETRATO do saldo daquele momento: "Treinar a voz
 * custa 10.000 créditos e você tem 0. Assine ou recarregue e clique em
 * Treinar." Quando o crédito entra DEPOIS (subscription_grant), nada limpa a
 * frase — o servidor nunca recusou o treino (o gate do start-training lê o
 * saldo AO VIVO e ao reservar a voz já grava error_message: null), mas o
 * aluno pagante lê o saldo velho e acha que está bloqueado (casos de 58h e
 * ~63h parado em awaiting_training).
 *
 * Correção SEM backfill: a mensagem de saldo insuficiente só sai pro cliente
 * se o saldo AO VIVO ainda for menor que TRAINING_CREDIT_COST. Equipe/admin
 * (bypassesBilling) nunca vê essa mensagem. Qualquer outra error_message
 * (ex.: fala insuficiente) passa intacta. Nada é escrito no banco — é filtro
 * de leitura, aplicado nas rotas GET /api/v1/voices e /api/v1/voices/[id].
 */
import { bypassesBilling } from "@/lib/credits/access";
import { getBalance } from "@/lib/credits/service";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";

/**
 * Prefixo estável da frase gravada por lib/onboarding/treino.ts — se a
 * redação de lá mudar, este prefixo tem que mudar junto (comentário cruzado
 * nos dois arquivos).
 */
const PREFIXO_MSG_SALDO = "Treinar a voz custa";

/** A error_message é a mensagem de saldo insuficiente do onboarding? */
export function ehMensagemDeSaldo(msg: string | null | undefined): boolean {
  return typeof msg === "string" && msg.startsWith(PREFIXO_MSG_SALDO);
}

/**
 * O saldo AO VIVO já cobre o treino (ou o usuário não é cobrado)?
 * Se sim, a mensagem de saldo velha deve ser OMITIDA da resposta.
 * Só consulte quando ehMensagemDeSaldo() for true — evita uma query de
 * profiles em toda leitura de voz.
 */
export async function saldoVivoCobreTreino(
  userId: string,
  email: string | null,
): Promise<boolean> {
  if (bypassesBilling(email)) return true;
  const bal = await getBalance(userId);
  return bal.total >= TRAINING_CREDIT_COST;
}
