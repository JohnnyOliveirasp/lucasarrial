/**
 * Entregar ao TIME — a saída do chamado de ATENDIMENTO. Server-only.
 *
 * HISTÓRICO. 24/08 (#82) o Johnny mandou: avisa o grupo e FECHA, "não dá para
 * ficar com o chamado aberto no limbo". Funcionou pra tirar o limbo, mas criou
 * outro (#153, 27–29/08): o chamado fechava 0,8–1,6s depois da mensagem do
 * aluno, a fila lia ZERO enquanto ele seguia escrevendo (Cássio pediu "um ser
 * humano" 6x), cada mensagem nova reabria/refechava e virava spam no grupo, e
 * a promessa "já já te respondem" ficava sem dono (Johnathan: 2 dias parado,
 * 0 vozes, e o passo prometido nem funcionava — #180).
 *
 * 29/08 o Johnny decidiu: o chamado escalado NASCE ABERTO (`investigating`) e
 * só fecha quando alguém do time responde o aluno. O aviso no grupo continua
 * igual — é assim que o time fica sabendo — mas a fila passa a mostrar o que
 * está esperando gente. Quem responde fecha (painel /admin ou Frank).
 *
 * Só a fila `atendimento` passa por aqui: `tecnico` já ficava aberto.
 * ⚠️ Não é "aguardando_aluno" — a bola está com o time, não com o aluno.
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
    `A Fast já respondeu que o time vai olhar. O chamado está ABERTO na fila esperando gente — quem pegar responde o aluno direto (${e.canal === "e-mail" ? "pelo suporte@" : "pelo painel"}) e fecha o chamado.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Posta no grupo e ANOTA no chamado, que fica aberto. Devolve true se o time
 * foi avisado E a nota entrou. Nunca lança — roda no caminho de resposta ao aluno.
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
    console.error(`[incidents/entregar] #${e.numero} sem aviso: nenhum grupo recebeu`);
    return false;
  }

  try {
    const admin = getAdmin();
    const agora = new Date().toISOString();
    const { data } = await admin
      .from("incidents" as never)
      .select("id, agent_notes")
      .eq("numero", e.numero)
      .maybeSingle();
    const linha = data as unknown as {
      id: string;
      agent_notes: Array<{ at: string; by: string; note: string }> | null;
    } | null;
    if (!linha) return false;

    const nota = `Time avisado no grupo do WhatsApp em ${hora()} — precisa de olho humano, não de código. O chamado FICA ABERTO até alguém responder o aluno (decisão do Johnny, 29/08, #153).`;
    const { error } = await admin
      .from("incidents" as never)
      .update({
        status: "investigating",
        resolved_at: null,
        resolved_by: null,
        agent_notes: [...(linha.agent_notes ?? []), { at: agora, by: "carol", note: nota }],
      } as never)
      .eq("id", linha.id);
    if (error) {
      console.error(`[incidents/entregar] #${e.numero} avisado mas a nota não entrou:`, error.message);
      return false;
    }
    console.log(`[incidents/entregar] #${e.numero} time avisado, chamado segue aberto`);
    return true;
  } catch (err) {
    console.error("[incidents/entregar] falhou:", err instanceof Error ? err.message : err);
    return false;
  }
}
