/**
 * POST /api/v1/agent/actions — ações do agente de monitoramento (token
 * dedicado). Ações permitidas (escopo curto de propósito):
 *  - add_note    {incident_id, note}                  → anota diagnóstico no incidente
 *  - set_status  {incident_id, status, resolution_note?, resolved_commit?}
 *  - set_state   {key, value}                          → memória persistente do agente
 *  - notify      {subject, body}                       → e-mail pro admin (Johnny)
 *  - ask_humans  {subject, question, ...}              → pede um olho humano no grupo
 * O agente NÃO tem ação de deploy nem escrita fora destas tabelas.
 */
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { closureFields } from "@/lib/incidents/closure";
import { isIncidentStatus } from "@/lib/incidents/status";
import { sendEmail } from "@/lib/email/resend";
import { sendAgentText } from "@/lib/agent/provider";
import { createPresignedGet } from "@/lib/r2/presigned";
import { R2_BUCKETS, imagesBucket } from "@/lib/r2/client";
import { logger } from "@/lib/logger/server";

export const dynamic = "force-dynamic";

const ADMIN_NOTIFY_EMAIL = "johnny.oliveirasp@gmail.com";

/** Grupo interno da equipe (o mesmo do `_frank/ferramentas/avisar_grupo.cjs`). */
const TEAM_GROUP_JID = process.env.AGENT_TEAM_GROUP_JID || "120363428193217427@g.us";

/** Quanto tempo o link do áudio/imagem vive. Curto demais e ninguém chega a
 *  tempo de ouvir; o pedido fica no grupo esperando alguém acordar. */
const ASK_LINK_TTL = 24 * 3600;

type AgentNote = { at: string; by: string; note: string };

/**
 * Aceita o chamado pelo NÚMERO (`42`, `#42`) ou pelo uuid — e devolve sempre o
 * uuid, que continua sendo a chave.
 *
 * ⚠️ POR QUE ACEITAR OS DOIS (pedido do Johnny, 21/08): ninguém fala
 * "2c5bab42-9e79-4ed5-9975-fbcb5f4a99df" no telefone nem digita isso num grupo.
 * Na prática todo mundo usava os 8 primeiros caracteres, que é um apelido sem
 * garantia de ser único. Agora o chamado tem número curto (migration 87) e é
 * por ele que se conversa.
 *
 * Tolerante à migration ainda não aplicada: se a coluna `numero` não existe, a
 * consulta falha, a função devolve o valor original e o comportamento é o de
 * antes. Assim código e migration podem subir em qualquer ordem.
 */
