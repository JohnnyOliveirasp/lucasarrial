/**
 * #15 (d3d8d1b2) — WORKER DEGRADADO x REGUA CURTA: qual dos dois matou a geracao.
 *
 *   node _frank/ferramentas/2026-09-22_worker_degradado_15.cjs
 *
 * SO LEITURA. Nao escreve, nao fecha, nao manda e-mail, nao gasta GPU.
 *
 * POR QUE EXISTE
 * --------------
 * O cartao #15 ja nomeou causa ERRADA tres vezes. As tres vezes o erro nasceu
 * do INSTRUMENTO, nao da leitura:
 *
 *   20/08  "e hang no chunk"      — lido do nome da fase, sem o running_s.
 *   21/09  "nao e hang, avancava" — lido do running_s=1,9 SEM saber que o
 *                                   heartbeat CONGELA na pane (o valor final e
 *                                   o ultimo escrito antes do congelamento, nao
 *                                   a prova de que estava andando).
 *   22/09  "a taxa subiu 25x"     — s/chunk global, que favorece texto CURTO.
 *
 * Este script existe pra que a quarta leitura nao seja mais uma dessas. Ele
 * carrega as DUAS armadilhas medidas como CONTROLE explicito, e imprime o
 * controle junto do resultado — numero sem o seu controle ao lado ja enganou
 * este cartao tres vezes.
 *
 * ARMADILHA 1 — `elapsed_seconds` MUDA DE SIGNIFICADO
 *   sucesso: NAO inclui o setup.   falha: INCLUI o setup.
 *   Logo `(elapsed - setup)/chunks` da NEGATIVO no sucesso. Medido em 22/09:
 *   159 de 829 jobs ficariam com s/chunk negativo nessa formula. Esses numeros
 *   estao na constante CENSO abaixo e sao COBRADOS como controle positivo: o
 *   script confere item por item e ABORTA se faltar qualquer um — nao so no
 *   zero. Achar 1 de 5 e pior que achar 0: a saida continua plausivel, so que
 *   medida numa base mutilada. Ao abortar ele diz QUAIS sumiram, com id.
 *
 * ARMADILHA 2 — s/chunk GLOBAL e enviesado por tamanho
 *   O overhead fixo por job nao se amortiza em texto curto. Medido em 22/09:
 *   p50 de 30,1 s/chunk em job de 1 chunk contra 14,9 em job de 11+. Comparar
 *   job curto com job longo na mesma regua produz "lentidao" que e so tamanho.
 *   Por isso o limiar aqui e o p99 DA PROPRIA FAIXA de chunks.
 *
 * ARMADILHA 3 — `qa.setup_s` so e persistido no SUCESSO
 *   Em job morto por SIGKILL o setup nao existe. Nao de palpite sobre ele: o
 *   veredito abaixo usa a comparacao com a FAIXA, que nao depende do setup.
 */
const { supa } = require("./_comum.cjs");

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const faixaDe = (c) => (c <= 1 ? "1" : c <= 3 ? "2-3" : c <= 6 ? "4-6" : c <= 10 ? "7-10" : "11+");
const chunksDe = (texto) => Math.max(1, Math.ceil((texto || "").length / 160));
const eMorteTimeout = (g) => g.status === "failed" && String(g.error_message || "").includes("executionTimeout");

const DESDE = process.env.DESDE || "2026-09-08T00:00:00Z";

/* ---------------------------------------------------------------------------
 * CENSO DE 22/09 — a LISTA ESPERADA do controle positivo.
 *
 * O controle positivo NAO pergunta "achei alguma coisa?". Pergunta "achei TUDO
 * que ja foi contado nesta janela?". A diferenca importa porque o modo de falha
 * real deste script nunca foi dar zero: foi dar POUCO. Filtro que perde parte da
 * populacao continua imprimindo tabela bonita, so que menor — e todo numero que
 * sai dali (p99 por faixa, taxa de lentos, "Nx o maximo da faixa") fica
 * OTIMISTA, com vies sempre PRA BAIXO: menos sucessos na faixa => maximo da
 * faixa menor => menos lentos => menos motivo pra suspeitar do worker.
 *
 * >>> QUEM QUISER BAIXAR QUALQUER PISO DAQUI tem que reescrever o item nesta
 *     lista E escrever aqui mesmo o motivo, com data e quem assinou. O piso so
 *     desce POR ESCRITO. Baixar piso "so pra rodar hoje" e exatamente como o
 *     cartao #15 nomeou causa errada tres vezes.
 *
 * Historico de alteracoes do piso (append-only):
 *   2026-09-22 — censo inicial, medido na janela 2026-09-08 (Frank).
 * ------------------------------------------------------------------------- */
