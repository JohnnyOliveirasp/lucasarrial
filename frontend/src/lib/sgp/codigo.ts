/**
 * SGP — código de 6 dígitos que prova o e-mail do aluno. Server-only.
 *
 * É NOSSO (sai pelo SMTP do suporte@, em pt-BR), não o do Supabase Auth: no
 * fluxo novo a conta só nasce no fim, então não há usuário pra emitir OTP —
 * e o template "Magic Link" do Supabase mandava um LINK, não o código
 * (foi o que sumiu no teste do Johnny, 29/08).
 *
 * Guardamos só o SHA-256. Vale 15 min e 5 tentativas.
 */
import { createHash, randomInt } from "node:crypto";

export const CODIGO_VALIDADE_MIN = 15;
export const CODIGO_MAX_TENTATIVAS = 5;

export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo.trim()).digest("hex");
}

/**
 * Onde o aluno digita o código. Mesma forma do `siteUrl()` de
 * `lib/payments/sgp-boas-vindas-canal.ts`: lê a config e CAI NUM PADRÃO.
 *
 * ⚠️ O fallback é o ponto todo (incidente #365). `linkDeRetomada`
 * (`lib/sgp/retomada.ts`) faz o OPOSTO — devolve `null` sem config — e lá está
 * certo: é link assinado que o suporte cola à mão, melhor não existir do que
 * sair quebrado. Aqui não: este e-mail é automático e sem o link o aluno fica
 * com um código de 6 dígitos e nenhum lugar pra digitar. Um link pro domínio
 * de produção é sempre melhor que link nenhum.
 */
function urlDoSgp(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://fastcloner.com";
  return `${base.replace(/\/+$/, "")}/sgp`;
}

/** Só o que o `sendSupportMail` precisa — o mínimo pra dar pra injetar no teste. */
export type EnviarEmailDoCodigo = (mensagem: {
  to: string;
  subject: string;
  text: string;
}) => Promise<unknown>;

/**
 * O `sendSupportMail` entra por `await import` e não por import estático de
 * propósito: ele arrasta o SMTP inteiro pelo alias `@/`, que NÃO resolve em
 * `node --test` — com import no topo o módulo não carrega e o corpo do e-mail
 * fica sem teste nenhum. O parâmetro `enviar` é a costura: produção não passa
 * nada e cai no canal real; o teste passa um espião e nada sai pela rede.
 */
export async function enviarCodigo(
  email: string,
  codigo: string,
  nome?: string | null,
  enviar?: EnviarEmailDoCodigo,
): Promise<void> {
  const ola = nome ? `Oi, ${nome.split(" ")[0]}!` : "Oi!";
  const enviarEmail = enviar ?? (await import("@/lib/agent/mail-smtp")).sendSupportMail;
  await enviarEmail({
    to: email,
    subject: `${codigo} é o seu código do Sistema de Geração Pronto`,
    text:
      `${ola}\n\n` +
      `Seu código de confirmação é:\n\n    ${codigo}\n\n` +
      `Volte para ${urlDoSgp()} e digite o código pra continuar a configuração ` +
      `do seu clone. O código vale ${CODIGO_VALIDADE_MIN} minutos.\n\n` +
      `Se não foi você que pediu, pode ignorar este e-mail.\n\n` +
      `— Equipe FastCloner`,
  });
}
