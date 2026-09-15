/**
 * A CAMADA DE IO da trava do humano (#415) — a regra pura mora em `humano.ts`.
 *
 * A separação é a mesma de `mail-bounce.ts` (regra) e `mail-bounce-dns.ts`
 * (IO), e existe pelo mesmo motivo: a decisão de calar a casa é a parte que
 * precisa ser testada exaustivamente, e ela não deve depender de banco pra ser
 * exercitada.
 */
import { getAdmin } from "@/lib/db/admin";
import type { NotaIncidente } from "./baixa";
import { travadoPorHumano, type IncidenteParaTrava } from "./humano";

export type CasoComHumano = { id: string; numero: number | null };

/**
 * Este aluno tem algum chamado ATIVO que já está na mão de gente?
 *
 * Casa por `affected_emails`, que é como `espera.ts:49` e
 * `mail-bounce-registro.ts:102` já acham o aluno pelo e-mail.
 *
 * SEGURANÇA DE FALHA: ABERTA. Se a consulta falhar, devolve `null` e a Fast
 * responde como responde hoje. É a mesma doutrina escrita no irmão
 * `agent/mail-dedupe.ts`, e pelo mesmo motivo: banco fora do ar é transitório
 * e atinge TODO MUNDO, então falhar fechado calaria a casa inteira — inclusive
 * para os alunos que não têm chamado nenhum. Entre "uma resposta a mais num
 * caso que tem dono" e "ninguém é atendido enquanto o banco pisca", o segundo
 * é o dano maior. Falha de leitura vira linha de log, não bloqueio.
 */
export async function casoComHumano(email: string): Promise<CasoComHumano | null> {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return null;
  try {
    const { data, error } = await getAdmin()
      .from("incidents" as never)
      .select("id, numero, status, agent_notes")
      .contains("affected_emails", [alvo]);
    if (error) throw new Error(error.message);
    const linhas = (data ?? []) as unknown as Array<
      { id: string; numero: number | null } & IncidenteParaTrava
    >;
    const travado = linhas.find((l) => travadoPorHumano(l));
    return travado ? { id: travado.id, numero: travado.numero ?? null } : null;
  } catch (e) {
    console.error(
      `[incidents/humano] não deu pra conferir se ${alvo} está com alguém — seguindo sem a trava:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * O ALUNO VOLTOU A FALAR E A CASA FICOU CALADA — registra isso no chamado.
 *
 * Isto não é enfeite, é o que impede a trava de virar um buraco. Calar sem
 * deixar rastro seria trocar "a casa fala demais" por "a mensagem do aluno
 * some", e mensagem que some é o defeito mais caro deste repositório (o
 * chamado #95 nasceu exatamente assim: resposta do aluno caindo no vazio).
 * Com a nota, quem abrir o chamado vê o que ele disse; com o `last_seen_at`
 * novo, o caso sobe na fila em vez de envelhecer parado.
 *
 * Nunca lança: roda no caminho de atendimento e não pode derrubar a varredura.
 */
export async function anotarQueOAlunoFalou(
  caso: CasoComHumano,
  args: { assunto: string; trecho: string },
): Promise<void> {
  try {
    const admin = getAdmin();
    const agora = new Date().toISOString();
    const { data } = await admin
      .from("incidents" as never)
      .select("agent_notes")
      .eq("id", caso.id)
      .maybeSingle();
    const atuais = ((data as unknown as IncidenteParaTrava | null)?.agent_notes ?? []) as NotaIncidente[];
    const nota: NotaIncidente = {
      at: agora,
      by: "sistema",
      note: [
        "=== O QUE FAZER ===",
        "O ALUNO MANDOU OUTRO E-MAIL e a Fast NÃO respondeu — este chamado já está com o time,",
        "e resposta automática por cima de gente foi o que bagunçou o caso da tuquinha (#415).",
        "Quem está com o caso responde pelo suporte@ e fecha o chamado; fechar destrava a Fast.",
        `Assunto: ${args.assunto}`,
        `Ele disse: "${args.trecho.replace(/\s+/g, " ").trim().slice(0, 400)}"`,
      ].join("\n"),
    };
    const { error } = await admin
      .from("incidents" as never)
      .update({ last_seen_at: agora, agent_notes: [...atuais, nota] } as never)
      .eq("id", caso.id);
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error(
      `[incidents/humano] o aluno falou de novo no #${caso.numero ?? "?"} mas a nota não entrou:`,
      e instanceof Error ? e.message : e,
    );
  }
}
