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
  // ⚠️ 10/09, chamado #342: ESTES DOIS FALTAVAM e o guarda NAO TINHA COMO ACUSAR
  // (ver `NAO_SAO_DEVOLUCAO` abaixo). `perdao_negativo_onboarding` sozinho eram
  // 65 linhas / 601.375 cr desde 30/08 lendo como NAO ESTORNADAS.
  // Quem grava: frontend/src/lib/credits/service.ts:155-190
  // (`perdoarNegativoDoOnboarding`, chamada de `grantSubscriptionCredits`) —
  // producao desde 30/08 por decisao do Johnny, nao rascunho.
  "perdao_negativo_onboarding",
  "reparo_falha_operacional",
  // ⚠️ 10/09, ronda das 18h40Z: este estava classificado como NAO-devolucao no
  // rascunho deste proprio chamado, e isso repetiria o #185 num tipo novo.
  // PROVA PELO CRITERIO DESTE ARQUIVO (casar ref_id e somar o sinal), medida
  // no banco antes de mover — as DUAS linhas de `compensation` zeram um debito:
  //   ref_id 0c0c08fc… generation -1996 + compensation +1996 = 0
  //   ref_id 957d96eb… generation -1999 + compensation +1999 = 0
  // e a nota das duas diz, com todas as letras, "estorno: eco de referencia na
  // voz Ricardo (corrigido 28/07)". E estorno de geracao de audio com outro
  // nome. Fora da lista, `ehEstorno('compensation')` dava false e quem
  // perguntasse "a geracao 0c0c08fc ja foi ressarcida?" leria NAO — o falso
  // negativo que paga em dobro. O nome enganou; o ref_id nao engana.
  "compensation",
  // ⚠️ 19/09, ronda noturna: ESTE FALTAVA e a lista comecou a mentir no MESMO
  // dia em que o tipo nasceu. Quem grava: frontend/src/app/api/v1/edicao/broll/
  // route.ts:200 (`refundRefType`) — producao, nao rascunho. Medido na hora de
  // somar: 3 linhas / +600 cr / 1 aluna (Leonice, #302, estornadas em c0d7a759).
  // Sem ele, `ehEstorno('edicao_broll_refund')` dava false e quem perguntasse
  // "os b-rolls da Leonice ja foram ressarcidos?" leria NAO e pagaria de novo.
  // Terceira reincidencia da MESMA classe (#185 studio_audio, #342 perdao/
  // compensation, agora esta): todo refundRefType novo nasce fora da lista, e
  // quem o escreve nao sabe que esta lista existe. Por isso o guarda do fim
  // deste arquivo (`ref_type de estorno que a lista nao conhece`) e que pegou —
  // ele apareceu na varredura de hoje antes de qualquer humano notar.
  "edicao_broll_refund",
  // ⚠️ 20/09, ronda das falhas ~11hZ: ESTE FALTAVA e o infrator fui EU MESMO —
  // a ronda das 03h de HOJE criou o tipo pra estornar o #485 (clipe de cena
  // cobrado e nunca devolvido) e nao passou aqui. 6 linhas / +59.400 cr / 6
  // alunos, todas de 20/09 02h-03hZ. Sem ele, `ehEstorno` dava false e quem
  // perguntasse "o Felipe e a Glaucia ja foram ressarcidos?" leria NAO e
  // pagaria de novo — o mesmo falso negativo de sempre.
  // QUARTA reincidencia da classe (#185 studio_audio, #342 perdao/compensation,
  // 19/09 edicao_broll, agora esta). O que mudou pra melhor: o guarda
  // `conferirListaCompleta` acusou em HORAS, nao em dias — rodado hoje, varreu
  // 3.489 linhas e devolveu exatamente ["video_clip_refund_backfill"]. O
  // criterio por EXCLUSAO fez o que foi desenhado pra fazer.
  //
  // PROVA PELO CRITERIO DESTE ARQUIVO (casar ref_id, somar o sinal) — e a
  // armadilha NOVA que ela revelou, espelho da de cima: somando SO
  // `video_clips`, tres alunos PARECEM ter recebido estorno A MAIOR (glaucia
  // +2.640; felipe e josimo +1.320 cada). NAO e verdade. A perna que falta e
  // `video_clip_regen`, que debita a regeracao de clipe em linha propria:
  //   felipe  video_clips -18.480 + video_clip_regen -1.320 = -19.800 · estorno +19.800 -> 0
  //   josimo  video_clips  -9.240 + video_clip_regen -1.320 = -10.560 · estorno +10.560 -> 0
  //   glaucia video_clips  -2.640 + video_clip_regen -2.640 =  -5.280 · estorno  +5.280 -> 0
  // Medir estorno de clipe por UMA perna so faz a conta CERTA parecer ERRADA —
  // e uma ronda apressada "corrigiria" tirando credito de aluno pagante, que e
  // exatamente o que a 9-A proibe. Quem conferir clipe de cena soma AS DUAS.
  // (A Priscilla fica com liquido negativo de proposito: recebeu 19 cenas e o
  // estorno cobriu so o que nao foi entregue — ver o log das 03h.)
  "video_clip_refund_backfill",
];

