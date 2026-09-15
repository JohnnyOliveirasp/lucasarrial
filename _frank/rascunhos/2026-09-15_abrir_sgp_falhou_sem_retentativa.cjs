/**
 * Abre o incidente: pedido do SGP em 'falhou' NAO TEM CAMINHO DE RETENTATIVA.
 * Medido na ronda das falhas de 15/09 22h40Z, em cima do caso real do #420.
 *
 *   node 2026-09-15_abrir_sgp_falhou_sem_retentativa.cjs [--confirmar]
 */
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "QUANDO UM PEDIDO DO SGP FALHA, NINGUEM CONSEGUE REFAZER A ENTREGA: nem o aluno, nem o suporte, nem o admin — so um script rodado a mao por um agente. O SGP substituiu a planilha em producao em 29/08 por ordem do Johnny; na PRIMEIRA falha dele (#420) o comprador ficou parado num estado sem saida, e a unica razao de ele ter sido destravado hoje foi uma ronda passar por ali por acaso de horario.";

const DESCRICAO = `OS TRES CAMINHOS DE RETENTATIVA, CONFERIDOS EM CODIGO UM A UM (arquivo:linha)

1. ALUNO, pelo proprio SGP — FECHADO
   frontend/src/app/api/v1/sgp/enviar/route.ts:29
     if (pedido.status !== "revisao") return badRequest("Complete as etapas
     anteriores antes de enviar.")
   O pedido que falhou esta em 'falhou', nunca em 'revisao'. O aluno leva 400 com
   uma mensagem FALSA: ela manda completar etapas que ele ja completou. (A linha
   :26 so desvia 'processando' e 'pronto'; 'falhou' cai no :29.)

2. ALUNO, pelo app (start-training) — FECHADO, E SERIA ERRADO SE ABRISSE
   frontend/src/app/api/v1/voices/[id]/start-training/route.ts:104
     if (bal.total < TRAINING_CREDIT_COST) -> 402 insufficient_credits
   TRAINING_CREDIT_COST = 10.000 (lib/credits/config.ts:10). O comprador do SGP
   tem 0 creditos POR DESENHO — comprar o SGP nao concede credito nenhum, e regra
   comercial da casa (lib/credits/onboarding-cobranca.ts, defeito medido em 09/09
   que levou 12 perfis a -126.300). Ou seja: o unico botao que o aluno enxerga
   cobra 10.000 por uma falha NOSSA, de alguem que tem 0 e nao deveria pagar.

3. SUPORTE / ADMIN, pelo /admin/sgp — NAO EXISTE
   api/v1/admin/sgp/[id]/erro/route.ts:16 e .../conclusao/route.ts:12 dizem, no
   proprio cabecalho, que NAO mexem no 'status' de proposito (a maquina de
   estados e da producao, lib/sgp/fracasso.ts). Sao anotacao de suporte. Varri
   /admin/sgp inteiro: nao existe rota de retreino, reprocessamento ou refazer.

O UNICO caminho que funciona e dispararTreinoOnboarding(admin, userId, voiceId,
"sgp") (lib/onboarding/treino.ts), que tem exatamente DOIS chamadores em
producao: lib/onboarding/import.ts:465 (planilha — DESLIGADA por ordem de 29/08)
e lib/sgp/processar.ts:273, alcancavel so por enviarPedido(), que por sua vez so
roda vindo do :29 acima. Nao ha entrada HTTP para um pedido 'falhou'.

A PROVA, E ELA E O #420
RICARDO OLITO (ricardoolito@gmail.com), pedido 7cc29ec9, voz f58a158a. Treino
morreu 21:52:15Z por CUDA out of memory (disputa de GPU, transitoria) sobre 3
audios que o NOSSO validador aprovou (818+600+278 = 1696s). A ronda anterior
devolveu a voz para awaiting_training e escreveu no pedido que "o retreino esta
disponivel". Nao estava — pelos tres motivos acima. O cartao ficou em
'aguardando_aluno' esperando uma acao que o aluno NAO TINHA COMO EXECUTAR.
Destravei rodando o disparo a mao (ferramenta 2026-09-15_retreinar_sgp.cjs,
commit e4b8f05): voz ready 22:53:07Z, pedido 'falhou'->'pronto' 22:53:14Z,
aluno avisado pela regua automatica 22:53:11Z, ZERO credito cobrado (conferido
por ref_id, 0 linhas antes e depois). Uma hora de espera para o aluno, e so
porque uma ronda passou ali. Sem isso ele esperaria indefinidamente.

A EVIDENCIA SE APAGA SOZINHA — MEDIDO DEPOIS DA RECUPERACAO
Assim que o retreino entrou, o proprio sistema limpou o rastro:
  select count(*) from sgp_pedidos where erro is not null   -> 0
  select count(*) from sgp_pedidos where status = 'falhou'  -> 0
Uma hora atras as duas consultas devolviam 1, e era a PRIMEIRA falha do SGP
desde 29/08. Hoje nao ha no banco nenhum vestigio de que o SGP ja falhou alguma
vez. Quem for medir a saude do SGP por essas colunas vai ler "nunca falhou".
E o mesmo defeito de instrumento que o Vigia mediu nas 22hZ por outro caminho
(linhas de video_clones apagadas, morte visivel so pelo dinheiro): a casa apaga
a propria evidencia ao se recuperar, e sobra um placar que diz zero.

ALCANCE HONESTO
Casos ate agora: 1. E 1 porque o SGP so falhou UMA vez desde 29/08, nao porque o
defeito seja estreito. O gatilho e "qualquer pedido do SGP ir para 'falhou'", e
a causa que disparou hoje (CUDA OOM) e transitoria e nao tem nada a ver com o
aluno — ela volta quando a GPU estiver disputada. Fila do SGP agora: dados 103,
pronto 83, foto 63, audio 19. Todo pedido dessa fila que falhar cai no mesmo
beco. Parente do #364 (avatar failed sem estado terminal, fixed 12/09), mas NAO
e o mesmo: la faltava estado terminal; aqui o estado terminal existe e nao tem
saida.

AS 3 CHECAGENS DO §3 DA ORDEM DE 27/08
1. JA EXISTE? Nao. Varri a fila aberta E fechada (500 cartoes) por
   sgp/retreino/retentativa/reprocessar/refazer/falhou/retry: 30 casam o filtro
   e nenhum cobre "pedido em falhou sem caminho de volta". O mais proximo, #364,
   e o oposto (falta de estado terminal) e esta fixed. O #420 e o CASO, nao a
   classe — por isso este cartao e separado, senao a classe morre junto com o
   fechamento do caso do Ricardo.
2. JA FOI CORRIGIDO? Nao. Dos PRs abertos, os que tocam SGP sao #214 (orfao no
   varredor), #203 (#290 boas-vindas) e #20 (mensagem de saldo) — nenhum cria
   caminho de retentativa. Nenhum commit em origin/main hoje toca sgp/enviar,
   sgp/processar nem admin/sgp nesse sentido.
3. DINHEIRO? NAO afirmo cobranca indevida. Conferi por ref_id (nunca por kind):
   credit_transactions para a voz f58a158a tem 0 linhas antes e 0 depois do
   retreino. Nao houve cobranca e nao ha nada a estornar. O que este cartao diz
   sobre dinheiro e o contrario: o unico botao disponivel ao aluno COBRARIA
   10.000 indevidamente (start-training:104), e e por isso que ele nao serve de
   caminho de retentativa.

O QUE EU NAO SEI
Nao prescrevo a forma da cura. As opcoes obvias (uma rota de retentativa no
/admin/sgp; aceitar 'falhou' no :29; um reenfileiramento automatico para causa
transitoria) tem trade-offs diferentes e uma delas gasta GPU sozinha, o que o
Johnny ja disse que e decisao dele (ronda 21hZ §9). Registro o vao e as tres
portas fechadas; quem consertar decide qual abrir.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "sgp:falhou-sem-caminho-de-retentativa",
    cause: "bug",
    categoria: "tecnico",
    status: "investigating",
    signature: "frank:sgp-pedido-falhou-sem-caminho-de-retentativa",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: ["ricardoolito@gmail.com"],
    reported_by: "frank",
    first_seen_at: agora,
    last_seen_at: agora,
    agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("✅ ABERTO:", "#" + data[0].numero, data[0].id, data[0].status);
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
