#!/usr/bin/env node
/**
 * A FRONTEIRA QUE A REGUA MARCOU PERDE PALAVRA? (#234, f8587cef) — so leitura.
 * =========================================================================
 *   node _frank/ferramentas/2026-09-24_fronteira_marcada_perde_palavra.cjs
 *        [--desde=ISO] [--janela=2.0] [--afastamento=5.0] [--max=13]
 *
 * A PERGUNTA, QUE ESTA ABERTA DESDE 18/09 E NUNCA PODE SER MEDIDA
 * ---------------------------------------------------------------
 * O contador `tail_interno_entregue` marca FRONTEIRA ABRUPTA por criterio
 * FISICO (release_ms<=35 E plato_db>-40). O nome do cartao promete outra coisa:
 * "palavra decapitada". A nota de 21/09 mostrou, em teste cego com controle
 * positivo, que um ouvido sensivel NAO achou corte em 4 de 5 geracoes que a
 * regua reprovou — e concluiu que a regua mede um SUPERCONJUNTO do defeito.
 * Mas aquele teste tinha n=10 e, pior, nao tinha ONDE ouvir: a telemetria
 * guardava CONTADOR, nao POSICAO. O limite 3 daquela nota diz isso com todas as
 * letras.
 *
 * O PR #408 (merge 7dc53d7a, 23/09 13:44Z) passou a gravar a POSICAO, e a
 * ferramenta irma 2026-09-24_posicao_da_fronteira_chegou.cjs mediu que o dado
 * chegou em producao as 14:12:09Z com virada LIMPA (36/36, zero desertor).
 * Entao pela primeira vez da pra perguntar no ponto certo.
 *
 * POR QUE ESTE INSTRUMENTO E NAO O `olho`
 * ---------------------------------------
 * O passo (b) do cartao foi escrito como "apontar o OUVIDO no segundo exato".
 * O unico operario que ouve (`olho`, Gemini) segue devolvendo VAZIO em 4s com
 * 0 token — reconferido nesta ronda, 5a vez seguida. Esperar o ouvido e' esperar
 * o Johnny recarregar credito, e isso ja esta no lote de decisoes.
 *
 * Mas "ouvir" nao e' a unica forma de responder. A pergunta do cartao e' se a
 * PALAVRA se perde na fronteira marcada — e palavra perdida aparece na
 * TRANSCRICAO. whisper-1 com timestamp por PALAVRA e' o mesmo instrumento que
 * o `fabricar_referencia.cjs` ja usa em producao, e foi o que funcionou na
 * ronda das 11hZ de 23/09 quando o `olho` falhou. Declarado: isto NAO e'
 * escuta humana, e' transcricao por maquina, e as duas nao sao a mesma coisa.
 *
 * O DESENHO — CONTROLE DENTRO DO MESMO AUDIO
 * ------------------------------------------
 * Comparar geracao marcada contra geracao limpa seria comparar vozes, textos e
 * tamanhos diferentes. Aqui o controle mora DENTRO do mesmo arquivo:
 *
 *   CASO     — os segundos que a regua marcou (`tail_interno_entregue_pos_s`)
 *   CONTROLE — segundos do MESMO audio, mesma voz, mesma transcricao, escolhidos
 *              longe de qualquer marca (>= --afastamento s) e longe das bordas
 *
 * Mesmo numero de pontos de controle que de casos, por geracao. Se a regua
 * mede perda de palavra, o defeito tem que se concentrar nos CASOS. Se as duas
 * taxas empatarem, a marca nao aponta pra lugar nenhum.
 *
 * COMO "PERDER PALAVRA" E' MEDIDO
 * -------------------------------
 * Alinha o texto PEDIDO (`text_normalized`) com o texto TRANSCRITO por maior
 * subsequencia comum, e chama de EVENTO DE DEFEITO:
 *   - palavra pedida que nao aparece na transcricao (sumiu/veio irreconhecivel)
 *   - palavra transcrita que nao estava no pedido (o modelo inventou)
 * Cada evento ganha um instante (o da palavra transcrita, ou o fim da ultima
 * palavra casada antes dele). Um ponto — caso ou controle — e' POSITIVO se tem
 * pelo menos um evento dentro de +/- --janela segundos.
 *
 * ⚠️ LIMITES DECLARADOS, e eles sao grandes:
 *  1. O offset e' APROXIMACAO por construcao, e o proprio codigo do #408 diz
 *     isso: o crossfade encurta (posicao real ANTES) e a pausa de paragrafo
 *     alonga (posicao real DEPOIS), e o desvio ACUMULA ao longo do arquivo.
 *     Por isso a janela e' de segundos, nao de milissegundos, e por isso este
 *     instrumento NUNCA serve pra corte automatico por timestamp.
 *  2. Decapitacao de UMA SILABA pode nao virar evento nenhum: o whisper tende a
 *     normalizar pra palavra inteira. Entao este teste tem FALSO NEGATIVO
 *     estrutural — ele mede a parte AUDIVEL-NO-TEXTO do defeito, que e' um
 *     subconjunto. Taxa igual nos dois lados NAO prova que a regua infla;
 *     prova que a perda nao chega ao texto.
 *  3. n pequeno (os casos que existem desde 23/09 14:12Z). E' direcional.
 *
 * NAO GASTA GPU, NAO TOCA EM CREDITO, NAO ESCREVE NO BANCO, NAO MANDA E-MAIL.
 * Custo: ~R$0,02 de whisper por audio.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({ path: path.join(c.RAIZ, "frontend", ".env.local") });

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : d; };
const DESDE = arg("desde", "2026-09-23T14:12:09Z"); // virada medida pela ferramenta irma
const JANELA = parseFloat(arg("janela", "2.0"));
const AFAST = parseFloat(arg("afastamento", "5.0"));
const MAX = parseInt(arg("max", "13"), 10);

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const tem = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

async function baixar(g) {
  const dest = path.join(os.tmpdir(), `fmp_${g.id.slice(0, 8)}.mp3`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  const r = await fetch(await c.urlAssinada(c.BUCKETS.geracoes(), g.audio_path, 900));
  if (!r.ok) throw new Error(`download ${g.id.slice(0, 8)}: HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

function duracaoReal(f) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" });
  const v = parseFloat((r.stdout || "").trim());
  if (!Number.isFinite(v)) throw new Error(`ffprobe nao devolveu duracao para ${f}`);
  return v;
}

async function palavras(f) {
  // Cache em disco de proposito: sem ele, re-rodar a ferramenta paga whisper de
  // novo E compara contra uma transcricao DIFERENTE (o modelo nao e' deter-
  // ministico). Duas leituras do mesmo audio tem que discutir o mesmo texto.
  const cache = f.replace(/\.mp3$/, ".words.json");
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(f)], { type: "audio/mpeg" }), "a.mp3");
  fd.append("model", "whisper-1"); fd.append("language", "pt"); fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error("whisper: " + JSON.stringify(j).slice(0, 200));
  const w = (j.words || []).map((x) => ({ t: norm(x.word), ini: x.start, fim: x.end })).filter((x) => x.t);
  if (!w.length) throw new Error("whisper devolveu ZERO palavra — transcricao vazia nao e' medicao");
  fs.writeFileSync(cache, JSON.stringify(w));
  return w;
}

/** maior subsequencia comum entre pedido[] e dito[] -> pares casados (i,j). */
function casar(pedido, dito) {
  const n = pedido.length, m = dito.length;
  // O(n*m) em Int32Array: 1500x1500 = 2,2M celulas, cabe folgado.
  const L = new Int32Array((n + 1) * (m + 1));
  const at = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[at(i, j)] = pedido[i] === dito[j]
        ? L[at(i + 1, j + 1)] + 1
        : Math.max(L[at(i + 1, j)], L[at(i, j + 1)]);
    }
  }
  const pares = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (pedido[i] === dito[j]) { pares.push([i, j]); i++; j++; }
    else if (L[at(i + 1, j)] >= L[at(i, j + 1)]) i++;
    else j++;
  }
  return pares;
}