async function resolverIncidente(
  admin: ReturnType<typeof getAdmin>,
  valor: unknown,
): Promise<string | null> {
  if (typeof valor === "number" || (typeof valor === "string" && /^#?\d+$/.test(valor.trim()))) {
    const n = Number(String(valor).replace("#", "").trim());
    const { data, error } = await admin
      .from("incidents" as never)
      .select("id")
      .eq("numero", n)
      .maybeSingle();
    if (error) return typeof valor === "string" ? valor : null; // coluna ainda não existe
    return (data as unknown as { id: string } | null)?.id ?? null;
  }
  return typeof valor === "string" && valor ? valor : null;
}

function bucketByName(name: unknown): string {
  if (name === "generations") return R2_BUCKETS.generations;
  if (name === "images") return imagesBucket();
  return R2_BUCKETS.voices;
}

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return badRequest("Missing 'action'");
  const admin = getAdmin();

  try {
    if (body.action === "add_note") {
      const { incident_id: refNota, note } = body;
      if (!refNota || !note) return badRequest("add_note requires incident_id and note");
      const incident_id = await resolverIncidente(admin, refNota);
      if (!incident_id) return badRequest(`incidente ${String(refNota)} nao encontrado`);
      const { data: incRaw } = await admin
        .from("incidents" as never)
        .select("agent_notes")
        .eq("id", incident_id)
        .maybeSingle();
      const inc = incRaw as unknown as { agent_notes: AgentNote[] | null } | null;
      if (!inc) return badRequest("incident not found");
      const notes = Array.isArray(inc.agent_notes) ? inc.agent_notes : [];
      notes.push({ at: new Date().toISOString(), by: "agent", note: String(note).slice(0, 2000) });
      await admin
        .from("incidents" as never)
        .update({ agent_notes: notes } as never)
        .eq("id", incident_id);
      logger.info("audit", "agent.add_note", { incident_id });
      return jsonOk({ ok: true });
    }

    if (body.action === "set_status") {
      const { incident_id: refStatus, status, resolution_note, resolved_commit } = body;
      // A lista de status mora em @/lib/incidents/status — estava copiada aqui
      // e na rota do admin, e cópia é como um status novo entra numa e não
      // entra na outra.
      if (!refStatus || !isIncidentStatus(status)) {
        return badRequest("set_status requires incident_id and valid status");
      }
      const incident_id = await resolverIncidente(admin, refStatus);
      if (!incident_id) return badRequest(`incidente ${String(refStatus)} nao encontrado`);
      const update: Record<string, unknown> = { status };
      if (typeof resolution_note === "string") update.resolution_note = resolution_note.slice(0, 1000);
      if (typeof resolved_commit === "string") update.resolved_commit = resolved_commit.slice(0, 64);
      // ⚠️ "ignored" TAMBEM e fechamento (20/08, incidente do detector de zumbi).
      // So o "fixed" gravava a data, entao todo incidente fechado como ignored
      // ficava sem resolved_at e sumia de qualquer consulta que filtra por data
      // de fechamento. Quem fecha nao pode precisar LEMBRAR de gravar o campo -
      // no dia 20/08 quem sabia do incidente esqueceu assim mesmo.
      // A regra dos 3 campos mora em @/lib/incidents/closure — ver lá por que
      // ela saiu de dentro desta rota.
      Object.assign(update, closureFields(status, "agent"));
      await admin
        .from("incidents" as never)
        .update(update as never)
        .eq("id", incident_id);
      logger.info("audit", "agent.set_status", { incident_id, status });
      return jsonOk({ ok: true });
    }

    if (body.action === "set_state") {
      const { key, value } = body;
      if (!key || typeof key !== "string") return badRequest("set_state requires key");
      await admin
        .from("agent_state" as never)
        .upsert({ key: key.slice(0, 100), value: value ?? null, updated_at: new Date().toISOString() } as never);
      return jsonOk({ ok: true });
    }

    if (body.action === "notify") {
      const { subject, body: text } = body;
      if (!subject || !text) return badRequest("notify requires subject and body");
      await sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `🤖 Vigia FastCloner: ${String(subject).slice(0, 120)}`,
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${String(text)
          .slice(0, 8000)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")}</pre>`,
      });
      logger.info("audit", "agent.notify", { subject: String(subject).slice(0, 120) });
      return jsonOk({ ok: true });
    }

    /**
     * ask_humans — o agente não OUVE e não ENXERGA. Quando a decisão depende
     * de escutar um áudio ou olhar uma imagem, ele para e pede a uma pessoa,
     * no grupo da equipe.
     *
     * POR QUE É UMA ROTA e não um script (medido 21/08): a WAHA só escuta em
     * 127.0.0.1 no Hetzner, e o Frank roda em OUTRA máquina. O
     * `avisar_grupo.cjs` morre com "WAHA ausente nesta máquina" fora do
     * servidor. Aqui o envio acontece dentro do app, que já vive no mesmo
     * host da WAHA — o agente só precisa do token que ele já tem.
     *
     * POR QUE EXISTE (regra 9-D do Frank): o áudio do Marcelo eram DUAS
     * pessoas conversando e o pipeline não tem diarização — retreinar teria
     * gerado "o clone de uma pessoa que não existe", e "existe e tem 43MB"
     * teria passado em qualquer checagem automática. A Claudia teve retreino
     * prometido ANTES de alguém escutar: a voz estava ótima e a "cura" piorou.
     *
     * `audio_key` vira link assinado aqui dentro. Sem link a mensagem morre
     * no grupo: ninguém vai atrás de um pedido que não dá pra abrir.
     */
    if (body.action === "ask_humans") {
      const { subject, question, checked, incident_id, student, audio_key } = body;
      if (!subject || !question) {
        return badRequest("ask_humans requires subject and question");
      }

      let link: string | null = typeof body.link === "string" ? body.link : null;
      if (!link && typeof audio_key === "string" && audio_key) {
        link = await createPresignedGet(bucketByName(body.bucket), audio_key, ASK_LINK_TTL);
      }

      const linhas = [
        "🔎 *Precisa de um olho humano*",
        "",
        `*${String(subject).slice(0, 200)}*`,
        student ? `Aluno: ${String(student).slice(0, 120)}` : null,
        checked ? `Já conferi: ${String(checked).slice(0, 600)}` : null,
        link ? `\nAbrir: ${link}` : null,
        "",
        `❓ ${String(question).slice(0, 600)}`,
        "",
        "_Responda aqui mesmo — o agente lê a resposta e segue._",
        incident_id ? `_(incidente ${String(incident_id).slice(0, 8)})_` : null,
      ].filter((l) => l !== null);

      await sendAgentText(TEAM_GROUP_JID, linhas.join("\n"));

      // O pedido tem que ficar NO incidente também: grupo rola e some, e sem
      // rastro a próxima ronda pergunta de novo a mesma coisa.
      const alvoIncidente = await resolverIncidente(admin, incident_id);
      if (alvoIncidente) {
        const { data: row } = await admin
          .from("incidents" as never)
          .select("agent_notes")
          .eq("id", alvoIncidente)
          .maybeSingle();
        const notes = ((row as unknown as { agent_notes: AgentNote[] } | null)?.agent_notes ??
          []) as AgentNote[];
        notes.push({
          at: new Date().toISOString(),
          by: "agent",
          note: `PEDIDO DE OLHO HUMANO no grupo: ${String(question).slice(0, 300)}${
            link ? " (com link)" : " (SEM LINK — ninguém vai conseguir abrir)"
          }`,
        });
        await admin
          .from("incidents" as never)
          .update({ agent_notes: notes } as never)
          .eq("id", alvoIncidente);
      }

      logger.info("audit", "agent.ask_humans", {
        incident_id: incident_id ?? null,
        has_link: Boolean(link),
      });
      return jsonOk({ ok: true, sent_to: TEAM_GROUP_JID, has_link: Boolean(link) });
    }

    /**
     * tell_frank — o único canal das rotinas para o FRANK.
     *
     * POR QUE EXISTE (medido 21/08). As três ações que o Vigia e o Executor
     * tinham apontavam TODAS pro Johnny: `notify` manda e-mail pro endereço
     * cravado aqui em cima, `PushNotification` vai pro celular dele e
     * `ask_humans` vai pro grupo de humanos. Naquele dia o Executor acionou 3
     * vezes (04:23, 11:23, 12:26) e NENHUMA chegou ao Frank — que é quem
     * conserta. Com o Johnny na estrada a partir de 24/08, ele é exatamente
     * quem não pode ser o destinatário.
     *
     * FAZ AS DUAS COISAS DE PROPÓSITO (decisão do Johnny, 21/08):
     *  B) grava em `agent_state` (`para_frank_*`) — durável, entra na ronda
     *     dele, não se perde se o Telegram falhar ou a mensagem rolar pra cima;
     *  A) manda no Telegram — tempo real, no canal onde ele já lê e onde dá
     *     pra RESPONDER. Testado ponta a ponta em 21/08 13:05: ida e volta em
     *     1 minuto.
     * Não são alternativas: A é o canal, B é a garantia.
     *
     * ⚠️ O `/msg@Frank_agent_007_bot` na PRIMEIRA linha é obrigatório — é o
     * formato que o bot dele aceita.
     *
     * ⚠️ Se o token do Telegram não estiver no servidor, a ação NÃO falha:
     * grava em B e devolve `telegram:false`. Recado que chega tarde é melhor
     * que recado perdido — e o campo diz a verdade sobre o que aconteceu.
     */
    if (body.action === "tell_frank") {
      const { subject, message, incident_id } = body;
      if (!subject || !message) {
        return badRequest("tell_frank requires subject and message");
      }

      // B) durável primeiro: se o Telegram falhar depois, o recado já existe.
      const key = `para_frank_${String(incident_id ?? Date.now()).slice(0, 8)}`;
      await admin.from("agent_state" as never).upsert({
        key,
        value: {
          at: new Date().toISOString(),
          subject: String(subject).slice(0, 200),
          message: String(message).slice(0, 8000),
          incident_id: incident_id ?? null,
          from: "rotina",
        },
        updated_at: new Date().toISOString(),
      } as never);

      // A) tempo real. Sem credencial no servidor, segue sem quebrar.
      let telegram = false;
      const tgToken = process.env.TELEGRAM_BOT_TOKEN;
      const tgChat = process.env.TELEGRAM_CHAT_ID;
      if (tgToken && tgChat) {
        const texto =
          `/msg@Frank_agent_007_bot\n` +
          `🤖 ${String(subject).slice(0, 200)}\n\n` +
          `${String(message).slice(0, 3500)}\n\n` +
          `_(recado gravado em \`${key}\`${incident_id ? `, incidente ${String(incident_id).slice(0, 8)}` : ""})_`;
        try {
          const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: tgChat, text: texto }),
          });
          telegram = r.ok;
        } catch {
          telegram = false; // B já garantiu; a ronda dele pega.
        }
      }

      logger.info("audit", "agent.tell_frank", { key, telegram });
      return jsonOk({ ok: true, key, telegram });
    }

    return badRequest(`unknown action '${body.action}'`);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "agent action failed");
  }
}
