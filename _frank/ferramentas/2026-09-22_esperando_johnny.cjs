#!/usr/bin/env node
/**
 * esperando_johnny.cjs — os cards que so param porque falta o JOHNNY decidir
 * ou por uma mao humana num painel que o agente nao opera.
 *
 * POR QUE ESTE INSTRUMENTO NASCEU (ronda de 22/09 ~17hZ).
 * Peguei a fila pela regra 8 (o mais antigo com aluno afetado) e os QUATRO
 * cartoes mais velhos da casa estavam, cada um, parados no mesmo ponto: nao
 * falta apuracao, falta UMA palavra ou UMA mao:
 *
 *   #15       d3d8d1b2 · 54d · conserto pronto, PR #404 ABERTO esperando merge
 *   #214      ffbfdfc4 · 22d · regra existe e esta codada; falta a MIGRATION 111 rodar
 *   #216      8b8fc4c8 · 21d · falta mao humana no painel da Hotmart (cancelamento)
 *   (o 4o)    7ed72ad0 · 21d · 7.455 cr: estornar ou nao e decisao de classe
 *
 * Cada ronda anterior fez a parte dela e escreveu "escalado ao grupo". O que
 * NINGUEM mediu foi o TAMANHO da classe: quantos alunos estao parados atras de
 * quantas decisoes distintas. Sem esse numero, cada ronda re-escala UM caso, o
 * Johnny recebe pedidos avulsos pingados, e o backlog parece "em andamento"
 * quando na verdade esta em fila de espera por ele.
 *
 * E a MESMA doutrina da ordem de 17/09 (percepcao nao e desculpa pra parar),
 * aplicada a DECISAO em vez de PERCEPCAO: "esperando o Johnny" tambem nao pode
 * ser estado de parada permanente e invisivel. A diferenca e que aqui o
 * desfecho nao e despachar pro `olho` — e juntar os pedidos num LOTE, para ele
 * resolver varios de uma vez.
 *
 * ⚠️ CRITERIO (herdado do percepcao_travada.cjs, pelos mesmos motivos):
 *   1. A marca tem que estar na ULTIMA nota (`agent_notes -> -1`). Varrer a
 *      pilha inteira mede HISTORICO e apresenta como PENDENCIA — foi assim que
 *      o SQL da ordem de 17/09 devolveu 41 falsos onde havia 1.
 *   2. Boilerplate do sensor nao conta. O `carol` carimba "precisa de olho
 *      humano, nao de codigo" em TODO chamado de atendimento; ali a frase quer
 *      dizer "isto nao e bug", nao "o Johnny precisa decidir".
 *   3. Status: open/investigating/aguardando_aluno. O rotulo aguardando_aluno
 *      MENTE quando quem deve o proximo passo e a casa — foi o que escondeu o
 *      #216 por 20 dias e o que custou os R$97 do #207.
 *
 * ⚠️ CONTROLE POSITIVO, e o script ABORTA se FALTAR QUALQUER UM dele (nao so
 * se zerar). Numero de instrumento cego ja fez a casa reportar saude onde havia
 * fila. O controle sao os quatro cartoes do cabecalho: se a varredura nao
 * reencontra TODOS os que EU li a mao nesta ronda, o filtro encolheu — e o
 * encolhimento so erra pra baixo, entao nenhum numero desta saida vale.
 * Baixar esse piso de proposito exige reescrever a lista CONTROLE e o motivo.
 *
 * ⚠️⚠️ LIMITE GRAVE, MEDIDO NA PROPRIA RONDA QUE ESCREVEU ISTO. Ler so a
 * ULTIMA nota (criterio 1) tem um preco: QUEM ANOTA, ESCONDE. Nesta ronda eu
 * anotei o b633b18c — cartao que ESTA esperando o Johnny — e minha nota nao
 * repetia nenhuma marca. O cartao sumiu da varredura na hora, sem nada ter
 * sido resolvido. A mesma doenca do rotulo `aguardando_aluno`: o cartao nao
 * muda de estado, so fica invisivel.
 *
 * Mitiguei somando as regras de alcada (9-A/9-B/9-C, "acima do teto") as
 * marcas, porque quem escreve uma nota dessas quase sempre cita a regra que o
 * impede de agir. NAO e cura: se a proxima nota nao citar nada, o cartao some
 * de novo.
 *
 * REGRA PRA QUEM ANOTAR UM CARTAO QUE SEGUE PARADO NO JOHNNY: repita na sua
 * nota, com essas palavras, o que falta ("decisao do Johnny", "9-A", "aguardando
 * merge"). Nao e burocracia — e o que mantem o cartao visivel no unico lugar
 * que o conta.
 *
 * SO LEITURA. Nao escreve, nao fecha, nao muda status, nao manda e-mail.
 */
