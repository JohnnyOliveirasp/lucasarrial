#!/usr/bin/env node
/**
 * Abre o cartao medido na ronda do VIGIA de 25/09 12hZ: o guarda que protege a
 * lista canonica de estorno le o LEDGER e nunca o CODIGO, entao um
 * `refundRefType` novo so e acusado depois que o dinheiro do primeiro aluno
 * passa por ele. 3 tipos ja estao carregados hoje, invisiveis por construcao.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "O GUARDA DA LISTA DE ESTORNO LE O LEDGER E NUNCA O CODIGO, ENTAO TIPO NOVO SO E ACUSADO DEPOIS QUE O DINHEIRO DO PRIMEIRO ALUNO PASSA: " +
  "conferirListaCompleta (_frank/ferramentas/_estornos.cjs) so varre credit_transactions com amount>0, e HOJE ha 3 refundRefType em producao com ZERO linha no ledger e fora das duas listas — " +
  "'edicao_captions_refund' (captions/route.ts:220) e 'studio_montage_refund' (studio/finalize.ts:164) cobram aluno desde 13-14/08 (158 debitos, 100 alunos) e 'studio_face_refund' (studio/face.ts:173). " +
  "Prejuizo medido HOJE: ZERO. O defeito e o detector chegar depois do dinheiro — 6 reincidencias da classe (#113, #185, #342, 19/09, 20/09 x2, 25/09) foram TODAS achadas assim";

const DESCRICAO = `MEDIDO NA RONDA DO VIGIA DE 25/09 ~12hZ. Nenhum credito foi tocado, nenhum
aluno foi respondido, nenhum cartao foi fechado ou reaberto (14-A).

=====================================================================
O ACHADO, EM UMA LINHA
=====================================================================
A lista canonica de estorno tem um guarda. O guarda le o BANCO. O tipo de
estorno nasce no CODIGO. Entre um e outro ha uma janela em que \`ehEstorno()\`
devolve false para uma devolucao de verdade — e quem perguntar "esse aluno ja
foi ressarcido?" nessa janela le NAO e paga de novo. A janela so fecha quando
o primeiro aluno de verdade passa dinheiro pelo tipo novo. O detector e o
proprio prejuizo.

=====================================================================
ONDE, COM ARQUIVO:LINHA (ordem de 27/08, §3.3 — dinheiro exige isto)
=====================================================================
O GUARDA (le so o ledger):
  _frank/ferramentas/_estornos.cjs, funcao \`conferirListaCompleta(db)\`
    db.from("credit_transactions").select("ref_type").gt("amount", 0)
  Nao ha uma unica leitura de arquivo-fonte nessa funcao. Tipo que ainda nao
  gerou linha POSITIVA no ledger e invisivel pra ela — nao por descuido, por
  construcao.

OS 3 TIPOS QUE ESTAO CARREGADOS HOJE E FORA DAS DUAS LISTAS
(REF_TYPES_ESTORNO e NAO_SAO_DEVOLUCAO, conferidas pelo modulo, nao pelo olho):
  1. "edicao_captions_refund"
     frontend/src/app/api/v1/edicao/captions/route.ts:220
     handleTechFailure({ debitRefType: "edicao_captions", refundRefType: ... })
     caminho de FALHA do RunPod (status FAILED/CANCELLED/TIMED_OUT), e a
     resposta ao aluno ja diz, com todas as letras: "A legendagem falhou e os
     creditos foram estornados."
  2. "studio_montage_refund"
     frontend/src/lib/studio/finalize.ts:164
     handleTechFailure({ debitRefType: "studio_montage", refundRefType: ... })
     F5 da montagem do Video Estudio.
  3. "studio_face_refund"
     frontend/src/lib/studio/face.ts:173
     handleTechFailure({ debitRefType: "studio_face", refundRefType: ... })
     F5 do rosto do Video Estudio.

Que \`refundRefType\` VIRA \`ref_type\` no extrato esta provado no proprio codigo
que consulta: frontend/src/lib/support/failure-alert.ts:143 e :317 fazem
\`.eq("ref_type", a.refundRefType)\`. Nao e inferencia de nome.

=====================================================================
POR QUE DOIS DELES NAO SAO TEORICOS (o lado do DEBITO ja roda)
=====================================================================
Medido no banco agora:
  ref_type            linhas  alunos  soma       desde        ate
  edicao_captions        46      28   -9.200     14/08 10:42  24/09 01:02
  studio_montage        112      72  -22.400     13/08 16:31  24/09 15:05
  studio_face             0       0        0     —            —

Ou seja: DUAS features cobram aluno de verdade ha ~6 semanas (158 debitos, 100
alunos distintos) e o tipo de devolucao delas nao esta cadastrado. Nao e codigo
morto, nao e rascunho, nao e feature desligada. E caminho de falha de feature
viva — o que significa que a primeira linha de estorno nasce exatamente no
momento em que o dinheiro de um aluno esta em jogo, que e o pior momento
possivel pra lista estar errada.
O studio_face_refund ainda nao cobrou ninguem; fica listado como terceiro, sem
peso de dinheiro, so pra a conta ficar completa.

=====================================================================
PREJUIZO MEDIDO HOJE: ZERO. Digo isso primeiro, de proposito.
=====================================================================
  select ... from credit_transactions
   where ref_type in ('edicao_captions_refund','studio_face_refund','studio_montage_refund')
  -> [] (nenhuma linha)

Nenhum aluno foi pago em dobro por causa destes 3. Nenhum estorno esta
pendurado. NAO estou pedindo estorno de nada e NAO estou acusando ninguem de
ter pago duas vezes. Este cartao e sobre um detector que chega tarde, nao sobre
dano consumado. A ordem de 27/08 nasceu porque o Vigia fez conta de dinheiro
sem ler quem cobra (#100, #125, #152): aqui eu li os tres arquivos que cobram,
citei linha, e o numero que sustento e ZERO.

=====================================================================
POR QUE ISTO NAO E O #342 DE NOVO (o que ja foi consertado, e o degrau abaixo)
=====================================================================
  #113 (24/08) — o CRITERIO da ordem so enxergava generation_refund (20%).
  #185 (29/08) — a JANELA do guarda (.limit(5000) rebaixado em silencio).
  #342 (10/09) — o guarda so suspeitava de nome que casasse /refund|estorn|devolu/i.
                 Consertado com criterio por EXCLUSAO e duas listas explicitas.

A resolution_note do #342 promete, com estas palavras: "Tipo novo nasce
acusando em vez de nascer calado." A promessa e VERDADEIRA e e boa — mas ela
comeca a valer na primeira LINHA, nao no primeiro COMMIT. O #342 consertou
COMO o guarda julga o que ve. Este cartao e sobre o que ele NAO VE: a fonte.

A prova de que o degrau segue aberto e a propria cadencia: depois do #342, a
classe reincidiu em 19/09 (edicao_broll_refund), 20/09 03h
(video_clip_refund_backfill), 20/09 18h (image_refund_gate371) e hoje 25/09
(video_clip_refund) — SEMPRE do mesmo jeito, sempre depois do fato. Seis vezes.
Se o guarda lesse os literais \`refundRefType\` do fonte e comparasse com as duas
listas, as seis teriam sido pegas no commit, antes de qualquer aluno.

E a armadilha de HOJE mostra que a lista tambem erra pra dentro: o commit
53e64785 registra que \`video_clip_refund_backfill\` estava cadastrado desde
20/09 e o irmao \`video_clip_refund\`, sem sufixo, NAO — porque \`includes()\` casa
string exata, nao prefixo. Quem bate o olho numa lista com um nome quase-igual
le como se ja estivesse coberto. Conferencia por olho humano nao pega isso;
conferencia por codigo pega.

=====================================================================
AS 3 CHECAGENS OBRIGATORIAS DA ORDEM DE 27/08, ANTES DE ABRIR
=====================================================================
1. JA EXISTE? NAO. Varri a fila ABERTA E FECHADA por title/signature com
   'estorno', 'lista canonica', '_estornos', 'guarda', 'refundRefType', 'dobro'.
   O que existe: #113, #185, #342 (os tres FIXED, e os tres sobre o CRITERIO ou
   a JANELA de quem ja esta no ledger) e #481 (Hotmart /sales/history, assunto
   diferente). Nenhum cartao, aberto ou fechado, trata o guarda nunca ler o
   fonte. Como a classe nao tem cartao ABERTO, isto nao e "somar ocorrencia" —
   e cartao novo.
2. JA FOI CORRIGIDO? NAO. \`git log origin/main\` desde a ronda das 10hZ: 4
   commits. O unico do assunto e o 53e64785 de HOJE 12:20Z, e eu li o diff: ele
   acrescenta a string "video_clip_refund" + comentario em _estornos.cjs e cria
   _frank/ferramentas/2026-09-25_classificar_video_clip_refund.cjs. Nenhuma
   leitura de fonte, nenhum guarda novo. \`gh pr list --state open\`: 67 abertos;
   os 7 que casam 'estorno|refund' sao de outros assuntos (#395 carta que afirma
   estorno x ledger, #368/#325 estorno orfao, #349 a Fast conferir estorno,
   #189/#81 webhook de chargeback, #422 recados). Nenhum cobre isto.
3. ENVOLVE DINHEIRO? SIM — e por isso este cartao traz arquivo:linha dos tres
   sitios que cobram/estornam MAIS do guarda, traz o lado do debito medido no
   banco, e declara prejuizo ZERO em vez de afirmar dano. Nao ha ref_id pra
   casar porque nao ha linha de estorno pra casar: e exatamente essa ausencia
   que o cartao denuncia.

=====================================================================
O CONSERTO QUE EU NAO FIZ (nao e alcada de sensor) — e ele e barato
=====================================================================
Um guarda estatico que leia os literais \`refundRefType: "..."\` do fonte
(hoje: um grep em frontend/src resolve, sao ~20 sitios) e acuse todo tipo que
nao esteja em REF_TYPES_ESTORNO nem em NAO_SAO_DEVOLUCAO. Rodando na ronda ele
acusa no dia do commit; rodando no CI ele acusa antes do merge. Cobre os 3 de
hoje e teria coberto as 6 reincidencias anteriores.
Duas coisas que quem for consertar precisa saber, e que eu medi:
  (a) nem todo tipo de devolucao termina em "_refund" — "estorno",
      "estorno_de_engano", "perdao_negativo_onboarding", "compensation" e
      "reparo_falha_operacional" estao na lista e nao casariam um filtro por
      sufixo. Por isso o guarda novo tem que ler o PARAMETRO \`refundRefType\`,
      nao adivinhar pelo nome — foi adivinhar pelo nome que criou o #342.
  (b) ha \`refundRefType\` que nao e literal e sim constante
      (REACT_REFUND_REF_TYPE, em react/gerar/route.ts). Um grep ingenuo de
      string perde esses; resolver a constante e parte do trabalho.

NAO decidi se o guarda vai pro CI ou so pra ronda, nao escrevi codigo, nao
mexi em _estornos.cjs e nao creditei ninguem.`;

async function main() {
  const linha = {
    kind: "system",
    cause: "ferramenta",
    categoria: "tecnico",
    status: "open",
    signature: "vigia:guarda-de-estorno-le-ledger-nunca-o-codigo",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: [],
    reported_by: "vigia",
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: `<${DESCRICAO.length} chars>` }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ id: data[0].id, numero: data[0].numero, status: data[0].status }, null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
