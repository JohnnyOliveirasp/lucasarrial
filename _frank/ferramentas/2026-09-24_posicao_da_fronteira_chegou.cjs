/**
 * A TELEMETRIA DE POSICAO DO PR #408 CHEGOU EM PRODUCAO? (#234, f8587cef)
 * ----------------------------------------------------------------------
 *   node _frank/ferramentas/2026-09-24_posicao_da_fronteira_chegou.cjs [--corte=ISO]
 *
 * POR QUE EXISTE
 * --------------
 * O PR #408 mergeou em 23/09 13:44Z (merge 7dc53d7a) e a nota daquela ronda
 * declarou que o passo (b) do cartao — apontar o ouvido no segundo exato da
 * fronteira reprovada — ficaria destravado assim que "toda geracao nova"
 * passasse a gravar `tail_interno_entregue_pos_s`.
 *
 * MERGE NAO E' PRODUCAO. O worker do TTS roda de uma IMAGEM: entre o merge e o
 * dado novo existem um build ("Build RunPod Worker") e a troca da imagem no
 * endpoint. Nenhuma ronda conferiu se o campo de fato nasceu. Se ele nao
 * nasceu, o passo (b) segue bloqueado por um motivo que ninguem nomeou — e a
 * proxima ronda ia procurar ouvido achando que o dado estava la.
 *
 * COMO A PRESENCA E' MEDIDA (e por que nao pelo numerador)
 * -------------------------------------------------------
 * `tail_interno_entregue_pos_s` so ganha ITEM quando ha fronteira reprovada
 * entregue. Contar itens confundiria "codigo velho" com "codigo novo e nada
 * reprovou". Por isso a sonda e a PRESENCA DA CHAVE:
 *
 *   loop.py:256-260 — com `dur_s` != None, `tail_interno_entregue_t_s` soma e
 *   `tail_interno_entregue_pos_s` nasce por `setdefault`, AINDA QUE VAZIA.
 *
 * Logo: chave presente  = codigo do #408 rodou naquela geracao.
 *       chave ausente   = imagem velha (ou `dur_s=None`, que nenhum call site
 *                         da main usa mais — inference.py passa a duracao nos 3).
 *
 * CONTROLE POSITIVO OBRIGATORIO (regua de 23/09: zero que concorda com voce
 * nao vale nada sem controle): na MESMA janela e nas MESMAS linhas imprime
 * `tail_interno_entregue_n`, que e' o campo do PR #153 (02/09). Se ele tambem
 * for zero, a sombra nao rodou e o veredito e' INCONCLUSIVO — nao "nao chegou".
 *
 * O CORTE SAI DO DADO, NAO DO RELOGIO DO BUILD — e isto e' correcao de um erro
 * meu desta mesma ronda. A 1a versao fixou o corte em 14:20Z (fim declarado do
 * Action) e o controle negativo REPROVOU: 1 geracao de 14:12:09Z ja carregava o
 * campo. Nao era a sonda errada, era o corte chutado — o endpoint trocou a
 * imagem ANTES de o Action terminar de contar o proprio tempo. Entao a
 * ferramenta agora DESCOBRE o instante da virada (ultima sem campo -> primeira
 * com campo) e usa o dado como corte.
 *
 * CONTROLE NEGATIVO, na forma que de fato prova alguma coisa: MONOTONIA. Se o
 * campo e' efeito de troca de imagem, depois da virada NAO pode haver geracao
 * sem ele. Uma so' geracao velha depois da virada = imagem antiga ainda
 * servindo (rollout parcial), e ai o dado novo e' amostra enviesada.
 *
 * SO LEITURA. Nao escreve, nao fecha cartao, nao gasta GPU nem credito.
 * Todo `error` mata o processo. Pagina de 1000 em 1000 (o Supabase corta ai).
 */
const { supa } = require("./_comum.cjs");

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};

