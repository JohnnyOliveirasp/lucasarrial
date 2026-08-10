/**
 * Gate do Gerador de Roteiro — PRÉ-PRODUÇÃO.
 *
 * Mesmo padrão do Publicador ([[social/access.ts]]): enquanto o Lucas não dá o
 * veredito sobre a qualidade do texto em pt-BR, TUDO (a página e as três rotas)
 * fica restrito a admin. O recurso já está no ar e cobra crédito de verdade —
 * abrir pros 400 antes de alguém ler um roteiro seria descobrir o problema pelo
 * suporte.
 *
 * 👉 GRADUAR: trocar o corpo por `return true` e mover o item do sidebar do
 * bloco de pré-produção pro grupo público. Nada mais precisa mudar.
 */
import { isAdmin } from "@/lib/admin/guard";

export async function roteiroAllowedEmail(email: string | null | undefined): Promise<boolean> {
  return isAdmin(email);
}
