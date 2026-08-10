/**
 * Resgate da Fast — a CONVERSA depois que a pessoa responde. Server-only.
 *
 * Duas responsabilidades:
 *  1. Dizer ao pipeline de resposta que este chat é um resgate (e entregar a
 *     missão pro system prompt, por cima do manual normal da Fast).
 *  2. Executar o que a Carol decidir: gravar o MOTIVO real do cancelamento,
 *     devolver créditos até o teto, e respeitar quem pediu pra não receber
 *     mais mensagens.
 *
 * O que a Carol promete, o sistema entrega — por isso o crédito sai daqui, na
 * mesma hora, e não de um "depois alguém credita".
 */
import { getAdmin } from "@/lib/db/admin";
import { addExtraCredits } from "@/lib/credits/service";
import { winbackMission, WINBACK_CREDITS_HARD_CAP } from "@/lib/winback/script";
import { winbackByChat, winbackByPhone } from "@/lib/winback/targets";
import type { WinbackSettingsRow, WinbackTargetRow } from "@/lib/db/types";

/** Categorias fechadas — é isso que vira estatística no /admin. */
const CATEGORIAS = new Set([
  "preco", "qualidade_voz", "qualidade_video", "bug",
  "nao_usou", "faltou_recurso", "concorrente", "pessoal", "outro",
]);

export type WinbackContext = { target: WinbackTargetRow; systemExtra: string };

/**
 * Este chat é uma conversa de resgate? Devolve a missão pro system prompt.
 * Marca a resposta da pessoa na primeira vez que ela fala (é o sinal de que a
 * abordagem funcionou — e o que segura o freio do disparador).
 */
export async function winbackContext(chatId: string): Promise<WinbackContext | null> {
  let target = await winbackByChat(chatId);

  // Não achou pelo chat? Pode ser o MESMO humano com outro identificador: nós
  // abrimos pelo número, o WhatsApp devolve a resposta por um id anônimo
  // (@lid). Casa pelo telefone e gruda o resgate nesta conversa.
  if (!target) {
    const { data: chat } = await getAdmin()
      .from("agent_chats")
      .select("wa_phone, kind")
      .eq("id", chatId)
      .maybeSingle();
    const phone = (chat as { wa_phone: string | null; kind: string } | null)?.wa_phone;
    if (!phone) return null;
    target = await winbackByPhone(phone);
    if (!target) return null;
    await getAdmin()
      .from("winback_targets")
      .update({ chat_id: chatId, updated_at: new Date().toISOString() } as never)
      .eq("id", target.id);
  }

  if (target.status === "sent") {
    const agora = new Date().toISOString();
    await getAdmin()
      .from("winback_targets")
      .update({ status: "replied", replied_at: agora, delivered_at: target.delivered_at ?? agora, updated_at: agora } as never)
      .eq("id", target.id);
  }

  const { data } = await getAdmin().from("winback_settings").select("*").eq("id", 1).maybeSingle();
  const cap = (data as WinbackSettingsRow | null)?.credits_cap ?? WINBACK_CREDITS_HARD_CAP;
  return { target, systemExtra: winbackMission(target, cap) };
}

function extrair(texto: string, marcador: string): { valor: string | null; limpo: string } {
  const re = new RegExp(`\\[${marcador}:?([^\\]]*)\\]`, "i");
  const m = texto.match(re);
  if (!m) return { valor: null, limpo: texto };
  return { valor: (m[1] ?? "").trim(), limpo: texto.replace(re, "").trim() };
}

/**
 * Processa o que a Carol decidiu nesta mensagem. Devolve o texto LIMPO (os
 * marcadores nunca chegam na pessoa) e o que foi executado.
 * Best-effort: nada aqui pode impedir a resposta de ser enviada.
 */
export async function applyWinbackMarkers(
  target: WinbackTargetRow,
  reply: string,
): Promise<{ clean: string; creditou: number; encerrou: boolean }> {
  const admin = getAdmin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let texto = reply;
  let creditou = 0;
  let encerrou = false;

  // MOTIVO — a resposta que o Johnny quer: por que as pessoas estão saindo.
  const motivo = extrair(texto, "MOTIVO");
  texto = motivo.limpo;
  if (motivo.valor) {
    const [catRaw, ...resto] = motivo.valor.split("|");
    const cat = catRaw.trim().toLowerCase().replace(/\s+/g, "_");
    patch.outcome = CATEGORIAS.has(cat) ? cat : "outro";
    const detalhe = resto.join("|").trim();
    if (detalhe) patch.outcome_detail = detalhe.slice(0, 500);
  }

  // SAIR — pediu pra não receber mais. Vale pra sempre.
  const sair = extrair(texto, "SAIR");
  texto = sair.limpo;
  if (sair.valor !== null) {
    patch.status = "optout";
    encerrou = true;
  }

  // CREDITAR — o que ela prometeu, o sistema entrega na hora.
  const creditar = extrair(texto, "CREDITAR");
  texto = creditar.limpo;
  if (creditar.valor && target.profile_id && target.credits_granted === 0) {
    const { data } = await admin.from("winback_settings").select("credits_cap").eq("id", 1).maybeSingle();
    const cap = Math.min(
      (data as { credits_cap: number } | null)?.credits_cap ?? WINBACK_CREDITS_HARD_CAP,
      WINBACK_CREDITS_HARD_CAP,
    );
    const pedido = Number(creditar.valor.replace(/\D/g, ""));
    const valor = Math.min(Math.max(pedido, 0), cap); // trava dura: nunca acima do teto
    if (valor > 0) {
      const { ok } = await addExtraCredits({
        userId: target.profile_id,
        amount: valor,
        refType: "winback",
        refId: target.id,
      });
      if (ok) {
        creditou = valor;
        patch.credits_granted = valor;
        patch.status = encerrou ? "optout" : "recovered";
      }
    }
  }

  if (Object.keys(patch).length > 1) {
    await admin.from("winback_targets").update(patch as never).eq("id", target.id);
  }
  return { clean: texto.trim(), creditou, encerrou };
}
