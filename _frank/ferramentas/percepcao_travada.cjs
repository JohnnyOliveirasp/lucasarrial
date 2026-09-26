#!/usr/bin/env node
/**
 * percepcao_travada.cjs — os cards que so param porque falta VER, OUVIR ou
 * ASSISTIR. Ordem do Johnny de 17/09
 * (`_frank/ordens/2026-09-17_percepcao_nao_e_desculpa_pra_parar.md`).
 *
 * POR QUE ESTE SCRIPT EXISTE, E NAO A CONSULTA QUE A ORDEM PUBLICOU.
 * A ordem trouxe uma consulta de apoio que varre `agent_notes::text` inteiro
 * atras de 'humano olhar|precisa olhar|nao enxergo|assistir|ouvir'. Medido em
 * 17/09 21hZ, ela devolve 41 cartoes abertos. O numero e falso por DOIS motivos
 * independentes, e os dois puxam pro mesmo lado (inflar):
 *
 *   1. BOILERPLATE DO SENSOR. O `carol` carimba, em TODO chamado entregue a
 *      humano, a frase "precisa de olho humano, não de código". Ali "olho
 *      humano" quer dizer "isto e atendimento, nao e bug" — o oposto de
 *      "alguem precisa olhar um arquivo". Sozinha, essa frase explicava 33 dos
 *      41.
 *   2. MARCA VELHA EM NOTA JA SUPERADA. Varrer o historico inteiro acha o
 *      "nao enxergo" que um agente escreveu ha 10 dias e que a nota SEGUINTE ja
 *      resolveu. O #296 aparecia na lista com a aluna ja respondida, causa
 *      achada e cartao-filho aberto.
 *
 * Aplicando os dois filtros, a classe REAL em 17/09 era de UM cartao (#310), e
 * ele foi fechado na mesma ronda. Uma classe de 1 exige despacho; uma classe de
 * 41 vira lista que ninguem ataca — que e exatamente como ela chegou a 16 dias.
 *
 * O CRITERIO DAQUI: a marca de percepcao tem que estar na ULTIMA nota (o passo
 * que falta AGORA, nao o que ja foi superado) e nao pode ser o boilerplate.
 *
 * ⚠️ CONTROLE POSITIVO, e o script ABORTA se ele zerar. "Zero" de instrumento
 * cego ja fez a casa reportar saude onde havia fila. O controle e o proprio
 * #310 (fechado em 17/09 com a marca "nao ouco nem enxergo" na nota do
 * EXECUTOR de 09/09): se a varredura por marca nao reencontra ELE no universo
 * de todos os status, o filtro quebrou e o zero nao vale nada.
 *
 * ⚠️ MEDIDO DE NOVO EM 21/09, porque o numero errado voltou DUAS rondas
 * seguidas: o SQL cru da ordem de 17/09 (pilha inteira) devolvia 18 cards, e
 * os 18 eram falso positivo — 15 casavam so em nota JA SUPERADA (702cc916,
 * ab5644be, bb97e2f1 entre eles) e 3 casavam na ultima nota por citacao/prosa,
 * nao por pendencia. ESTE script, no mesmo instante, devolvia 2. A consulta da
 * ordem foi corrigida para `agent_notes -> -1` na mesma entrega; o instrumento
 * canonico continua sendo este arquivo (a memoria da casa ja dizia isso).
 *
 * ⚠️ SEGUNDO DEFEITO, MEDIDO NA RONDA DE 21/09 18hZ (Frank): a varredura so
 * contava open/investigating, e cartao travado em percepcao costuma estar em
 * 'aguardando_aluno' — rotulo que MENTE sobre quem deve o proximo passo.
 * Quando a ultima nota pede ver/ouvir/assistir, quem trava e a CASA; o cartao
 * foi parado em aguardando_aluno e sumiu de toda contagem. Custo real: no
 * #207 o Vigia avisou em 11/09 12:17Z que a garantia do aluno vencia em
 * ~11,7h; o cartao estava em aguardando_aluno, invisivel, ninguem viu, a
 * garantia venceu e o aluno ficou com R$97 cobrados sem devolucao. Falso
 * NEGATIVO esconde aluno esperando — pior que falso positivo, que so faz
 * ruido. Por isso STATUS_VARRIDOS inclui aguardando_aluno, e a saida marca
 * esses cartoes como "rotulo mente: a bola e da CASA".
 *
 * USO: node _frank/ferramentas/percepcao_travada.cjs
 * TESTE (sem banco): node --test "_frank/ferramentas/percepcao_travada.test.cjs"
 */