/**
 * NUMERAL NAO E' DEFEITO — e isto foi MEDIDO, nao suposto. O controle positivo
 * deste script (1c761a52) devolveu 73 eventos, e a maioria era a mesma familia
 * que a resolution_note do 37bacb68 ja tinha catalogado em 20/08 como falso
 * negativo NOSSO: "digito x extenso". O `text_normalized` expande o numero por
 * extenso ("cinquenta", "cem", "mil") e o whisper devolve em algarismo ("50",
 * "100", "1 000"). Sao a MESMA fala, e o alinhador por palavra nao tem como
 * saber. Fica fora dos dois lados da conta (caso E controle), senao o ruido
 * entra como se fosse sinal.
 */
const NUMERAL = new Set([
  "zero", "um", "uma", "dois", "duas", "tres", "quatro", "cinco", "seis", "sete",
  "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quatorze", "quinze",
  "dezesseis", "dezessete", "dezoito", "dezenove", "vinte", "trinta", "quarenta",
  "cinquenta", "sessenta", "setenta", "oitenta", "noventa", "cem", "cento",
  "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
  "setecentos", "oitocentos", "novecentos", "mil", "milhao", "milhoes",
  "bilhao", "bilhoes", "real", "reais", "r", "rs", "porcento", "por",
  "primeiro", "segundo", "terceiro", "e",
]);
const ehNumeral = (w) => /^[0-9]+$/.test(w) || NUMERAL.has(w);

