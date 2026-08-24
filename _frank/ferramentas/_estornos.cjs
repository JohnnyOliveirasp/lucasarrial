/**
 * A LISTA de verdade dos ref_type de estorno. Chamado #113.
 *
 * POR QUE ISTO EXISTE (e por que nao e frescura de nomenclatura):
 * a ordem de 20/08 gravou "ESTORNO se confere por ref_type='generation_refund'".
 * A metade "nunca por kind" esta certa. A outra metade erra na MESMA direcao do
 * acidente que a ordem queria evitar: faz o aluno JA ESTORNADO parecer NAO
 * estornado - o falso negativo que paga em dobro.
 *
 * MEDIDO EM 23/08 (553 linhas de estorno no banco):
 *   image_refund 157 · video_clone_refund 156 · image_video_refund 71 ·
 *   voice_train_refund 69 · generation_refund 52 · studio_scene_refund 29 ·
 *   estorno_de_engano 14 · estorno 3 · support_refund 2
 *
 * Conferir so por generation_refund enxerga 52/553 = 9,4%.
 *
 * ⚠️ A PEGADINHA QUE SOBRA depois da correcao obvia: `estorno_de_engano` e
 * `estorno` (17 linhas) NAO terminam em "_refund". Quem "consertar" trocando
 * generation_refund por LIKE '%_refund' continua cego pra esses 17.
 *
 * COMO CONFERIR DE VERDADE: case o `ref_id` com o id do objeto que falhou e
 * some o SINAL do amount (debito negativo + estorno positivo = 0 -> quitado).
 * A lista abaixo e o filtro; o casamento por ref_id e a prova.
 */

/** Todos os ref_type que significam "devolvemos credito". */
const REF_TYPES_ESTORNO = [
  "image_refund",
  "video_clone_refund",
  "image_video_refund",
  "voice_train_refund",
  "generation_refund",
  "studio_scene_refund",
  "support_refund",
  // Os dois sem "_refund" no nome — a pegadinha:
  "estorno_de_engano",
  "estorno",
];

/** Qual ref_type cada feature grava, pra conferencia de UM objeto. */
const POR_FEATURE = {
  audio: "generation_refund",
  imagem: "image_refund",
  imagem_video: "image_video_refund",
  video_clone: "video_clone_refund",
  treino_voz: "voice_train_refund",
  cena_studio: "studio_scene_refund",
};

function ehEstorno(refType) {
  return REF_TYPES_ESTORNO.includes(String(refType ?? ""));
}

/**
 * Avisa se apareceu ref_type de estorno que a lista nao conhece.
 * Lista fixa envelhece calada - e envelhecer calada aqui custa dinheiro.
 * Passe o client do supabase (_comum.cjs).
 */
async function conferirListaCompleta(db) {
  const { data, error } = await db
    .from("credit_transactions")
    .select("ref_type")
    .gt("amount", 0)
    .limit(5000);
  if (error) return { ok: false, erro: error.message, novos: [] };
  const vistos = new Set((data ?? []).map((t) => t.ref_type).filter(Boolean));
  const suspeitos = [...vistos].filter(
    (t) => !REF_TYPES_ESTORNO.includes(t) && /refund|estorn|devolu/i.test(t),
  );
  return { ok: suspeitos.length === 0, erro: null, novos: suspeitos };
}

module.exports = { REF_TYPES_ESTORNO, POR_FEATURE, ehEstorno, conferirListaCompleta };
