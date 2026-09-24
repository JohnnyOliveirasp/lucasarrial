#!/usr/bin/env node
/**
 * nota_em_lote.cjs — MEDICAO: quais notas de incidente foram escritas EM LOTE
 * (a mesma nota carimbada em varios cartoes de uma vez) e quanto elas cegam a
 * fila de decisao do Johnny.
 *
 * POR QUE NASCEU (ronda 24/09 ~21h45Z).
 * O `2026-09-22_esperando_johnny.cjs` le SO a ultima nota do cartao (criterio 1,
 * deliberado: varrer a pilha inteira mede HISTORICO e ja devolveu 41 falsos onde
 * havia 1). O preco disso o proprio cabecalho dele registrou em 22/09 como
 * "LIMITE GRAVE — QUEM ANOTA, ESCONDE", e a cura proposta era disciplina:
 * "quem anotar cartao parado no Johnny, repita na nota o que falta".
 *
 * Em 24/09 17:48Z essa disciplina foi quebrada em 24 cartoes de uma vez por um
 * retrofit automatico (#554). Quatro cartoes parados no Johnny sumiram da
 * varredura — TRES deles dinheiro de aluno — e o script passou a ABORTAR no
 * controle positivo. A licao que o #554 escreveu, e que este instrumento
 * persegue: **disciplina humana nao sobrevive a escrita automatica em lote.**
 *
 * ENTAO A PERGUNTA AQUI NAO E "como remendo aquele retrofit". E:
 *   da pra RECONHECER escrita em lote pelo DADO, sem lista de padroes
 *   escrita a mao que a proxima ronda vai esquecer de atualizar?
 *
 * HIPOTESE MEDIDA: sim. Nota escrita em lote tem uma assinatura que nota
 * individual nao tem — o MESMO texto aparece em N cartoes distintos. Nota que
 * fala do caso fala de UM caso: nome de aluno, valor, id de geracao.
 *
 * SO LEITURA. Nao escreve, nao fecha, nao muda status, nao manda e-mail.
 */
const { supa } = require("./_comum.cjs");

// Quantos cartoes distintos o mesmo texto precisa tocar pra ser "lote".
// 3 e deliberadamente baixo: quero VER os limitrofes nesta medicao, nao
// escondê-los. Quem for usar isso num portao decide o piso com o numero na mao.
const PISO_LOTE = Number(process.env.PISO_LOTE || 3);

// Prefixo normalizado usado como impressao digital da nota. 200 chars pega o
// cabecalho da nota (que e onde o lote se repete literalmente) sem exigir que a
// nota inteira seja identica — o retrofit, por exemplo, varia no miolo.
const PREFIXO = 200;

const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PREFIXO);

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

(async () => {
  const db = supa();
  const { data: vivos, error } = await db
    .from("incidents")
    .select("id,numero,status,agent_notes")
    .in("status", ["open", "investigating", "aguardando_aluno"]);
  exigir("incidents vivos", error);

  // impressao digital -> { cartoes:Set, exemplo, quando:Set }
  const digital = new Map();
  for (const r of vivos) {
    const notas = Array.isArray(r.agent_notes) ? r.agent_notes : [];
    for (const n of notas) {
      const k = norm(n && n.note);
      if (!k || k.length < 40) continue; // nota curta demais pra ter assinatura
      if (!digital.has(k)) digital.set(k, { cartoes: new Set(), exemplo: (n.note || "").slice(0, 160), quando: new Set() });
      const d = digital.get(k);
      d.cartoes.add(r.id);
      if (n.at) d.quando.add(String(n.at).slice(0, 16));
    }
  }

  const lotes = [...digital.entries()]
    .map(([k, d]) => ({ k, n: d.cartoes.size, exemplo: d.exemplo, quando: [...d.quando].sort() }))
    .filter((x) => x.n >= PISO_LOTE)
    .sort((a, b) => b.n - a.n);

  console.log(`universo: ${vivos.length} cartoes vivos · ${digital.size} textos de nota distintos`);
  console.log(`piso de lote: mesma nota em >= ${PISO_LOTE} cartoes distintos (prefixo de ${PREFIXO} chars)\n`);

  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`📋 NOTAS ESCRITAS EM LOTE: ${lotes.length} texto(s)`);
  console.log("══════════════════════════════════════════════════════════════════════");
  for (const l of lotes) {
    const janela = l.quando.length === 1 ? l.quando[0] : `${l.quando[0]} .. ${l.quando[l.quando.length - 1]}`;
    console.log(`\n  ${String(l.n).padStart(3)} cartoes · ${janela}`);
    console.log(`      "${l.exemplo.replace(/\s+/g, " ")}..."`);
  }
  if (!lotes.length) console.log("  (nenhuma)");

  // O que interessa pro esperando_johnny.cjs: em quantos cartoes vivos a
  // ULTIMA nota e uma nota de lote? Esses sao exatamente os cegados.
  const chavesLote = new Set(lotes.map((l) => l.k));
  const cegados = [];
  for (const r of vivos) {
    const notas = Array.isArray(r.agent_notes) ? r.agent_notes : [];
    if (!notas.length) continue;
    const ultima = notas[notas.length - 1];
    if (chavesLote.has(norm(ultima && ultima.note))) {
      // anda pra tras: qual seria a ultima nota INDIVIDUAL?
      let i = notas.length - 1;
      while (i >= 0 && chavesLote.has(norm(notas[i] && notas[i].note))) i--;
      cegados.push({
        numero: r.numero,
        id: String(r.id).slice(0, 8),
        status: r.status,
        enterradas: notas.length - 1 - i,
        sobra: i >= 0 ? (notas[i].note || "").slice(0, 90).replace(/\s+/g, " ") : "(nenhuma nota individual)",
      });
    }
  }

  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(`🙈 CARTOES VIVOS CUJA ULTIMA NOTA E DE LOTE: ${cegados.length}`);
  console.log("   (nestes, qualquer leitor de `ultima nota` le o carimbo do lote,");
  console.log("    nao o estado do caso — o cartao nao mudou, so ficou invisivel)");
  console.log("══════════════════════════════════════════════════════════════════════");
  for (const c of cegados.sort((a, b) => a.numero - b.numero)) {
    console.log(`  #${String(c.numero).padEnd(4)} ${c.id} ${c.status.padEnd(14)} -${c.enterradas} nota(s) de lote por cima`);
    console.log(`        volta a valer: "${c.sobra}..."`);
  }
  if (!cegados.length) console.log("  (nenhum)");
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
