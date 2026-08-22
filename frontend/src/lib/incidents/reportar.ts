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
};

export async function abrirChamadoReportado(c: ChamadoReportado): Promise<void> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  const { data: existingRaw } = await admin
    .from("incidents" as never)
    .select("id, status, occurrences, affected_emails")
    .eq("signature", c.signature)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = existingRaw as unknown as {
    id: string;
    status: string;
    occurrences: number;
    affected_emails: string[];
  } | null;

  if (existing) {
    const reopened = existing.status === "fixed" || existing.status === "ignored";
    await admin
      .from("incidents" as never)
      .update({
        status: reopened ? "open" : existing.status,
        occurrences: (existing.occurrences ?? 1) + 1,
        last_seen_at: now,
        sample_error: (c.sampleError ?? "").slice(0, 1000) || null,
        description: c.description,
        ...(c.attachments?.length ? { attachment_path: c.attachments.join(",") } : {}),
      } as never)
      .eq("id", existing.id);
    return;
  }

  await admin.from("incidents" as never).insert({
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
    attachment_path: c.attachments?.length ? c.attachments.join(",") : null,
    first_seen_at: now,
    last_seen_at: now,
  } as never);
}
