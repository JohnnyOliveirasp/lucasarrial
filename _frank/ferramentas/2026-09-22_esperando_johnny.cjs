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
 *   1. A marca tem que estar na ULTIMA nota SUBSTANTIVA. Varrer a pilha
 *      inteira mede HISTORICO e apresenta como PENDENCIA — foi assim que
 *      o SQL da ordem de 17/09 devolveu 41 falsos onde havia 1.
 *      "Substantiva" = nao e de manutencao. Nota de manutencao (retrofit,
 *      backfill, nota em lote — `tipo:"manutencao"`) nao representa o estado
 *      do cartao e a leitura PULA por cima dela, andando pra tras ate achar
 *      uma substantiva. Sem isso, uma unica escrita em lote enterra a fila
 *      inteira de uma vez — foi o retrofit de 24/09 17:48Z (#554), que
 *      escreveu em 21 cartoes vivos e cegou 4 da fila de decisao do Johnny,
 *      3 deles de dinheiro de aluno.
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
 * ultima nota SUBSTANTIVA (criterio 1) tem um preco: QUEM ANOTA, ESCONDE.
 * Nesta ronda eu anotei o b633b18c — cartao que ESTA esperando o Johnny — e
 * minha nota nao repetia nenhuma marca. O cartao sumiu da varredura na hora,
 * sem nada ter sido resolvido. A mesma doenca do rotulo `aguardando_aluno`:
 * o cartao nao muda de estado, so fica invisivel.
 *
 * Mitiguei somando as regras de alcada (9-A/9-B/9-C, "acima do teto") as
 * marcas, porque quem escreve uma nota dessas quase sempre cita a regra que o
 * impede de agir. NAO e cura: se a proxima nota nao citar nada, o cartao some
 * de novo.
 *
 * REGRA PRA QUEM ANOTAR UM CARTAO QUE SEGUE PARADO NO JOHNNY: isto vale pra
 * nota SUBSTANTIVA (a escrita por alguem que leu o caso): repita na sua nota,
 * com essas palavras, o que falta ("decisao do Johnny", "9-A", "aguardando
 * merge"). Nao e burocracia — e o que mantem o cartao visivel no unico lugar
 * que o conta.
 *
 * NOTA EM LOTE / RETROFIT / BACKFILL e outra especie: quem escreve nao leu o
 * caso e nao tem como repetir a marca. Ela DEVE sair com `tipo:"manutencao"`
 * no objeto da nota — a varredura pula por cima e o cartao continua visivel.
 * Nota em lote SEM essa marca e a operacao destrutiva de 24/09 de novo
 * (21 cartoes anotados numa tacada, 4 da fila do Johnny enterrados). Ponte
 * temporaria: as 21 notas daquele retrofit nasceram sem o campo, entao a
 * leitura tambem reconhece pela assinatura de texto no INICIO da nota
 * (/^RETROFIT DA TRAVA DO HUMANO/i). Anchor no inicio de proposito: nota
 * substantiva que CITA a frase no meio (caso e693222b/#554) NAO e manutencao.
 *
 * SO LEITURA. Nao escreve, nao fecha, nao muda status, nao manda e-mail.
 */
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
  "d3d8d1b2": "#15  PR #404 esperando merge",
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
  "702cc916": ["REAL", "entrega abaixo do piso de QA: manter/falhar/avisar"],
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

  // --- CONTESTADO: as leituras divergiram. Fora do numero de cima. ---
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

// Nota de manutencao: escrita em lote/retrofit/backfill, por quem NAO leu o
// caso. Nao representa o estado do cartao — a leitura pula por cima dela.
// Criterio primario: campo `tipo:"manutencao"` no objeto da nota. Ponte: as
// 21 notas do retrofit de 24/09 17:48Z nasceram sem o campo, entao a
// assinatura de texto delas tambem conta — ANCORADA NO INICIO, porque nota
// substantiva pode CITAR a frase no meio (medido: a nota do #554/e693222b
// cita "RETROFIT DA TRAVA DO HUMANO" na posicao 207 e NAO e manutencao).
const PONTE_RETROFIT_2409 = /^\s*RETROFIT DA TRAVA DO HUMANO/i;

function ehNotaManutencao(nota) {
  if (!nota || typeof nota !== "object") return false;
  if (nota.tipo === "manutencao") return true;
  return PONTE_RETROFIT_2409.test(String(nota.note || ""));
}

// "Ultima nota" da varredura = ultima nota SUBSTANTIVA: anda pra tras
// enquanto a nota for de manutencao. NAO varre a pilha atras de marca — quem
// faz isso mede historico e apresenta como pendencia (41 falsos onde havia 1,
// ver criterio 1 no cabecalho). So pula o que for manutencao declarada.
function ultimaNota(r) {
  const n = r.agent_notes;
  if (!Array.isArray(n) || n.length === 0) return null;
  for (let i = n.length - 1; i >= 0; i--) {
    if (ehNotaManutencao(n[i])) continue;
    const u = n[i];
    return (u && (u.note || "")) || "";
  }
  return null; // a pilha inteira e manutencao — nada substantivo pra ler
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

// Puras, sem banco — e o que o .test.cjs importa (padrao do percepcao_travada).
module.exports = { ultimaNota, ehNotaManutencao, casa, MARCAS, BOILERPLATE, CONTROLE, TRIAGEM, PONTE_RETROFIT_2409 };

if (require.main === module) (async () => {
  // Lazy de proposito (padrao do percepcao_travada.cjs): o require do _comum
  // puxa node_modules do frontend, que nao existe em worktree de agente — e o
  // .test.cjs importa este arquivo SEM banco.
  const { supa } = require("./_comum.cjs");
  const db = supa();

  // Universo 1: a fila que espera (o que a ordem quer).
  const { data: fila, error: e1 } = await db
    .from("incidents")
    .select("id,created_at,last_seen_at,status,signature,affected_emails,agent_notes")
    .in("status", ["open", "investigating", "aguardando_aluno"])
    .order("created_at", { ascending: true });
  exigir("incidents em espera", e1);

  // Universo 2: TODOS os status, so para o controle positivo.
  const { data: todos, error: e2 } = await db
    .from("incidents")
    .select("id,agent_notes")
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

  // ---- APLICA A TRIAGEM CONFERIDA A MAO ----
  const baldes = { REAL: [], CONTESTADO: [], FALSO: [], NOVO: [] };
  for (const p of presos) {
    const k = String(p.id).slice(0, 8);
    const t = TRIAGEM[k];
    if (!t) baldes.NOVO.push({ ...p, motivo: "NAO TRIADO — apareceu depois de 22/09 17hZ" });
    else baldes[t[0]].push({ ...p, motivo: t[1] });
  }

  const linha = (p) =>
    `  ${String(p.id).slice(0, 8)} · ${String(dias(p.created_at)).padStart(3)}d · ` +
    `${String((p.affected_emails || []).length).padStart(2)} aluno(s) · ${p.motivo}`;

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
