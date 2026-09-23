#!/usr/bin/env node
/**
 * 2026-09-23 — A HIPOTESE DA NOTA 63 DO #37bacb68, MEDIDA CONTRA A BASE.
 *
 * O QUE A RONDA DAS 12hZ DEIXOU ESCRITO (e mandou medir antes de mexer no
 * worker): "os dois pontos onde o modelo alucinou sao LISTAS LONGAS DE
 * SUBSTANTIVOS SOLTOS separados por virgula, sem estrutura de frase. Nao medi
 * isso contra a base; quem for atras, mede a taxa de alucinacao por presenca
 * de lista longa."
 *
 * Isto e esse instrumento. Ele NAO conserta nada: responde uma pergunta de
 * fato — lista longa prediz alucinacao, ou a hipotese e bonita e falsa?
 *
 * ── POR QUE ELE TEM CONTROLE POSITIVO QUE ABORTA ────────────────────────────
 * Licao de 18/09 (`dump_enviada`): a primeira versao so desfazia
 * quoted-printable, as cartas saem em base64, e ela devolveu "0 cartas com
 * link" em 2819 varridas — um zero FALSO que por acaso CONCORDAVA com a
 * hipotese de quem media. E a licao de 23/09 12h30: "instrumento que confirma
 * o que voce ja sabe ser falso esta quebrado, mesmo quando o resto da tabela
 * parece plausivel".
 *
 * Por isso o detector e testado, ANTES de varrer, contra:
 *   POSITIVO  as 4 geracoes do caso vivo (voz d6f89414, texto com as listas
 *             "um, dois, tres, ..." e "tecnologia, estrategia, ..."). Se o
 *             detector NAO achar lista longa nelas, ele esta CEGO -> exit 2.
 *   NEGATIVO  prosa corrida com virgulas normais de frase. Se ele achar lista
 *             longa ai, esta GULOSO (casaria tudo, e um detector que casa tudo
 *             nao prediz nada) -> exit 2.
 *
 * ── O CONFUNDIDOR QUE EU DECLARO ───────────────────────────────────────────
 * Texto longo tem mais virgula E mais chance de alucinar. Se eu so comparasse
 * "com lista" x "sem lista", o comprimento poderia explicar tudo sozinho. Por
 * isso a saida imprime o comprimento mediano dos dois grupos E repete a
 * comparacao DENTRO da mesma faixa de comprimento. Sem isso o numero nao
 * sustenta conclusao nenhuma.
 *
 * USO: node _frank/ferramentas/2026-09-23_alucinacao_por_lista_longa.cjs
 *      (so LE. Nao grava, nao gasta GPU, nao toca em credito.)
 */
const { supa } = require("./_comum.cjs");

/** Itens de ate 3 palavras separados por virgula = "item de lista", nao oracao. */
const MAX_PALAVRAS_ITEM = 3;
/** Corrida minima de itens para valer "lista longa". */
const MIN_ITENS = 5;

/**
 * Maior corrida de itens curtos separados por virgula no texto.
 * Trabalha por SEGMENTO entre pontuacao forte (.!?;:\n) — uma virgula de
 * aposto no meio de um paragrafo nao pode somar com a de outro paragrafo.
 */
function maiorCorridaDeLista(texto) {
  let melhor = 0, trecho = "";
  for (const seg of String(texto || "").split(/[.!?;:\n]+/)) {
    const partes = seg.split(",");
    if (partes.length < 2) continue;
    let corrida = 0, ini = 0;
    for (let i = 0; i < partes.length; i++) {
      // "cem, mil e dez mil" — o ultimo item costuma vir com "e"; conta igual.
      const p = partes[i].replace(/\b(e|ou)\b/gi, " ").trim();
      const n = p ? p.split(/\s+/).length : 0;
      if (n >= 1 && n <= MAX_PALAVRAS_ITEM) {
        if (corrida === 0) ini = i;
        corrida++;
        if (corrida > melhor) { melhor = corrida; trecho = partes.slice(ini, i + 1).join(",").trim(); }
      } else corrida = 0;
    }
  }
  return { itens: melhor, trecho: trecho.slice(0, 120) };
}
const temListaLonga = t => maiorCorridaDeLista(t).itens >= MIN_ITENS;

/** Taxa de alucinacao da geracao, ou null quando o QA nao chegou a medir. */
function taxaAlucinacao(qa) {
  const chk = Number(qa?.coverage_checked ?? 0);
  if (!chk) return null;
  return Number(qa?.coverage_alucinado ?? 0) / chk;
}

