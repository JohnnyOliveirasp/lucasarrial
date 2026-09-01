/**
 * A quem pertence um erro do onboarding — DECISÃO PURA, sem I/O.
 *
 * Vivia dentro de `avisos.ts`, que importa SMTP/WhatsApp/Resend e por isso não
 * dá pra exercitar num teste sem subir meio app. Foi extraído pra cá para que a
 * régua de culpa tenha teste próprio: quem decide se o aluno leva a culpa por um
 * erro é a coisa mais cara de errar neste módulo (incidente #184 — aluno levou
 * e-mail mandando "liberar" um link que já estava liberado).
 *
 * `avisos.ts` re-exporta tudo daqui, então os importadores antigos seguem iguais.
 */

/**
 * A quem pertence o erro:
 *   "nosso"    → rede, servidor, bug, limite do provedor. O aluno NÃO é
 *                incomodado (regra 1).
 *   "planilha" → dado errado na planilha (e-mail inválido, falta senha). Não
 *                dá pra mandar e-mail — muitas vezes o endereço é justamente o
 *                que está quebrado. É o TIME que corrige.
 *   "aluno"    → o material dele. Ele é avisado e a mensagem diz o que fazer.
 */
export type DonoDoErro = "nosso" | "planilha" | "aluno";

/** Erro NOSSO: infra, bug, resposta estranha. Lista fechada, e é de propósito. */
const NOSSO =
  /http \d{3}|falha de rede|falha geral|cannot read propert|undefined|enospc|no space left|timeout|econn|socket hang up|ffmpeg|erro interno|internal server|tentativas sem sucesso|não sabemos listar|limitou temporariamente|cota de tr[aá]fego/i;

/** Dado da planilha: não adianta escrever pro aluno, o canal é que está errado. */
const PLANILHA = /e-?mail inv[aá]lido|faltou e-?mail|faltou.*senha|sem e-?mail/i;

/**
 * Classifica o motivo do erro. 22/08 (Johnny): *"onde é erro que não tem
 * permissão, o suporte manda e-mail informando que não consegue progredir; se
 * for erro técnico que está errada a imagem, é informado que ação ela precisa
 * fazer"*.
 *
 * ⚠️ O PADRÃO FOI INVERTIDO, e essa é a mudança que importa. A versão antiga
 * era uma lista de palavras PERMITIDAS ("permissão", "not found", "teto"…) e
 * quem não casasse ficava calado — resultado medido no dia: WeTransfer
 * vencido (9 linhas, a 2ª maior causa), YouTube/iCloud, PDF no lugar da foto e
 * página HTML do Dropbox/OneDrive **não avisavam ninguém**. O aluno ficava
 * parado sem saber por quê, às vezes por semanas, até o link morrer de vez.
 *
 * Agora só cala o que é COMPROVADAMENTE nosso ou dado da planilha; todo o
 * resto é material do aluno e ele é avisado. O risco trocado é consciente: um
 * erro nosso desconhecido pode gerar um e-mail a mais — muito mais barato do
 * que um aluno esperando em silêncio.
 *
 * 29/08 (incidente #184): entraram "limitou temporariamente" e "cota de
 * tráfego". Quando o Drive estoura a cota de download DO PRÓPRIO ARQUIVO ele
 * devolve HTML, e o HTML era lido como "arquivo privado" — o aluno levava
 * e-mail mandando arrumar um compartilhamento que já estava certo. Cota é
 * limite do provedor, não material do aluno: é NOSSO, e passa calado pra ele.
 * São DUAS âncoras de propósito, pra um ajuste de texto na mensagem não voltar
 * a culpar o aluno em silêncio.
 */
export function classificarErro(motivo: string): DonoDoErro {
  if (NOSSO.test(motivo)) return "nosso";
  if (PLANILHA.test(motivo)) return "planilha";
  return "aluno";
}

/** Compat: o aluno recebe e-mail? */
export function dependeDoAluno(motivo: string): boolean {
  return classificarErro(motivo) === "aluno";
}