const { execFileSync } = require("node:child_process");
const { supa } = require("./_comum.cjs");
const { casarPrsComCartoes } = require("./_pr_cartao.cjs");

const AGORA = new Date();
const dias = (iso) => Math.floor((AGORA - new Date(iso)) / 86400000);

// Os 4 que eu li a mao na ronda de 22/09 17hZ e confirmei parados no Johnny.
// Servem de controle positivo: a varredura TEM que reencontrar TODOS estes.
// Nao e "pelo menos um": e a lista inteira. Perder UM ja prova que o filtro
// encolheu, e o vies do encolhimento e sempre pra baixo (ver o aborto abaixo).
//
// ⚠️ PISO SO DESCE POR ESCRITO: se alguem decidir DE PROPOSITO baixar esta
// exigencia (um cartao foi resolvido de verdade, mudou de dono, saiu do banco),
// tem que REESCREVER esta lista aqui e deixar o MOTIVO escrito nesta mesma
// linha, com data. Comentar o aborto, afrouxar a contagem ou "deixar passar por
// hoje" sem mexer aqui e como apagar o instrumento: a proxima ronda nao tem
// como saber que o piso caiu nem por que.
const CONTROLE = {
  // ⚠️ #15 FECHADO em 24/09 21hZ (PR #404 mergeado, watchdog no ar). FICA na
  // lista de proposito: o controle positivo testa o MATCHER, nao a fila viva —
  // ele varre `todos` (todos os status), e um cartao fechado com a marca
  // intacta na ultima nota serve igual. Tirar daqui baixaria o piso sem ganho.
  // Se um dia a ultima nota dele mudar e o controle acusar, NAO e cegueira de
  // fila: e so este cartao. Leia antes de sair mexendo na lista.
  "d3d8d1b2": "#15  PR #404 esperando merge (cartao FECHADO em 24/09; segue como controle do matcher)",
  "ffbfdfc4": "#214 migration 111 nao aplicada",
  "8b8fc4c8": "#216 mao humana no painel da Hotmart",
  "7ed72ad0": "     7.455 cr: decisao de classe",
  // PISO SUBIU em 23/09 17hZ (Frank) — entrada nova, com o motivo por escrito
  // como a regra acima exige. Este cartao estava parado no Johnny ha 21 dias,
  // escalado por escrito desde 21/09 18:59Z, e a varredura NAO O VIA: a nota
  // dele diz "a decisao (a)manter/(b)falhar sem cobrar/(c)entregar avisando e
  // do Johnny", com as opcoes a/b/c NO MEIO, e a marca antiga exigia
  // "decisao ... do johnny" coladas. Era o "QUEM ANOTA, ESCONDE" do cabecalho
  // acontecendo justamente no cartao que mais pesa — e ele que trava tambem a
  // decisao do #37bacb68 (22 alunos). Entra como controle pra nao sumir calado
  // de novo.
  "702cc916": "#226 portao: (a)manter/(b)falhar sem cobrar/(c)entregar avisando",
};