const CENSO = {
  janela: "2026-09-08T00:00:00Z",
  medidoEm: "2026-09-22",
  itens: [
    { id: "comSetup", esperado: 829,
      rotulo: "jobs ready com elapsed_seconds e qa.setup_s numerico (populacao do controle)" },
    { id: "negativos", esperado: 159,
      rotulo: "desses, os que dariam s/chunk NEGATIVO em (elapsed-setup)/chunks" },
    // piso estrutural, nao censo: este script existe pra julgar morte por
    // timeout. Zero mortes na janela = o filtro de error_message parou de casar,
    // nao = janela limpa (a janela cobre as mortes que abriram o cartao).
    { id: "mortesTimeout", esperado: 1,
      rotulo: "geracoes failed com executionTimeout no error_message (o veredito)" },
  ],
};

(async () => {
  const s = supa();
  let todas = [], from = 0;
  for (;;) {
    const { data, error } = await s.from("generations")
      .select("id,status,created_at,elapsed_seconds,request_attempts,text_raw,qa,error_message")
      .gte("created_at", DESDE).order("created_at", { ascending: true }).range(from, from + 999);
    exigir("generations pagina " + from, error);
    todas = todas.concat(data);
    if (data.length < 1000) break;
    from += 1000;                       // a consulta corta em 1000: paginar sempre
  }
  console.log(`#15 — worker degradado x regua curta · desde ${DESDE}`);
  console.log(`${todas.length} geracoes lidas\n`);

  // ---- CONTROLE da armadilha 1 -------------------------------------------
  // Gate: compara o REENCONTRADO com a LISTA ESPERADA (CENSO) e para se faltar
  // QUALQUER item. Rodar sem o censo casado nao e "rodar com menos dado", e
  // rodar com numero otimista sem aviso.
  if (DESDE !== CENSO.janela) {
    console.error(`\n❌ CONTROLE POSITIVO INAPLICAVEL: DESDE=${DESDE} != janela do censo (${CENSO.janela}).`);
    console.error(`   Os pisos de ${CENSO.itens.map(i => i.esperado).join("/")} foram CONTADOS na janela do censo (${CENSO.medidoEm}).`);
    console.error("   Em outra janela eles nao protegem de nada: a populacao muda por motivo");
    console.error("   legitimo e o controle deixa de distinguir 'janela menor' de 'filtro quebrado'.");
    console.error("   Recenseie a janela nova e reescreva CENSO (valor + motivo + data) antes.");
    process.exit(2);
  }

  let negativos = 0, comSetup = 0;
  const descartados = [];               // ready que NAO entrou no controle, com motivo
  for (const g of todas) {
    if (g.status !== "ready") continue;
    if (!g.elapsed_seconds) { descartados.push({ g, motivo: "elapsed_seconds vazio/zero" }); continue; }
    const st = g.qa && typeof g.qa.setup_s === "number" ? g.qa.setup_s : null;
    if (st === null) { descartados.push({ g, motivo: "qa.setup_s ausente ou nao-numerico" }); continue; }
    comSetup++;
    if (g.elapsed_seconds - st < 0) negativos++;
  }

  const reencontrado = { comSetup, negativos, mortesTimeout: todas.filter(eMorteTimeout).length };
  console.log(`── CONTROLE 1 (elapsed muda de significado) — lista esperada do censo de ${CENSO.medidoEm}`);
  console.log(`   ${negativos} de ${comSetup} jobs com setup dariam s/chunk NEGATIVO em (elapsed-setup)/chunks`);
  const sumiram = [];
  for (const it of CENSO.itens) {
    const n = reencontrado[it.id];
    const ok = n >= it.esperado;
    console.log(`   ${ok ? "✔" : "✗"} ${it.id.padEnd(14)} esperado >= ${String(it.esperado).padStart(4)}   reencontrado ${String(n).padStart(4)}${ok ? "" : `   FALTAM ${it.esperado - n}`}`);
    if (!ok) sumiram.push({ ...it, reencontrado: n, faltam: it.esperado - n });
  }

  if (sumiram.length) {
    console.error("\n❌ CONTROLE POSITIVO FALHOU — a varredura PARA AQUI.");
    console.error(`   Sumiram ${sumiram.length} item(ns) da lista esperada:`);
    for (const it of sumiram) {
      console.error(`     - ${it.id}  (${it.rotulo})`);
      console.error(`       esperado >= ${it.esperado} · reencontrado ${it.reencontrado} · faltam ${it.faltam}`);
    }
    if (negativos === 0) {
      console.error("   ZERO negativos em especial: ou o filtro quebrou, ou a premissa mudou");
      console.error("   (elapsed talvez passe a INCLUIR o setup tambem no sucesso). Confira qual");
      console.error("   dos dois antes de tocar no piso — sao consertos opostos.");
    }
    console.error("\n   POR QUE ISSO MATA A VARREDURA:");
    console.error("   o censo diz que esses itens ESTAO na janela. Se o filtro nao reencontra um");
    console.error("   item conhecido, ele esta perdendo populacao silenciosamente — e ai TODO");
    console.error("   numero abaixo sairia OTIMISTA, com vies sempre PRA BAIXO: menos sucessos na");
    console.error("   faixa => p99 e MAXIMO da faixa menores => menos jobs marcados 'lento' =>");
    console.error("   razao 'Nx o maximo da faixa' encolhida => o worker degradado passa por sao.");
    console.error("   Imprimir isso seria repetir, com numero novo, o erro de 21/09.");
    if (descartados.length) {
      const AMOSTRA = 40;
      console.error(`\n   ready DESCARTADOS do controle (${descartados.length}; mostrando ate ${AMOSTRA}) — comece o diagnostico por estes:`);
      for (const d of descartados.slice(0, AMOSTRA)) {
        console.error(`     ${d.g.created_at.slice(0, 16)}  ${d.g.id}  ${d.motivo}`);
      }
      if (descartados.length > AMOSTRA) console.error(`     ... e mais ${descartados.length - AMOSTRA}.`);
    } else {
      console.error("\n   nenhum ready foi descartado por campo faltando: a perda esta ANTES do");
      console.error("   controle (janela, paginacao ou o proprio SELECT), nao nos campos.");
    }
    console.error("\n   Baixar piso so por escrito: edite CENSO no topo deste arquivo com o valor");
    console.error("   novo, o motivo, a data e quem assinou. Sem isso, conserte o filtro.");
    process.exit(2);
  }
  console.log("   ✔ confirma: no SUCESSO elapsed NAO inclui setup. Formula usada: elapsed/chunks.\n");

  // ---- distribuicao por faixa (armadilha 2) ------------------------------
  const grupos = {};
  for (const g of todas) {
    if (g.status !== "ready" || !g.elapsed_seconds || !g.text_raw) continue;
    const ch = chunksDe(g.text_raw);
    (grupos[faixaDe(ch)] ||= []).push({
      pc: g.elapsed_seconds / ch, el: g.elapsed_seconds, ch,
      dia: g.created_at.slice(0, 10), id: g.id, at: g.request_attempts || 1,
    });
  }
  const ORDEM = ["1", "2-3", "4-6", "7-10", "11+"];
  const limiar = {}, elMax = {}, elP95 = {}, elP50 = {};
  console.log("── CONTROLE 2 (s/chunk cai com o tamanho — por isso o limiar e POR FAIXA)");
  console.log("   faixa     n     p50    p95    p99    max   | elapsed p50   p95   max");
  for (const f of ORDEM) {
    const a = grupos[f] || []; if (!a.length) continue;
    const v = a.map(x => x.pc), e = a.map(x => x.el);
    limiar[f] = pct(v, 0.99); elMax[f] = Math.max(...e); elP95[f] = pct(e, 0.95); elP50[f] = pct(e, 0.5);
    console.log(`   ${f.padEnd(6)} ${String(a.length).padStart(4)}  ${pct(v,.5).toFixed(1).padStart(6)} ${pct(v,.95).toFixed(1).padStart(6)} ${pct(v,.99).toFixed(1).padStart(6)} ${Math.max(...v).toFixed(1).padStart(6)}   | ${elP50[f].toFixed(0).padStart(9)}s ${elP95[f].toFixed(0).padStart(5)}s ${elMax[f].toFixed(0).padStart(5)}s`);
  }

  // ---- taxa de lentos por dia, dentro da propria faixa -------------------
  const porDia = {};
  for (const f of Object.keys(grupos)) for (const x of grupos[f]) {
    porDia[x.dia] ||= { n: 0, lento: 0 };
    porDia[x.dia].n++;
    if (x.pc > limiar[f]) porDia[x.dia].lento++;
  }
  const dias = Object.keys(porDia).sort();
  const ultimo = dias[dias.length - 1];
  const base = dias.slice(0, -1).reduce((a, d) => ({ n: a.n + porDia[d].n, lento: a.lento + porDia[d].lento }), { n: 0, lento: 0 });
  const hoje = porDia[ultimo];
  console.log("\n── TAXA DE LENTOS (acima do p99 da PROPRIA faixa)");
  for (const d of dias) {
    const x = porDia[d];
    console.log(`   ${d}  ${String(x.n).padStart(3)} jobs  ${String(x.lento).padStart(2)} lento  ${(100*x.lento/x.n).toFixed(1).padStart(5)}%`);
  }
  const pBase = base.n ? base.lento / base.n : 0;
  const pHoje = hoje.n ? hoje.lento / hoje.n : 0;
  console.log(`\n   base  : ${base.lento}/${base.n} = ${(100*pBase).toFixed(2)}%`);
  console.log(`   ultimo: ${hoje.lento}/${hoje.n} = ${(100*pHoje).toFixed(2)}%  (${ultimo})`);
  // honestidade estatistica: n pequeno nao vira manchete
  const pAoMenos1 = 1 - Math.pow(1 - pBase, hoje.n);
  console.log(`   P(ver >=1 lento hoje se a taxa fosse a da base) = ${(100*pAoMenos1).toFixed(0)}%`);
  console.log(hoje.lento <= 1 && pAoMenos1 > 0.05
    ? "   ⚖️  NAO declare surto: com este n, 1 lento e esperado. (Foi assim que nasceu o '25x' errado.)"
    : "   ⚠️  acima do esperado — vale olhar, mas confira o n antes de escrever 'surto'.");

  // ---- o veredito: mortes por timeout contra a faixa ---------------------
  console.log("\n── MORTES POR TIMEOUT x a FAIXA delas (o controle que nao depende do setup)");
  // mesmo predicado do CONTROLE 1 (item mortesTimeout) de proposito: se os dois
  // divergirem, o controle passa a proteger uma populacao que nao e esta.
  const mortos = todas.filter(eMorteTimeout);
  if (!mortos.length) console.log("   nenhuma morte por executionTimeout na janela.");  // inalcancavel: o CONTROLE 1 ja abortou
  for (const g of mortos) {
    const ch = chunksDe(g.text_raw), f = faixaDe(ch);
    const fase = g.qa && g.qa.fase_corrente ? g.qa.fase_corrente : null;
    console.log(`   ${g.created_at.slice(0,16)}  ${g.id.slice(0,8)}  ${(g.text_raw||"").length}ch/${ch}chunk (faixa ${f})  elapsed=${g.elapsed_seconds}s  at=${g.request_attempts||1}`);
    if (elMax[f] !== undefined) {
      const razao = g.elapsed_seconds / elMax[f];
      console.log(`       faixa ${f}: n=${(grupos[f]||[]).length} sucessos, elapsed p50=${elP50[f].toFixed(0)}s p95=${elP95[f].toFixed(0)}s MAX=${elMax[f].toFixed(0)}s`);
      console.log(`       morreu com ${razao.toFixed(1)}x o MAXIMO observado na faixa`);
      console.log(razao > 1.5
        ? "       => WORKER DEGRADADO. Fora da distribuicao inteira: regua maior nao consertaria, so adiaria."
        : "       => dentro da distribuicao: aqui a REGUA e suspeita legitima, nao o worker.");
    }
    if (fase) {
      console.log(`       fase final: ${fase.fase} chunk=${fase.meta && fase.meta.chunk} running_s=${fase.running_s} visto_em=${fase.visto_em}`);
      console.log("       ⚠️  running_s BAIXO nao prova avanço: na pane o heartbeat CONGELA e o");
      console.log("           valor final e o ultimo escrito antes de congelar. (Erro de 21/09.)");
    }
  }

  // ---- panes curadas por retry: invisiveis em status ---------------------
  const curados = todas.filter(g => g.status === "ready" && (g.request_attempts || 1) > 1);
  console.log(`\n── PANE INVISIVEL (ready com request_attempts>1: a 1a tentativa morreu e o retry salvou)`);
  console.log(`   ${curados.length} geracao(oes) na janela — nao geram incidente, nao geram estorno,`);
  console.log(`   e NAO aparecem em nenhuma contagem de falha por status.`);
  for (const g of curados) console.log(`     ${g.created_at.slice(0,16)} ${g.id.slice(0,8)} ${(g.text_raw||"").length}ch elapsed=${g.elapsed_seconds}s`);
  console.log(`\n   >>> QUALQUER medicao de "N dias sem reincidencia" feita por status SUBCONTA`);
  console.log(`       esta classe. Foi uma dessas que embasou o fechamento de 21/09, e o`);
  console.log(`       cartao reincidiu 25h depois. Conte SEMPRE os curados por retry junto.`);
})();
