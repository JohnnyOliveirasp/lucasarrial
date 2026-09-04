/**
 * Canais reais do e-mail de boas-vindas do SGP (parte suja: Supabase e SMTP).
 * A decisão, o texto e a idempotência moram em `sgp-boas-vindas.ts`, que é puro
 * e testado — aqui só se pluga o mundo.
 *
 * Desde 04/09 (weekly do Lucas) este arquivo também CRIA A CONTA do comprador —
 * ver `criarContaDoComprador`, que é a parte perigosa e está comentada linha a
 * linha.
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
import { logger } from "@/lib/logger/server";
import { ehEmailJaCadastrado } from "@/lib/payments/sgp-boas-vindas";
import type {
  CanaisBoasVindas,
  EstadoBoasVindas,
  EstadoBoasVindasIO,
  ResultadoConta,
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

/** Onde o aluno define a senha (mesmo destino de /api/v1/admin/users/recovery-link). */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://fastcloner.com").replace(/\/+$/, "");
}

/**
 * A conta já existe?
 *
 * Duas fontes, porque elas falham por motivos diferentes: `profiles` é o índice
 * rápido (e tem índice por e-mail), mas pode não ter a linha se o trigger
 * falhou algum dia; `listUsers` é o dono da verdade em `auth.users`.
 *
 * ⚠️ ISTO NÃO É A TRAVA DE SEGURANÇA — é só um atalho pra não chamar o
 * `createUser` à toa. A trava de verdade é o e-mail ÚNICO do próprio Supabase:
 * se esta busca errar (paginação curta, replicação atrasada, corrida entre dois
 * eventos), o `createUser` FALHA com "already registered" e o chamador trata
 * como `ja_tinha`. Ou seja: nenhum caminho daqui cria conta duplicada nem toca
 * na senha de quem já existe.
 */
async function contaJaExiste(email: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin
    .from("profiles" as never)
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (data) return true;

  for (let page = 1; page <= 5; page++) {
    const { data: lista } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (lista?.users?.some((u) => (u.email ?? "").toLowerCase() === email)) return true;
    if (!lista?.users?.length || lista.users.length < 1000) break;
  }
  return false;
}

/**
 * Cria a conta do comprador do SGP e devolve o link pra ele definir a senha.
 *
 * O QUE ESTA FUNÇÃO NÃO FAZ, e cada "não" tem um motivo:
 *  - NÃO define senha nenhuma. O `createUser` vai SEM `password`: a conta nasce
 *    sem senha e só ganha uma quando o próprio aluno abre o link. Senha gerada
 *    por nós teria que trafegar por e-mail pra ser útil, que é exatamente o que
 *    estamos evitando;
 *  - NÃO mexe em conta existente. Nem `generateLink`, nem update, nem nada:
 *    reset silencioso em quem já usa a plataforma é o pior estrago possível
 *    aqui, e a Hotmart reenvia o mesmo evento até 5×;
 *  - NÃO credita, NÃO cria entitlement e NÃO escreve `access_until`. A linha em
 *    `profiles` quem cria é o trigger `on_auth_user_created`, com
 *    `credits_subscription`/`credits_extra` em 0 e `access_until` NULL. SGP não
 *    dá a plataforma (regra do Lucas, 31/08).
 *
 * `email_confirm: true` porque o e-mail já foi provado pela compra paga na
 * Hotmart — e, na prática, o aluno ainda precisa abrir o link que só chega
 * naquela caixa pra conseguir entrar.
 */
async function criarContaDoComprador(d: {
  email: string;
  nome: string | null;
}): Promise<ResultadoConta> {
  const email = d.email.trim().toLowerCase();
  const admin = getAdmin();

  if (await contaJaExiste(email)) {
    return { situacao: "ja_tinha", linkDefinirSenha: null, erro: null };
  }

  const { error: erroCriar } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: (d.nome ?? "").trim(),
      onboarding_source: "sgp_compra",
    },
  });
  if (erroCriar) {
    // Corrida ou busca que errou: a conta existe. NÃO é erro e NÃO vira reset.
    if (ehEmailJaCadastrado(erroCriar.message)) {
      return { situacao: "ja_tinha", linkDefinirSenha: null, erro: null };
    }
    return { situacao: "falhou", linkDefinirSenha: null, erro: erroCriar.message };
  }

  // Conta criada. Agora o link de definição de senha — o MESMO `generateLink`
  // de /api/v1/admin/users/recovery-link. Ele não dispara e-mail do Supabase:
  // só devolve a URL, que nós colocamos no nosso e-mail.
  const { data, error: erroLink } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    },
  });
  const link = data?.properties?.action_link ?? null;

  logger.info("audit", "sgp.conta.criada", { target: email, comLink: Boolean(link) });

  if (erroLink || !link) {
    // Conta criada mas sem link: o e-mail sai sem o bloco de acesso e o aluno
    // entra pelo "esqueci minha senha". Registrado como erro pra não sumir.
    return {
      situacao: "criada",
      linkDefinirSenha: null,
      erro: erroLink?.message ?? "generateLink não devolveu action_link",
    };
  }
  return { situacao: "criada", linkDefinirSenha: link, erro: null };
}

export function canaisDoSgp(): CanaisBoasVindas {
  return {
    garantirConta: criarContaDoComprador,
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