const med = a => { if (!a.length) return null; const s=[...a].sort((x,y)=>x-y); const m=s.length>>1;
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const pct = x => x === null ? "  n/a" : (x * 100).toFixed(1).padStart(5) + "%";

(async () => {
  const db = supa();

  // ── 1. CONTROLES, ANTES DE VARRER ────────────────────────────────────────
  const TEXTO_POSITIVO = (await db.from("generations").select("text_raw")
    .eq("id", "339d44b8-76c1-496c-a95e-10d021503d65").maybeSingle()).data?.text_raw;
  if (!TEXTO_POSITIVO) { console.error("INSTRUMENTO CEGO: nao li o texto do controle positivo."); process.exit(2); }
  const cPos = maiorCorridaDeLista(TEXTO_POSITIVO);
  const TEXTO_NEGATIVO =
    "Quando uma equipe sabe exatamente o que precisa fazer, o trabalho fica mais simples e previsivel. " +
    "Antes de tomar uma decisao importante, e fundamental observar os fatos com calma, porque a pressa, " +
    "que quase sempre atrapalha, costuma cobrar caro depois.";
  const cNeg = maiorCorridaDeLista(TEXTO_NEGATIVO);

  console.log("══ CONTROLES DO DETECTOR ══");
  console.log(`  POSITIVO (texto do caso vivo, 339d44b8): corrida=${cPos.itens} · "${cPos.trecho}"`);
  console.log(`  NEGATIVO (prosa com virgula de oracao):  corrida=${cNeg.itens} · "${cNeg.trecho}"`);
  if (cPos.itens < MIN_ITENS) { console.error(`\n❌ INSTRUMENTO CEGO: nao achou lista no texto que SABIDAMENTE tem duas. exit 2`); process.exit(2); }
  if (cNeg.itens >= MIN_ITENS) { console.error(`\n❌ INSTRUMENTO GULOSO: achou "lista longa" em prosa corrida. exit 2`); process.exit(2); }
  console.log("  ✔ positivo casa, negativo nao casa — o detector discrimina.\n");

  // ── 2. VARREDURA PAGINADA (o SELECT corta em 1000; licao de 20/08) ───────
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("generations")
      .select("id,status,created_at,text_raw,qa,voice_id").not("qa", "is", null)
      .order("created_at", { ascending: false }).range(de, de + 999);
    if (error) { console.error("ERRO:", error.message); process.exit(1); }
    linhas.push(...data);
    if (data.length < 1000) break;
  }

  const pop = [];
  for (const g of linhas) {
    const t = taxaAlucinacao(g.qa);
    if (t === null) continue;                       // QA nao mediu: fora, nao vira zero
    if (!g.text_raw || !String(g.text_raw).trim()) continue;
    const c = maiorCorridaDeLista(g.text_raw);
    const idi = g.qa?.coverage_idioma_prob;
    pop.push({ id: g.id, status: g.status, taxa: t, lista: c.itens >= MIN_ITENS, idioma: idi==null?null:Number(idi),
               corrida: c.itens, len: String(g.text_raw).length, texto: g.text_raw });
  }
  console.log(`══ POPULACAO ══\n  ${linhas.length} geracoes com qa · ${pop.length} com coverage_checked>0 e texto (o resto fica FORA, nao vira zero)\n`);

  // ── 3. A COMPARACAO ──────────────────────────────────────────────────────
  const com = pop.filter(x => x.lista), sem = pop.filter(x => !x.lista);
  const bloco = (nome, g) => {
    const taxas = g.map(x => x.taxa);
    const alucinaram = g.filter(x => x.taxa > 0).length;
    console.log(`  ${nome.padEnd(22)} n=${String(g.length).padStart(4)} · taxa media ${pct(taxas.reduce((a,b)=>a+b,0)/(g.length||1))} · mediana ${pct(med(taxas))} · ${String(alucinaram).padStart(4)} (${((alucinaram/(g.length||1))*100).toFixed(1)}%) com ALGUMA alucinacao · len mediano ${med(g.map(x=>x.len))}`);
  };
  console.log("══ LISTA LONGA x RESTO ══");
  bloco("COM lista longa", com);
  bloco("SEM lista longa", sem);

  // ── 4. O MESMO, DENTRO DA FAIXA DE COMPRIMENTO (tira o confundidor) ──────
  console.log("\n══ CONTROLADO POR COMPRIMENTO (o confundidor declarado) ══");
  const faixas = [[0,500],[500,1000],[1000,2000],[2000,1e9]];
  for (const [a,b] of faixas) {
    const c = com.filter(x=>x.len>=a&&x.len<b), s = sem.filter(x=>x.len>=a&&x.len<b);
    if (!c.length && !s.length) continue;
    const t = g => g.length ? pct(g.map(x=>x.taxa).reduce((p,q)=>p+q,0)/g.length) : "  n/a";
    console.log(`  ${String(a).padStart(4)}-${b===1e9?"+":b} chars · COM n=${String(c.length).padStart(4)} taxa ${t(c)} · SEM n=${String(s.length).padStart(4)} taxa ${t(s)}`);
  }

  // ── 5. O TEXTO-MODELO DA CASA ────────────────────────────────────────────
  // O caso vivo usa o texto "Este e um teste de voz..." — se ele for modelo
  // que a plataforma oferece, o defeito nao e de um aluno: e de todo mundo
  // que clicou no exemplo.
  const assinatura = t => String(t).toLowerCase().includes("este é um teste de voz")
                       || String(t).toLowerCase().includes("este e um teste de voz");
  const modelo = pop.filter(x => assinatura(x.texto));
  console.log(`\n══ O TEXTO-MODELO "teste de voz" ══`);
  if (modelo.length) {
    bloco("texto-modelo", modelo);
    bloco("todo o resto", pop.filter(x => !assinatura(x.texto)));
    const falhou = modelo.filter(x => x.status === "failed").length;
    console.log(`  → ${modelo.length} geracoes usam esse texto · ${falhou} terminaram FAILED (${((falhou/modelo.length)*100).toFixed(1)}%)`);
  } else console.log("  nenhuma geracao com essa assinatura.");

  // ── 6. A HIPOTESE SEM O CASO QUE A GEROU (o teste que decide) ────────────
  // A hipotese NASCEU do caso do Diego. Medi-la numa base que INCLUI o Diego
  // e circular: o caso que sugeriu a regra nao pode ser a prova dela.
  const DIEGO_VOICE = "d6f89414-d0c2-4138-85cd-c8fcc346383b";
  const idsDiego = new Set(linhas.filter(g => g.voice_id === DIEGO_VOICE).map(g => g.id));
  // ⚠️ GUARDA QUE EU PRECISEI POR DEPOIS DE CAIR NELA NESTA MESMA RONDA.
  // A primeira versao nao trazia `voice_id` no SELECT. Resultado: o conjunto
  // saiu VAZIO, a "exclusao" nao excluiu nada, e o bloco imprimiu numeros
  // IDENTICOS aos de cima — ou seja, disse "a hipotese sobrevive sem o caso
  // que a gerou" quando o caso continuava dentro. Zero silencioso que
  // CONCORDAVA com a hipotese: a mesma familia do base64 de 18/09.
  if (idsDiego.size !== 4) {
    console.error(`\n❌ EXCLUSAO CEGA: esperava 4 geracoes da voz do caso vivo, achei ${idsDiego.size}. ` +
      `Sem elas fora, este bloco NAO testa nada. exit 2`);
    process.exit(2);
  }
  const semDiego = pop.filter(x => !idsDiego.has(x.id));
  console.log("\n══ A MESMA CONTA, SEM O CASO QUE GEROU A HIPOTESE ══");
  bloco("COM lista (s/ Diego)", semDiego.filter(x => x.lista));
  bloco("SEM lista (s/ Diego)", semDiego.filter(x => !x.lista));

  // ── 7. O PREDITOR QUE JA ESTA NA NOSSA TELEMETRIA ────────────────────────
  // Achado desta ronda: `coverage_idioma_prob` — que o proprio QA ja grava —
  // separa MUITO melhor que "lista longa". Dose-resposta monotona.
  const comIdioma = pop.filter(x => x.idioma !== null);
  console.log(`\n══ TAXA POR coverage_idioma_prob (${comIdioma.length} de ${pop.length} tem o campo) ══`);
  for (const [a, b] of [[0,0.3],[0.3,0.6],[0.6,0.9],[0.9,1.01]]) {
    const g = comIdioma.filter(x => x.idioma >= a && x.idioma < b);
    if (!g.length) continue;
    console.log(`  idioma ${a}-${b}  n=${String(g.length).padStart(4)} · taxa media ${pct(g.reduce((p,q)=>p+q.taxa,0)/g.length)} · alguma ${pct(g.filter(x=>x.taxa>0).length/g.length)}`);
  }

  // ── 8. E O PORTAO ENTREGOU ASSIM MESMO (liga no #702cc916) ───────────────
  const ruins = pop.filter(x => x.taxa >= 0.5);
  const entregues = ruins.filter(x => x.status === "ready");
  console.log(`\n══ >=50% DE ALUCINACAO: ${ruins.length} geracoes · ENTREGUES assim mesmo: ${entregues.length} ══`);

  // ── 9. OS PIORES, PRA CONFERENCIA A MAO ──────────────────────────────────
  console.log("\n══ 10 PIORES TAXAS (pra conferir a mao, nao pra concluir) ══");
  for (const x of [...pop].sort((a,b)=>b.taxa-a.taxa).slice(0,10))
    console.log(`  ${pct(x.taxa)} · ${x.id.slice(0,8)} [${x.status}] corrida=${String(x.corrida).padStart(2)} len=${String(x.len).padStart(5)} lista=${x.lista?"SIM":"nao"} · ${JSON.stringify(String(x.texto).slice(0,50))}`);
})();
