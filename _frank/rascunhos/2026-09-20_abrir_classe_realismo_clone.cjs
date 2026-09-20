#!/usr/bin/env node
/**
 * Abre o cartao da CLASSE medida na ronda das falhas de 20/09 ~10h30Z:
 * "insatisfeito com o realismo do Video Clone" nao e queixa de lip-sync — e
 * queixa de CORPO PARADO e OLHAR MORTO. Medido assistindo 3 videos de 3 alunos
 * diferentes, nao deduzido.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = [
  "pcezardireito@icloud.com",
  "alexandre@novaconexao.com",
  "igorlramalho@gmail.com",
  "fabianabedin2016@gmail.com",
  "ricardo@inventivebox.pt",
  "drrodrigoribeiro7@gmail.com",
  "contato@mastroiannioliveira.com.br",
  "tuquinha36@hotmail.com",
  "grupohcmarketing.comercial@gmail.com",
];

const TITULO =
  "A QUEIXA DE 'REALISMO' DO VIDEO CLONE NAO E LIP-SYNC, E CORPO PARADO E OLHAR MORTO: " +
  "3 videos de 3 alunos assistidos de verdade nesta ronda dao a MESMA leitura — boca acompanha o audio, " +
  "nota 5/10 nos tres, e o que quebra a credibilidade e o tronco/bracos (congelado em 2, espasmodico em 1) " +
  "mais olhar fixo sem microexpressao. 9 cartoes abertos na classe, 1 cancelamento (#411) e 1 pedido de " +
  "reembolso (#412) ja sairam dela, e a casa vem respondendo esses alunos com dica de ENQUADRAMENTO DE FOTO, " +
  "que nao alcanca a causa";

const DESCRICAO = `MEDIDO NA RONDA DAS FALHAS DE 20/09 ~10h30Z, ASSISTINDO O VIDEO — nao lendo
log, nao deduzindo do codigo. Ordem de 17/09 ("precisa ver/ouvir NAO e estado
de parada, e despacho"): despachei 3 videos pro \`olho\`, que le video e audio.

=====================================================================
O ACHADO, EM UMA LINHA
=====================================================================
A classe inteira reclama de "realismo" e "lip-sync". A boca NAO e o problema.
O problema e que o aluno compra um video e recebe uma FOTO ANIMADA NA BOCA:
tronco e bracos congelados (ou sacudindo fora de hora) e olhar fixo, sem
piscada nem microexpressao.

=====================================================================
OS TRES PARECERES (cegos entre si: cada um foi pedido sem contar ao \`olho\`
o que os outros tinham dito, e sem citar a hipotese)
=====================================================================

1) PAULO MOURA · pcezardireito@icloud.com · cartao #270
   video da87f41b (16/09 20:39Z, 23,6s, 480p-v3)
   - lip-sync: boca acompanha o audio, SEM atraso perceptivel.
   - corpo: gesticula, mas ESPASMODICO — maos sobem e voltam pra mesa com
     aceleracao antinatural em 1,6-3,2s, 12,5-13,5s e 18,5-19,5s, sem relacao
     com a enfase da fala.
   - rosto: identidade e iluminacao estaveis; olhar fixo, piscada rara.
   - nota 5/10. Queixa do aluno ("gestos e fala desconexos"): CONFIRMA.

2) ALEXANDRE · alexandre@novaconexao.com · cartao #478
   video 9732dc58 (19/09 12:51Z, 35,7s, 480p-v3)
   - lip-sync: acompanha a cadencia; fonema rigido/borrado, travada nas pausas
     (0-1s, ~12-14s, ~22-24s).
   - corpo: gesticulacao PRATICAMENTE INEXISTENTE. Tronco congelado, so leve
     inclinacao de cabeca.
   - rosto: rigidez/textura artificial; dentes e labios perdem nitidez depois
     dos 20s; olhar vitreo.
   - nota 5/10. Motivo principal, palavras dele: "foto estatica animada
     artificialmente".

3) IGOR · igorlramalho@gmail.com · cartao #245 (16,5d de espera, tem recado
   \`para_frank_52b22304\` desde 03/09)
   video f3133d80 (12/09 00:35Z, 15,8s, 480p-v3)
   - lip-sync: acompanha o ritmo; rigidez em oclusivas, leve atraso na
     reabertura (~5-6s, ~10-10,5s). Fecha certo no silencio.
   - corpo: NENHUM movimento de bracos ou maos. So oscilacao mecanica de
     ombros, sem conexao com a fala.
   - rosto: borramento peribucal em fala rapida (12-15,5s); olhar fixo,
     piscada rara, terco superior sem microexpressao.
   - nota 5/10. Motivo principal: "foto estatica animada apenas na boca,
     ausencia total de gesticulacao".

CONVERGENCIA: 3 de 3 dao nota 5/10. 3 de 3 absolvem a boca. 3 de 3 acusam o
corpo e o olhar. Os tres sao 480p-v3/v2 (motor InfiniteTalk). Isso deixa de ser
gosto de aluno e passa a ser leitura repetivel do produto.

=====================================================================
POR QUE ISSO IMPORTA MAIS QUE OS 9 CARTOES
=====================================================================
A casa vem respondendo esta classe com orientacao de FOTO (enquadramento, rosto
frontal, foto melhor). Pela medicao acima, foto melhor nao cria gesto que o
motor nao gera, nem piscada que ele nao anima. Ou seja: a resposta padrao da
classe NAO alcanca a causa, e o aluno que segue a dica volta pior — porque ele
gasta credito refazendo e recebe o mesmo resultado. O #245 diz isso com todas
as letras ("diz que seguiu as orientacoes").

CUSTO JA MEDIDO NA CLASSE:
  #411 biatupi@hotmail.com   CANCELOU a assinatura por causa disso (15/09)
  #412 tuquinha36@hotmail.com pediu REEMBOLSO da assinatura por qualidade (15/09)
  #329 contato@mastroiannioliveira.com.br gastou ~20.000 cr insatisfeito
  #270 pcezardireito@icloud.com refez o MESMO video de 24s 4x em 16/09
       (~10.000 cr) tentando consertar no pedido o que esta no motor

=====================================================================
CARTOES DA CLASSE (9 abertos, mais velho 01/09)
=====================================================================
  investigating: #270 (Paulo), #329 (Mastroianni), #478 (Alexandre)
  aguardando_aluno: #216 (Fabiana), #224 (Grupo HC), #245 (Igor),
                    #380 (Ricardo), #386 (Wilson), #406 (Rodrigo), #412 (Tuquinha)
  ja fechados nascidos da mesma queixa: #121, #160, #167, #275, #411

=====================================================================
O QUE ESTE CARTAO NAO DECIDE — e de proposito
=====================================================================
Trocar/ajustar motor de video, mudar tier, mexer em preco ou devolver dinheiro
por insatisfacao de QUALIDADE (nao por falha tecnica) e decisao do Johnny, nao
minha (9-B: "dar o que nunca foi dele -> para e chama"). Os 4 videos do Paulo
de 16/09 foram ENTREGUES: nao ha falha tecnica pra estornar pela 9-B. Levado ao
grupo nesta ronda com estes numeros.

O que eu NAO fiz: nao prometi a nenhum aluno melhora de motor, nao estornei
insatisfacao de qualidade, nao gastei GPU, nao mexi em tier nem em preco.

=====================================================================
O PROXIMO PASSO BARATO, PRA QUEM PEGAR ESTE CARTAO
=====================================================================
Os outros 6 cartoes da classe tem video no R2 e o \`olho\` custa ~1 min por
video. Despachar os 6 fecha a medicao da classe inteira (e a ordem de 17/09
manda fazer isso em vez de escrever "precisa de um humano olhar"). Receita:
  1. select video_path from video_clones where user_id=... and status='ready'
  2. baixar do bucket R2 voices-clone-ai-verse (NAO e o de generations)
  3. node dist/delegate-cli.js olho "assista <arquivo> ..." com as 5 perguntas
     acima, SEM citar a hipotese (senao o parecer vem viciado).`;

async function main() {
  const linha = {
    kind: "system",
    cause: "produto",
    categoria: "tecnico",
    status: "open",
    signature: "video-clone:realismo-e-corpo-parado-nao-lipsync",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 3,
    affected_emails: AFETADOS,
    reported_by: "frank",
    first_seen_at: "2026-09-01T00:00:00.000Z",
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
