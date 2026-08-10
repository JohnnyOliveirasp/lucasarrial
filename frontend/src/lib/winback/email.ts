/**
 * Resgate da Fast — canal E-MAIL. Server-only.
 *
 * Decisão do Johnny (10/08): o WhatsApp levou uma tranca de 24h e não dá conta
 * hoje, então a Fast pergunta o motivo POR E-MAIL — e alcança mais gente (125
 * têm e-mail; só 89 tinham telefone). A ordem foi explícita: "ela precisa
 * entrar em CADA pessoa que cancelou e tentar entender", ou seja, um e-mail
 * escrito para aquela pessoa, com o que a gente sabe dela — não um disparo
 * igual para todos.
 *
 * Sai pelo SMTP do suporte@fastcloner.com (a Fast de verdade). NUNCA pelo
 * Resend: lá o domínio verificado ainda é o antigo e o e-mail chega como
 * "AI Clone Verse" — o que já constrangeu a gente na frente de um cliente.
 */
import { getAdmin } from "@/lib/db/admin";
import { agentComplete } from "@/lib/agent/brain";
import { buildAgentSystem } from "@/lib/agent/manual";
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import { buildAccountContext } from "@/lib/agent/account";
import { winbackMission, tirarCaraDeRobo } from "@/lib/winback/script";
import type { WinbackTargetRow } from "@/lib/db/types";

/** Espaçamento entre e-mails: nada de 125 disparos no mesmo segundo. */
const PAUSA_MS = 15_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Instrução para a Fast escrever ESTE e-mail, para ESTA pessoa. */
function instrucaoEmail(t: WinbackTargetRow, nome: string | null, conta: string | null): string {
  const quem = nome ? `A pessoa se chama ${nome}.` : "Você não sabe o nome dela — não invente nem use nome nenhum.";
  const abertura =
    t.segment === "nunca_ativou" || t.segment === "sem_conta"
      ? "Ela assinou e NÃO chegou a usar (não criou nenhuma voz). Não pergunte 'por que cancelou' como se ela tivesse testado: pergunte o que aconteceu, se travou em alguma coisa, e ofereça ajudar a dar o primeiro passo."
      : "Ela usou a plataforma e depois cancelou. Pergunte, de forma aberta e curta, o que não funcionou pra ela.";

  return [
    "TAREFA: escreva um E-MAIL curto para esta pessoa, que cancelou a assinatura do FastCloner.",
    quem,
    abertura,
    t.survey_reason
      ? `Na pesquisa de cancelamento ela marcou "${t.survey_reason}"${t.survey_detail ? ` e escreveu: "${t.survey_detail}"` : " e não escreveu detalhe"}. Se ela deu um motivo, MOSTRE que você leu — não pergunte de novo o que ela já respondeu; peça o detalhe que falta.`
      : "Ela não deixou motivo na pesquisa de cancelamento.",
    conta ? `O que a gente sabe da conta dela (use pra escrever com conhecimento de causa, MAS não despeje esses dados no e-mail):\n${conta}` : "",
    "",
    "REGRAS DESTE E-MAIL:",
    "- É um E-MAIL, não WhatsApp: pode ter 2 ou 3 parágrafos curtos, mas nada de textão.",
    "- NÃO venda nada. Não liste recursos, não anuncie novidade, não ofereça crédito. O objetivo aqui é UM: entender por que ela saiu.",
    "- Deixe claro que é uma pessoa querendo entender, não uma pesquisa automática.",
    "- Diga que basta responder este e-mail, em uma linha se quiser.",
    "- Ofereça saída fácil no fim, numa frase curta, sem destaque.",
    "- Escreva do seu jeito: cada pessoa recebe um texto diferente.",
    "- NÃO use travessão (— ou –).",
    "- Não use marcador nenhum ([MOTIVO], [CREDITAR] etc.) neste primeiro e-mail.",
    "- Assine como Fast, do FastCloner.",
    "",
    "Responda APENAS com o corpo do e-mail em texto puro (sem assunto, sem HTML).",
  ]
    .filter(Boolean)
    .join("\n");
}

function assuntoPara(t: WinbackTargetRow, nome: string | null): string {
  const eu = nome ? `${nome}, ` : "";
  return t.segment === "nunca_ativou" || t.segment === "sem_conta"
    ? `${eu}o que travou por aí?`
    : `${eu}posso te fazer uma pergunta?`;
}

async function primeiroNome(t: WinbackTargetRow): Promise<string | null> {
  if (!t.profile_id) return null;
  const { data } = await getAdmin().from("profiles").select("display_name").eq("id", t.profile_id).maybeSingle();
  const nome = (data as { display_name: string | null } | null)?.display_name?.trim();
  if (!nome) return null;
  const primeiro = nome.split(/\s+/)[0];
  return primeiro.length >= 2 && primeiro.length <= 20 ? primeiro : null;
}

export type EnvioEmail = { email: string; ok: boolean; erro?: string };

/**
 * Manda o e-mail de resgate para quem ainda não recebeu. `limite` controla o
 * lote; o Johnny pediu para "matar tudo hoje", então o padrão é alto.
 */
export async function enviarResgatePorEmail(limite = 200): Promise<{
  enviados: number;
  falhas: number;
  detalhe: EnvioEmail[];
}> {
  const admin = getAdmin();
  const { data } = await admin
    .from("winback_targets")
    .select("*")
    .is("email_sent_at", null)
    .not("status", "in", "(optout,recovered)")
    .order("canceled_at", { ascending: false })
    .limit(limite);

  const alvos = (data ?? []) as WinbackTargetRow[];
  const detalhe: EnvioEmail[] = [];
  let enviados = 0;
  let falhas = 0;

  for (const alvo of alvos) {
    try {
      const nome = await primeiroNome(alvo);
      const conta = alvo.profile_id ? await buildAccountContext(alvo.profile_id) : null;
      const system = `${buildAgentSystem()}\n\n${winbackMission(alvo, 0)}`;
      const corpo = tirarCaraDeRobo(
        (await agentComplete(system, instrucaoEmail(alvo, nome, conta), { maxTokens: 500 }))
          .replace(/\[(MOTIVO|CREDITAR|SAIR|ESCALAR[^\]]*)[^\]]*\]/gi, "")
          .trim(),
      );
      if (!corpo) throw new Error("texto vazio");

      await sendSupportMail({
        to: alvo.email,
        subject: assuntoPara(alvo, nome),
        text: corpo,
      });

      const agora = new Date().toISOString();
      await admin
        .from("winback_targets")
        .update({
          email_sent_at: agora,
          status: alvo.status === "pending" ? "sent" : alvo.status,
          sent_at: alvo.sent_at ?? agora,
          updated_at: agora,
        } as never)
        .eq("id", alvo.id);

      enviados++;
      detalhe.push({ email: alvo.email, ok: true });
      console.log(`[winback/email] enviado para ${alvo.email} (${alvo.segment})`);
    } catch (e) {
      falhas++;
      const erro = e instanceof Error ? e.message : "?";
      detalhe.push({ email: alvo.email, ok: false, erro });
      console.error(`[winback/email] falhou para ${alvo.email}: ${erro}`);
    }
    await sleep(PAUSA_MS);
  }

  return { enviados, falhas, detalhe };
}
