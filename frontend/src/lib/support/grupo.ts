/**
 * O grupo interno do suporte no WhatsApp — um só lugar guarda esse jid.
 *
 * Ele já apareceu em dois arquivos hoje (aviso de erro do onboarding e
 * escalação da Carol) e ia virar a terceira cópia. Copiar identificador é como
 * o aviso do grupo ficou mudo: alguém corrige um lado e esquece o outro.
 */

/** "FASTCLONER - Suporte" — o ÚNICO grupo da conta da Carol (medido 22/08). */
export const GRUPO_SUPORTE_JID = "120363428193217427@g.us";

/** Env sobrescreve (vale lista separada por vírgula/espaço). */
export function gruposDoTime(): string[] {
  return (process.env.ONBOARDING_GRUPO_WHATSAPP || GRUPO_SUPORTE_JID)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((j) => (j.includes("@") ? j : `${j.replace(/\D/g, "")}@s.whatsapp.net`));
}

/**
 * É o grupo INTERNO da equipe? (Johnny 22/08: "só o time".)
 *
 * Muda o que a Carol pode dizer: ali são colegas, não alunos — ela confirma o
 * número do chamado em vez de responder "já já te respondem aqui", que é frase
 * pra quem comprou.
 */
export function ehGrupoDoTime(jid: string | null | undefined): boolean {
  if (!jid) return false;
  return gruposDoTime().includes(jid);
}
