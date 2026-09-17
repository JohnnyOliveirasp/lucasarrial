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
 * USO: node _frank/ferramentas/percepcao_travada.cjs
 */
const { supa } = require("./_comum.cjs");

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

/** Sem acento e minusculo: a marca nao pode depender de como o agente digitou. */
const chato = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A marca que casa numa nota, JA descontado o boilerplate do sensor. */
function marcaDe(nota) {
  const t = chato(nota).split(BOILERPLATE).join(" ");
  return MARCAS.find((m) => t.includes(m)) ?? null;
}

const dias = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;

(async () => {
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
  console.log(`controle positivo OK (#310 reencontrado pela marca) · ${data.length} incidentes varridos\n`);

  const abertos = data.filter((i) => ["open", "investigating"].includes(i.status));
  const travados = [];
  for (const i of abertos) {
    if (!Array.isArray(i.agent_notes) || !i.agent_notes.length) continue;
    const ultima = i.agent_notes[i.agent_notes.length - 1];
    const marca = marcaDe(ultima?.note);
    if (!marca) continue;
    travados.push({ i, marca, ultima });
  }
  travados.sort((a, b) => new Date(a.ultima.at) - new Date(b.ultima.at));

  console.log("═".repeat(70));
  console.log(`👁  SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: ${travados.length}`);
  console.log("═".repeat(70));
  if (!travados.length) {
    console.log("  (nenhum — nenhum card aberto tem pedido de percepcao como ULTIMO passo)");
  }
  for (const { i, marca, ultima } of travados) {
    console.log(`  #${i.numero} · ${dias(i.created_at).toFixed(1)}d de vida · nota parada ha ${dias(ultima.at).toFixed(1)}d · [${marca}]`);
    console.log(`     ${(i.affected_emails ?? []).join(", ") || "(sem aluno nomeado)"} · ${String(i.title ?? i.signature).slice(0, 80)}`);
    console.log(`     ultima nota por "${ultima.by}": ${String(ultima.note).replace(/\s+/g, " ").slice(0, 140)}`);
  }

  const velho = travados.length ? dias(travados[0].ultima.at).toFixed(1) : "0";
  console.log(`\n>>> NUMERO PRO RELATORIO: ${travados.length} card(s) travado(s) em percepcao · mais velho parado ha ${velho}d`);
  console.log("    Regra de 17/09: isto NAO e estado de parada, e despacho — `olho` (imagem/video/audio) ou `qa` (tela).");
  console.log("    Se o artefato nao existe/nao abre, escreva o motivo concreto e a data. O que nao vale e seguir em frente.");
})();
