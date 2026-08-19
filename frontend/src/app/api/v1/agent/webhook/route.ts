/**
 * POST /api/v1/agent/webhook?token=... — recebe os eventos da Evolution API
 * (instância do WhatsApp do suporte). MESSAGES_UPSERT → grava no banco (F0)
 * e aciona a IA quando os guards permitem (F1: privado + allowlist).
 * Segurança: a Evolution não assina o payload — o gate é o token secreto na
 * URL (env AGENT_WEBHOOK_TOKEN), configurado só no webhook da instância.
 * Responde 200 SEMPRE que autenticado (a Evolution re-tenta em erro).
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { ingestMessage, type EvolutionMessage } from "@/lib/agent/ingest";
import { maybeRespond, pauseChatForHuman } from "@/lib/agent/respond";
import { phoneFromJid } from "@/lib/agent/account";
import { winbackByPhone } from "@/lib/winback/targets";

type EvolutionWebhook = {
  event?: string;
  instance?: string;
  data?: unknown;
  /** WAHA: { event: "message", session, payload: {...} } */
  session?: string;
  payload?: WahaMessagePayload;
};

type WahaMessagePayload = {
  id?: string;
  from?: string;
  to?: string;
  fromMe?: boolean;
  /** "api" = enviado pelo nosso sistema · "app" = digitado no celular/web. */
  source?: string;
  participant?: string | null;
  body?: string;
  hasMedia?: boolean;
  media?: { url?: string; mimetype?: string } | null;
  mentionedIds?: string[];
  _data?: { notifyName?: string; Info?: { PushName?: string } };
};

/**
 * Nomes que CHAMAM a agente num grupo, além da menção @número.
 *
 * Em grupo ninguém marca o número: as pessoas escrevem "Carol, dá uma olhada
 * nisso". Sem isso, a única forma de chamá-la seria o @, e a alternativa era
 * ela responder sozinha ao burburinho — que é justamente o que não pode
 * acontecer num grupo interno da equipe (ordem do Johnny, 19/08).
 */
const AGENT_NAMES = (process.env.AGENT_NAMES ?? "carol,fast")
  .split(",")
  .map((n) => n.trim().toLowerCase())
  .filter(Boolean);

/** O texto chama a agente pelo nome? Casa palavra inteira, em qualquer lugar
 *  da frase, com ou sem @ na frente ("Carol", "@carol", "ei carol,"). */
function callsAgentByName(body: string): boolean {
  if (!body || AGENT_NAMES.length === 0) return false;
  const texto = body.toLowerCase();
  return AGENT_NAMES.some((nome) =>
    new RegExp(`(^|[^\p{L}\p{N}])@?${nome}([^\p{L}\p{N}]|$)`, "u").test(texto),
  );
}

/** A mensagem marca (@) o número do suporte, ou chama pelo nome? Olha o corpo,
 *  a lista de menções normalizada E o payload cru (GOWS aninha o contextInfo
 *  fundo). */
function mentionsAgent(p: WahaMessagePayload): boolean {
  const body = p.body ?? "";
  // Nome vale como chamado — é assim que gente chama alguém num grupo.
  if (callsAgentByName(body)) return true;
  const selfIds = (process.env.AGENT_SELF_IDS ?? "")
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .filter(Boolean);
  if (selfIds.length === 0) return false;
  if (selfIds.some((id) => body.includes(`@${id}`))) return true;
  const mentioned = (p.mentionedIds ?? []).map((j) => j.replace(/\D/g, ""));
  if (mentioned.some((d) => selfIds.includes(d))) return true;
  try {
    const raw = JSON.stringify(p._data ?? {});
    return selfIds.some((id) => raw.includes(`${id}@lid`) || raw.includes(`${id}@s.whatsapp.net`) || raw.includes(`${id}@c.us`));
  } catch {
    return false;
  }
}

