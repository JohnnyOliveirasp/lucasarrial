/**
 * Quem pode usar o HeyGen (ordem do Johnny 21/09): NINGUÉM além da equipe.
 * O produto saiu do menu do aluno e voltou pra PRÉ-PRODUÇÃO — a página e as
 * rotas passam pelo mesmo portão, senão sobraria a URL direta.
 *
 * Fica num arquivo só de propósito: no dia em que o HeyGen voltar (ou virar
 * pago), muda aqui e vale pra página e pras 4 rotas de uma vez. Foi assim que
 * ele graduou em 14/08 — e o gate morava espalhado, então a volta atrás teve
 * que caçar ponto por ponto.
 */
import { isAdmin } from "@/lib/admin/guard";

export async function heygenLiberado(email: string | null | undefined): Promise<boolean> {
  return isAdmin(email);
}

/** Frase única da recusa — o aluno não precisa saber o que é pré-produção. */
export const HEYGEN_FECHADO = "O HeyGen não está disponível nesta conta.";
