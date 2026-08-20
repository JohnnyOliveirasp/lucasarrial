/**
 * Apaga o aviso de "sem créditos" que ficou grudado na voz DEPOIS que o
 * crédito entrou.
 *
 * ⚠️ POR QUE EXISTE (incidente bea487b7, 20/08): quando o treino esbarra em
 * saldo, a gente grava a frase em `voices.error_message` — "Treinar a voz
 * custa 10.000 créditos e você tem 0. Assine ou recarregue e clique em
 * Treinar." O texto está certo NO MOMENTO em que é escrito. O problema é que
 * ninguém apaga: o aluno assina, o crédito entra, e a tela continua dizendo
 * que ele tem 0. Ele lê, acredita, e não clica em Treinar.
 *
 * Foi assim que ms.sobadjian e celsopinto ficaram 63,8h e 61,9h parados com
 * 100.000 créditos no bolso, e o aabfa1e5 antes deles com 58h. A tela mentiu,
 * não o saldo.
 *
 * A limpeza roda no ÚNICO momento em que a frase pode ter virado mentira: a
 * entrada de crédito. Ver `credits/service.ts`.
 *
 * ⚠️ Só apaga o que ela mesma escreveu. Aviso de áudio curto, de falha de
 * treino ou qualquer outro fica intacto — apagar aviso legítimo esconderia
 * problema de verdade, que é o oposto do que este arquivo serve.
 */
import { getAdmin } from "@/lib/db/admin";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";

/** As duas frases que a plataforma escreve quando falta crédito pra treinar. */
const MARCAS_DE_SALDO = [
  "Treinar a voz custa",       // lib/onboarding/treino.ts (treino automático)
  "Créditos insuficientes",    // api/v1/voices/[id]/start-training (botão)
];

const ehAvisoDeSaldo = (msg: string | null): boolean =>
  !!msg && MARCAS_DE_SALDO.some((m) => msg.includes(m));

/**
 * Limpa o aviso nas vozes que ainda esperam treino, se o saldo agora cobre o
 * treino. Nunca lança: crédito que entrou não pode ser desfeito por causa de
 * uma limpeza cosmética — no pior caso o aviso continua e alguém vê de novo.
 *
 * @param saldoAtual saldo JÁ com o crédito novo (o que a RPC devolveu).
 * @returns quantas vozes foram destravadas (0 = nada a fazer).
 */
export async function destravarAvisoDeCredito(
  userId: string,
  saldoAtual: number,
): Promise<number> {
  // Ainda não dá pra treinar: a frase continua VERDADE, então continua na tela.
  if (saldoAtual < TRAINING_CREDIT_COST) return 0;

  try {
    const admin = getAdmin();
    const { data, error } = await admin
      .from("voices")
      .select("id, error_message")
      .eq("user_id", userId)
      .eq("status", "awaiting_training")
      .not("error_message", "is", null);
    if (error || !data?.length) return 0;

    const alvos = data.filter((v) => ehAvisoDeSaldo(v.error_message)).map((v) => v.id);
    if (!alvos.length) return 0;

    const { error: errUpd } = await admin
      .from("voices")
      .update({ error_message: null })
      .in("id", alvos);
    if (errUpd) return 0;

    console.info(
      `[destravar-aviso-credito] ${alvos.length} voz(es) destravada(s) ` +
      `para ${userId} (saldo ${saldoAtual})`,
    );
    return alvos.length;
  } catch {
    return 0;
  }
}
