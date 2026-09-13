/**
 * Memória das recusas por tamanho (quem já levou "seu e-mail não abre aqui").
 *
 * Sem isto, `decidirAnexoGrande` não tem como saber que é a SEGUNDA vez com a
 * mesma pessoa — e foi exatamente a segunda recusa idêntica que fez o cliente
 * de 09/09 escrever "preciso de um suporte humano".
 *
 * SEM MIGRATION: mora em `agent_state` (chave `mail_recusas_tamanho`), do mesmo
 * jeito que o Vigia e o `aviso-orfao-canal` já fazem.
 */
import { getAdmin } from "@/lib/db/admin";
// `podar` mora no módulo PURO pra poder ser testada com `node --test` — aqui
// dentro ela seria inalcançável (este arquivo importa `@/`).
import { podar, type EstadoRecusas } from "./mail-anexo-grande";

export type { EstadoRecusas };

/** Chave única no `agent_state`. */
const CHAVE_ESTADO = "mail_recusas_tamanho";

/** `agent_state` fica fora do Database tipado (padrão das rotas do Vigia). */
async function ler(): Promise<EstadoRecusas> {
  const { data } = await getAdmin()
    .from("agent_state" as never)
    .select("value")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  return (((data as { value?: EstadoRecusas } | null)?.value ?? {}) as EstadoRecusas) || {};
}

async function gravar(estado: EstadoRecusas): Promise<void> {
  await getAdmin()
    .from("agent_state" as never)
    .upsert({
      key: CHAVE_ESTADO,
      value: estado,
      updated_at: new Date().toISOString(),
    } as never);
}

/**
 * Quantas recusas por tamanho este remetente já levou (dentro da janela).
 * Nunca derruba o fluxo: banco fora do ar devolve 0 — a Fast responde como se
 * fosse a primeira vez, que é o comportamento antigo e seguro.
 */
export async function recusasAnteriores(email: string): Promise<number> {
  try {
    const estado = podar(await ler(), Date.now());
    return estado[email.toLowerCase()]?.n ?? 0;
  } catch (e) {
    console.error("[agent/mail] não consegui ler recusas por tamanho:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Soma mais uma recusa pra este remetente. Falha em silêncio, nunca trava a fila. */
export async function registrarRecusa(email: string): Promise<void> {
  try {
    const chave = email.toLowerCase();
    const estado = podar(await ler(), Date.now());
    const atual = estado[chave]?.n ?? 0;
    estado[chave] = { n: atual + 1, at: new Date().toISOString() };
    await gravar(estado);
  } catch (e) {
    console.error("[agent/mail] não consegui gravar recusa por tamanho:", e instanceof Error ? e.message : e);
  }
}