/** Converte o payload da WAHA (webjs/gows) pro shape Evolution/Baileys do ingest. */
function wahaToEvolution(p: WahaMessagePayload): { m: EvolutionMessage; mediaUrl: string | null } {
  const norm = (jid: string | null | undefined) =>
    (jid ?? "").replace(/@c\.us$/, "@s.whatsapp.net");
  const mime = p.media?.mimetype ?? "";
  const messageType = !p.hasMedia
    ? "conversation"
    : mime.startsWith("audio")
      ? "audioMessage"
      : mime.startsWith("image")
        ? "imageMessage"
        : mime.startsWith("video")
          ? "videoMessage"
          : "documentMessage";
  return {
    m: {
      key: {
        remoteJid: norm(p.from),
        fromMe: p.fromMe === true,
        // id serializado do webjs: "false_1321...@c.us_<ID>" → só o <ID>
        // (mesmo valor que o sendText devolve — o dedupe do eco depende disso)
        id: (p.id ?? "").split("_").pop() || p.id || undefined,
        participant: p.participant ? norm(p.participant) : undefined,
      },
      // webjs = notifyName · gows = Info.PushName
      pushName: p._data?.notifyName ?? p._data?.Info?.PushName,
      messageType,
      message: { conversation: p.body || undefined },
    },
    mediaUrl: p.media?.url ?? null,
  };
}

export async function POST(request: NextRequest) {
  const token = process.env.AGENT_WEBHOOK_TOKEN;
  if (!token || request.nextUrl.searchParams.get("token") !== token) {
    return jsonError("unauthorized", "Invalid token", 401);
  }

  let payload: EvolutionWebhook;
  try {
    payload = (await request.json()) as EvolutionWebhook;
  } catch {
    return jsonOk({ handled: false });
  }

  const event = (payload.event ?? "").toLowerCase().replace(/_/g, ".");

  // WAHA (webjs/gows): evento "message"/"message.any" com payload plano.
  if ((event === "message" || event === "message.any") && payload.payload) {
    const p = payload.payload;
    // Eco do que NÓS enviamos pela API (resposta da IA / painel): o pipeline
    // já gravou a mensagem — descarta (e o dedupe segura qualquer corrida).
    if (p.fromMe && p.source === "api") return jsonOk({ handled: "api_echo" });

    const { m, mediaUrl } = wahaToEvolution(p);
    const ingested = await ingestMessage(m, {
      mediaUrl,
      mediaType: p.media?.mimetype ?? null,
      mentioned: mentionsAgent(p),
      replyToId: p.id ?? null,
    });
    if (ingested?.fromMe) {
      // Humano respondeu pelo CELULAR/web → auto-pausa a IA nessa conversa.
      // EXCEÇÃO (11/08): abertura do RESGATE enviada pelo CELULAR (a tranca
      // da Meta proíbe o SERVIDOR de iniciar contato até 18/08; o celular
      // pode). Se o número é alvo do winback, a Carol continua DONA da
      // conversa — pausar aqui silenciava ela pra sempre (caso Gustavo).
      const phone =
        ingested.chat.wa_phone ?? (await phoneFromJid(ingested.chat.wa_jid).catch(() => null));
      const target = phone ? await winbackByPhone(phone) : null;
      if (!target) await pauseChatForHuman(ingested.chat.id);
    } else if (ingested) {
      await maybeRespond(ingested);
    }
    return jsonOk({ handled: "waha_message" });
  }

  if (event === "messages.upsert" && payload.data) {
    // O upsert pode vir como 1 mensagem ou como lote { messages: [...] }.
    const d = payload.data as { messages?: EvolutionMessage[] } & EvolutionMessage;
    const list = Array.isArray(d.messages) ? d.messages : [d];
    for (const m of list) {
      const ingested = await ingestMessage(m);
      if (ingested) await maybeRespond(ingested);
    }
    return jsonOk({ handled: "messages", count: list.length });
  }

  return jsonOk({ handled: "ignored", event });
}