const { ultimaNotaSubstantiva } = require("./_ultima_nota_substantiva.cjs");

/** A frase do sensor que NAO e pedido de percepcao. Normalizada sem acento. */
const BOILERPLATE = "precisa de olho humano, nao de codigo";

/**
 * Marcas que significam "falta alguem ver/ouvir/assistir". Sem acento.
 *
 * ⚠️ "alguem olhar" ESTAVA nesta lista e SAIU, medido em 17/09: ela casava o
 * #315, onde a frase e "depende de alguem olhar O BANCO a mao". Olhar banco e
 * consulta, nao percepcao — o passo que trava aquele cartao e um conserto de
 * codigo sem dono. Marca que casa o verbo sem casar o ARTEFATO devolve o card
 * pra lista errada, e lista errada e como esta classe chegou a 16 dias.
 * Se voltar a precisar dela, exija o objeto junto ("alguem olhar a imagem").
 */
const MARCAS = [
  "humano olhar", "olho humano", "ouvido humano", "ouvido/olho",
  "nao enxergo", "nao ouco", "nao vejo", "nao consigo ver",
  "precisa olhar", "precisa assistir", "precisa ouvir",
  "alguem assistir", "alguem ouvir",
  "ouvir o audio", "ver a imagem", "ver o video", "conferir a imagem",
];

/**
 * Status que a varredura considera "alguem esta ESPERANDO".
 *
 * ⚠️ 'aguardando_aluno' ENTROU em 21/09 (segundo defeito, ronda 18hZ). O
 * rotulo diz que a bola e do aluno, mas quando a ULTIMA nota pede
 * ver/ouvir/assistir, o passo que falta e da CASA — o cartao foi PARADO em
 * aguardando_aluno e virou invisivel (caso #207, garantia vencida, R$97 nao
 * devolvidos). A saida marca esses cartoes explicitamente.
 *
 * fixed/ignored ficam FORA de proposito: a ordem de 17/09 quer quem esta
 * esperando, nao historico — e fixed/ignored sao exatamente os status em que
 * a reincidencia REABRE o cartao sozinha no ingest, entao nao ha aluno mudo
 * escondido atras deles. Se um dia entrar status final aqui, argumente.
 */
const STATUS_VARRIDOS = ["open", "investigating", "aguardando_aluno"];

/**
 * TERCEIRO DEFEITO, MEDIDO NA RONDA DE 21/09 ~19hZ: depois dos consertos da
 * ultima-nota e do aguardando_aluno, os 5 que SOBRARAM eram TODOS falso
 * positivo — a marca casava a NARRATIVA de percepcao ja cumprida, nao um
 * pedido pendente. A classe real era ZERO e o relatorio mentia pra cima.
 * Os 5, um por um (o teste trava cada um com o texto real da nota):
 *   #450 — a propria nota diz "NAO e caso de percepcao"; casava por
 *          '%precisa olhar%' CITADO entre aspas, prosa sobre o detector.
 *   #406 — "OLHEI AS IMAGENS, UMA POR UMA" — cumprida; casava pelo recado
 *          citado 'EU NAO ENXERGO IMAGEM, precisa de olho humano'.
 *   #455 — "=== O QUE FOI FEITO === Audio LIBERADO" — cumprida.
 *   #216 — "a percepcao JA foi cumprida", "FALSO POSITIVO" com todas as
 *          letras; casava por "[olho humano]" entre colchetes, uma CITACAO.
 *   #438 — relato de perna que saiu do papel; casava pela frase da ordem de
 *          17/09 citada entre aspas ("precisa de um humano olhar").
 *
 * DOIS filtros novos, e nenhum depende de o agente lembrar frase magica
 * (nota sobre instrumento cego nao sobrevive a ronda seguinte — ja
 * aconteceu duas vezes nesta familia):
 *
 *   1. CITACAO NAO E PEDIDO. Trecho entre aspas ('...', "...") ou colchetes
 *      [...] e fala SOBRE a marca (recado antigo, padrao SQL, tag do
 *      detector), nao pedido novo. Sai antes de procurar marca. O span e
 *      LIMITADO (sem quebra de linha, teto de chars): apostrofe solta num
 *      texto longo nao pode engolir um pedido verdadeiro.
 *   2. RELATO ANULA PEDIDO. Nota que conta percepcao FEITA (olhei/assisti/
 *      ouvi em primeira pessoa, "despacho cumprido", "percepcao cumprida",
 *      "falso positivo", "nao e caso de percepcao", "o que foi feito") e
 *      relato, nao fila. Word boundary nos verbos: "assisti" NAO casa
 *      dentro de "precisa assistir", senao o anulador mataria o proprio
 *      pedido que ele protege.
 *
 * CUSTO ASSUMIDO, por escrito: uma nota mista ("olhei a foto, mas ainda
 * falta ouvir o audio") sai da lista — falso negativo possivel. Aceito
 * porque (a) a familia inteira medida ate hoje (5 de 5 em 21/09) e relato
 * puro, e (b) quem cumpre percepcao pela metade escreve a pendencia na
 * PROXIMA nota ao despachar, que e onde o detector le. Se este custo
 * aparecer medido, o conserto e refinar o anulador, nao remove-lo.
 */