// Marcas de "parado no Johnny". Deliberadamente especificas: prefiro falso
// NEGATIVO a inflar a classe (classe inflada vira lista que ninguem ataca).
const MARCAS = [
  // ALARGADA em 23/09 17hZ (Frank), com medicao antes de subir. A versao
  // antiga (`decis[aã]o\s+(?:e\s+)?d[oe]\s+johnny`) exigia as palavras
  // COLADAS e perdia a forma mais comum de escrever a frase nesta casa, que e
  // nomear as opcoes no meio: "a decisao (a)manter/(b)falhar/(c)entregar E DO
  // JOHNNY". O gap e limitado a 160 chars e NAO atravessa ponto final nem
  // quebra de linha, pra nao casar duas frases distintas ("...tomei a decisao.
  // O resto do Johnny...").
  // MEDIDO ANTES DE APLICAR, na fila inteira (142 cartoes): ganho de 5, e os
  // 5 lidos A MAO, um a um — 702cc916 ("(a)manter/(b)falhar... e do Johnny"),
  // 1a37605a ("DECISAO COMERCIAL, que e do Johnny"), 719c9af6 ("decisao de
  // produto/preco/estorno e do Johnny", 9 alunos), 555a1cee ("decisao de
  // dinheiro do Johnny") e f8a71e43 ("decisao comercial nova = #173, do
  // Johnny"). CINCO verdadeiros, ZERO ruido. Por isso o alargamento sobe: ele
  // nao infla a classe, so para de esconder.
  /decis[aã]o\b[^.\n]{0,160}?\b[eé]?\s*d[oe]\s+johnny/i,
  /pend[eê]ncia\s+johnny/i,
  /depende\s+d[oe]\s+johnny/i,
  /(?:s[oó]|apenas)\s+(?:o\s+)?johnny/i,
  /esperando\s+(?:o\s+)?johnny/i,
  /aguardand[oe]\s+(?:o\s+)?johnny/i,
  // Regras de alcada: 9-A (mexer em saldo e sempre do Johnny), 9-B (acima do
  // teto de 20.000/caso), 9-C (reembolso). Citar a regra JA e dizer "nao e
  // minha alcada" — por isso contam como marca.
  /\b9-[ABC]\b/,
  /acima\s+do\s+teto/i,
  /esperando\s+merge|aguardando\s+merge|esperando\s+o\s+merge/i,
  /migration\s+\d+.{0,40}n[aã]o\s+aplicada|falta\s+a\s+migration/i,
  /m[aã]o\s+humana\s+no\s+painel|painel\s+da\s+hotmart/i,
];

// Boilerplate que NAO conta como pedido de decisao (criterio 2).
const BOILERPLATE = [
  /precisa\s+de\s+olho\s+humano,?\s+n[aã]o\s+de\s+c[oó]digo/i,
];

/**
 * ⚠️ NOTA NEUTRA — escrita em LOTE que NAO fala do estado do caso (24/09 21h45Z).
 *
 * O QUE ACONTECEU. Em 24/09 17:48Z um retrofit automatico (#415) carimbou a
 * mesma nota em 21 cartoes vivos de uma vez. Como `ultimaNota()` le so
 * `agent_notes[-1]`, o carimbo virou a ultima nota de todos eles e 4 cartoes
 * parados no Johnny sumiram da varredura — TRES deles dinheiro de aluno
 * (#245, #263, #307) — e o controle positivo passou a ABORTAR (#554).
 *
 * O cabecalho deste arquivo ja previa isso em 22/09 ("LIMITE GRAVE — QUEM
 * ANOTA, ESCONDE") e prescrevia disciplina: quem anotar cartao parado no
 * Johnny repete na nota o que falta. A licao de 24/09 e que **disciplina
 * humana nao sobrevive a escrita automatica em lote**: uma rodada de retrofit
 * quebrou a regra em 21 cartoes sem ninguem desobedecer de proposito.
 *
 * A CURA, E O QUE ELA DELIBERADAMENTE NAO E. `ultimaNota()` passa a ANDAR PRA
 * TRAS enquanto a nota for NEUTRA. Neutra nao e sinonimo de "em lote", e essa
 * distincao e o ponto inteiro:
 *
 *   MEDIDO em 24/09 com `2026-09-24_nota_em_lote.cjs` (instrumento irmao, so
 *   leitura, que acha escrita em lote pelo DADO — mesmo texto em N cartoes):
 *   4 textos em lote nos cartoes vivos. Destes, apenas 2 sao neutros. Os
 *   outros 2 MUDAM O ESTADO e NAO podem ser pulados:
 *     · "CONSERTO EM PRODUCAO === PR #331 ... MERGEADO" (3 cartoes)
 *     · "RONDA 13/09 ... CANAL ENCONTRADO - ficha deixa de ser beco sem saida" (5)
 *   Pular esses ressuscitaria estado velho — exatamente a doenca de varrer a
 *   pilha inteira (41 falsos onde havia 1) que o criterio 1 existe pra evitar.
 *
 * POR ISSO A LISTA E CONFERIDA A MAO, e nao derivada automaticamente de "e
 * lote". O `nota_em_lote.cjs` SURFACE candidatos; quem inclui um aqui LE a nota
 * e responde: "se o cartao estava parado no Johnny antes desta nota, ele
 * continua parado depois dela?" So entra se a resposta for sim.
 *
 * O piso so desce por escrito, como o CONTROLE: incluir padrao aqui exige
 * motivo e data nesta mesma lista.
 */
