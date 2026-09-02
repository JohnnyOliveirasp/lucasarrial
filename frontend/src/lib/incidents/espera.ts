/**
 * "Aguardando o aluno" — e o caminho de volta. Server-only.
 *
 * Regra do Johnny (24/08): *"se já mandou para o aluno e está esperando
 * resposta dele, não é mais caso aberto"*. Chamado aberto tem que significar
 * TRABALHO NOSSO pendente; se a bola está com o aluno, o quadro mente.
 *
 * ⚠️ MAS SÓ PODE FECHAR ASSIM SE A RESPOSTA DELE TROUXER O CHAMADO DE VOLTA.
 * Sem isto, a regra vira o defeito do chamado #95: o caso foi fechado às
 * 20:40 com "aguardando ele dizer o que quer", o aluno respondeu às 22:57 —
 * 2h17 depois — e a resposta caiu no vazio, porque resposta de aluno não
 * reabria nada. Fechar sem o retorno automático não organiza o quadro,
 * só transfere o problema para um lugar onde ninguém olha.
 *
 * Por isso `aguardando_aluno` NÃO é "fixed": não foi resolvido, está em
 * espera — e a espera tem quem a encerre.
 */
import { getAdmin } from "@/lib/db/admin";
import { limparFechamento } from "./closure";

const STATUS_ESPERA = "aguardando_aluno";

/**
 * O aluno falou. Traz de volta pra fila tudo que estava esperando por ele.
 *
 * Devolve os números dos chamados reabertos (para o log / aviso ao time).
 * Nunca lança: isto roda no caminho de atendimento e não pode derrubar a
 * resposta ao aluno.
 */
export async function reabrirPorRespostaDoAluno(args: {
  email?: string | null;
  /** Só dígitos, como está em agent_chats.wa_phone. */
  telefone?: string | null;
  /** O que ele disse — vira nota no chamado, senão o time reabre às cegas. */
  trecho?: string | null;
}): Promise<number[]> {
  const email = args.email?.trim().toLowerCase() || null;
  const telefone = args.telefone?.replace(/\D/g, "") || null;
  if (!email && !telefone) return [];

  try {
    const admin = getAdmin();
    // Quem estava esperando ESTE aluno. O e-mail casa por affected_emails; o
    // telefone casa pela signature do WhatsApp (wa-privado:<fone>:<assunto>).
    let q = admin
      .from("incidents" as never)
      .select("id, numero, agent_notes")
      .eq("status", STATUS_ESPERA);
    q = email ? q.contains("affected_emails", [email]) : q.like("signature", `wa-%:${telefone}:%`);

    const { data } = await q;
    const linhas = (data ?? []) as unknown as Array<{
      id: string;
      numero: number | null;
      agent_notes: Array<{ at: string; by: string; note: string }> | null;
    }>;
    if (linhas.length === 0) return [];

    const agora = new Date().toISOString();
    const reabertos: number[] = [];
    for (const l of linhas) {
      const nota = {
        at: agora,
        by: "sistema",
        note:
          "Reaberto automaticamente: o aluno respondeu." +
          (args.trecho ? ` Ele disse: "${args.trecho.slice(0, 300)}"` : ""),
      };
      const { error } = await admin
        .from("incidents" as never)
        .update({
          status: "open",
          // "aguardando_aluno" hoje chega pelas rotas que já limpam, então
          // na prática o carimbo costuma estar nulo aqui. Passa pelo helper
          // mesmo assim: é o tipo de "na prática não acontece" que vira o
          // sétimo conserto quando alguém mudar como se entra nesse status.
          ...limparFechamento(),
          last_seen_at: agora,
          agent_notes: [...(l.agent_notes ?? []), nota],
        } as never)
        .eq("id", l.id);
      if (!error && l.numero != null) reabertos.push(l.numero);
    }
    if (reabertos.length > 0) {
      console.log(`[incidents/espera] aluno respondeu → reabertos: ${reabertos.map((n) => `#${n}`).join(", ")}`);
    }
    return reabertos;
  } catch (e) {
    console.error("[incidents/espera] falhou ao reabrir:", e instanceof Error ? e.message : e);
    return [];
  }
}
