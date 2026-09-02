/**
 * Chamado ABERTO POR GENTE (kind "reported") — a fila que o Frank varre.
 *
 * Existia só dentro de `mail-respond.ts`, privado, e por isso o WhatsApp
 * nunca abriu chamado nenhum: a Carol escalava, mandava zap pro técnico,
 * pausava a conversa… e o pedido morria ali. Quem escreveu o caminho do
 * e-mail não replicou no do zap — o mesmo tipo de metade que deixou o aviso
 * do grupo mudo (22/08).
 *
 * Idempotente pela `signature`: o mesmo pedido soma ocorrência em vez de
 * abrir chamado novo, e um pedido que volta depois de fechado REABRE.
 *
 * Server-only. As tabelas da mig 47 não estão nos types gerados → `as never`.
 */
import { getAdmin } from "@/lib/db/admin";
import { inserirChamadoUnico } from "./gravar";

export type ChamadoReportado = {
  /** Dedupe. Precisa distinguir PEDIDOS, não canais: num grupo o chat é um só,
   *  então assinar pelo chat faria todo pedido virar o mesmo chamado eterno. */
  signature: string;
  title: string;
  description: string;
  /** Quem registrou: "fast" (e-mail), "carol-grupo", "carol-zap". */
  reportedBy: string;
  /** E-mails de alunos afetados, quando dá pra saber. No grupo costuma ser vazio. */
  affectedEmails?: string[];
  /** Trecho do que a pessoa escreveu — sem isso o chamado nasce cego. */
  sampleError?: string | null;
  /** Anexos (chaves no R2), separados por vírgula na coluna. */
  attachments?: string[];
  /**
   * Em qual FILA o chamado entra (mig 93).
   *   "tecnico"     → existe ação NOSSA que resolve: retreinar a voz, refazer
   *                   a imagem, reprocessar o material, corrigir o bug.
   *   "atendimento" → reclamação do produto, dúvida, pré-venda, espera de
   *                   resposta. Precisa de PESSOA falando com o aluno.
   * O padrão é "atendimento" porque esta função é a porta de quem RELATA —
   * quem abre por falha de sistema (burst-rule, sync) manda "tecnico".
   */
  categoria?: "tecnico" | "atendimento";
};

/** Devolve o número curto do chamado (#85), que é como as pessoas se referem
 *  a ele. null se a gravação falhou. */
export async function abrirChamadoReportado(c: ChamadoReportado): Promise<number | null> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data: existingRaw } = await admin
    .from("incidents" as never)
    .select("id, numero, status, occurrences, affected_emails, title")
    .eq("signature", c.signature)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = existingRaw as unknown as {
    id: string;
    numero: number | null;
    status: string;
    occurrences: number;
    affected_emails: string[];
    title: string | null;
  } | null;

  if (existing) {
    const reopened = existing.status === "fixed" || existing.status === "ignored";
    const tituloNovo = c.title.slice(0, 120);
    /**
     * ⚠️ TÍTULO E DESCRIÇÃO TÊM QUE ANDAR JUNTOS (#213, 31/08).
     *
     * Até aqui a ocorrência nova sobrescrevia a `description` e NÃO mexia no
     * `title`. Como a assinatura do chat é por PESSOA (`help:atend:<email>`,
     * help/route.ts:170) e não por problema, o mesmo aluno perguntando outra
     * coisa cai no MESMO chamado — e o registro passava a se contradizer:
     * título do pedido VELHO, descrição do pedido NOVO.
     *
     * Não é cosmético. No #213 o título dizia "aluno quer saber como apagar
     * fotos" (já respondido e fechado às 19h38Z) enquanto a descrição, às
     * 20h45Z, já era "insatisfeito com o realismo dos dentes no Vídeo Clone".
     * Quem pega a fila pelo título trabalha no problema errado, e a reclamação
     * que está de fato esperando fica invisível.
     *
     * Agora os dois andam juntos. E o título velho NÃO é destruído em
     * silêncio: quando o assunto muda, ele fica preservado no corpo da
     * descrição, porque o pedido anterior pode ter ficado sem resposta.
     */
    const mudouDeAssunto = !!existing.title && existing.title !== tituloNovo;
    const description = mudouDeAssunto
      ? `${c.description}\n\n⚠️ ASSUNTO MUDOU (ocorrência ${(existing.occurrences ?? 1) + 1}). ` +
        `O pedido anterior deste mesmo chamado era: "${existing.title}". ` +
        `Confira se ELE já foi respondido antes de tratar só o de agora.`
      : c.description;
    await admin
      .from("incidents" as never)
      .update({
        status: reopened ? "open" : existing.status,
        occurrences: (existing.occurrences ?? 1) + 1,
        last_seen_at: now,
        sample_error: (c.sampleError ?? "").slice(0, 1000) || null,
        title: tituloNovo,
        description,
        ...(c.attachments?.length ? { attachment_path: c.attachments.join(",") } : {}),
      } as never)
      .eq("id", existing.id);
    return existing.numero ?? null;
  }

  const criado = await inserirChamadoUnico(admin, {
      kind: "reported",
      cause: "reported",
      status: "open",
      signature: c.signature,
      title: c.title.slice(0, 120),
      occurrences: 1,
      affected_emails: c.affectedEmails ?? [],
      sample_error: (c.sampleError ?? "").slice(0, 1000) || null,
      description: c.description,
      reported_by: c.reportedBy,
      categoria: c.categoria ?? "atendimento",
      attachment_path: c.attachments?.length ? c.attachments.join(",") : null,
      first_seen_at: now,
      last_seen_at: now,
  });
  // Se perdemos a corrida, inserirChamadoUnico já somou a ocorrência no
  // chamado que venceu e devolve o número DELE — que é o que o time vai citar.
  return criado?.numero ?? null;
}