/**
 * QUARTO DEFEITO, MEDIDO NA RONDA DE 23/09 ~00h40Z: o anulador nao trata
 * NEGACAO. O #518 (b4d64e4a, Junqueira) entrou na lista como pendencia
 * enquanto a sua ULTIMA nota diz, com todas as letras, o CONTRARIO:
 *
 *   "...e NAO PEDI OUVIDO HUMANO porque ele proprio ja deu o veredito de
 *    ouvido que o caso precisava - eu nao ouco e nao afirmo nada sobre
 *    como o audio saiu."
 *
 * A marca casou por 'ouvido humano' DENTRO de "nao pedi ouvido humano".
 * Nenhum CUMPRIMENTOS anterior pega isto: nao ha verbo em primeira pessoa
 * ("olhei"/"assisti"/"ouvi" — e "ouvi" tem word boundary, entao nao casa
 * "ouvido"), nao ha "despacho cumprido" e nao ha "falso positivo".
 *
 * E a MESMA familia dos tres anteriores — a nota fala SOBRE a marca em vez
 * de pedir — mas por uma porta nova: antes era CITACAO e RELATO, agora e
 * RECUSA EXPLICITA. Custo real: com 1 so card na classe, um falso positivo
 * e 100% do numero do relatorio. A ronda de 22/09 23h reportou "0"; esta
 * teria reportado "1" e mandado despachar percepcao de um caso em que o
 * proprio aluno ja tinha dado o veredito de ouvido.
 *
 * ⚠️ O QUE **NAO** ENTRA AQUI, DE PROPOSITO: "eu nao ouco" / "eu nao
 * enxergo" sozinhos. Essas frases sao o PEDIDO DE SOCORRO — sao exatamente
 * a marca do controle positivo #310. Anular por elas cegaria o detector
 * inteiro. So se desconta a RECUSA NOMINAL ("nao pedi X") e o veredito ja
 * dado, que sao afirmacoes de que a pendencia NAO existe.
 */
const CUMPRIMENTOS = [
  /\bolhei\b/, /\bassisti\b/, /\bouvi\b/,
  /despacho cumprido/, /percepcao (ja foi |foi )?cumprida/,
  /nao e caso de percepcao/, /falso positivo/, /o que foi feito/,
  // 23/09 — recusa explicita e veredito ja dado (ver bloco acima)
  /nao pedi (ouvido|olho|percepcao)/,
  /ja deu o veredito/,
  /ninguem precisa olhar nada de novo/,
];

/** Cita entre aspas/colchetes, span limitado (sem \n, teto de chars). */
const semCitacoes = (t) => t
  .replace(/"[^"\n]{1,200}"/g, " ")
  .replace(/'[^'\n]{1,200}'/g, " ")
  .replace(/\[[^\]\n]{1,120}\]/g, " ");

/** Sem acento e minusculo: a marca nao pode depender de como o agente digitou. */
const chato = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A marca que casa numa nota: descontado o boilerplate do sensor, descontadas
 * as CITACOES, e null se a nota e RELATO de percepcao cumprida (CUMPRIMENTOS).
 * O anulador roda no texto JA sem citacoes: "olhei" citado de terceiro nao
 * pode anular um pedido verdadeiro da mesma nota.
 */
function marcaDe(nota) {
  const t = semCitacoes(chato(nota)).split(BOILERPLATE).join(" ");
  if (CUMPRIMENTOS.some((c) => c.test(t))) return null;
  return MARCAS.find((m) => t.includes(m)) ?? null;
}

