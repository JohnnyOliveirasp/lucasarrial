#!/usr/bin/env node
/**
 * 2026-09-23 17hZ — `coverage_idioma_prob` E UM MARCADOR DE REPROVACAO,
 * NAO UM PREDITOR INDEPENDENTE. (#37bacb68)
 *
 * ── DE ONDE ISTO NASCE ─────────────────────────────────────────────────────
 * A ronda das 13hZ deste mesmo cartao refutou "lista longa" como causa e
 * apontou um substituto que parecia muito melhor:
 *
 *   "O PREDITOR DE VERDADE JA ESTA NA NOSSA PROPRIA TELEMETRIA:
 *    coverage_idioma_prob. Dose-resposta MONOTONA: 43,1% -> 3,9%, sem
 *    inversao. LIMITE QUE DECLARO: o campo so existe em 281 das 1.791
 *    (15,7%). NAO SEI POR QUE SO NESSAS."
 *
 * Esta ferramenta responde esse "nao sei por que", que e a pergunta que decide
 * se da pra construir portao em cima do campo.
 *
 * ── A RESPOSTA ESTA NO CODIGO, E ELA MUDA A CONCLUSAO ──────────────────────
 * `tts_qa/loop.py:726-733` roda a 2a opiniao de idioma sob guarda:
 *
 *     if (coverage_qa_enabled
 *         and best_coverage is not None
 *         and best_coverage < coverage_qa_min      <<< SO NA REPROVACAO
 *         and best_seg is not None ...)
 *
 * e o proprio comentario do codigo diz: "Roda SO no caminho de reprovacao".
 * Ou seja: o campo NASCE de um chunk que ja falhou cobertura. Ele nao e um
 * termometro que mede todo mundo — e uma etiqueta que so e colada em quem ja
 * foi reprovado.
 *
 * Isso torna a dose-resposta de 13hZ um EFEITO DE SELECAO (colisor): ela foi
 * medida DENTRO do subconjunto ja reprovado. Um portao "bloqueie se
 * coverage_idioma_prob < 0,3" nunca veria uma geracao que nao reprovou
 * cobertura — e nas que reprovaram, ele seria redundante com a propria
 * reprovacao que o fez existir.
 *
 * ── HIPOTESE PRE-REGISTRADA (H-colisor, 23/09 17hZ, ANTES de rodar) ────────
 * Se a leitura do codigo estiver certa, entao na base:
 *   (P1) `coverage_idioma_checked > 0` praticamente nunca aparece sem marcador
 *        de reprovacao (`coverage_flagged > 0` ou `exhausted > 0`);
 *   (P2) a taxa de alucinacao do grupo "a sonda RODOU" e MUITO maior que a do
 *        grupo "a sonda NAO rodou" — porque rodar ja significa ter falhado;
 *   (P3) a maior parte das geracoes que alucinam de leve NAO tem o campo,
 *        entao a COBERTURA de um portao baseado nele e baixa.
 * Se (P1) falhar, a leitura do codigo esta errada e eu recuo publicamente.
 *
 * ── CONTROLE POSITIVO QUE ABORTA ──────────────────────────────────────────
 * Licao de 23/09 (3a da familia: base64 18/09, bloco-sem-voice_id, grep sem
 * controle): zero que CONCORDA com a hipotese nao vale nada sem controle.
 * Aqui o controle e reproduzir, com instrumento independente, os numeros que
 * a ronda das 13hZ publicou: ~1.791 na populacao e ~281 com o campo. Se eu
 * nao reencontrar isso, e a MINHA varredura que esta quebrada -> exit 2.
 *
 * USO: node _frank/ferramentas/2026-09-23_idioma_e_colisor.cjs
 *      SO LE. Nao grava, nao gasta GPU, nao toca em credito, nao fecha nada.
 */
const { supa } = require("./_comum.cjs");

/** Mesma definicao da ronda das 13hZ, de proposito: os numeros tem que ser comparaveis. */
function taxaAlucinacao(qa) {
  const chk = Number(qa?.coverage_checked ?? 0);
  if (!chk) return null;
  return Number(qa?.coverage_alucinado ?? 0) / chk;
}
const pct = x => x === null ? "  n/a" : (x * 100).toFixed(1).padStart(5) + "%";
const media = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : null;

/** Bloco de estatistica de um grupo. */
function bloco(nome, g) {
  const taxas = g.map(x => x.taxa);
  const alg = g.filter(x => x.taxa > 0).length;
  console.log(`  ${nome.padEnd(34)} n=${String(g.length).padStart(4)} · taxa media ${pct(media(taxas))} · ${String(alg).padStart(4)} (${pct(g.length ? alg / g.length : null)}) com ALGUMA`);
}

