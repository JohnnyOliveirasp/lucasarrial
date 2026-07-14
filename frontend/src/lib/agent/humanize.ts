/**
 * Agente de suporte — simulação de digitação humana. Server-only.
 * Resposta instantânea de parágrafo único "cheira a robô": aqui a Mary marca
 * como lida, mostra "digitando…" por um tempo proporcional ao texto e, no
 * privado, quebra respostas longas em até 3 mensagens (como gente faz).
 * Best-effort: typing é cosmético; falha nele nunca impede o envio.
 */
import { sendAgentText, sendSeen, setTyping } from "@/lib/agent/provider";

const MAX_PARTS = 3;
const MS_PER_CHAR = 35; // ~"velocidade de digitação" percebida
const MIN_TYPING_MS = 1_200;
const MAX_TYPING_MS = 7_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function typingMs(text: string): number {
  return Math.min(Math.max(text.length * MS_PER_CHAR, MIN_TYPING_MS), MAX_TYPING_MS);
}

/**
 * Quebra a resposta em mensagens como uma pessoa mandaria: por parágrafo
 * (linha em branco), no máximo MAX_PARTS — o excedente gruda na última.
 * Grupo fica em mensagem ÚNICA (a resposta sai citando quem marcou).
 */
export function splitReply(text: string, group: boolean): string[] {
  const clean = text.trim();
  if (group || !clean) return clean ? [clean] : [];
  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) return [clean];
  const parts = paras.slice(0, MAX_PARTS - 1);
  const rest = paras.slice(MAX_PARTS - 1).join("\n\n");
  if (rest) parts.push(rest);
  return parts;
}

export type SentPart = { waMessageId: string | null; text: string };

/**
 * Envia a resposta com "cara de humano": visto → digitando… → envia (por
 * parte). Devolve as partes enviadas com seus ids (pro dedupe do eco).
 * O replyTo (citação em grupo) vai só na primeira parte.
 */
export async function sendHumanized(
  jid: string,
  reply: string,
  opts: { group: boolean; replyTo?: string | null },
): Promise<SentPart[]> {
  const parts = splitReply(reply, opts.group);
  const sent: SentPart[] = [];
  await sendSeen(jid);
  for (let i = 0; i < parts.length; i++) {
    await setTyping(jid, true);
    await sleep(typingMs(parts[i]));
    await setTyping(jid, false);
    const id = await sendAgentText(jid, parts[i], {
      replyTo: i === 0 ? (opts.replyTo ?? null) : null,
    });
    sent.push({ waMessageId: id, text: parts[i] });
  }
  return sent;
}