/**
 * Os cards que SO param por falta de ver/ouvir/assistir: em status de espera
 * (STATUS_VARRIDOS, incluindo o aguardando_aluno que mente), e com a marca na
 * ULTIMA nota SUBSTANTIVA (o passo que falta AGORA). Pura, sem banco — e o
 * criterio inteiro do detector, e o que o teste unitario exercita.
 * `agent_notes` null, vazio ou fora do formato de array NAO explode nem casa.
 *
 * ⚠️ "ULTIMA nota" NAO e mais `agent_notes[-1]` cru desde 25/09 (incidente
 * 02581255). Quando a ultima nota e um carimbo de LOTE/retrofit (NEUTRA — ver
 * `_ultima_nota_substantiva.cjs`), a leitura anda pra tras ate achar uma nota
 * que fale do estado do caso, ate o TETO_NEUTRAS daquele modulo. Sem isso, o
 * defeito era silencioso: o cartao do incidente estimou ~22 de 164 cartoes
 * vivos (13%) com a ultima nota neutra; a MEDICAO ao vivo em producao (25/09,
 * mesmo escopo STATUS_VARRIDOS deste detector) achou 20 — a diferenca nao foi
 * reconciliada, e fica registrada em vez de arredondada. Um pedido de
 * percepcao real atras de uma dessas notas sumiria da varredura do mesmo
 * jeito que os 4 cartoes de dinheiro sumiram do `esperando_johnny.cjs` em
 * 24/09 (#554) — MESMO defeito, DOIS consumidores. Rodado de novo em
 * producao apos este conserto: os 20 cartoes tiveram a nota neutra pulada,
 * ZERO viraram pedido de percepcao (a nota substantiva por tras nao pedia
 * ver/ouvir/assistir) — o "0 travado" que a casa ja publicava seguiu correto,
 * so que agora e um zero VERIFICADO, nao um zero por cegueira.
 *
 * `travados.resgatados` (anexado ao array devolvido, nao muda o formato pra
 * quem so itera/indexa) lista os cartoes que SO entraram na classe porque a
 * leitura andou pra tras — o relato que evita que o conserto vire so "um
 * numero trocando por outro" sem ninguem saber se confiar nele.
 */
function travadosDe(incidentes) {
  const travados = [];
  const resgatados = [];
  for (const i of incidentes) {
    if (!STATUS_VARRIDOS.includes(i.status)) continue;
    const { nota: ultima, pulos } = ultimaNotaSubstantiva(i.agent_notes);
    if (!ultima) continue;
    const marca = marcaDe(ultima.note);
    if (pulos > 0) resgatados.push({ id: i.id, numero: i.numero, pulos, entrouNaClasse: !!marca });
    if (!marca) continue;
    travados.push({ i, marca, ultima });
  }
  travados.sort((a, b) => new Date(a.ultima?.at) - new Date(b.ultima?.at));
  // Anexado ao array (nao troca o tipo de retorno): quem so faz .length/.map
  // continua funcionando igual; quem quer o relato de resgate acha aqui.
  travados.resgatados = resgatados.filter((r) => r.entrouNaClasse);
  travados.totalNotasNeutrasPuladas = resgatados.length;
  return travados;
}

const dias = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;

module.exports = { marcaDe, travadosDe, MARCAS, BOILERPLATE, STATUS_VARRIDOS, CUMPRIMENTOS };