/** instantes dos EVENTOS DE DEFEITO (palavra pedida sumida ou palavra inventada). */
function eventos(pedido, dito, pares) {
  const casadoPedido = new Set(pares.map((p) => p[0]));
  const casadoDito = new Set(pares.map((p) => p[1]));
  const ev = [];
  // inventadas: instante proprio
  for (let j = 0; j < dito.length; j++) {
    if (!casadoDito.has(j) && !ehNumeral(dito[j].t)) ev.push({ t: dito[j].fim, tipo: "inventou", palavra: dito[j].t });
  }
  // sumidas: ancorar no fim da ultima palavra casada ANTES dela
  const porPedido = new Map(pares.map(([pi, dj]) => [pi, dj]));
  for (let i = 0; i < pedido.length; i++) {
    if (casadoPedido.has(i) || ehNumeral(pedido[i])) continue;
    let k = i - 1, anc = null;
    while (k >= 0) { if (porPedido.has(k)) { anc = dito[porPedido.get(k)].fim; break; } k--; }
    if (anc === null) {
      let k2 = i + 1;
      while (k2 < pedido.length) { if (porPedido.has(k2)) { anc = dito[porPedido.get(k2)].ini; break; } k2++; }
    }
    if (anc !== null) ev.push({ t: anc, tipo: "sumiu", palavra: pedido[i] });
  }
  return ev.sort((a, b) => a.t - b.t);
}

/** pontos de controle: grade de 1s, longe das marcas e das bordas, espalhados. */
function controles(dur, marcas, k) {
  const cand = [];
  for (let t = 3; t <= dur - 3; t += 1) {
    if (marcas.every((m) => Math.abs(m - t) >= AFAST)) cand.push(t);
  }
  if (!cand.length || k <= 0) return [];
  if (cand.length <= k) return cand;
  // ⚠️ DEFEITO MEDIDO E CORRIGIDO NESTA MESMA RONDA: a 1a versao usava
  // x*(len-1)/(k-1), que para k=1 devolve SEMPRE cand[0] — ou seja, o controle
  // caia sistematicamente no COMECO do audio (3,0s em 8 das 13 geracoes). Como
  // as marcas se espalham pelo arquivo inteiro, controle preso num pedaco so
  // nao e' controle. Quantis (x+0,5)/k espalham de verdade e, para k=1, caem
  // no MEIO.
  //   A DIRECAO DO VIES FOI MEDIDA, NAO DEDUZIDA — porque eu deduzi ERRADO.
  //   Antes de rodar eu escrevi que o inicio do audio "e' onde o modelo erra
  //   menos" e que portanto o contraste vinha INFLADO a meu favor. O dado disse
  //   o contrario: com o controle preso no inicio ele deu 3/19; espalhado, caiu
  //   pra 1/19. O comeco era o pedaco com MAIS evento, entao o vies ESCONDIA o
  //   contraste (2,3x virou 7x depois do conserto). Fica escrito assim de
  //   proposito: a correcao andou CONTRA a minha intuicao, e eu so soube porque
  //   rodei os dois.
  const out = [];
  for (let x = 0; x < k; x++) out.push(cand[Math.min(cand.length - 1, Math.floor(((x + 0.5) * cand.length) / k))]);
  return [...new Set(out)];
}

const positivo = (ev, p) => ev.filter((e) => Math.abs(e.t - p) <= JANELA);

/**
 * CONTROLE POSITIVO DO DETECTOR (--prova=<id>). Regua de 23/09, cobrada quatro
 * vezes nesta casa: zero que concorda com a sua hipotese nao vale nada sem
 * controle. Se o alinhador nao acusar evento num audio que SABIDAMENTE saiu
 * errado, entao "empate entre caso e controle" nao significa "nao ha defeito",
 * significa "o detector e' cego". Alvo canonico: 1c761a52 (Diego Vargas), cujo
 * defeito foi nomeado palavra por palavra na nota das 11hZ de 23/09 do 37bacb68
 * ("minha maneira de me comunicar" sumiu, "ginesamento" inventado).
 */
