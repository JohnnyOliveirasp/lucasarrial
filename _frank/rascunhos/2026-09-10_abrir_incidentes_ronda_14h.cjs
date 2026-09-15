#!/usr/bin/env node
/**
 * Abre os DOIS defeitos medidos na ronda das falhas de 10/09 ~13hZ.
 * Sem --confirmar, só imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

// ─────────────────────────────────────────────────────────────────────────────
const SGP_AFETADOS = [
  "francaanampf@gmail.com", "otnielbarbosa@gmail.com", "iran@ogr.com.br",
  "patriciapio007@gmail.com", "neilamagalhaes79@gmail.com",
  "mateusanalistadenegocios@gmail.com", "frfaria.1980@gmail.com",
  "schiavojr77@gmail.com", "carlaneavatar@gmail.com", "souzaprado@gmail.com",
  "danilo.cntcont@gmail.com", "welrisson@gmail.com", "jasf.junior@gmail.com",
  "evelyn.cheida@gmail.com", "drbrunoa@gmail.com", "edust@live.com",
];

const SGP_TITULO =
  "O ONBOARDING DO SGP DEBITAVA DA CARTEIRA DO COMPRADOR O MATERIAL QUE A CASA ENTREGA: " +
  "treino.ts:155 (-10.000) + avatares.ts:153 (-525) = -10.525 numa carteira que o SGP nunca credita. " +
  "16 perfis negativos (-168.400). CAUSA CORRIGIDA EM PRODUCAO (fdcba70, PR #228); sobra a devolucao";

const SGP_DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~13hZ, EM PRODUCAO.
Nao e a planilha (ordem de 29/08): e o portal /sgp e o onboarding, os dois em producao.

POR QUE ESTE CHAMADO NASCE JA COM O CONSERTO NO AR
O defeito nunca teve chamado. Ele foi medido pelo Vigia dentro de uma NOTA do #312
(ronda de 10/09 00hZ, caso welrisson@gmail.com) e virou o PR #228 sem card proprio.
Abro agora para que (a) o residuo nao viva so no corpo de um PR fechado e (b) a
correcao de fato do numero abaixo fique rastreavel. O teste de bolso da ordem de
27/08 responde SIM: se o codigo estivesse certo, nenhum comprador teria saldo negativo.

O DEFEITO, COM ARQUIVO:LINHA (estado ANTES do fdcba70)
frontend/src/lib/onboarding/treino.ts:155     -> debitCreditsOnboarding 10.000 (treino da voz)
frontend/src/lib/onboarding/avatares.ts:153   -> debitCreditsOnboarding    525 (avatar)
frontend/src/lib/sgp/processar.ts:224,230     -> chamava os dois SEM distinguir a origem

Comprar o SGP (produto 7283229) NAO concede credito nenhum — regra comercial da casa.
O debito caia numa carteira vazia e o saldo ia a -10.525. O negativo do onboarding e
autorizado (migration 88, decisao do Johnny de 21/08), mas sob a premissa escrita na
propria migration: "a divida e descontada sozinha quando os 100k entrarem". Na PLANILHA
a premissa vale. No SGP ela e falsa: o comprador pode nunca assinar.

A MEDICAO (10/09 13hZ, varredura paginada, so leitura)
356 debitos de onboarding no extrato, janela 17/08 .. 10/09, 116 usuarios.
  SGP, negativo AGORA ............ 16 perfis   -168.400
  SGP, ja restaurado pelo perdao .. 11 perfis   -115.775 (todos com linha perdao_negativo_onboarding)
  planilha (fora deste card) ...... 89 perfis
⚠️ ERAM 14 AS 00h26Z E SAO 16 AS 13hZ. Dois perfis novos em ~12h: a causa estava
viva ate o merge de hoje. Isso e o alcance do conserto, medido, nao estimado.

O QUE JA FOI FEITO (por mim, nesta ronda)
1. PR #228 revisado contra a MAIN DE AGORA (nao contra a base do PR): merge-tree
   com ZERO conflito; tsc --noEmit com o unico erro pre-existente
   (resgate-audio.test.ts, 'vitest', PR #185); node --test em credits+sgp+
   onboarding+voices = 219 testes, 211 pass, 1 fail (o mesmo pre-existente), 7 skip.
   Cobertura de chamadores conferida: gerarAvatares e dispararTreinoOnboarding tem
   2 chamadores cada (onboarding/import = planilha, default preservado; sgp/processar
   = "sgp"). Nenhum caminho do SGP ficou de fora.
2. MERGEADO: fdcba70. Deploy Frontend (production) run 34478649270 completed/SUCCESS
   as 12:49:46Z, headSha=fdcba70 — conferi o DESFECHO do run, nao o disparo. Sem migration.
3. DEVOLVIDO a neilamagalhaes79@gmail.com: +10.525, linha adf18e12, ref_type
   perdao_negativo_onboarding. Relido do banco depois de gravar: extra=0, total=95.898.
   Aluna avisada por e-mail (Enviados uid 1601, copia CONFIRMADA).

⚠️ CORRECAO FACTUAL DO CORPO DO PR #228 — LEIA ANTES DE EXECUTAR A REMEDIACAO
O PR afirma que neilamagalhaes79 e carlaneavatar sao "assinantes PAGANTES" e que
"pagaram R$97 por 100.000". ISSO ESTA ERRADO E EU MEDI. Os dois entitlements sao do
produto 7851642 com raw_event->purchase->price->value = "0", e pagou_de_verdade.cjs
na Hotmart viva devolve SEM PAGAMENTO para os dois enderecos (assinaturas: 1, valor
R$ 0,00 APPROVED; avulsas pagas: 0; stripe: 0). Sao TRIAL de R$ 0, nao pagantes.
E exatamente a armadilha que o proprio #305/aviso-orfao (a49f432, mergeado hoje)
existe pra matar, e que a varredura repete em caixa alta: "acesso vivo != pagou —
inclui trial R$0". Quem executar a remediacao lendo o PR trata trial como pagante.

POR QUE DEVOLVI A UMA E NAO A OUTRA (e nao as 16)
- neilamagalhaes79: trial ATIVO ate 14/09. O debito comeu 10,5% do que o trial dela
  concedeu, dentro da janela em que ela ainda usa. Devolvido (regra 9-B: 10.525 <
  teto de 20.000 por caso; devolucoes do dia 13.645 -> 24.170, bem abaixo do teto
  diario de 100.000 — somado DO BANCO, e so os ref_type de devolucao: somar tambem
  subscription_grant faz um dia normal de 11 renovacoes parecer 1,1 MILHAO e congela
  a ronda por engano).
- carlaneavatar: trial VENCIDO hoje as 12:00Z. A regra final de credito diz que quem
  nunca pagou e saiu do trial nao ganha credito novo. Nao devolvi. Se ela assinar,
  perdoarNegativoDoOnboarding zera o negativo no grant (service.ts:129) — nao perde nada.
- os outros 14 (plan=free, sem access_until): NAO devolvi, e nao e por causa do teto.
  E porque o perdao automatico ja cobre o unico momento em que a divida machuca: ao
  assinar, grantSubscriptionCredits chama perdoarNegativoDoOnboarding e zera o extra
  (provado: 11 perfis passaram por esse caminho, com a linha no extrato). Sem assinatura
  eles nao geram nada de qualquer jeito, entao o saldo negativo nao os impede de nada hoje.

O QUE SOBRA, E E O QUE MANTEM ESTE CHAMADO ABERTO
(a) RESIDUO MEDIDO: 15 perfis seguem em -10.525 (16 menos a neila). Nenhum e pagante
    confirmado. Devolver os 15 = 157.875, o que PASSA do teto diario de 100.000 e pela
    regra 9-B vira "congela e chama" — decisao do Johnny, nao minha.
(b) BURACO QUE EU NAO FECHEI E NAO SEI FECHAR SOZINHO: o perdao so roda em
    grantSubscriptionCredits. Se um comprador de SGP com saldo negativo comprar CREDITO
    AVULSO em vez de assinar, addExtraCredits soma no credits_extra negativo e ele perde
    ate 10.525 do que acabou de comprar, com dinheiro de verdade. NAO medi nenhum caso
    assim ainda e por isso NAO afirmo que aconteceu — fica escrito como risco vivo.
(c) A trava dura contra saldo negativo mora no SQL (debit_credits_onboarding) e exige
    migration + decisao de negocio. O fdcba70 poe o SENSOR (console.error quando o
    onboarding deixa negativo), nao a trava.`;

// ─────────────────────────────────────────────────────────────────────────────
const LISTA_TITULO =
  "A LISTA CANONICA DE ESTORNO ENVELHECEU CALADA DE NOVO, E O GUARDA NAO PODE VER: " +
  "_estornos.cjs:114-116 so suspeita de ref_type que casa /refund|estorn|devolu/i, entao " +
  "perdao_negativo_onboarding (65 linhas, 601.375 cr desde 30/08) le como NAO ESTORNADO e o guarda da verde";

const LISTA_DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 10/09 ~13hZ, no banco de producao.
Achado enquanto eu conferia como registrar a devolucao do outro chamado desta ronda.

E A CLASSE DO #185 VOLTANDO POR UMA PORTA QUE O CONSERTO DO #185 NAO COBRE.
O #185 (6839d5b9, fixed em 29/08) era "studio_audio_refund faltava na lista". O conserto
somou o tipo e trocou o .limit(5000) por paginacao — as duas coisas certas. Mas o CRITERIO
do guarda continuou sendo um palpite por NOME, e os dois tipos que nasceram depois nao tem
"refund", "estorn" nem "devolu" no nome. O guarda nao esta quebrado: ele e cego por construcao
para exatamente o tipo que ninguem lembrou de cadastrar, que e o unico caso que ele existe pra pegar.

O DEFEITO, COM ARQUIVO:LINHA
_frank/ferramentas/_estornos.cjs:27-46   -> REF_TYPES_ESTORNO (10 tipos)
_frank/ferramentas/_estornos.cjs:114-116 -> const suspeitos = [...vistos].filter(
                                             (t) => !REF_TYPES_ESTORNO.includes(t)
                                                    && /refund|estorn|devolu/i.test(t));

A MEDICAO (SQL sobre credit_transactions, amount > 0, base inteira)
25 ref_type distintos. Os que significam "devolvemos credito" e a lista NAO conhece:
  perdao_negativo_onboarding   65 linhas   601.375 cr   30/08 .. 10/09
  reparo_falha_operacional      1 linha     10.000 cr   02/09
Nenhum dos dois casa o regex, entao conferirListaCompleta() devolve ok:true. A varredura
de hoje (10/09 ~12h44Z) imprimiu "Lista de estorno em dia: 10 tipos, 3042 linhas varridas,
nenhum tipo desconhecido" com 65 linhas de perdao ja gravadas. Verde e cego sao a mesma cor aqui.

QUEM GRAVA perdao_negativo_onboarding
frontend/src/lib/credits/service.ts:155-190, perdoarNegativoDoOnboarding(), chamada de
grantSubscriptionCredits (service.ts:129). Producao desde 30/08 (decisao do Johnny), nao rascunho.

O CUSTO, na linguagem que este arquivo usa
ehEstorno("perdao_negativo_onboarding") devolve FALSE. Entao qualquer conferencia de
"este aluno ja foi ressarcido?" le 65 devolucoes reais como NAO ESTORNADAS. E o falso
negativo que paga em dobro — o mesmo acidente da ordem de 20/08 ("quase pagamos em dobro
pra 13 alunos" por filtrar por kind) e a razao de existir deste arquivo. So no SGP sao 11
pessoas ja perdoadas que uma remediacao em lote pegaria de novo.
⚠️ NAO AFIRMO QUE ALGUEM FOI PAGO EM DOBRO. Nao casei ref_id nem varri lote nenhum
procurando duplicata. O que esta medido e que a leitura esta errada e o guarda nao acusa.

CORRECAO PROPOSTA (nao apliquei; e ferramenta do _frank, nao codigo de producao)
1. Somar "perdao_negativo_onboarding" e "reparo_falha_operacional" a REF_TYPES_ESTORNO.
2. INVERTER o guarda: em vez de suspeitar por NOME (allowlist de regex, que envelhece
   calada exatamente como a lista que ela deveria proteger), manter a lista explicita do
   que NAO e devolucao (payment_event, stripe_session, e os grants/bonus: winback,
   courtesy_grant, admin_grant, credit_campaign, stock_seed, bonus_cortesia,
   courtesy_test_access, courtesy_video_clone, incident_apology, incident_apology_bonus,
   backlog_apology_bonus, compensation) e acusar TODO ref_type positivo fora das duas
   listas. Assim tipo novo nasce acusando, em vez de nascer invisivel.
3. Um teste que trave a inversao, senao o proximo tipo repete isto pela terceira vez.`;

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const agora = new Date().toISOString();
  const linhas = [
    {
      kind: "system", cause: "bug", categoria: "tecnico", status: "investigating",
      signature: "frank:sgp-onboarding-debita-carteira-do-comprador",
      title: SGP_TITULO, description: SGP_DESCRICAO,
      occurrences: SGP_AFETADOS.length, affected_emails: SGP_AFETADOS,
      reported_by: "frank", first_seen_at: agora, last_seen_at: agora, agent_notes: [],
    },
    {
      kind: "system", cause: "bug", categoria: "tecnico", status: "investigating",
      signature: "frank:estornos-guarda-cego-por-nome",
      title: LISTA_TITULO, description: LISTA_DESCRICAO,
      occurrences: 66, affected_emails: [],
      reported_by: "frank", first_seen_at: agora, last_seen_at: agora, agent_notes: [],
    },
  ];

  if (!CONFIRMAR) {
    for (const l of linhas) {
      console.log("ENSAIO — gravaria:", l.signature, `| desc ${l.description.length} chars | ocor ${l.occurrences} | afetados ${l.affected_emails.length}`);
    }
    return;
  }

  for (const l of linhas) {
    const { data, error } = await db.from("incidents").insert(l).select("id, numero, status");
    if (error) throw new Error("insert falhou: " + JSON.stringify(error));
    if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0));
    console.log("GRAVADO:", l.signature, "->", JSON.stringify(data[0]));
  }
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
