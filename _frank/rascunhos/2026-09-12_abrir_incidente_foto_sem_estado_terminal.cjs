#!/usr/bin/env node
/** Abre o incidente do defeito de codigo medido na ronda do VIGIA de 12/09 10hZ. */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "O SGP NAO TEM ESTADO TERMINAL PARA A PERNA DA FOTO: avatar 'failed' com a voz 'ready' " +
  "nao produz `falhou` (pronto.ts:145-146 exige vozMorta), entao etapas.ts:90 grava " +
  "status='processando' PARA SEMPRE e a tela mostra a foto em 'andamento' para uma imagem " +
  "que morreu na moderacao do Kie. `erro` fica NULO e ninguem e avisado. " +
  "1 comprador do SGP parado 16,6h em silencio em 11-12/09";

const DESCRICAO = `MEDIDO POR MIM (VIGIA) NA RONDA DE 12/09 ~10h15Z, EM PRODUCAO.
Caso-prova: rafaelzan@me.com, pedido fe00d4e2-54bb-42de-9935-8159c1ce0f3e,
user_id b1bb9057-e04c-4bab-8d53-f1d2da3a45d4.

O QUE O BANCO MOSTRA (medido 10:12Z-10:20Z)
  sgp_pedidos fe00d4e2:
    enviado_em     = 2026-09-11 17:37Z   (4 fotos, 2 audios, origem 'portal')
    voz_pronta_em  = 2026-09-11 17:43Z   <- a perna da VOZ fechou em 6 min
    foto_pronta_em = NULL                <- a perna da FOTO nunca fechou
    status         = 'processando'       <- ha 16,6h
    erro           = NULL                <- nada carimbado, ninguem avisado
  image_generations do mesmo user_id, idea='onboarding_avatar': 1 linha
    id e568b3cd, criado 17:37Z, status='failed', retry_count=0,
    kie_task_id 84dafe099c896bfca11822711a718cc5
    kie_raw_error: "your prompt was flagged by website as violating content policies."
  Ou seja: avatares_total=1, avatares_prontos=0, pendentes=0, voz=ready.

O DEFEITO, COM ARQUIVO:LINHA
frontend/src/lib/onboarding/pronto.ts:145-146
    const falhou = onboarding && !pronto && pendentes === 0 && !vozTreinando && vozMorta;
  'falhou' exige **vozMorta** (linha 143-144: voz 'failed' ou 'rejected_too_short').
  So a VOZ tem estado terminal. Avatar 'failed' NAO entra nessa conta em lugar
  nenhum. Com a voz 'ready', vozMorta=false => falhou=false.
  E 'pronto' (linha 126-130) exige houveAvatar ? prontos >= 1 => pronto=false.
  Resultado: nem pronto, nem falhou. Limbo.

frontend/src/lib/sgp/etapas.ts:90
    const status = s.pronto ? "pronto" : s.falhou ? "falhou" : "processando";
  false : false => grava 'processando'. Toda vez que rodar, de novo. Para sempre.

frontend/src/lib/sgp/etapas.ts:101 (o que o aluno LE na tela)
    estado: fotoPronta ? "feito" : fotoFalhou ? "falhou" : s.avatares_total > 0 ? "andamento" : "espera"
  fotoFalhou (etapas.ts:65) = avatares_total>0 && prontos===0 && s.falhou => false.
  Cai no ramo 'andamento'. A tela diz "em andamento" ha 16,6h para uma imagem
  que esta 'failed' no banco e nunca mais vai se mover.

POR QUE NAO EXISTE NADA QUE DESTRAVE ISSO SOZINHO
'estadoDasEtapas' so roda por (a) polling da tela de acompanhamento e (b)
'avancarEtapasDoUsuario' chamado pelos webhooks do Kie/RunPod (etapas.ts:26-45).
Nao ha varredor/cron que olhe pedido parado. Fechou a aba e o webhook ja passou
=> o pedido fica 'processando' ate alguem olhar na mao. Foi o que aconteceu.

ISTO E A MESMA CLASSE QUE JA FOI CONSERTADA — SO QUE SO PARA A VOZ
O comentario de 22/08 em pronto.ts:54-58 descreve o defeito identico na perna da
voz ("uma linha cuja voz JA falhou ficava 'Em Andamento' segurando a fila ate
bater o prazo"). A correcao daquele dia criou 'vozMorta'/'falhou' e cobriu
SO a voz. A perna da foto ficou com o buraco aberto. Parente do #146 (guarda
que julga pelo estado velho).

CONTROLE POSITIVO — NAO E A FOTO QUE ESTA QUEBRADA, E O ESTADO TERMINAL
Dos 30 pedidos com enviado_em nos ultimos 10 dias, 29 fecharam em 'pronto' com
foto_pronta_em carimbado em 1..13 min (ex.: fermachado.coach 00:25->00:27;
dramaryannepdovale 01:30->01:32; hugolacunha 17:54->17:55, este 17 min ANTES do
caso-prova). O unico preso e o fe00d4e2. O pipeline da foto funciona; o que
falta e o que fazer quando ele falha.

ALCANCE HONESTO HOJE: 1 aluno. Varri a base inteira cruzando sgp_pedidos com
image_generations (prontos=0 AND falhos>0 AND pendentes=0): sai UMA linha, a do
Rafael. Mas o numero e 1 por sorte do gatilho, nao por estreiteza do defeito: o
gatilho e "o avatar do onboarding falhar", e aqui ele falhou por MODERACAO do
Kie numa foto comum de pessoa. Todo pedido cujo avatar falhar cai no mesmo
limbo, em silencio.

O QUE EU NAO AFIRMO (ordem de 27/08 §3.3)
NAO fiz conta de dinheiro e NAO afirmo que ha credito a estornar. O
error_message da propria linha diz que o credito foi devolvido automaticamente,
e onboarding e conta da casa (pode ficar negativo por autorizacao de 21/08).
Nao abri o arquivo que cobra, entao nao tenho 'arquivo:linha' do debito e por
isso nao afirmo nada sobre cobranca. Quem for mexer em dinheiro aqui precisa
medir antes — foi assim que o #152 quase pagou em dobro.

AS 3 CHECAGENS DO §3 DA ORDEM DE 27/08
1. JA EXISTE? Nao. Varri a fila aberta E fechada por sgp/processando/travado/
   preso (25 cartoes lidos). O mais proximo, #238 "SGP perde foto/audio em
   silencio", e outra causa (confirmador le-modifica-grava, fechado 02/09).
   Nenhum cartao cobre "avatar failed sem estado terminal".
2. JA FOI CORRIGIDO? Nao. Zero commits em origin/main desde 00:15Z. Dos 32 PRs
   abertos, NENHUM toca onboarding/pronto.ts nem sgp/etapas.ts (conferido por
   gh pr list --json files).
3. DINHEIRO? Nao afirmo nada — ver bloco acima.

O ALUNO CONTINUA ESPERANDO E NAO ESCREVEU PRA NINGUEM. Ele nao esta na caixa do
suporte: esta calado, olhando uma tela que diz "em andamento". Nao respondi, nao
escrevi rascunho e nao toquei em credito — 14-A. Quem decide e conserta e o Frank.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system", cause: "bug", categoria: "tecnico", status: "investigating",
    signature: "vigia:sgp-avatar-failed-sem-estado-terminal-preso-em-processando",
    title: TITULO, description: DESCRICAO,
    occurrences: 1, affected_emails: ["rafaelzan@me.com"],
    reported_by: "vigia", first_seen_at: agora, last_seen_at: agora, agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ id: data[0].id, numero: data[0].numero, status: data[0].status }, null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