// Merge 7dc53d7a em 23/09 13:44:45Z; o Action "Build RunPod Worker" contou
// 31m26s. NAO uso esse relogio como corte (ver cabecalho): o corte e' DESCOBERTO
// no dado. --corte so' existe pra forcar a mao em investigacao.
const CORTE_FORCADO = arg("corte", "");
const DESDE = arg("desde", "2026-09-21T00:00:00Z");

const tem = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

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
  if (!linhas.length) throw new Error("ZERO geracoes lidas — consulta vazia nao e medicao");

  const bloco = (rows, nome) => {
    const comQa = rows.filter((g) => g.qa && typeof g.qa === "object");
    // controle positivo: a sombra interna (PR #153, 02/09) rodou?
    const sombra = comQa.filter((g) => tem(g.qa, "tail_interno_entregue_n"));
    // alvo: o codigo do #408 rodou?
    const comT = comQa.filter((g) => tem(g.qa, "tail_interno_entregue_t_s"));
    const comPos = comQa.filter((g) => tem(g.qa, "tail_interno_entregue_pos_s"));
    const comCross = comQa.filter((g) => tem(g.qa, "tail_interno_pos_crossfade_ms"));
    const posComItem = comPos.filter((g) => (g.qa.tail_interno_entregue_pos_s || []).length > 0);
    const itens = comPos.reduce((s, g) => s + (g.qa.tail_interno_entregue_pos_s || []).length, 0);
    const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
    console.log(`\n── ${nome} ──`);
    console.log(`  geracoes ready            ${rows.length} · com bloco qa ${comQa.length}`);
    console.log(`  [controle +] tail_interno_entregue_n presente   ${sombra.length} (${pct(sombra.length, comQa.length)})`);
    console.log(`  [ALVO] tail_interno_entregue_t_s presente       ${comT.length} (${pct(comT.length, comQa.length)})`);
    console.log(`  [ALVO] tail_interno_entregue_pos_s presente     ${comPos.length} (${pct(comPos.length, comQa.length)})`);
    console.log(`  [ALVO] tail_interno_pos_crossfade_ms presente   ${comCross.length} (${pct(comCross.length, comQa.length)})`);
    console.log(`         ...com pelo menos 1 offset gravado       ${posComItem.length} · ${itens} offset(s) no total`);
    return { comQa: comQa.length, sombra: sombra.length, comPos: comPos.length, itens, posComItem: posComItem.length, rows: comPos };
  };

  const comQaTodas = linhas.filter((g) => g.qa && typeof g.qa === "object");
  const comCampo = comQaTodas.filter((g) => tem(g.qa, "tail_interno_entregue_t_s"));
  const semCampo = comQaTodas.filter((g) => !tem(g.qa, "tail_interno_entregue_t_s"));

  if (!comCampo.length) {
    console.log(`janela: ${DESDE} .. agora · lidas ${linhas.length} geracoes ready`);
    console.log(`com bloco qa: ${comQaTodas.length} · com o campo do #408: 0`);
    const sombra = comQaTodas.filter((g) => tem(g.qa, "tail_interno_entregue_n")).length;
    console.log(`[controle +] tail_interno_entregue_n presente: ${sombra}`);
    console.log("\n══════════════════════════════════════════════════════════════");
    if (!sombra) {
      console.log(">>> INCONCLUSIVO: a sombra de 02/09 tambem nao aparece. Zero nos");
      console.log("    dois nao separa 'imagem velha' de 'a sombra nao rodou'.");
    } else {
      console.log(">>> NAO CHEGOU. A sombra de 02/09 roda em producao, mas NENHUMA");
      console.log("    geracao carrega o campo do #408: imagem velha no endpoint.");
      console.log("    O passo (b) do f8587cef segue BLOQUEADO, e nao por falta de ouvido.");
    }
    console.log("══════════════════════════════════════════════════════════════");
    return;
  }

  const virada = CORTE_FORCADO || comCampo[0].created_at;
  const ultimaSem = semCampo.filter((g) => g.created_at < virada).slice(-1)[0];

  const antes = linhas.filter((g) => g.created_at < virada);
  const depois = linhas.filter((g) => g.created_at >= virada);

  console.log(`janela: ${DESDE} .. agora · lidas ${linhas.length} geracoes ready`);
  console.log(`VIRADA MEDIDA NO DADO: ${virada}` + (CORTE_FORCADO ? "  (FORCADA por --corte)" : ""));
  if (ultimaSem) console.log(`  ultima SEM o campo: ${String(ultimaSem.id).slice(0, 8)} em ${ultimaSem.created_at}`);
  console.log(`  primeira COM o campo: ${String(comCampo[0].id).slice(0, 8)} em ${comCampo[0].created_at}`);
  console.log("  (merge 7dc53d7a 23/09 13:44:45Z; Action contou 31m26s — o relogio do");
  console.log("   Action NAO e' o corte, o dado e')");

  const A = bloco(antes, `ANTES da virada (controle negativo — o campo TEM que ser 0%)`);
  const D = bloco(depois, `DEPOIS da virada (onde o #408 deveria estar)`);

  // ── MONOTONIA: depois da virada nao pode haver geracao sem o campo ──────
  const desertores = depois.filter((g) => g.qa && typeof g.qa === "object" && !tem(g.qa, "tail_interno_entregue_t_s"));
  console.log(`\n── MONOTONIA (o controle que de fato prova troca de imagem) ──`);
  console.log(`  geracoes com bloco qa depois da virada: ${D.comQa}`);
  console.log(`  ...SEM o campo do #408 (imagem velha ainda servindo): ${desertores.length}`);
  for (const g of desertores.slice(0, 10)) console.log(`     ${String(g.id).slice(0, 8)} · ${g.created_at}`);

  if (D.posComItem > 0) {
    console.log(`\n── AMOSTRA PRO PASSO (b): geracoes NOVAS com posicao gravada ──`);
    const uteis = D.rows.filter((g) => (g.qa.tail_interno_entregue_pos_s || []).length > 0);
    for (const g of uteis) {
      const q = g.qa;
      console.log(`  ${String(g.id).slice(0, 8)} · ${g.created_at} · t_s ${q.tail_interno_entregue_t_s}s · ` +
        `reprovadas ${q.tail_interno_entregue}/${q.tail_interno_entregue_n} · ` +
        `pos ${JSON.stringify((q.tail_interno_entregue_pos_s || []).slice(0, 8))} · ` +
        `crossfade ${q.tail_interno_pos_crossfade_ms ?? "?"}ms`);
    }
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  if (A.comPos > 0) {
    console.log(">>> SONDA REPROVADA: existe geracao com o campo ANTES da propria");
    console.log("    virada que a ferramenta calculou. Isso e' bug da sonda.");
  } else if (D.sombra === 0) {
    console.log(">>> INCONCLUSIVO: a sombra de 02/09 nao aparece depois da virada.");
  } else if (desertores.length > 0) {
    console.log(`>>> CHEGOU PARCIALMENTE: ${desertores.length} geracao(oes) depois da virada`);
    console.log("    ainda sem o campo. Imagem velha e nova convivem no endpoint —");
    console.log("    o dado novo e' amostra enviesada, nao a populacao.");
  } else {
    console.log(">>> CHEGOU, E A VIRADA E' LIMPA. Toda geracao com bloco qa depois");
    console.log(`    de ${virada} grava a posicao — ${D.comQa} de ${D.comQa}, sem desertor.`);
    console.log(`    ${D.itens} offset(s) em ${D.posComItem} geracao(oes) ja disponiveis pro`);
    console.log("    passo (b) do f8587cef. O que falta e' OUVIDO, nao dado.");
  }
  console.log("══════════════════════════════════════════════════════════════");
  console.log("Nada foi alterado: esta ferramenta so le.");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