/**
 * O que entra em `credit_transactions` com `amount > 0` e NAO e devolucao.
 *
 * Isto e a metade que faltava do guarda. Ela existe porque o criterio antigo
 * suspeitava por NOME (`/refund|estorn|devolu/i`) — uma allowlist de regex que
 * envelhece calada exatamente como a lista que ela deveria proteger. Os dois
 * tipos somados acima nasceram DEPOIS do #185 e nenhum dos dois casa o regex:
 * o guarda deu verde por 11 dias com 65 linhas de devolucao desconhecida no banco.
 *
 * Com as duas listas explicitas, ref_type NOVO nasce ACUSANDO em vez de nascer
 * invisivel — que e a unica propriedade que importa num guarda contra
 * esquecimento. Cadastrar aqui e uma decisao consciente ("isto nao e devolucao");
 * esquecer nao e mais uma opcao silenciosa.
 *
 * Duas familias:
 *  - COMPRA/CICLO: dinheiro entrando, nao voltando.
 *  - CORTESIA/BONUS: credito concedido de graca. NAO e devolucao — quem conferir
 *    "ja foi ressarcido?" nao pode ler um bonus de campanha como estorno de falha.
 */
const NAO_SAO_DEVOLUCAO = [
  // compra / ciclo
  "payment_event",
  "stripe_session",
  // cortesia, bonus e campanha
  "winback",
  "courtesy_grant",
  "courtesy_test_access",
  "courtesy_video_clone",
  "bonus_cortesia",
  "admin_grant",
  "credit_campaign",
  "stock_seed",
  // ⚠️ `compensation` NAO mora aqui — parece bonus pelo nome, mas casa ref_id
  // com o debito e zera. Esta em REF_TYPES_ESTORNO, com a medicao anotada la.
  "incident_apology",
  "incident_apology_bonus",
  "backlog_apology_bonus",
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
 *
 * ⚠️ POR QUE ELE FALHOU DE NOVO, POR OUTRO MOTIVO (medido 10/09, chamado #342):
 * consertada a JANELA em 29/08, sobrou o CRITERIO. Ele so suspeitava de nome que
 * casasse `/refund|estorn|devolu/i` — entao `perdao_negativo_onboarding` (65
 * linhas, 601.375 cr, producao desde 30/08) e `reparo_falha_operacional` eram
 * invisiveis POR CONSTRUCAO, e a varredura imprimiu "nenhum tipo desconhecido"
 * por 11 dias seguidos. Um guarda que adivinha pelo nome so pega quem se
 * comporta; o tipo perigoso e justamente o que ninguem batizou direito.
 *
 * Agora o criterio e por EXCLUSAO, com as duas listas explicitas: e devolucao
 * conhecida (`REF_TYPES_ESTORNO`), ou e sabidamente-nao-devolucao
 * (`NAO_SAO_DEVOLUCAO`), ou ACUSA. Nome nao entra na conta. Isso troca o modo de
 * falha: antes, tipo novo nascia invisivel e calado; agora nasce acusando e
 * alguem precisa dizer conscientemente em qual das duas listas ele entra.
 * O preco e ruido quando aparece tipo novo legitimo — que e o preco certo.
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

  const suspeitos = classificarDesconhecidos([...vistos]);
  return { ok: suspeitos.length === 0, erro: null, novos: suspeitos, varridas };
}

/**
 * O criterio, isolado pra poder ser testado sem banco.
 * Devolve os ref_type que nao estao em NENHUMA das duas listas.
 */
function classificarDesconhecidos(refTypes) {
  return [...new Set(refTypes)]
    .filter((t) => t)
    .filter((t) => !REF_TYPES_ESTORNO.includes(t) && !NAO_SAO_DEVOLUCAO.includes(t));
}

module.exports = {
  REF_TYPES_ESTORNO,
  NAO_SAO_DEVOLUCAO,
  POR_FEATURE,
  ehEstorno,
  classificarDesconhecidos,
  conferirListaCompleta,
};