if (require.main === module) (async () => {
  const { supa } = require("./_comum.cjs");
  const db = supa();
  const { data, error } = await db.from("incidents")
    .select("id,numero,status,signature,title,affected_emails,created_at,agent_notes")
    .order("created_at");
  if (error) { console.error("ERRO incidents:", error.message); process.exit(1); }

  // CONTROLE POSITIVO antes de qualquer numero: a marca ainda e encontravel?
  const controle = data.find((i) => i.numero === 310);
  const achouControle = controle
    && Array.isArray(controle.agent_notes)
    && controle.agent_notes.some((n) => marcaDe(n?.note));
  if (!achouControle) {
    console.error("ABORTA: o controle positivo (#310, marca 'nao ouco nem enxergo' na nota de 09/09) NAO foi reencontrado.");
    console.error("O filtro quebrou. Qualquer zero desta varredura seria cegueira, nao saude.");
    process.exit(1);
  }
  // CONTROLE NEGATIVO (23/09): o #518 recusa percepcao por escrito ("NAO PEDI
  // OUVIDO HUMANO ... ele proprio ja deu o veredito"). Ele NAO pode contar como
  // pendencia. Se voltar a contar, o anulador de negacao regrediu e o numero
  // volta a mentir pra cima — morre aqui, nao imprime.
  const negativo = data.find((i) => i.numero === 518);
  if (negativo && Array.isArray(negativo.agent_notes) && negativo.agent_notes.length) {
    const ultimaNeg = negativo.agent_notes[negativo.agent_notes.length - 1];
    if (marcaDe(ultimaNeg?.note)) {
      console.error("ABORTA: o controle negativo (#518, 'NAO PEDI OUVIDO HUMANO') voltou a contar como pendencia.");
      console.error("O anulador de negacao regrediu. Qualquer numero desta varredura estaria inflado.");
      process.exit(1);
    }
  }

  console.log(`controle positivo OK (#310) · controle negativo OK (#518 descontado) · ${data.length} incidentes varridos\n`);

  const travados = travadosDe(data);

  // ---- O QUE A LEITURA DE NOTA NEUTRA MUDOU, DECLARADO (incidente 02581255) ----
  // Mesmo relato que o `esperando_johnny.cjs` ja imprime: sem ele, o conserto
  // vira so "um numero trocando por outro" e ninguem sabe se confiar nele.
  if (travados.resgatados.length) {
    console.log(
      `🔎 ${travados.resgatados.length} cartao(oes) so aparecem porque a leitura de nota SUBSTANTIVA andou pra tras` +
        ` (carimbo de lote por cima do estado real; ${travados.totalNotasNeutrasPuladas} cartao(oes) tiveram nota neutra pulada` +
        ` no total, ${travados.resgatados.length} viraram fila de percepcao):`
    );
    for (const r of [...travados.resgatados].sort((a, b) => (a.numero || 0) - (b.numero || 0))) {
      console.log(`     · ${String(r.id).slice(0, 8)} ${r.numero ? `#${r.numero}` : ""} — ${r.pulos} nota(s) neutra(s) puladas`);
    }
    console.log("   Nao confunda com fila crescendo: e fila que estava escondida.\n");
  } else if (travados.totalNotasNeutrasPuladas) {
    console.log(
      `🔎 ${travados.totalNotasNeutrasPuladas} cartao(oes) tiveram nota neutra pulada na leitura, ` +
        "mas nenhum virou pedido de percepcao (a nota substantiva por tras nao pedia ver/ouvir/assistir).\n"
    );
  }

  const porStatus = {};
  for (const { i } of travados) porStatus[i.status] = (porStatus[i.status] ?? 0) + 1;
  const quebra = STATUS_VARRIDOS
    .filter((s) => porStatus[s])
    .map((s) => `${s} ${porStatus[s]}`)
    .join(" · ") || "nenhum";

  console.log("═".repeat(70));
  console.log(`👁  SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: ${travados.length}  (${quebra})`);
  console.log("═".repeat(70));
  if (!travados.length) {
    console.log("  (nenhum — nenhum card em espera tem pedido de percepcao como ULTIMO passo)");
  }
  for (const { i, marca, ultima } of travados) {
    console.log(`  #${i.numero} · status=${i.status} · ${dias(i.created_at).toFixed(1)}d de vida · nota parada ha ${dias(ultima.at).toFixed(1)}d · [${marca}]`);
    console.log(`     ${(i.affected_emails ?? []).join(", ") || "(sem aluno nomeado)"} · ${String(i.title ?? i.signature).slice(0, 80)}`);
    console.log(`     ultima nota por "${ultima.by}": ${String(ultima.note).replace(/\s+/g, " ").slice(0, 140)}`);
    if (i.status === "aguardando_aluno") {
      console.log(`     ⚠ ROTULO MENTE: esta 'aguardando_aluno', mas o ultimo passo pedido e VER/OUVIR — a bola e da CASA. Despache (olho/qa), nao espere o aluno.`);
    }
  }

  const velho = travados.length ? dias(travados[0].ultima.at).toFixed(1) : "0";
  console.log(`\n>>> NUMERO PRO RELATORIO: ${travados.length} card(s) travado(s) em percepcao · mais velho parado ha ${velho}d`);
  console.log("    Regra de 17/09: isto NAO e estado de parada, e despacho — `olho` (imagem/video/audio) ou `qa` (tela).");
  console.log("    Se o artefato nao existe/nao abre, escreva o motivo concreto e a data. O que nao vale e seguir em frente.");
})();
