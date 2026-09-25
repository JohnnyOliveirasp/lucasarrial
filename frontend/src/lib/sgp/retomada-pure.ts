/**
 * SGP — RETOMADA pelo e-mail já verificado. Módulo PURO (decisão, sem I/O).
 *
 * O PROBLEMA (medido em 22/09): antes do "Confirmar e Enviar" o dono do
 * pedido é SÓ um uuid num cookie httpOnly de 30 dias (`lib/sgp/sessao.ts`).
 * Trocou de aparelho, limpou o navegador, passou dos 30 dias → o cookie some,
 * `pedidoDaSessao()` abre uma linha NOVA em branco e o material que o aluno
 * já subiu fica inalcançável. 41 e-mails com linha duplicada, 49 linhas
 * extras; 3 alunos encalhados hoje (luzwellington@, jcesaram@,
 * elaineesthetician@). O jcesaram é a prova viva: linha de 10/09 com 4 fotos
 * e linha de 11/09 com 0 — a segunda nasceu do cookie perdido.
 *
 * O CONSERTO: quando o código de 6 dígitos valida um e-mail que JÁ tem pedido
 * em andamento, a tela 1 OFERECE "continuar de onde você parou" e reaponta o
 * cookie para a linha canônica. É seguro porque o aluno acabou de provar
 * posse da caixa com o código — a mesma barra que o fluxo já usa. Nenhuma
 * conta é criada, nenhum portão afrouxa, nenhuma linha é apagada.
 *
 * REGRAS (todas testadas em retomada-pure.test.ts):
 *  - só linha ainda NO WIZARD (dados|foto|audio|revisao) é retomável; linha
 *    'pronto'/'enviado'/'processando'/'falhou' NUNCA é oferecida — quem
 *    terminou e começa outro está começando outro de propósito;
 *  - só linha com e-mail JÁ VERIFICADO (`email_verificado_at`) e SEM conta
 *    (`user_id` null): pedido de conta se retoma com login, não digitando um
 *    e-mail numa tela pública;
 *  - com MAIS DE UMA linha em andamento (caso real do jcesaram), ganha a de
 *    MAIS FOTOS APROVADAS; empate → a mais recente. "Mais recente" sozinho
 *    pegaria exatamente a linha vazia que nasceu do cookie perdido;
 *  - a escolha NUNCA mexe nas linhas: quem reaponta é só o cookie, e a linha
 *    preterida continua existindo.
 */
// Extensão explícita: este módulo é testado por `node --test` (type-stripping
// nativo), que não resolve import sem `.ts`. Mesmo motivo do passo-foto-pure.
import type { SgpStatus } from "./types.ts";

/** O que a decisão precisa saber de cada linha — e nada além disso. */
export type CandidatoRetomada = {
  id: string;
  /** O uuid que o cookie aponta (coluna `sessao`). */
  sessao: string;
  status: SgpStatus;
  /** Fotos com status "aprovada" na linha. */
  fotosAprovadas: number;
  /** ISO de `atualizado_em`. */
  atualizadoEm: string;
  /** ISO de `email_verificado_at`, ou null se nunca verificou. */
  emailVerificadoAt: string | null;
  /** `user_id` — preenchido quando uma conta já assumiu o pedido. */
  userId: string | null;
};

/** O pedido ainda está com o ALUNO preenchendo (dá pra retomar de onde parou). */
export function emAndamento(status: SgpStatus): boolean {
  return status === "dados" || status === "foto" || status === "audio" || status === "revisao";
}

/**
 * A linha canônica pra retomar, ou null quando não há o que oferecer
 * (comportamento de hoje: segue no pedido da sessão atual).
 *
 * `sessaoAtual` fica de fora da disputa: a linha que o navegador já está
 * usando não é "retomada", é o presente.
 */
export function escolherRetomada(
  candidatos: readonly CandidatoRetomada[],
  sessaoAtual: string,
): CandidatoRetomada | null {
  const elegiveis = candidatos.filter(
    (c) =>
      c.sessao !== sessaoAtual &&
      emAndamento(c.status) &&
      c.emailVerificadoAt !== null &&
      c.userId === null,
  );
  if (elegiveis.length === 0) return null;
  return elegiveis.reduce((melhor, c) => {
    // MAIS PROGRESSO primeiro. jcesaram: a linha de 10/09 com 4 fotos GANHA
    // da linha de 11/09 com 0 — ordenar só por data pegaria a vazia.
    if (c.fotosAprovadas !== melhor.fotosAprovadas) {
      return c.fotosAprovadas > melhor.fotosAprovadas ? c : melhor;
    }
    return Date.parse(c.atualizadoEm) > Date.parse(melhor.atualizadoEm) ? c : melhor;
  });
}

/**
 * A sessão que o cookie deve apontar depois da decisão do ALUNO.
 * Recusar é sempre possível e sempre inofensivo: fica na sessão atual (a
 * linha nova), e a linha antiga continua intacta esperando.
 */
export function resolverRetomada(
  candidatos: readonly CandidatoRetomada[],
  sessaoAtual: string,
  decisao: "retomar" | "recusar",
): { sessao: string; retomada: CandidatoRetomada | null } {
  if (decisao === "recusar") return { sessao: sessaoAtual, retomada: null };
  const alvo = escolherRetomada(candidatos, sessaoAtual);
  return alvo ? { sessao: alvo.sessao, retomada: alvo } : { sessao: sessaoAtual, retomada: null };
}

/**
 * A tela do wizard pra onde a retomada leva. Só estados em andamento chegam
 * aqui (ver `escolherRetomada`); `dados` cai em foto porque quem retomou já
 * tem o e-mail verificado — a tela 1 terminou.
 */
export function destinoDaRetomada(status: SgpStatus): string {
  switch (status) {
    case "audio":
      return "/sgp/audio";
    case "revisao":
      return "/sgp/revisao";
    default:
      return "/sgp/foto";
  }
}
