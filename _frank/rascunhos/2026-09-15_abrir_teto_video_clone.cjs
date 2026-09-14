#!/usr/bin/env node
/**
 * Abre o incidente medido na rotina das falhas de 14/09 ~23h50Z:
 * o teto de execucao do Video Clone (cloneExecutionTimeoutMs) derrubou
 * 7 geracoes de 6 alunos HOJE, e 0 em qualquer dia anterior.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = [
  "welrisson@gmail.com",
  "leonicemleandrosociedadeadvoca@gmail.com",
  "danicale@gmail.com",
  "claytonpc10@gmail.com",
  "alcinalivre@gmail.com",
  "daniel@dlima.adv.br",
];

const TITULO =
  "O TETO DE EXECUCAO DO VIDEO CLONE COMECOU A DERRUBAR ALUNO HOJE E NUNCA ANTES: " +
  "cloneExecutionTimeoutMs (config.ts:96-101) matou 7 geracoes de 6 alunos em 14/09, " +
  "TODAS 480p-v3, cada uma entre +2,8s e +11,8s do proprio teto calculado — contra ZERO " +
  "executionTimeout nos 29 dias anteriores. 5h45min de espera dos alunos, 43.050 cr cobrados " +
  "(estornados 1:1). E a casa nao sabe qual e a folga real porque so grava elapsed_seconds " +
  "quando o job FALHA: 0 de 1.986 entregas prontas tem duracao registrada";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA ROTINA DAS FALHAS DE 14/09 ~23h50Z, EM PRODUCAO.
Peguei o caso ao vivo: capturei o status do job de um aluno no RunPod no minuto
em que ele virou FAILED (o status expira depois do job — quem nao captura na
hora nao captura mais).

=== 1. OS SETE, MEDIDOS CONTRA O TETO QUE O NOSSO PROPRIO CODIGO CALCULA ===
Teto = (20*60 + ceil(duration_seconds)*30) segundos, de cloneExecutionTimeoutMs
(frontend/src/lib/video-clone/config.ts:96-101), para flow != v1.

 aluno                  audio_s  frames  teto_s  elapsed_s   excesso
 welrisson  16:06:59Z    53,01   1350    2820    2831,831    +11,8s
 welrisson  16:55:38Z    53,01   1350    2820    2829,136     +9,1s
 leonice    19:01:52Z    63,26   1600    3120    3127,566     +7,6s
 danicale   20:45:52Z    28,44    725    2070    2074,944     +4,9s
 claytonpc10 20:48:13Z   74,30   1875    3450    3459,396     +9,4s
 alcinalivre 21:48:09Z   46,54   1175    2610    2612,762     +2,8s
 daniel     22:44:50Z    86,82   2175    3810    3812,998     +3,0s

Todas com raw_error "executionTimeout exceeded". Todas tier 480p-v3.
Soma do tempo queimado: 20.748,6 s = 5h45min de espera de seis pessoas, hoje,
por zero video entregue.

=== 2. O QUE FAZ ISTO SER DE HOJE, E NAO CRONICO ===
Falhas de video_clones por dia nos ultimos 30 dias, e quantas sao por teto:
  18/08 -> 3 falhas, 0 por teto
  01/09 -> 1 falha,  0 por teto
  05/09 -> 24 falhas, 0 por teto  (o apagao conhecido, outra causa)
  14/09 -> 7 falhas,  7 por teto
Ou seja: a classe executionTimeout tem ZERO ocorrencia nos 29 dias anteriores e
7 hoje. Nao e defeito antigo que ninguem viu; e estreia.

E o codigo do teto NAO mudou: a formula esta na main desde a1a2c51, de 07/08,
intocada ha 5 semanas. O unico commit recente em video-clone (86b4acb) mexe em
catch vazio de mensagem de erro, nao em tempo.

=== 3. A CORRELACAO QUE EU REGISTRO MAS NAO TRANSFORMO EM CAUSA ===
14/09 e o dia de MAIOR volume da serie: 64 entregas 480p-v3 prontas, contra 28
em 13/09, 36 em 12/09, 48 em 11/09. Volume dobrou e a classe estreou no mesmo
dia. Isso e compativel com pressao de fila / worker frio / GPU mais lenta
empurrando o job para alem de um teto dimensionado em dia calmo.
NAO AFIRMO QUE O VOLUME CAUSOU. Nao li o worker, nao medi a fila do RunPod, nao
sei qual GPU pegou cada job, e e um unico dia de observacao. Fica como hipotese
com a medicao ao lado, nao como diagnostico.

=== 4. O QUE NAO SE PODE CONCLUIR DO "+3s" (armadilha) ===
Tentador ler "morreu 3 segundos alem do teto, entao faltava quase nada". E
FALSO por construcao: o RunPod mata EXATAMENTE no executionTimeout, entao
elapsed ~= teto para QUALQUER job que estoure, precisasse ele de mais 3
segundos ou de mais 3 horas. O excesso de +2,8s a +11,8s mede a precisao do
carrasco, nao a distancia que faltava pro fim.
Consequencia pratica: ESTE CARTAO NAO RECOMENDA "subir o teto". Subir o teto so
ajuda se os jobs estavam perto do fim, e isso e exatamente o que nao da pra
saber com a instrumentacao de hoje (item 5). A medicao do #15 vai no sentido
contrario (la o job pendurava, nao estava lento).

=== 5. O BURACO DE INSTRUMENTACAO QUE IMPEDE DECIDIR ===
video_clones.elapsed_seconds, medido nos ultimos 30 dias:
  status ready  -> 1.986 linhas,    0 com elapsed_seconds
  status failed ->    35 linhas,   32 com elapsed_seconds
A casa so registra quanto tempo o job levou QUANDO ELE FRACASSA. Logo nao existe
como responder "quao perto do teto roda um job saudavel?" — que e a UNICA
pergunta que decide se o teto esta apertado ou se o job trava.
E o dado existe e esta sendo jogado fora, conferido em arquivo:linha:
  - sweep-clones/route.ts:61-70 le o status do RunPod e passa st.executionTimeMs
    para finalizeVideoClone em QUALQUER status terminal, COMPLETED incluso;
  - finalize.ts:38-46 e o ramo COMPLETED: da update com {status:'ready',
    error_message:null} e RETORNA. Nunca toca em elapsed_seconds;
  - finalize.ts:75-80, que grava elapsed_seconds = executionTimeMs/1000, esta
    DEPOIS do gate de falha (finalize.ts:48-50), ou seja so roda em
    FAILED/CANCELLED/TIMED_OUT.
Portanto o numero chega na nossa mao no caminho de sucesso e e descartado ali
mesmo. Gravar no ready e um update a mais no ramo que ja existe.
PRIMEIRO PASSO PROPOSTO, e so ele: persistir elapsed_seconds tambem em ready.
Uma semana disso responde a pergunta com dado, em vez de com aposta.

=== 6. DINHEIRO: CONFERIDO E LIMPO ===
7 falhas, 43.050 cr cobrados, 7 estornos, casamento 1:1 por clone.
Conferido por ref_type='video_clone_refund' e NUNCA por kind — o estorno grava
kind='extra_purchase', e quem filtrar por kind conclui que nao houve estorno e
paga em dobro (armadilha medida em 20/08).
  welrisson   2 falhas / 11.340 cr / 2 estornos
  daniel      1 falha  /  9.135 cr / 1 estorno
  claytonpc10 1 falha  /  7.875 cr / 1 estorno
  leonice     1 falha  /  6.720 cr / 1 estorno
  alcinalivre 1 falha  /  4.935 cr / 1 estorno
  danicale    1 falha  /  3.045 cr / 1 estorno
A rede de seguranca do dinheiro FUNCIONOU: sweep-clones (cron de 5 min) pegou
cada um e finalizeVideoClone estornou. Nao ha credito a devolver neste cartao.
O que a rede NAO cobre e o tempo: credito de volta nao e hora de volta.

=== 7. O DANO QUE SE REPETE, E QUE E EVITAVEL HOJE ===
welrisson tentou DUAS VEZES o mesmo audio de 53,01s (16:06 e 16:55) e morreu no
mesmo teto as duas vezes: 2831,8s e 2829,1s. Repetir a mesma entrada custa outra
hora, com certeza praticamente total. Enquanto nao houver conserto, o aluno
precisa ser avisado ANTES de tentar de novo — foi o que fiz com o daniel.

=== 8. CONTORNO MEDIDO (com a ressalva de tamanho de amostra) ===
Por tier, em 30h: 480p-v3 -> 78 ready / 7 failed. 480p-v2 (Turbo) -> 10 ready /
0 failed. As 7 falhas sao 100% v3.
NAO AFIRMO QUE O TURBO E IMUNE: 10 entregas nao provam nada sozinhas.
Mas o caso do daniel e evidencia pessoal util: as 21:19:45Z ele gerou um audio
de 86,82s no Turbo e FICOU PRONTO; as 22:44:50Z gerou 86,82s no Padrao 2.0 e
morreu no teto. Mesmo tamanho de audio, tiers diferentes, desfechos opostos, no
mesmo aluno e na mesma noite. E o Turbo ainda e mais barato (80 cr/s contra
105). Foi esse o contorno que eu ofereci a ele.

=== 9. POR QUE ESTE CARTAO NAO EXISTIA ===
O detector de rajada conta 2 ocorrencias em 6h POR ALUNO. Hoje foram 6 alunos
com 1 falha cada e 1 com 2: so o welrisson cruzou a regua (e virou o #398).
Seis pessoas derrubadas pelo mesmo defeito no mesmo dia aparecem como um
chamado so. A regua mede reincidencia individual, e este defeito e coletivo.

=== 10. O QUE EU NAO FIZ ===
Nao subi codigo, nao mexi em teto, nao mexi em credito (nao havia o que mexer),
nao prometi data a ninguem. Escrevi so ao daniel, que estava na tela no momento
da falha e prestes a tentar de novo (Enviados uid 2362). Os outros 5 ja foram
estornados automaticamente; levar os 5 ao grupo e a decisao do Johnny, nao
minha, porque carta a 5 pessoas de uma vez e envio em massa (regra 8).`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "frank:teto-execucao-video-clone-v3",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 7,
    affected_emails: AFETADOS,
    reported_by: "frank",
    first_seen_at: "2026-09-14T16:06:59Z",
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
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}

main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