async function provaDoDetector(db, ref) {
  // uuid e' uuid: `like` nao existe pro tipo, e `.limit(N)` sem ordem pega um
  // punhado ARBITRARIO de linhas — foi assim que a 1a versao disto declarou
  // "nao existe" uma geracao que existe. Prefixo vira FAIXA, como no
  // medir_pausas_da_entrega.cjs.
  const hex = ref.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{1,32}$/.test(hex)) throw new Error(`"${ref}" nao parece id`);
  const vestir = (s) => `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
  const { data, error } = await db.from("generations")
    .select("id, created_at, audio_path, text_normalized, status, qa")
    .gte("id", vestir(hex.padEnd(32, "0"))).lte("id", vestir(hex.padEnd(32, "f"))).limit(5);
  if (error) throw new Error(`generations: ${error.message}`);
  if (data && data.length > 1) throw new Error(`prefixo "${ref}" e' ambiguo (${data.length})`);
  const g = (data || [])[0];
  if (!g) throw new Error(`geracao "${ref}" nao existe`);
  if (!g.audio_path) throw new Error(`geracao ${ref} nao tem audio_path (status ${g.status})`);
  const f = await baixar(g);
  const dur = duracaoReal(f);
  const dito = await palavras(f);
  const pedido = (g.text_normalized || "").split(/\s+/).map(norm).filter(Boolean);
  const pares = casar(pedido, dito.map((w) => w.t));
  const ev = eventos(pedido, dito, pares);
  const sumiu = ev.filter((e) => e.tipo === "sumiu"), inventou = ev.filter((e) => e.tipo === "inventou");
  console.log(`\n── CONTROLE POSITIVO DO DETECTOR: ${String(g.id).slice(0, 8)} (${String(g.created_at).slice(0, 19).replace("T", " ")}, ${dur.toFixed(1)}s) ──`);
  console.log(`   pedido ${pedido.length} pal · transcrito ${dito.length} pal · casadas ${pares.length} (${(100 * pares.length / Math.max(1, pedido.length)).toFixed(1)}%)`);
  console.log(`   EVENTOS: ${ev.length}  (sumiu ${sumiu.length} · inventou ${inventou.length})`);
  console.log(`   sumiram  : ${sumiu.slice(0, 20).map((e) => e.palavra).join(" ") || "(nenhuma)"}`);
  console.log(`   inventadas: ${inventou.slice(0, 20).map((e) => e.palavra).join(" ") || "(nenhuma)"}`);
  if (!ev.length) {
    console.log("   >>> CONTROLE REPROVADO: detector CEGO num audio sabidamente errado.");
    console.log("       Nao rode a medicao principal enquanto isto nao passar.");
    process.exit(2);
  }
  console.log("   >>> CONTROLE OK: o detector acusa defeito onde ele existe.");
}

