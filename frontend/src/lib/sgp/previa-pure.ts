/**
 * SGP — QUAL imagem e QUAL áudio a tela 5 (/sgp/acompanhar) pode mostrar.
 *
 * Johnny 29/08: *"o aluno no final habilitará um botão entrar no sistema, onde
 * a partir daí ele precisa fazer a assinatura, MAS ELE JÁ VAI CONSEGUIR VER A
 * IMAGEM CLONE DELE GERADO E O ÁUDIO GERADO"*. Essa prévia é a única prova de
 * valor que o aluno recebe ANTES de decidir assinar — e a regra comercial é que
 * SGP não dá FastCloner (ele PRECISA assinar). Tela sem prova é tela sem motivo.
 *
 * ⚠️ POR QUE ISTO É UM MÓDULO PURO E SEPARADO. A tela 5 NÃO EXIGE LOGIN (é a
 * continuação do wizard, pela sessão httpOnly). Então "qual linha pode aparecer"
 * é decisão de SEGURANÇA, não de layout, e precisa de teste próprio — o resto do
 * `previa.ts` importa Supabase e R2 e não sobe num `node --test`.
 *
 * O risco é REAL, não teórico. Medido em 03/09 no pedido de lucas.m.arrial@gmail.com:
 * ele tem 5 linhas em `generations`, sendo 4 de OUTRA voz (1bf3f56e…, pessoal:
 * "Teste A/B da equipe", dois mp3 de 43s e 36s) e só 1 da voz do pedido SGP
 * (acee4794…). Filtrar só por `user_id` mostraria material privado dele numa
 * página sem login; filtrar por `user_id` + nome da amostra pegaria a amostra
 * ERRADA (a da voz antiga). Por isso o par `voice_id` DO PEDIDO + nome é
 * obrigatório, e é re-conferido aqui mesmo que a query já filtre — defesa em
 * profundidade: se alguém afrouxar o `where` lá na frente, isto ainda barra.
 */

/** Marca das imagens geradas pelo onboarding/SGP (lib/onboarding/avatares.ts). */
export const SGP_IDEA_AVATAR = "onboarding_avatar";
/**
 * Nome da amostra que o worker gera com a voz nova no fim do treino
 * (lib/voices/finalize-training.ts). É o "áudio gerado" do pedido do Johnny:
 * a voz clonada falando, não o material que o aluno enviou.
 */
export const SGP_NOME_AMOSTRA = "Amostra automática";

export type LinhaImagem = {
  user_id: string | null;
  idea: string | null;
  status: string | null;
  image_path: string | null;
  created_at?: string | null;
};

export type LinhaAudio = {
  user_id: string | null;
  voice_id: string | null;
  name: string | null;
  status: string | null;
  audio_path: string | null;
  duration_seconds?: number | null;
};

function vazio(s: string | null | undefined): boolean {
  return typeof s !== "string" || s.trim() === "";
}

/**
 * A chave R2 da foto clone do pedido, ou null. Só imagem do PRÓPRIO aluno,
 * marcada como avatar do onboarding e já `ready` — nada de imagem que ele
 * gerou depois na plataforma.
 */
export function escolherImagem(userId: string | null, linhas: readonly LinhaImagem[]): string | null {
  if (vazio(userId)) return null;
  const validas = linhas.filter(
    (l) =>
      l.user_id === userId &&
      l.idea === SGP_IDEA_AVATAR &&
      l.status === "ready" &&
      !vazio(l.image_path),
  );
  if (validas.length === 0) return null;
  // Mais recente primeiro: re-geração manual do avatar deve ganhar da antiga.
  const ordenadas = [...validas].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return ordenadas[0].image_path;
}

/**
 * A chave R2 da amostra da voz DESTE pedido, ou null.
 *
 * `voiceId` é o `sgp_pedidos.voice_id` — a voz que o pedido criou. Sem ele não
 * há prévia de áudio: melhor não mostrar nada do que mostrar a voz errada (ou,
 * pior, uma geração pessoal do aluno numa página sem login).
 */
export function escolherAudio(
  userId: string | null,
  voiceId: string | null,
  linhas: readonly LinhaAudio[],
): { key: string; segundos: number | null } | null {
  if (vazio(userId) || vazio(voiceId)) return null;
  const achada = linhas.find(
    (l) =>
      l.user_id === userId &&
      l.voice_id === voiceId &&
      l.name === SGP_NOME_AMOSTRA &&
      l.status === "ready" &&
      !vazio(l.audio_path),
  );
  return achada ? { key: achada.audio_path as string, segundos: achada.duration_seconds ?? null } : null;
}
