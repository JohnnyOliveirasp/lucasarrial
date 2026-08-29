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
import { sendSupportMail } from "@/lib/agent/mail-smtp";

export const CODIGO_VALIDADE_MIN = 15;
export const CODIGO_MAX_TENTATIVAS = 5;

export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo.trim()).digest("hex");
}

export async function enviarCodigo(email: string, codigo: string, nome?: string | null): Promise<void> {
  const ola = nome ? `Oi, ${nome.split(" ")[0]}!` : "Oi!";
  await sendSupportMail({
    to: email,
    subject: `${codigo} é o seu código do Sistema de Geração Pronto`,
    text:
      `${ola}\n\n` +
      `Seu código de confirmação é:\n\n    ${codigo}\n\n` +
      `Digite ele na tela pra continuar a configuração do seu clone. ` +
      `O código vale ${CODIGO_VALIDADE_MIN} minutos.\n\n` +
      `Se não foi você que pediu, pode ignorar este e-mail.\n\n` +
      `— Equipe FastCloner`,
  });
}