(async () => {
  const db = c.supa();
  const PROVA = arg("prova", "");
  if (PROVA) { await provaDoDetector(db, PROVA); if (!process.argv.includes("--seguir")) return; }
  const linhas = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db.from("generations")
      .select("id, created_at, voice_id, audio_path, text_normalized, status, qa")
      .eq("status", "ready").gte("created_at", DESDE)
      .order("created_at", { ascending: true }).range(off, off + 999);
    if (error) throw new Error(`generations: ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const casos = linhas.filter((g) =>
    g.qa && tem(g.qa, "tail_interno_entregue_pos_s") &&
    (g.qa.tail_interno_entregue_pos_s || []).length > 0 &&
    g.audio_path && g.text_normalized).slice(0, MAX);

  console.log(`janela de busca: desde ${DESDE}`);
  console.log(`geracoes ready lidas: ${linhas.length} · com posicao gravada e texto: ${casos.length}`);
  console.log(`janela de atribuicao: +/- ${JANELA}s · afastamento do controle: ${AFAST}s`);
  if (!casos.length) throw new Error("ZERO casos — nao ha o que medir (isto nao e' resultado, e' amostra vazia)");

  let cCaso = 0, cCasoPos = 0, cCtrl = 0, cCtrlPos = 0;
  const detalhe = [];
  for (const g of casos) {
    const id8 = g.id.slice(0, 8);
    let f, dur, dito;
    try {
      f = await baixar(g); dur = duracaoReal(f); dito = await palavras(f);
    } catch (e) { console.log(`  ${id8} PULADO: ${e.message.slice(0, 120)}`); continue; }
    const pedido = (g.text_normalized || "").split(/\s+/).map(norm).filter(Boolean);
    const pares = casar(pedido, dito.map((w) => w.t));
    const ev = eventos(pedido, dito, pares);
    const marcas = (g.qa.tail_interno_entregue_pos_s || []).filter((x) => Number.isFinite(x));
    const ctrl = controles(dur, marcas, marcas.length);

    const rc = marcas.map((p) => ({ p, ev: positivo(ev, p) }));
    const rk = ctrl.map((p) => ({ p, ev: positivo(ev, p) }));
    cCaso += rc.length; cCasoPos += rc.filter((r) => r.ev.length).length;
    cCtrl += rk.length; cCtrlPos += rk.filter((r) => r.ev.length).length;

    const cob = pares.length / Math.max(1, pedido.length);
    console.log(`\n=== ${id8} · ${String(g.created_at).slice(0, 19).replace("T", " ")} · ${dur.toFixed(1)}s`);
    console.log(`    pedido ${pedido.length} pal · transcrito ${dito.length} pal · casadas ${pares.length} (${(100 * cob).toFixed(1)}%) · eventos ${ev.length}`);
    console.log(`    CASO     marcas [${marcas.map((x) => x.toFixed(1)).join(", ")}] -> positivos ${rc.filter((r) => r.ev.length).length}/${rc.length}`);
    for (const r of rc.filter((x) => x.ev.length)) {
      console.log(`             @${r.p.toFixed(1)}s: ${r.ev.slice(0, 4).map((e) => `${e.tipo}:${e.palavra}@${e.t.toFixed(1)}`).join(" ")}`);
    }
    console.log(`    CONTROLE pontos [${ctrl.map((x) => x.toFixed(1)).join(", ")}] -> positivos ${rk.filter((r) => r.ev.length).length}/${rk.length}`);
    for (const r of rk.filter((x) => x.ev.length)) {
      console.log(`             @${r.p.toFixed(1)}s: ${r.ev.slice(0, 4).map((e) => `${e.tipo}:${e.palavra}@${e.t.toFixed(1)}`).join(" ")}`);
    }
    detalhe.push({ id8, marcas: rc.length, marcasPos: rc.filter((r) => r.ev.length).length, ctrl: rk.length, ctrlPos: rk.filter((r) => r.ev.length).length, cob });
  }

  const pc = cCaso ? (100 * cCasoPos) / cCaso : null;
  const pk = cCtrl ? (100 * cCtrlPos) / cCtrl : null;
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(`CASO     (segundo que a regua marcou) : ${cCasoPos}/${cCaso}` + (pc !== null ? ` = ${pc.toFixed(1)}%` : ""));
  console.log(`CONTROLE (mesmo audio, longe da marca): ${cCtrlPos}/${cCtrl}` + (pk !== null ? ` = ${pk.toFixed(1)}%` : ""));
  console.log("══════════════════════════════════════════════════════════════");
  if (!cCtrl) {
    console.log(">>> INCONCLUSIVO: nao houve ponto de CONTROLE (audio curto demais");
    console.log("    pro afastamento pedido). Sem controle, o numero do caso nao");
    console.log("    quer dizer nada — baixe --afastamento e repita.");
  } else if (pc === pk) {
    console.log(">>> EMPATE EXATO. A marca nao aponta pra lugar nenhum NO TEXTO.");
    console.log("    Leia com o limite 2 do cabecalho: isto nao prova que a regua");
    console.log("    infla, prova que a perda (se existe) nao chega a transcricao.");
  } else if (pc > pk) {
    console.log(`>>> O DEFEITO SE CONCENTRA NA MARCA (${pc.toFixed(1)}% x ${pk.toFixed(1)}%).`);
    console.log("    Direcional a FAVOR da regua: onde ela marca, o texto entregue");
    console.log("    diverge mais do pedido do que no resto do MESMO audio.");
  } else {
    console.log(`>>> O DEFEITO NAO SE CONCENTRA NA MARCA (${pc.toFixed(1)}% x ${pk.toFixed(1)}%).`);
    console.log("    Direcional CONTRA o rotulo 'palavra decapitada': o texto erra");
    console.log("    tanto (ou mais) longe da marca quanto nela.");
  }
  console.log("Nada foi alterado: esta ferramenta so le. Zero GPU, zero credito de aluno.");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
