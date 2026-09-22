/**
 * A 2a PROVA POR PALAVRA JÁ TEM DADO? (#234, f8587cef) — só leitura.
 *
 *   node _frank/ferramentas/2026-09-22_regua_da_palavra_tem_dado.cjs [--desde=...]
 *
 * POR QUE EXISTE
 * --------------
 * A nota de 21/09 do f8587cef fechou com três próximos passos nomeados, e o
 * (ii) era *"medir a 2a prova por palavra (tail_interno_word_flagged) como
 * candidata a régua de verdade"*. Antes de medir, é preciso saber se ela
 * EXISTE no dado — e a leitura do código diz que talvez não:
 *
 *   tts_qa/loop.py  ~L566:
 *     if cortado is False and (not interno or tail_qa_interno_palavra):
 *
 * ou seja, na fronteira INTERNA a prova por palavra só roda com
 * `TTS_TAIL_QA_INTERNO_PALAVRA` ligado, e o comentário do próprio arquivo diz
 * que ela "vem desligada". Se estiver desligada em produção,
 * `tail_interno_word_flagged` é 0 em toda a base e o passo (ii) NÃO é uma
 * medição — é um pedido de aval pra gastar GPU (N whispers com timestamp por
 * palavra por geração, em vez de 1).
 *
 * Isto muda o que vai escrito pro Johnny, então é medido, não suposto.
 *
 * CONTROLE DO ZERO (a armadilha catalogada: "zero de fonte que não existia")
 * -------------------------------------------------------------------------
 * Um zero em `tail_interno_word_flagged` só significa "a prova não rodou" se a
 * SOMBRA tiver rodado. Por isso a ferramenta imprime, na mesma janela e nas
 * mesmas linhas, `tail_interno_checked` — que é o irmão que prova que o
 * instrumento estava ligado. Zero nos dois = não mediu nada. Zero só no
 * primeiro, com o segundo grande = a prova por palavra está DESLIGADA, que é a
 * hipótese a testar.
 *
 * Compara também com `tail_word_flagged` (a MESMA prova na fronteira FINAL,
 * onde ela roda sempre): se a final tem número e a interna é zero, o
 * instrumento funciona e o que falta é só a chave.
 *
 * SÓ LEITURA. Não escreve linha, não fecha cartão, não gasta GPU, não gasta
 * crédito, não manda e-mail. Todo `error` mata o processo — zero de consulta
 * quebrada não é zero medido. Pagina de 1000 em 1000 (o Supabase corta aí).
 */
const { supa } = require("./_comum.cjs");

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};

const DESDE = arg("desde", "2026-09-02T17:08:00Z"); // nascimento do tail_interno_* (PR #153)

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

