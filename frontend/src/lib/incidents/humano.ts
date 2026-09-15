/**
 * A TRAVA DO HUMANO — "este caso já tem dono, a casa cala" (#415).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O QUE ACONTECEU (15/09, medido, aluna real)
 *
 * tuquinha36@hotmail.com pediu reembolso de R$ 2.712,12. O caso foi entregue
 * ao time às 11:55Z. Depois disso a casa mandou NOVE mensagens automáticas em
 * 2h50 (12:40, 12:50, 13:25, 13:30 ×2, 13:40, ~14:27, 14:35, 14:45). Uma delas
 * INVENTOU um WhatsApp de terceiro; outra respondeu POR CIMA de uma correção
 * escrita por gente. A aluna resumiu: "isso aí está muito bagunçado".
 *
 * POR QUE AS TRAVAS DE HOJE NÃO PEGAM. O e-mail tem duas, e nenhuma é sobre
 * isto: `shouldSkip` olha o REMETENTE (robô/plataforma), e a reserva por
 * Message-ID (`mail-dedupe.ts`) impede responder DUAS VEZES A MESMA MENSAGEM.
 * Nove mensagens diferentes do mesmo caso são nove Message-IDs diferentes —
 * passam todas. O que faltava é a trava que o canal irmão já tem há tempos:
 * `agent_chats.mode = 'human'` (respond.ts:68-74, 207, 247-253).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ONDE MORA O ESTADO, e por que NÃO é `agent_state` nem coluna nova
 *
 * O WhatsApp guarda o modo no CHAT. No e-mail não existe "chat": o que existe
 * é o CHAMADO. Então a trava mora no próprio chamado, como uma nota com
 * `tipo` em `agent_notes` — exatamente o padrão que `baixa.ts` já usa e pelo
 * mesmo motivo: sem migration (regra do Johnny: migration se propõe, não se
 * aplica) e auditável de graça, porque toda nota já carrega `at` e `by`. Quem
 * lê `agent_notes` hoje (painel, _Bugs/*.cjs, rondas) usa `note`/`by`/`at` e
 * ignora a chave `tipo` a mais.
 *
 * ⚠️ E A ESCOLHA MAIS IMPORTANTE DESTE ARQUIVO: a fonte da verdade é a LINHA
 * VIVA do chamado, não um carimbo paralelo. Isso é o que faz a trava se
 * SOLTAR SOZINHA — quando alguém fecha o chamado (`fixed`/`ignored`), pelo
 * painel ou pelo Frank, a consulta deixa de achá-lo e a Fast volta a falar.
 * Se o estado morasse em `agent_state`, fechar o chamado não limparia nada e
 * o aluno ficaria mudo PARA SEMPRE — que é o dano oposto e pior, o mesmo que
 * deixou a Fast dois dias sem responder ninguém em 08/08. Trava que não tem
 * quem a solte não é trava, é buraco.
 *
 * SÓ REGRA, SEM IO — de propósito, como `baixa.ts`. Nada aqui importa `@/`,
 * então `humano.test.ts` roda com `node --test` pelado, sem precisar do
 * resolvedor de alias. Quem fala com o banco é `humano-io.ts`.
 */
import type { NotaIncidente } from "./baixa";

/** A marca de "entregue a gente". Gravada por `entregarAoTime`. */
export const TIPO_ENTREGUE_HUMANO = "entregue_humano";

/**
 * Os únicos status que significam ENCERRADO. É lista de encerrados e não de
 * abertos de propósito: status novo (como `suporte_necessario` foi em 04/09)
 * nasce contando como ATIVO, que é o lado seguro — um status que ninguém
 * mapeou não pode destravar a casa em cima de um caso que ainda tem dono.
 */
const ENCERRADOS: ReadonlySet<string> = new Set(["fixed", "ignored"]);

export type IncidenteParaTrava = {
  status?: string | null;
  agent_notes?: readonly NotaIncidente[] | null;
};

function notas(inc: IncidenteParaTrava): readonly NotaIncidente[] {
  return Array.isArray(inc.agent_notes) ? inc.agent_notes : [];
}

/** O chamado já foi posto na mão de alguém do time? */
export function entregueAoHumano(inc: IncidenteParaTrava): boolean {
  return notas(inc).some((n) => n?.tipo === TIPO_ENTREGUE_HUMANO);
}

/** Ainda está de pé (não foi fechado nem ignorado). */
export function casoAtivo(inc: IncidenteParaTrava): boolean {
  return !ENCERRADOS.has((inc.status ?? "").trim());
}

/**
 * A REGRA, pura e testável sem banco: a casa cala quando o caso está ATIVO e
 * já foi entregue a gente. As duas condições são necessárias — só "entregue"
 * calaria para sempre depois do fechamento; só "ativo" calaria em cima de
 * chamado técnico que ninguém pegou, e aí o aluno espera um humano que não
 * foi chamado.
 */
export function travadoPorHumano(inc: IncidenteParaTrava): boolean {
  return casoAtivo(inc) && entregueAoHumano(inc);
}

/** A nota que marca a entrega. O texto é de quem já existia — só ganhou `tipo`. */
export function notaEntregueAoHumano(args: { at: string; by: string; note: string }): NotaIncidente {
  return { at: args.at, by: args.by, note: args.note, tipo: TIPO_ENTREGUE_HUMANO };
}