(async () => {
  const db = supa();

  // ── 1. VARREDURA PAGINADA (o SELECT corta em 1000) ───────────────────────
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("generations")
      .select("id,status,created_at,qa")
      .not("qa", "is", null)
      .order("created_at", { ascending: false })
      .range(de, de + 999);
    if (error) { console.error("❌ CONSULTA FALHOU:", error.message, "\n   Nao acredite em nenhum zero desta rodada."); process.exit(1); }
    linhas.push(...data);
    if (data.length < 1000) break;
  }

  const pop = [];
  for (const g of linhas) {
    const t = taxaAlucinacao(g.qa);
    if (t === null) continue;                    // QA nao mediu: fica FORA, nao vira zero
    const qa = g.qa || {};
    const prob = qa.coverage_idioma_prob;
    pop.push({
      id: g.id, status: g.status, created_at: g.created_at, taxa: t,
      prob: prob == null ? null : Number(prob),
      checked: Number(qa.coverage_idioma_checked ?? 0),
      temChave: Object.prototype.hasOwnProperty.call(qa, "coverage_idioma_checked"),
      covFlag: Number(qa.coverage_flagged ?? 0),
      exhausted: Number(qa.exhausted ?? 0),
      regens: Number(qa.regens ?? 0),
      scoreMax: Number(qa.exhausted_score_max ?? 0),
    });
  }

  const comProb = pop.filter(x => x.prob !== null);
  console.log("══ POPULACAO ══");
  console.log(`  ${linhas.length} geracoes com qa · ${pop.length} com coverage_checked>0 · ${comProb.length} com coverage_idioma_prob\n`);

  // ── 2. CONTROLE POSITIVO: reproduzir os numeros publicados as 13hZ ───────
  console.log("══ CONTROLE POSITIVO (reproduzir a medicao de 13hZ) ══");
  console.log(`  esperado ~1791 na populacao e ~281 com o campo · medido ${pop.length} e ${comProb.length}`);
  const okPop = Math.abs(pop.length - 1791) <= 60;      // a base cresce durante o dia
  const okCampo = Math.abs(comProb.length - 281) <= 40;
  if (!okPop || !okCampo) {
    console.error(`\n❌ NAO REPRODUZI A MEDICAO ANTERIOR (pop ok=${okPop}, campo ok=${okCampo}).`);
    console.error("   Ou a base mudou muito, ou a MINHA varredura esta quebrada.");
    console.error("   De qualquer forma nao publico conclusao em cima dela. exit 2");
    process.exit(2);
  }
  console.log("  ✔ reencontrei os dois numeros — a varredura mede o mesmo objeto.\n");

  // ── 3. (P1) A SONDA SO RODA NA REPROVACAO? ───────────────────────────────
  // `coverage_idioma_checked` e inicializado em 0 para TODA geracao
  // (inference.py:94), entao "nao rodou" e observavel, nao e ausencia.
  const semChave = pop.filter(x => !x.temChave).length;
  const rodou = pop.filter(x => x.checked > 0);
  const naoRodou = pop.filter(x => x.temChave && x.checked === 0);
  const reprovou = x => x.covFlag > 0 || x.exhausted > 0;

  console.log("══ (P1) A SONDA DE IDIOMA SO RODA NO CAMINHO DE REPROVACAO? ══");
  console.log(`  geracoes SEM a chave coverage_idioma_checked (worker antigo): ${semChave}`);
  console.log(`  a sonda RODOU    n=${String(rodou.length).padStart(4)} · destas, COM marcador de reprovacao: ${rodou.filter(reprovou).length} (${pct(rodou.length ? rodou.filter(reprovou).length / rodou.length : null)})`);
  console.log(`  a sonda NAO rodou n=${String(naoRodou.length).padStart(4)} · destas, COM marcador de reprovacao: ${naoRodou.filter(reprovou).length} (${pct(naoRodou.length ? naoRodou.filter(reprovou).length / naoRodou.length : null)})`);
  const semMarcador = rodou.filter(x => !reprovou(x));
  console.log(`  → rodou SEM nenhum marcador de reprovacao: ${semMarcador.length}`);
  if (semMarcador.length) {
    console.log("    (amostra, para quem quiser conferir a mao:)");
    for (const x of semMarcador.slice(0, 5)) {
      console.log(`      ${x.id} · covFlag=${x.covFlag} exhausted=${x.exhausted} regens=${x.regens} taxa=${pct(x.taxa)}`);
    }
  }

  // ── 4. (P2) O EFEITO DE SELECAO, MEDIDO ──────────────────────────────────
  console.log("\n══ (P2) TAXA DE ALUCINACAO: A SONDA RODOU x NAO RODOU ══");
  bloco("sonda RODOU (ja tinha reprovado)", rodou);
  bloco("sonda NAO rodou", naoRodou);
  console.log("  Leitura: se o 1o grupo aluciná muito mais, o campo nao 'prediz' — ele MARCA");
  console.log("  quem ja falhou. A dose-resposta de 13hZ vive inteira dentro do 1o grupo.");

  // ── 5. A DOSE-RESPOSTA DE 13hZ, COM O DENOMINADOR HONESTO ───────────────
  console.log("\n══ A DOSE-RESPOSTA DE 13hZ, AGORA COM O GRUPO QUE FALTAVA ══");
  for (const [a, b] of [[0, 0.3], [0.3, 0.6], [0.6, 0.9], [0.9, 1.01]]) {
    const g = comProb.filter(x => x.prob >= a && x.prob < b);
    if (!g.length) continue;
    bloco(`  idioma ${a}-${b}`, g);
  }
  bloco("SEM O CAMPO (o resto da base)", pop.filter(x => x.prob === null));

  // ── 6. (P3) QUANTO UM PORTAO POR IDIOMA CONSEGUIRIA VER? ────────────────
  const alucinaram = pop.filter(x => x.taxa > 0);
  const graves = pop.filter(x => x.taxa >= 0.5);
  const vistoPorIdioma = g => g.filter(x => x.prob !== null).length;
  console.log("\n══ (P3) COBERTURA DE UM PORTAO BASEADO NO CAMPO ══");
  console.log(`  geracoes que alucinaram (taxa>0): ${alucinaram.length} · com o campo: ${vistoPorIdioma(alucinaram)} (${pct(alucinaram.length ? vistoPorIdioma(alucinaram) / alucinaram.length : null)})`);
  console.log(`  alucinacao GRAVE (taxa>=50%):     ${graves.length} · com o campo: ${vistoPorIdioma(graves)} (${pct(graves.length ? vistoPorIdioma(graves) / graves.length : null)})`);
  console.log("  → o que estiver fora desse percentual e INVISIVEL pro portao por construcao.");

  // ── 7. O QUE ESTA DISPONIVEL EM 100% DAS LINHAS (o portao construivel) ──
  // Se o campo de idioma so existe em quem ja reprovou, entao o sinal util
  // tem que sair de algo medido em TODA geracao. `exhausted_score_max` e
  // `coverage_flagged` sao. A pergunta: eles discriminam?
  console.log("\n══ SINAIS PRESENTES EM 100% DAS LINHAS — DISCRIMINAM? ══");
  bloco("coverage_flagged > 0", pop.filter(x => x.covFlag > 0));
  bloco("coverage_flagged = 0", pop.filter(x => x.covFlag === 0));
  bloco("exhausted > 0", pop.filter(x => x.exhausted > 0));
  bloco("exhausted = 0", pop.filter(x => x.exhausted === 0));
  console.log("  (faixas de exhausted_score_max — a regua de severidade do proprio worker:)");
  for (const [a, b, rot] of [[1, 50, "so ritmo (benigno)"], [50, 100, "intrusao"], [100, 1e9, "cobertura/fim abrupto (GRAVE)"]]) {
    const g = pop.filter(x => x.scoreMax >= a && x.scoreMax < b);
    if (!g.length) continue;
    bloco(`  score ${a}-${b === 1e9 ? "+" : b} ${rot}`, g);
  }

  // ── 8. O QUE O PORTAO DEIXOU PASSAR (liga no #702cc916) ─────────────────
  const entregues = graves.filter(x => x.status === "ready");
  console.log(`\n══ ALUCINACAO GRAVE ENTREGUE ══`);
  console.log(`  taxa>=50%: ${graves.length} geracoes · ENTREGUES (status=ready): ${entregues.length}`);
  for (const x of entregues.slice(0, 12)) {
    console.log(`    ${x.id} · ${String(x.created_at).slice(0, 10)} · taxa ${pct(x.taxa)} · scoreMax=${x.scoreMax} covFlag=${x.covFlag}`);
  }
  console.log("\n>>> Veja o veredito escrito na nota do cartao. Este script so mede.");
})();
