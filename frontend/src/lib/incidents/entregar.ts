/**
 * Entregar ao TIME — a saída do chamado de ATENDIMENTO. Server-only.
 *
 * Regra do Johnny (24/08, chamado #82): *"era para a Fast escalar no WhatsApp
 * e fechar este chamado… não dá para ficar com o chamado aberto no limbo"*.
 *
 * O que acontecia: a Fast/Carol escalava, o chamado abria na fila de
 * atendimento e ficava lá — o grupo da equipe NUNCA era avisado pelo caminho
 * do e-mail, e o chamado só saía quando um agente o pegava, dias depois.
 * Chamado aberto tem que significar TRABALHO NOSSO pendente (o mesmo princípio
 * de `espera.ts`). Quando o que falta é OLHO HUMANO — abrir um link, ouvir uma
 * voz, decidir se refaz — isso é do time, e o time vive no grupo do WhatsApp.
 *
 * Então: posta no grupo "FASTCLONER - Suporte" com tudo que a pessoa precisa
 * para agir (quem, o quê, o link, o trecho) e FECHA o chamado com a nota de
 * que a responsabilidade passou. Só a fila `atendimento`: `tecnico` é ação
 * nossa (código, retreino, reprocesso) e continua aberto até ser feita.
 *
 * ⚠️ Não é "aguardando_aluno" — a bola não está com o aluno, está com o time.
 * ⚠️ Se o grupo não recebeu, o chamado NÃO fecha: fechar sem avisar ninguém é
 *    exatamente o limbo que a regra proíbe.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendAgentText } from "@/lib/agent/provider";
import { gruposDoTime } from "@/lib/support/grupo";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

export type EntregaAoTime = {
  numero: number;
  /** "e-mail" | "WhatsApp" — de onde o aluno falou. */
  canal: string;
  /** Como o time acha o aluno: e-mail ou telefone. */
  aluno: string;
  /** Resumo que a Fast/Carol escreveu no [ESCALAR]. */
  resumo: string;
  /** O que o aluno escreveu — é daqui que saem os links. */
  texto?: string | null;
};

function hora(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Links do aluno (Drive, WeTransfer, Instagram…) — sem eles ninguém vai atrás. */
function linksDe(...textos: Array<string | null | undefined>): string[] {
  const achados = new Set<string>();
  for (const t of textos) for (const u of (t ?? "").match(URL_RE) ?? []) achados.add(u);
  return [...achados].slice(0, 5);
}

export function montarAvisoAoTime(e: EntregaAoTime): string {
  const links = linksDe(e.resumo, e.texto);
  const trecho = (e.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  return [
    `🙋 *Chamado #${e.numero} — precisa de alguém do time*`,
    ``,
    `*Aluno:* ${e.aluno} (por ${e.canal})`,
    `*O que precisa:* ${e.resumo}`,
    trecho ? `*Ele disse:* "${trecho}${(e.texto ?? "").length > 400 ? "…" : ""}"` : "",
    links.length ? `*Link:* ${links.join("\n")}` : "",
    ``,
    `A Fast já respondeu que o time vai olhar. O chamado está FECHADO como entregue ao time — quem pegar responde o aluno direto (${e.canal === "e-mail" ? "pelo suporte@" : "pelo painel"}).`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Posta no grupo e fecha o chamado. Devolve true se o time foi avisado E o
 * chamado fechou. Nunca lança — roda no caminho de resposta ao aluno.
 */
export async function entregarAoTime(e: EntregaAoTime): Promise<boolean> {
  let avisou = false;
  for (const jid of gruposDoTime()) {
    try {
      if (await sendAgentText(jid, montarAvisoAoTime(e))) avisou = true;
    } catch (err) {
      console.error("[incidents/entregar] grupo não recebeu:", err instanceof Error ? err.message : err);
    }
  }
  if (!avisou) {
    console.error(`[incidents/entregar] #${e.numero} fica ABERTO: nenhum grupo recebeu o aviso`);
    return false;
  }

  try {
    const admin = getAdmin();
    const agora = new Date().toISOString();
    const { data } = await admin
      .from("incidents" as never)
      .select("id, agent_notes, resolution_note")
      .eq("numero", e.numero)
      .maybeSingle();
    const linha = data as unknown as {
      id: string;
      agent_notes: Array<{ at: string; by: string; note: string }> | null;
      resolution_note: string | null;
    } | null;
    if (!linha) return false;

    const nota = `Entregue ao time no grupo do WhatsApp em ${hora()} — precisa de olho humano, não de código. A responsabilidade é do time; o chamado não fica aberto no limbo (regra do Johnny, 24/08).`;
    const { error } = await admin
      .from("incidents" as never)
      .update({
        status: "fixed",
        resolved_at: agora,
        resolved_by: "carol (entregue ao time)",
        resolution_note: linha.resolution_note ? `${linha.resolution_note}\n\n${nota}` : nota,
        agent_notes: [...(linha.agent_notes ?? []), { at: agora, by: "carol", note: nota }],
      } as never)
      .eq("id", linha.id);
    if (error) {
      console.error(`[incidents/entregar] #${e.numero} avisado mas não fechou:`, error.message);
      return false;
    }
    console.log(`[incidents/entregar] #${e.numero} entregue ao time e fechado`);
    return true;
  } catch (err) {
    console.error("[incidents/entregar] falhou:", err instanceof Error ? err.message : err);
    return false;
  }
}
