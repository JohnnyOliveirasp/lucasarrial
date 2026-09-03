/**
 * Canais reais do aviso de compra órfã (parte suja: Supabase, Telegram, Resend).
 * A decisão, o texto e a idempotência moram em `aviso-orfao.ts`, que é puro e
 * testado — aqui só se pluga o mundo.
 *
 * O desenho copia o `tell_frank` (/api/v1/agent/actions), que é o único canal
 * desta casa comprovadamente testado ponta a ponta (21/08, ida e volta em 1
 * minuto):
 *   B) grava em `agent_state` — durável, entra na ronda do Frank, não se perde
 *      se o Telegram estiver fora;
 *   A) manda no Telegram — tempo real, no canal onde alguém lê e responde.
 * Não são alternativas: A é o canal, B é a garantia. O e-mail entra como
 * terceiro reforço porque, no #239, ele sozinho não avisou ninguém.
 *
 * Sem migration: `agent_state` já é usado assim pelo Vigia e pelo
 * orphan-outreach (chave `orphan_invites`).
 */
import { getAdmin } from "@/lib/db/admin";
import { sendEmail } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import type {
  CanaisAviso,
  CompraOrfa,
  EstadoAvisos,
  EstadoAvisosIO,
  TextoAviso,
} from "@/lib/payments/aviso-orfao";

/** Chave do dedupe (um registro por entitlement já avisado). */
const CHAVE_ESTADO = "orphan_alerts";

/** agent_state fica fora do Database tipado (padrão das rotas do Vigia). */
export function estadoDosAvisos(): EstadoAvisosIO {
  return {
    ler: async () => {
      const { data } = await getAdmin()
        .from("agent_state" as never)
        .select("value")
        .eq("key", CHAVE_ESTADO)
        .maybeSingle();
      return (((data as { value?: EstadoAvisos } | null)?.value ?? {}) as EstadoAvisos) || {};
    },
    gravar: async (estado) => {
      await getAdmin()
        .from("agent_state" as never)
        .upsert({ key: CHAVE_ESTADO, value: estado, updated_at: new Date().toISOString() } as never);
    },
  };
}

/** Recado durável: entra na ronda do Frank mesmo com Telegram e Resend fora. */
async function registrarDuravel(chave: string, aviso: TextoAviso, dados: CompraOrfa): Promise<void> {
  await getAdmin()
    .from("agent_state" as never)
    .upsert({
      key: `para_frank_orfa_${chave}`.slice(0, 120),
      value: {
        at: new Date().toISOString(),
        subject: aviso.assunto.slice(0, 200),
        message: aviso.texto.slice(0, 8000),
        from: "webhook-hotmart",
        compra: dados,
      },
      updated_at: new Date().toISOString(),
    } as never);
}

/**
 * Telegram. Mesmas envs do `tell_frank`; sem credencial no servidor, devolve
 * false em vez de quebrar — e o `false` fica GRAVADO, que é o ponto todo.
 *
 * ⚠️ O `/msg@Frank_agent_007_bot` na PRIMEIRA linha é obrigatório: é o formato
 * que o bot aceita (mesma observação do tell_frank).
 */
async function mandarNoTelegram(texto: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `/msg@Frank_agent_007_bot\n${texto.slice(0, 3500)}`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** E-mail de reforço: suporte@ + a allowlist de admins. */
async function mandarPorEmail(assunto: string, html: string): Promise<boolean> {
  try {
    const destinos = new Set<string>([SUPPORT_EMAIL]);
    const { data } = await getAdmin().from("admin_emails").select("email");
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) destinos.add(r.email.toLowerCase());
    }
    return await sendEmail({ to: [...destinos], subject: assunto, html });
  } catch {
    return false;
  }
}

export function canaisDaCasa(): CanaisAviso {
  return { registrar: registrarDuravel, telegram: mandarNoTelegram, email: mandarPorEmail };
}