const NOTA_NEUTRA = [
  // Retrofit da trava do humano (#415), 24/09 17:48Z, 21 cartoes. A propria
  // nota declara: "NADA MAIS foi tocado — nem status, nem credito, nem acesso,
  // nem texto de nota", e o #554 conferiu que e verdade. Fala de MARCA no
  // registro, nunca do desfecho do caso.
  /retrofit\s+da\s+trava\s+do\s+humano/i,
  // Carimbo automatico da Fast quando o aluno escreve de novo num chamado que
  // ja esta com o time (10 cartoes, desde 16/09). Registra que o aluno voltou a
  // falar; nao decide nada e nao tira nada do colo do Johnny. Mesma familia do
  // BOILERPLATE acima, so que em nota inteira.
  /o\s+aluno\s+mandou\s+outro\s+e-?mail\s+e\s+a\s+fast\s+n[aã]o\s+respondeu/i,
  // Nota automatica do passo pos-merge (`pos_merge_nota_no_cartao.cjs`,
  // incidente 0398d161, 24/09). Ela avisa que um PR nomeando o cartao MERGEOU
  // e exige visita humana — nao decide nada e NAO tira o cartao do colo do
  // Johnny. Respondida a pergunta da lista: se o cartao estava parado no
  // Johnny antes dela, continua parado depois (quem confirma a cura e a
  // VISITA, nao o merge). Sem esta linha, o proprio mecanismo criado pra dar
  // visibilidade cegaria esta fila em lote — o retrofit #415, de novo, agora
  // automatizado a cada merge. O estado "merge aconteceu" NAO se perde com o
  // pulo: ele entra nesta saida pelo marcador de merge abaixo (parte 2 do
  // 0398d161), que le o gh direto (dado vivo), nao a pilha de notas. Ha teste
  // amarrando este padrao ao formato real da nota: `_pr_cartao.test.cjs`.
  /^\[pos-merge PR #\d+\]/i,
];

const ehNeutra = (texto) => !!texto && NOTA_NEUTRA.some((p) => p.test(texto));

/**
 * TRIAGEM DE 22/09 17hZ — o resultado da conferencia a mao, encodado.
 *
 * A marca crua devolveu 30 cartoes. Li 6 a mao e dois deles eram falso
 * positivo (b0ddd483 so CITAVA "#214 e #226 estao em decisao do Johnny" pra
 * explicar a escolha do cartao; dd1764e9 tinha o proximo passo no coder).
 * ~33% de inflacao e exatamente a doenca que a ordem de 17/09 descreve: classe
 * inflada vira lista que ninguem ataca.
 *
 * Entao classifiquei os 30 com DUAS leituras independentes e cruzei:
 *   REAL      = as duas leituras concordam que ha pedido concreto e vivo.
 *   CONTESTADO= as duas discordam. Nao entra no numero de cima; fica listado.
 *   FALSO     = as duas concordam que e citacao/prosa/outro dono.
 *
 * O numero que vai pro relatorio e o PISO (REAL), nao o teto. Prefiro reportar
 * 17 solidos a 30 duvidosos: o Johnny age em cima deste numero.
 */
const TRIAGEM = {
  // --- REAL: as duas leituras concordam (piso do relatorio) ---
  d3d8d1b2: ["REAL", "merge do PR #404 (watchdog do #15)"],
  "8b8fc4c8": ["REAL", "mao no painel Hotmart: cancelar assinatura da Fabiana"],
  "7ed72ad0": ["REAL", "estornar ou nao os 7.455 cr (decisao de classe)"],
  // PESO CORRIGIDO em 24/09 22hZ: o cartao mostra 1 aluno em affected_emails,
  // mas a decisao que ele carrega e a MESMA que trava o #52 (37bacb68, 22
  // alunos, o mais velho da casa). Quem ler "1 aluno" subdimensiona a unica
  // pergunta que destrava os dois. Somados e sem repetir ninguem: 23.
  "702cc916": ["REAL", "⚖️ entrega abaixo do piso de QA: manter/falhar/avisar — trava tambem o #52 (23 alunos no total)"],
  "52b22304": ["REAL", "9-A: devolver credito das geracoes que nosso laudo chamou de fracas"],
  "5c68eb33": ["REAL", "9-C: devolver ou nao os R$97 de 08/08"],
  ab5644be: ["REAL", "9-A: estorno das animacoes sobrescritas (84.720 cr)"],
  "20ba24a1": ["REAL", "autorizar apagar linha duplicada em admin_emails"],
  "58b376ea": ["REAL", "merge do PR #355 (titularidade) — bomba armada"],
  b633b18c: ["REAL", "9-B acima do teto: 157.875 cr de residuo do SGP"],
  "176f987f": ["REAL", "credito+acesso de 10 contas contestadas (762.695 cr)"],
  "4ec88113": ["REAL", "reembolso fora da garantia de aluno que consumiu"],
  bb4d4cd0: ["REAL", "autorizar retentativa automatica de treino (gasta GPU)"],
  "1a37605a": ["REAL", "destravar acesso de quem pagou outro produto"],
  "22cda8b7": ["REAL", "devolver R$1.109,64 (garantia venceu no nosso silencio)"],
  "66c5c55a": ["REAL", "merge do PR #323 -> migration 111 -> saldos"],
  "1a9e6133": ["REAL", "⏰ 'pode'/'nao' dos TRES — janela vence 23/09"],

  // --- Segunda leva, triada a mao as 17h10Z (apareceram quando somei 9-B/9-C
  //     e "acima do teto" as marcas; o corte anterior nao as via) ---
  "09a26f8b": ["REAL", "⚖️ reembolso pedido com CDC art.49 — 14d dormindo"],
  "75c33ee1": ["REAL", "9-B 10x o teto: 1.010.200 cr liquidos, 183 alunos + DDL sem aval"],
  "827fa746": ["REAL", "aval do PR #42 (Fast le anexo > 2MB) — aberto desde 24/08"],
  ea898e2c: ["FALSO", "aluno respondido; a bola e dele (9-C so se ele pedir)"],
  e811cbc7: ["FALSO", "espera ocorrencia nova pra provar cura; card do coder acdae9ff"],
  a6e21646: ["FALSO", "pergunta aberta do aluno; 9-C so se ele pedir — bola e dele"],

  // --- Terceira leva, triada a mao na ronda de 24/09 ~22hZ. Entraram na
  //     varredura por dois motivos distintos, ambos registrados: (i) a regra
  //     NOTA_NEUTRA parou de deixar o carimbo de lote enterrar o estado, e
  //     (ii) o alargamento das MARCAS de 23/09. So entra aqui o que eu li
  //     INTEIRO; o que li pela metade fica NAO TRIADO de proposito. ---
  f1ada07e: ["REAL", "⏰ 9-C: reembolso Carlos R$194 + Nassara, e 'pode' do Leandro ANTES de 28/09 (cobranca dupla futura)"],
  ce8ba48b: ["REAL", "9-B acima do teto: 62.040 cr de estorno do #485 — o titulo do cartao ja diz 'DECISAO DO JOHNNY'"],
  "719c9af6": ["REAL", "decisao de produto/preco/estorno (lido a mao em 23/09 17hZ, ver bloco MARCAS)"],
  "555a1cee": ["REAL", "9-A/9-C: pagou R$291 e nao recebeu nada — decisao de dinheiro (lido a mao 23/09 17hZ)"],
  // FALSOS desta leva: cartao meu, ou ja resolvido, ou dono que nao e o Johnny.
  e693222b: ["FALSO", "#554 e o cartao DESTA ferramenta — dono sou eu, e foi trabalhado em 24/09 21h45Z"],
  "37c2b55c": ["FALSO", "'triado, sem acionamento'; contorno ja em producao, aluno Christian curado"],

  // --- CONTESTADO: as leituras divergiram. Fora do numero de cima. ---
  // Mesmo criterio ja aplicado ao ffbfdfc4: a pergunta existe, mas ja esta
  // sendo feita em OUTRO cartao. Levar os dois duplica a pergunta ao Johnny.
  "37bacb68": [
    "CONTESTADO",
    "#52: 22 alunos, mas travado na MESMA decisao (a)/(b)/(c) do 702cc916 — 1 pergunta, nao 2",
  ],
  ffbfdfc4: ["CONTESTADO", "decisao consolidada no #446/66c5c55a — levar junto duplicaria a pergunta"],
  acac6983: ["CONTESTADO", "piso de 400 cr / preco do teste: decisao futura ou pedido vivo?"],
  "980da40f": ["CONTESTADO", "cr acima do teto, mas ja na mesa do Hercules"],
  "354d3c73": ["CONTESTADO", "nota IDENTICA ao 980da40f (mesmo aluno/projeto) — 1 assunto, nao 2"],
  d92982fa: ["CONTESTADO", "estorno R$97 reendereçado a Liz, que opera o painel — pode nao ser do Johnny"],

  // --- FALSO: as duas leituras concordam que nao e pedido vivo ---
  b0ddd483: ["FALSO", "cita #214/#226 pra justificar escolha; bola esta com o aluno"],
  ae6b4bd1: ["FALSO", "a nota entrega ao Frank decidir, nao ao Johnny"],
  "3a9a4854": ["FALSO", "pedido e conserto proprio do texto de garantia"],
  ea54d97d: ["FALSO", "regra ja decidida em 21/08; passo esta em PR do coder"],
  "6fabb64a": ["FALSO", "'nao estornar' ja decidido pelo agente; Johnny citado como historico"],
  "4113298a": ["FALSO", "esperar Hotmart, reconferir 30/09"],
  "68b8fac7": ["FALSO", "falta pegar o n. da transacao antes de qualquer estorno"],
  dd1764e9: ["FALSO", "proximo passo e o coder; os 3 casos deram falso positivo"],
};

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

// Quantas notas neutras seguidas se aceita pular. Teto baixo de proposito: se
// um cartao tiver uma PILHA de carimbos por cima, isso e achado pra investigar
// (outro lote cego), nao coisa pra varrer em silencio. Estourar o teto devolve
// a nota crua — o vies volta a ser pra baixo, que e o lado seguro.
const TETO_NEUTRAS = 5;

// Conta, so pra relatorio: quantos cartoes so aparecem porque andamos pra tras.
const resgatados = [];

function ultimaNota(r) {
  const n = r.agent_notes;
  if (!Array.isArray(n) || n.length === 0) return null;
  let i = n.length - 1;
  let pulos = 0;
  while (i >= 0 && pulos < TETO_NEUTRAS && ehNeutra(n[i] && n[i].note)) {
    i--;
    pulos++;
  }
  if (i < 0) return "";
  if (pulos > 0) resgatados.push({ id: String(r.id).slice(0, 8), numero: r.numero, pulos });
  return (n[i] && (n[i].note || "")) || "";
}

function casa(texto) {
  if (!texto) return null;
  let limpo = texto;
  for (const b of BOILERPLATE) limpo = limpo.replace(b, " ");
  for (const m of MARCAS) {
    const hit = limpo.match(m);
    if (hit) return hit[0].trim();
  }
  return null;
}

(async () => {
  const db = supa();

  // Universo 1: a fila que espera (o que a ordem quer).
  const { data: fila, error: e1 } = await db
    .from("incidents")
    .select("id,numero,created_at,last_seen_at,status,signature,affected_emails,agent_notes")
    .in("status", ["open", "investigating", "aguardando_aluno"])
    .order("created_at", { ascending: true });
  exigir("incidents em espera", e1);

  // Universo 2: TODOS os status, so para o controle positivo.
  const { data: todos, error: e2 } = await db
    .from("incidents")
    .select("id,numero,agent_notes")
    .order("created_at", { ascending: true });
  exigir("incidents todos (controle)", e2);

  // ---- CONTROLE POSITIVO ----
  // Confere a lista ESPERADA inteira, item a item. Qualquer ausencia aborta —
  // nao existe "maioria reencontrada": ver o bloco do CONTROLE la em cima.
  const esperadosControle = Object.entries(CONTROLE);
  const achadosControle = [];
  const faltantesControle = [];
  for (const [prefixo, rotulo] of esperadosControle) {
    const row = todos.find((r) => String(r.id).startsWith(prefixo));
    if (!row) {
      faltantesControle.push({
        prefixo,
        rotulo,
        causa: "cartao NAO EXISTE no resultado da consulta (sumiu do banco ou o id mudou)",
      });
      continue;
    }
    const nota = ultimaNota(row);
    if (!casa(nota)) {
      const trecho = String(nota || "").replace(/\s+/g, " ").trim().slice(0, 120);
      faltantesControle.push({
        prefixo,
        rotulo,
        causa: `existe, mas NENHUMA marca casou com a ultima nota${trecho ? `: "${trecho}"` : " (ultima nota vazia)"}`,
      });
      continue;
    }
    achadosControle.push(`${prefixo} ${rotulo}`);
  }

  if (faltantesControle.length > 0) {
    console.error(
      `\n❌ CONTROLE POSITIVO INCOMPLETO: ${faltantesControle.length} de ${esperadosControle.length} cartoes` +
        " lidos a mao em 22/09 17hZ NAO foram reencontrados."
    );
    console.error("\n   SUMIRAM (estes sao os que voce tem que investigar):");
    for (const f of faltantesControle) {
      console.error(`     · ${f.prefixo} ${f.rotulo}`);
      console.error(`         motivo: ${f.causa}`);
    }
    if (achadosControle.length) {
      console.error("\n   Ainda reencontrados (nao consolam, so delimitam a quebra):");
      for (const a of achadosControle) console.error(`     · ${a}`);
    }
    console.error("\n   POR QUE ISTO MATA A VARREDURA: estes 4 cartoes sao os UNICOS casos");
    console.error("   que alguem conferiu a mao e sabe, de fato, que estao parados no Johnny.");
    console.error("   Se o filtro perde um caso CONHECIDO, ele esta perdendo tambem um numero");
    console.error("   desconhecido de casos que ninguem conferiu — e nao ha como saber quantos.");
    console.error("   O erro so anda num sentido: a marca deixa de casar, o cartao some da lista,");
    console.error("   o total impresso CAI. O vies e sempre pra baixo, nunca pra cima. Portanto");
    console.error("   QUALQUER numero desta saida seria otimista: uma fila menor do que a real,");
    console.error("   lida como 'a casa esta melhorando'. Foi exatamente assim que o #216 ficou");
    console.error("   20 dias invisivel. NAO reporte nada desta rodada; conserte a marca primeiro.");
    console.error("\n   Se o piso DEVE mesmo cair (cartao resolvido/reendereçado de verdade),");
    console.error("   reescreva a lista CONTROLE no topo deste arquivo com o motivo e a data.");
    console.error("   O piso so desce por escrito.");
    process.exit(1);
  }

  console.log(
    `controle positivo OK (${achadosControle.length}/${esperadosControle.length} reencontrados) · ${todos.length} incidentes varridos`
  );

  // ---- A CLASSE ----
  const presos = [];
  for (const r of fila) {
    const marca = casa(ultimaNota(r));
    if (marca) presos.push({ ...r, marca });
  }

  // ---- O QUE A REGRA DA NOTA NEUTRA MUDOU, DECLARADO ----
  // Numero que anda sem explicacao e numero em que ninguem confia. Se a fila
  // cresce porque passamos a enxergar o que estava enterrado, isso vai escrito:
  // NAO e piora da casa, e o fim de uma cegueira.
  //
  // ⚠️ ESTE BLOCO TEM QUE FICAR DEPOIS DO LACO DA CLASSE. Ele nasceu ACIMA
  // dele em 24/09 e saiu MENTINDO: como `resgatados` so se enche quando
  // `ultimaNota()` roda, imprimir antes do laco mostrava apenas os cartoes do
  // CONTROLE (1 de 4 — so o #216). Os outros tres, que sao justamente os de
  // dinheiro de aluno (#245, #263, #307), eram resgatados de verdade e
  // apareciam na lista final, mas NAO constavam no aviso. Ou seja: o proprio
  // aviso criado pra matar o vies pra baixo tinha o vies pra baixo. Pego
  // relendo a saida contra o `nota_em_lote.cjs`, nao pelo teste.
  // So conta quem ANDOU PRA TRAS **e** acabou na classe. Andar pra tras em
  // cartao que nao casa marca nenhuma nao "revelou" nada — dizer que revelou
  // inflaria o efeito do proprio conserto (22 em vez de 4), e numero inflado a
  // favor de quem mexeu e a versao espelhada do vies que isto combate.
  const naClasse = new Set(presos.map((p) => String(p.id).slice(0, 8)));
  const unicos = [...new Map(resgatados.map((x) => [x.id, x])).values()].filter((x) => naClasse.has(x.id));
  if (unicos.length) {
    console.log(
      `\n🔎 ${unicos.length} cartao(oes) so aparecem porque a regra NOTA_NEUTRA andou pra tras` +
        ` (carimbo de lote por cima do estado real; ${resgatados.length} cartoes tiveram carimbo, ` +
        `${unicos.length} viraram fila):`
    );
    for (const u of unicos.sort((a, b) => (a.numero || 0) - (b.numero || 0))) {
      console.log(`     · ${u.id} ${u.numero ? `#${u.numero}` : ""} — ${u.pulos} nota(s) neutra(s) puladas`);
    }
    console.log("   Nao confunda com fila crescendo: e fila que estava escondida.");
  }

  // ---- APLICA A TRIAGEM CONFERIDA A MAO ----
  const baldes = { REAL: [], CONTESTADO: [], FALSO: [], NOVO: [] };
  for (const p of presos) {
    const k = String(p.id).slice(0, 8);
    const t = TRIAGEM[k];
    if (!t) baldes.NOVO.push({ ...p, motivo: "NAO TRIADO — apareceu depois de 22/09 17hZ" });
    else baldes[t[0]].push({ ...p, motivo: t[1] });
  }

  // ---- PARTE 2 do 0398d161: merge SINALIZA, nunca esconde ----
  // A ordem original pedia "esconder da fila o item cujo PR nomeado ja
  // mergeou". RECUSADO, e o motivo e medido: em 24/09 esta mesma fila
  // escondeu 4 cartoes por outro motivo (#554), o total caiu e a queda foi
  // lida como melhora — o vies desta fila so anda pra baixo. Entao o item
  // CONTINUA na lista, com o aviso colado; quem le decide. E o aviso vem do
  // gh (dado VIVO), nao das notas: nota e historico e ja deu 3 falsos em 5.
  // gh fora do ar NAO derruba a varredura (a fila vale sozinha) — mas grita,
  // porque marcador ausente em silencio e o mesmo defeito com outra roupa.
  let mergePorCartao = new Map();
  try {
    const prsMergeados = JSON.parse(
      execFileSync("gh", ["pr", "list", "--state", "merged", "--limit", "400",
        "--json", "number,title,mergedAt"], { maxBuffer: 1e9 }).toString(),
    );
    mergePorCartao = casarPrsComCartoes(prsMergeados, fila);
  } catch (e) {
    console.error(
      `\n⚠️  MARCADOR DE MERGE INDISPONIVEL nesta rodada (gh falhou: ${String(e.message).slice(0, 120)}).` +
        "\n   A fila abaixo vale, mas SEM o aviso de 'PR ja mergeou' — nao conclua que nenhum mergeou.",
    );
  }

  const marcaMerge = (p) => {
    const pares = mergePorCartao.get(String(p.id)) || [];
    return pares
      .map(({ pr }) => `\n        ⚠️ PR #${pr.number} ja mergeou em ${String(pr.mergedAt).slice(0, 16)}Z — provavelmente resolvido, confirme`)
      .join("");
  };

  const linha = (p) =>
    `  ${String(p.id).slice(0, 8)} · ${String(dias(p.created_at)).padStart(3)}d · ` +
    `${String((p.affected_emails || []).length).padStart(2)} aluno(s) · ${p.motivo}` +
    marcaMerge(p);

  console.log(`\nmarca crua: ${presos.length} cartoes — ANTES da triagem (a marca infla ~33%)`);

  console.log("\n" + "=".repeat(70));
  console.log(`⏳ PARADOS NO JOHNNY — CONFERIDO (piso): ${baldes.REAL.length}`);
  console.log("=".repeat(70));
  baldes.REAL.forEach((p) => console.log(linha(p)));

  if (baldes.NOVO.length) {
    console.log(`\n🆕 NAO TRIADOS (entraram depois da conferencia — LEIA A MAO): ${baldes.NOVO.length}`);
    baldes.NOVO.forEach((p) => console.log(linha(p)));
  }

  console.log(`\n🤔 CONTESTADOS (as 2 leituras discordaram — fora do numero): ${baldes.CONTESTADO.length}`);
  baldes.CONTESTADO.forEach((p) => console.log(linha(p)));

  console.log(`\n🗑  FALSOS POSITIVOS da marca (nao leve ao Johnny): ${baldes.FALSO.length}`);

  const alunos = new Set();
  for (const p of baldes.REAL) for (const e of p.affected_emails || []) alunos.add(e);
  const maisVelho = baldes.REAL.length ? Math.max(...baldes.REAL.map((p) => dias(p.created_at))) : 0;

  console.log("\n" + "-".repeat(70));
  console.log(`>>> NUMERO PRO RELATORIO: ${baldes.REAL.length} card(s) parado(s) em decisao do Johnny`);
  console.log(`    mais velho parado ha ${maisVelho}d · ${alunos.size} aluno(s) distinto(s) atras da fila`);
  console.log(`    (teto se os ${baldes.CONTESTADO.length} contestados contarem: ${baldes.REAL.length + baldes.CONTESTADO.length})`);
  console.log("    Doutrina (17/09, aplicada a DECISAO): isto nao pode ser parada permanente.");
  console.log("    O desfecho aqui NAO e re-escalar um caso por ronda — e juntar num LOTE");
  console.log("    e levar ao grupo de uma vez, pra ele resolver varios com poucas palavras.");
})();
