/**
 * A CHAVE do canal de aviso da escalação. Módulo puro, sem `@/` e sem import:
 * é o que deixa `node --test` carregar isso direto (lição do PR #159).
 *
 * ⛔ 04/09 — DECISÃO DO LUCAS: o time de suporte passou a analisar os casos
 * DENTRO do FastCloner (painel /admin/agente), então o aviso automático no
 * GRUPO de WhatsApp "FASTCLONER - Suporte" virou RUÍDO e para de sair.
 * O canal não foi apagado: fica atrás de `AGENT_ESCALATION_WHATSAPP`,
 * DESLIGADO por padrão. Se o Lucas ou o Johnny quiserem de volta é trocar um
 * valor no .env, não reescrever código.
 *
 * ⚠️ O QUE ISTO **NÃO** DESLIGA (e desligar seria falha grave):
 *   1. o CHAMADO (`abrirChamadoDaEscalacao`) — é justamente o painel pro qual o
 *      Lucas mandou o time olhar; sem ele o time fica CEGO;
 *   2. o E-MAIL da escalação (suporte@ + Johnny) — sai igual, é o registro;
 *   3. o WhatsApp que a Fast usa pra FALAR COM O ALUNO (waha.ts / provider.ts).
 * O corte é no DESTINATÁRIO do aviso interno de equipe, não no canal.
 *
 * (Histórico do mesmo canal: 24/08 o Johnny já tinha tirado o zap PRIVADO dos 4
 * telefones e concentrado tudo no grupo — ver o cabeçalho de `escalate.ts`.)
 */

/** Liga de volta o aviso de escalação no grupo de WhatsApp do time. */
export const ENV_AVISO_ZAP_ESCALACAO = "AGENT_ESCALATION_WHATSAPP";

type Env = Record<string, string | undefined>;

/** Só um "1/true/on/sim" explícito liga. Ausente, vazio ou lixo = DESLIGADO. */
export function avisoZapDeEscalacaoLigado(env: Env = process.env): boolean {
  return /^(1|true|on|sim)$/i.test((env[ENV_AVISO_ZAP_ESCALACAO] ?? "").trim());
}

/**
 * Aplica a chave sobre a lista de destinos do zap de escalação.
 * Desligado (padrão desde 04/09) → lista VAZIA → o laço de envio não roda.
 */
export function destinosDoAvisoZap(grupos: string[], env: Env = process.env): string[] {
  return avisoZapDeEscalacaoLigado(env) ? grupos : [];
}