(async () => {
  const db = supa();

  const linhas = [];
  const PAG = 1000;
  for (let off = 0; ; off += PAG) {
    const { data, error } = await db
      .from("generations")
      .select("id, created_at, status, qa")
      .eq("status", "ready")
      .gte("created_at", DESDE)
      .order("created_at", { ascending: true })
      .range(off, off + PAG - 1);
    if (error) throw new Error(`consulta generations falhou: ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAG) break;
  }

  console.log(`janela: desde ${DESDE} · gerações ready lidas: ${linhas.length}`);
  if (linhas.length === 0) {
    throw new Error("ZERO gerações lidas — isto é consulta vazia, não medição");
  }

  // ── Controle: a sombra da fronteira interna rodou? ──────────────────────
  const comQa = linhas.filter((g) => g.qa && typeof g.qa === "object");
  const somaChecked = comQa.reduce((s, g) => s + n(g.qa.tail_interno_checked), 0);
  const comChecked = comQa.filter((g) => n(g.qa.tail_interno_checked) > 0).length;

  // ── O alvo: a 2a prova por PALAVRA na fronteira interna ─────────────────
  const somaWordInterna = comQa.reduce(
    (s, g) => s + n(g.qa.tail_interno_word_flagged), 0);
  const comWordInterna = comQa.filter(
    (g) => n(g.qa.tail_interno_word_flagged) > 0).length;
  const campoPresente = comQa.filter(
    (g) => Object.prototype.hasOwnProperty.call(g.qa, "tail_interno_word_flagged")).length;

  // ── O irmão que roda SEMPRE: a mesma prova na fronteira FINAL ───────────
  const somaWordFinal = comQa.reduce((s, g) => s + n(g.qa.tail_word_flagged), 0);
  const comWordFinal = comQa.filter((g) => n(g.qa.tail_word_flagged) > 0).length;
  const somaTailChecked = comQa.reduce((s, g) => s + n(g.qa.tail_checked), 0);

  // ── A entrega (o numerador do 609) ──────────────────────────────────────
  const somaEntregue = comQa.reduce((s, g) => s + n(g.qa.tail_interno_entregue), 0);
  const somaEntregueN = comQa.reduce((s, g) => s + n(g.qa.tail_interno_entregue_n), 0);

  console.log(`gerações com bloco qa: ${comQa.length}`);
  console.log("");
  console.log("── CONTROLE (a sombra interna rodou?) ─────────────────────────");
  console.log(`  tail_interno_checked      soma ${somaChecked} · em ${comChecked} geração(ões)`);
  console.log(`  tail_interno_entregue     ${somaEntregue} de ${somaEntregueN} fronteiras entregues com veredito` +
    (somaEntregueN ? ` = ${(100 * somaEntregue / somaEntregueN).toFixed(1)}%` : ""));
  console.log("");
  console.log("── ALVO: 2a prova por PALAVRA na fronteira INTERNA ────────────");
  console.log(`  campo presente no qa      ${campoPresente} geração(ões)`);
  console.log(`  tail_interno_word_flagged soma ${somaWordInterna} · em ${comWordInterna} geração(ões)`);
  console.log("");
  console.log("── IRMÃO DE CONTROLE: a MESMA prova na fronteira FINAL ────────");
  console.log(`  tail_checked              soma ${somaTailChecked}`);
  console.log(`  tail_word_flagged         soma ${somaWordFinal} · em ${comWordFinal} geração(ões)`);
  console.log("");

  console.log("══════════════════════════════════════════════════════════════");
  if (somaChecked === 0) {
    console.log(">>> VEREDITO: INCONCLUSIVO. A sombra da fronteira interna não");
    console.log("    rodou nesta janela, então o zero da palavra não prova nada.");
  } else if (somaWordInterna === 0 && somaWordFinal > 0) {
    console.log(">>> VEREDITO: a 2a prova por palavra está DESLIGADA na fronteira");
    console.log("    INTERNA e NÃO TEM DADO NENHUM pra medir.");
    console.log(`    A sombra interna rodou (${somaChecked} checagens) e o mesmo`);
    console.log(`    instrumento marcou ${somaWordFinal} vez(es) na fronteira FINAL,`);
    console.log("    onde ele roda sempre. Instrumento funciona; falta a chave.");
    console.log("    CONSEQUÊNCIA: o passo (ii) da nota de 21/09 NÃO é medição de");
    console.log("    dado existente — é pedido de aval pra gastar GPU (N whispers");
    console.log("    com timestamp por palavra por geração, em vez de 1).");
  } else if (somaWordInterna === 0 && somaWordFinal === 0) {
    console.log(">>> VEREDITO: zero nos DOIS. Não dá pra separar 'desligada' de");
    console.log("    'ligada e não viu nada' — o irmão de controle também é zero.");
  } else {
    console.log(`>>> VEREDITO: TEM DADO. ${somaWordInterna} marcação(ões) da prova por`);
    console.log("    palavra na fronteira interna. O passo (ii) é medível AGORA,");
    console.log("    sem aval e sem GPU: cruze com tail_interno_entregue.");
  }
  console.log("══════════════════════════════════════════════════════════════");
  console.log("Nada foi alterado: esta ferramenta só lê.");
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
