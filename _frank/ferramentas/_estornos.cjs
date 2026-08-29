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
  // ⚠️ 29/08, chamado #185: ESTE FALTAVA e a lista ficou 6 dias mentindo.
  // Quem grava: frontend/src/lib/studio/finalize.ts:104 (F0 do Video Estudio,
  // limpeza de audio) — producao desde sempre, nao rascunho. Sem ele,
  // ehEstorno('studio_audio_refund') dava false e os 7 estornos de +3.850 cr da
  // priscillarosseti@hotmail.com (29/08 04:13-04:23Z) liam como NAO ESTORNADOS.
  // Esse e o falso negativo que paga em dobro, exatamente o acidente que este
  // arquivo nasceu pra impedir.
  "studio_audio_refund",
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
  audio_studio: "studio_audio_refund",
};

function ehEstorno(refType) {
  return REF_TYPES_ESTORNO.includes(String(refType ?? ""));
}

/**
 * Avisa se apareceu ref_type de estorno que a lista nao conhece.
 * Lista fixa envelhece calada - e envelhecer calada aqui custa dinheiro.
 * Passe o client do supabase (_comum.cjs).
 *
 * ⚠️ POR QUE ESTE GUARDA FALHOU NA VIDA REAL (medido em 29/08, chamado #185):
 * ele NAO estava so sem ser chamado — ele estava DEVOLVENDO ok:true COM
 * `studio_audio_refund` faltando na lista e 7 linhas dele no banco. Ou seja:
 * mesmo que alguem o tivesse chamado todo dia, ele teria dado verde.
 *
 * A causa e o `.limit(5000)` da versao anterior. O PostgREST REBAIXA em
 * silencio pro teto do projeto: medido, `.limit(5000)` devolveu 1000 de 2.485
 * linhas — o guarda enxergava 40% do banco. As 1.000 primeiras sao dominadas
 * por `payment_event` (1.803 linhas), entao os estornos raros, que sao
 * justamente os que a lista tende a nao conhecer, caem fora da janela. Um
 * guarda que so ve o comeco da tabela e cego exatamente onde precisa enxergar.
 *
 * Por isso aqui PAGINA por `.range()` ate a pagina vir curta, conta as linhas
 * varridas e devolve esse numero: quem chama pode conferir contra o count real
 * e nao acreditar num zero de instrumento cego. Regra da ordem de 20/08:
 * "consulta ao Supabase corta em 1000 linhas: pagine, e imprima o campo error
 * cru antes de acreditar em qualquer zero".
 *
 * Provado em 29/08 antes de somar o tipo na lista: com a lista ANTIGA de 9
 * entradas, esta versao paginada varre 2.485 linhas, ve 22 ref_type distintos
 * e acusa ["studio_audio_refund"]. A versao com .limit(5000) acusava [].
 */
const PASSO_PAGINA = 1000;

async function conferirListaCompleta(db) {
  const vistos = new Set();
  let de = 0;
  let varridas = 0;

  for (;;) {
    const { data, error } = await db
      .from("credit_transactions")
      .select("ref_type")
      .gt("amount", 0)
      // Ordem estavel: sem ela o range() pode repetir/pular linha entre paginas.
      .order("id", { ascending: true })
      .range(de, de + PASSO_PAGINA - 1);
    // O erro CRU sobe, sem traducao: zero silencioso ja custou dinheiro aqui.
    if (error) return { ok: false, erro: error.message, novos: [], varridas };
    const pagina = data ?? [];
    for (const t of pagina) if (t.ref_type) vistos.add(t.ref_type);
    varridas += pagina.length;
    if (pagina.length < PASSO_PAGINA) break;
    de += PASSO_PAGINA;
  }

  const suspeitos = [...vistos].filter(
    (t) => !REF_TYPES_ESTORNO.includes(t) && /refund|estorn|devolu/i.test(t),
  );
  return { ok: suspeitos.length === 0, erro: null, novos: suspeitos, varridas };
}

module.exports = { REF_TYPES_ESTORNO, POR_FEATURE, ehEstorno, conferirListaCompleta };
