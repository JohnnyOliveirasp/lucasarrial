/**
 * A porta ÚNICA para criar um chamado. Server-only.
 *
 * Por que existe (chamado #110, 23/08): a deduplicação por `signature` vivia
 * em read-then-write espalhado por 4 arquivos — SELECT, e então UPDATE ou
 * INSERT. Sob concorrência os SELECT todos erram e os INSERT todos passam:
 * 6 chamados nasceram do MESMO problema em 140 ms, o quadro saltou de 8 para
 * 17 abertos e o mesmo aluno apareceu 6 vezes sem nenhuma das 6 ser a dona
 * do caso.
 *
 * Nenhum código consegue ser atômico sozinho. Quem garante é o banco: a mig 92
 * criou índice UNIQUE PARCIAL em `signature` para chamados em aberto. Aqui a
 * gente trata a outra ponta — quando o índice recusa o insert, isso não é
 * erro, é a resposta certa: **alguém acabou de criar este mesmo chamado**.
 *
 * ⚠️ Sem este tratamento o índice seria um tiro no pé: o insert passaria a
 * falhar em silêncio e o chamado se perderia — pior que duplicar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Violação de UNIQUE no Postgres. */
const CONFLITO = "23505";

export type ResultadoGravacao = {
  id: string;
  numero: number | null;
  /** true = perdemos a corrida; o chamado já existia (ou nasceu agora, por outro). */
  jaExistia: boolean;
};

/**
 * Insere o chamado; se já houver um ABERTO com a mesma assinatura, devolve o
 * que existe em vez de criar outro. Nunca lança — chamado é registro, não pode
 * derrubar o fluxo que o originou.
 */
export async function inserirChamadoUnico(
  admin: SupabaseClient<never>,
  payload: Record<string, unknown> & { signature: string },
): Promise<ResultadoGravacao | null> {
  const { data, error } = await admin
    .from("incidents" as never)
    .insert(payload as never)
    .select("id, numero")
    .single();

  if (!error && data) {
    const row = data as unknown as { id: string; numero: number | null };
    return { id: row.id, numero: row.numero, jaExistia: false };
  }

  // Só o conflito tem tratamento: qualquer outro erro é problema de verdade.
  if ((error as { code?: string } | null)?.code !== CONFLITO) return null;

  const { data: atual } = await admin
    .from("incidents" as never)
    .select("id, numero, occurrences")
    .eq("signature", payload.signature)
    .not("status", "in", '("fixed","ignored")')
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = atual as unknown as { id: string; numero: number | null; occurrences: number | null } | null;
  if (!row) return null;

  // O pedido que perdeu a corrida não some: vira ocorrência no chamado que
  // venceu. Sem isso, "6 falhas" viraria "1 falha" — o oposto do bug, e igual
  // de enganoso para quem lê o quadro.
  await admin
    .from("incidents" as never)
    .update({
      occurrences: (row.occurrences ?? 1) + 1,
      last_seen_at: (payload.last_seen_at as string) ?? new Date().toISOString(),
    } as never)
    .eq("id", row.id);

  return { id: row.id, numero: row.numero, jaExistia: true };
}
