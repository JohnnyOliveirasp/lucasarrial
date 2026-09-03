/**
 * Canais reais do e-mail de boas-vindas do SGP (parte suja: Supabase e SMTP).
 * A decisão, o texto e a idempotência moram em `sgp-boas-vindas.ts`, que é puro
 * e testado — aqui só se pluga o mundo.
 *
 * DUAS ESCOLHAS QUE VALE EXPLICAR:
 *
 * 1. O ESTADO VAI EM `agent_state`, NÃO EM `avisos_enviados`.
 *    A idempotência precisa de uma tabela que EXISTA. A `avisos_enviados` vem da
 *    migration 104, que NÃO foi aplicada (decisão do Johnny) — usá-la como trava
 *    faria "já avisei?" responder sempre NÃO e o aluno receberia o e-mail a cada
 *    reenvio da Hotmart. `agent_state` já é usada exatamente assim pelo Vigia,
 *    pelo orphan-outreach e pelo aviso de compra órfã, e não precisa de
 *    migration nenhuma. A `avisos_enviados` continua sendo escrita, mas no papel
 *    dela: PROVA do envio, best-effort.
 *
 * 2. O E-MAIL SAI PELO SMTP DO suporte@ (`sendSupportMail`), não pelo Resend.
 *    Pelo Resend ele sairia assinado como "AI Clone Verse" (lição de 10/08) e o
 *    aluno não reconheceria o remetente. É o mesmo caminho da régua de avisos do
 *    onboarding.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import { registrarAviso } from "@/lib/onboarding/registrar-aviso";
import { resolveUserIdByEmail } from "@/lib/credits/service";
import type {
  CanaisBoasVindas,
  EstadoBoasVindas,
  EstadoBoasVindasIO,
} from "@/lib/payments/sgp-boas-vindas";

/** Chave do dedupe (um registro por transação já avisada). */
const CHAVE_ESTADO = "sgp_boas_vindas";

/** `agent_state` fica fora do Database tipado (padrão das rotas do Vigia). */
export function estadoDasBoasVindas(): EstadoBoasVindasIO {
  return {
    ler: async () => {
      const { data } = await getAdmin()
        .from("agent_state" as never)
        .select("value")
        .eq("key", CHAVE_ESTADO)
        .maybeSingle();
      return (((data as { value?: EstadoBoasVindas } | null)?.value ?? {}) as EstadoBoasVindas) || {};
    },
    gravar: async (estado) => {
      await getAdmin()
        .from("agent_state" as never)
        .upsert({
          key: CHAVE_ESTADO,
          value: estado,
          updated_at: new Date().toISOString(),
        } as never);
    },
  };
}

export function canaisDoSgp(): CanaisBoasVindas {
  return {
    email: async (to, assunto, texto) => {
      // `sendSupportMail` LANÇA quando falha; o orquestrador trata o throw e
      // grava a mensagem do erro. Devolver `true` aqui significa "o SMTP
      // aceitou", que é o mais longe que dá pra afirmar de dentro do processo.
      await sendSupportMail({ to, subject: assunto, text: texto });
      return true;
    },
    registrar: async ({ email, assunto, ok, erro, referencia }) => {
      // O comprador do curso quase nunca tem conta aqui (medido em 03/09: 27,1%
      // dos 129 criaram). `resolveUserIdByEmail` devolve null nesse caso e a
      // linha fica com user_id nulo, que é o previsto na migration 104.
      let userId: string | null = null;
      try {
        userId = await resolveUserIdByEmail(email);
      } catch {
        // Descobrir a conta é enfeite do registro, não pode custar o registro.
      }
      await registrarAviso(getAdmin(), {
        email,
        userId,
        aviso: "sgp_compra_boas_vindas",
        assunto,
        referencia,
        ok,
        erro,
      });
    },
  };
}
