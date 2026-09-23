/**
 * "O banco dele nomeia Htm* e um valor num dia — essa compra e NOSSA?"
 *
 * POR QUE EXISTE (23/09, chamado #86de22c6 / Simone Leal): o extrato dela mostra
 * 31/08 "Htm *clonepronto Curitiba Br" R$ 672,00 e "Htm*hotmart Fabr Belo
 * Horizon Br" R$ 303,40. Descritor de cartao NAO e codigo de transacao, e as
 * duas chaves que a casa sabia consultar — E-MAIL (`pagou_de_verdade.cjs`) e
 * NOME (`2026-09-20_achar_compra_por_nome.cjs`) — ja tinham falhado nela:
 * 8 meses de balde "Simone" paginado, ZERO compra em 31/08 e ZERO nos dois
 * valores. O Vigia fechou a avenida do nome em 22/09 20hZ e nomeou a lacuna:
 * "busca por VALOR+DATA ou por CPF NAO EXISTE hoje nas ferramentas da casa".
 * Este script e a primeira metade (valor+data). Nao resolve CPF.
 *
 * A IDEIA, EM UMA LINHA: /sales/history aceita janela de data SEM buyer_name.
 * Entao da pra ler o DIA INTEIRO da casa e procurar o valor — que e a unica
 * chave que o extrato de cartao realmente entrega.
 *
 * ⛔ AS ARMADILHAS HERDADAS (medidas em 20/09, valem aqui igual)
 *   (1) SEM start_date/end_date a API aplica janela curta, CALADA. Aqui a
 *       janela e sempre explicita.
 *   (2) Janela longa demais devolve HTTP 400 invalid_parameter. Por isso o
 *       padrao e 1 dia (+/- folga de fuso), nao 8 meses.
 *   (3) PAGINACAO: sem page_token voce le o primeiro pedaco e acha que e tudo.
 *       Aqui paginamos e, se bater no teto, o script GRITA em vez de mentir.
 *
 * ⛔ A ARMADILHA NOVA DESTE INSTRUMENTO: FUSO.
 *   O extrato do banco esta em horario de Brasilia; `order_date` da Hotmart e
 *   epoch ms (UTC). Um dia BRT == 03:00Z do dia ate 03:00Z do dia seguinte. Se
 *   a janela fosse 00:00Z-23:59Z, compra feita as 21h30 BRT de 31/08 (= 00:30Z
 *   de 01/09) ficaria INVISIVEL e o script diria "nao existe". Por isso a
 *   janela nasce com --folga (default 1 dia para cada lado) e cada linha sai
 *   com o carimbo nos DOIS fusos, pra conferencia humana.
 *
 * ⛔ VALOR NAO E IDENTIDADE, E O PARCELAMENTO MEXE NO NUMERO.
 *   A compra da Simone Leal saiu parcelada (6x e 10x). O que o cartao cobra
 *   pode trazer juros e NAO bater centavo a centavo com `price.value` da
 *   Hotmart. Par medido no proprio balde: SIMONE WOLFFENBUTTEL comprou SGP
 *   R$ 741,00 + FCI R$ 313,32 — o MESMO par de produtos da Simone Leal, com
 *   valores PROXIMOS mas DIFERENTES dos R$ 672,00 / R$ 303,40 dela. Por isso a
 *   busca e por FAIXA (--tolerancia, default 20%) e nao por igualdade, e por
 *   isso o resultado se chama CANDIDATO e nunca "a compra dela".
 *
 * ⛔⛔ A ARMADILHA MAIS CARA, MEDIDA NO PROPRIO CASO QUE CRIOU ESTE SCRIPT:
 *     /sales/history SO DEVOLVE COMPRA PAGA. REEMBOLSO SOME.
 *
 *   Medido em 23/09, janela 30/08-01/09: 329 de 329 itens vieram PAGO, 100%.
 *   Peguei 5 transacoes que a NOSSA base (payment_events) registra como
 *   ordenadas DENTRO da janela com status DELAYED/BILLET_PRINTED
 *   (HP2383446026, HP2572235142, HP3314415771, HP3381746828, HP0691567194):
 *   as CINCO estao AUSENTES da resposta da API. O endpoint filtra por status
 *   pago e nao avisa.
 *
 *   O ESTRAGO QUE ISSO QUASE CAUSOU: a Simone Leal (#86de22c6) reclamava de
 *   R$ 975,40 em 31/08. Por VALOR+DATA este script devolveu ZERO nos dois
 *   valores; por NOME o balde de 8 meses devolveu ZERO; `pagou_de_verdade.cjs`
 *   no e-mail dela devolveu "SEM PAGAMENTO ENCONTRADO"; `aluno.cjs` devolveu
 *   "compras: NENHUMA". QUATRO instrumentos concordando em ZERO — e o zero
 *   era FALSO nos quatro. Consultadas as transacoes UMA A UMA:
 *       HP2163322038  R$ 672,00   REFUNDED  order_date 31/08 11:34:02Z
 *       HP3504926128  R$ 303,40   REFUNDED  order_date 31/08 11:23:47Z
 *   producer "Starter Digital", comprador ela mesma. Eram NOSSAS, e ja tinham
 *   sido ESTORNADAS. Com o zero na mao eu estava a um passo de escrever pra
 *   uma aluna que o dinheiro dela "nunca entrou nesta casa, procure a Hotmart
 *   pra saber quem recebeu" — acusacao falsa, sobre dinheiro ja devolvido.
 *
 *   ⇒ REGRA: zero neste script (e em pagou_de_verdade, aluno.cjs e no balde de
 *     nome) significa "nao ha compra PAGA por esta chave". NAO significa "nunca
 *     comprou". Antes de dizer QUALQUER coisa a aluno sobre dinheiro, consulte
 *     a transacao direta (--transacao), que enxerga REFUNDED/CANCELLED, ou leia
 *     as notas antigas do cartao, que e onde o codigo da transacao costuma
 *     estar escrito. Mesma familia do `profiles.ja_pagou` (ordem de 18/08,
 *     SUSPENSA) e do /subscriptions/{code}/purchases cego a assinatura
 *     cancelada (#5c68eb33): coluna/endpoint que le "nao" quando a resposta e
 *     "eu nao enxergo".
 *
 * ZERO AQUI NAO E PROVA DE QUE NAO PAGOU. Pode ser: REEMBOLSO (acima), compra
 * em nome/cartao de terceiro fora da janela, valor com juros fora da faixa, ou
 * descritor que nao e nosso. Vincular compra a conta, e decidir reembolso, sao
 * atos HUMANOS.
 *
 * SOMENTE LEITURA. Nao escreve em banco, nao manda e-mail, nao vincula nada.
 *
 * Uso:
 *   node _frank/ferramentas/2026-09-23_achar_compra_por_valor_e_data.cjs \
 *        --data 2026-08-31 --valor 672,00 --valor 303,40
 *   [--tolerancia 20]   % de faixa em volta de cada valor (default 20)
 *   [--folga 1]         dias de folga de cada lado da janela (default 1)
 *   [--tudo]            imprime TODAS as compras da janela, nao so as candidatas
 *   [--controle]        roda o controle positivo (par conhecido de 21/09) e sai
 */
const fs = require("fs"), path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
for (const l of fs.readFileSync(path.join(RAIZ, "frontend", ".env.local"), "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0) {
    const k = l.slice(0, i).trim();
    const v = l.slice(i + 1).replace(/[\r\n]+$/g, "").replace(/^["']|["']$/g, "");
    if (/^[A-Za-z0-9_]+$/.test(k)) process.env[k] = v;
  }
}
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
const PAGO = new Set(["COMPLETE", "APPROVED"]);
const MAX_PAGINAS = 60;
const DIA = 86400000;

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const args = (n) => process.argv.reduce((a, x, i) => (x === n ? [...a, process.argv[i + 1]] : a), []);
// "672,00" e "672.00" e "1.054,32" tem que virar numero. Vem de extrato BR.
const num = (s) => {
  const t = String(s).trim().replace(/\s/g, "");
  return parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};
const brl = (v) => (v == null ? "?" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const carimbo = (ms) => {
  if (!ms) return "?";
  const d = new Date(ms);
  const brt = new Date(ms - 3 * 3600000);
  return `${d.toISOString().slice(0, 16).replace("T", " ")}Z  (${brt.toISOString().slice(0, 16).replace("T", " ")} BRT)`;
};

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  const t = JSON.parse(raw).access_token;
  if (!t) throw new Error(`sem access_token (HTTP ${r.status}): ${raw.slice(0, 200)}`);
  return t;
}

async function lerJanela(ini, fim, H) {
  let pageToken = null, paginas = 0, itens = [], total = null, estourou = false;
  do {
    const qs = `start_date=${ini}&end_date=${fim}&max_results=50`
      + (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "");
    const r = await fetch(`${BASE}/sales/history?${qs}`, { headers: H });
    const raw = await r.text();
    if (!r.ok) {
      console.log(`\n❌ /sales/history HTTP ${r.status} na pagina ${paginas + 1}. ISTO NAO E "NAO EXISTE COMPRA"`);
      console.log(`   — e o instrumento falhando. Corpo cru:\n   ${raw.slice(0, 400)}`);
      process.exit(1);
    }
    let j;
    try { j = JSON.parse(raw); } catch {
      console.log(`\n❌ /sales/history nao devolveu JSON (HTTP ${r.status}). Corpo cru:\n   ${raw.slice(0, 400)}`);
      process.exit(1);
    }
    itens.push(...(j.items || []));
    total = (j.page_info && j.page_info.total_results) ?? total;
    pageToken = (j.page_info && j.page_info.next_page_token) || null;
    paginas++;
    if (pageToken && paginas >= MAX_PAGINAS) { estourou = true; break; }
  } while (pageToken);
  return { itens, total, paginas, estourou };
}

function linha(it) {
  const b = it.buyer || {}, p = it.product || {}, pu = it.purchase || {};
  const price = pu.price || {};
  const st = String(pu.status || it.status || "?").toUpperCase();
  console.log(`  ${PAGO.has(st) ? "💰 PAGO " : "⬜ " + st.padEnd(8)} R$ ${brl(price.value).padStart(10)} ${price.currency_value ?? ""}`);
  console.log(`     quando    : ${carimbo(pu.order_date)}`);
  console.log(`     comprador : ${b.name ?? "?"}`);
  console.log(`     e-mail    : ${b.email ?? "?"}`);
  console.log(`     produto   : ${p.name ?? "?"} (${p.id ?? "?"})`);
  console.log(`     transacao : ${pu.transaction ?? "?"}`);
  console.log("");
}

(async () => {
  const H = { Authorization: `Bearer ${await token()}` };
  const controle = process.argv.includes("--controle");

  // CONTROLE POSITIVO: par conhecido e medido (Vigia 22/09 20hZ) — SIMONE
  // WOLFFENBUTTEL, 21/09, SGP R$ 741,00 (HP3461697829) + FCI R$ 313,32
  // (HP3869146914). Se a busca por valor+data NAO achar este par, o
  // instrumento esta cego e QUALQUER zero dele e lixo.
  {
    const ini = Date.parse("2026-09-20T00:00:00Z"), fim = Date.parse("2026-09-22T23:59:59Z");
    const { itens, paginas, estourou } = await lerJanela(ini, fim, H);
    const achou = (alvo) => itens.some((it) => {
      const v = it.purchase && it.purchase.price && it.purchase.price.value;
      return v != null && Math.abs(v - alvo) < 0.01;
    });
    const a = achou(741.0), b = achou(313.32);
    const tx = itens.map((it) => it.purchase && it.purchase.transaction);
    const t1 = tx.includes("HP3461697829"), t2 = tx.includes("HP3869146914");
    console.log(`🧪 CONTROLE POSITIVO (par medido de 21/09, ${itens.length} compra(s) na janela, ${paginas} pag)`);
    console.log(`   R$ 741,00 por valor: ${a ? "OK" : "FALHOU"} · R$ 313,32 por valor: ${b ? "OK" : "FALHOU"}`);
    console.log(`   HP3461697829: ${t1 ? "OK" : "FALHOU"} · HP3869146914: ${t2 ? "OK" : "FALHOU"}`);
    if (estourou) console.log(`   ⚠️  teto de paginas estourado no proprio controle`);
    if (!(a && b && t1 && t2)) {
      console.log(`\n❌ CONTROLE POSITIVO FALHOU. A busca por valor+data NAO enxerga uma compra`);
      console.log(`   que SABIDAMENTE existe. Nao use o resultado deste script pra concluir nada.`);
      if (!controle) process.exit(1);
    } else {
      console.log(`   ✔ o instrumento enxerga compra conhecida por valor e por transacao.\n`);
    }
    if (controle) process.exit(0);
  }

  // --transacao: a UNICA consulta desta casa que enxerga REFUNDED/CANCELLED.
  // Por transaction= a API devolve o item mesmo nao-pago; por janela+valor,
  // nao. Ver o bloco ⛔⛔ no topo. Use isto antes de falar de dinheiro.
  const txs = args("--transacao").filter(Boolean);
  if (txs.length) {
    for (const tx of txs) {
      const r = await fetch(`${BASE}/sales/history?transaction=${encodeURIComponent(tx)}`, { headers: H });
      const raw = await r.text();
      console.log(`\n=== ${tx} === HTTP ${r.status}`);
      if (!r.ok) { console.log(`  ❌ instrumento falhou (NAO e "nao existe"): ${raw.slice(0, 300)}`); continue; }
      let j; try { j = JSON.parse(raw); } catch { console.log(`  ❌ nao-JSON: ${raw.slice(0, 300)}`); continue; }
      const its = j.items || [];
      if (!its.length) { console.log(`  nenhum item devolvido — transacao inexistente OU de outro produtor.`); continue; }
      for (const it of its) {
        const pu = it.purchase || {}, b = it.buyer || {}, p = it.product || {}, pr = it.producer || {};
        const st = String(pu.status || "?").toUpperCase();
        console.log(`  status    : ${st}${["REFUNDED", "CHARGEBACK", "CANCELLED", "CANCELED"].includes(st) ? "   ⬅ DINHEIRO VOLTOU/NAO FICOU: invisivel em toda busca por valor/nome/e-mail" : ""}`);
        console.log(`  valor     : R$ ${brl(pu.price && pu.price.value)}`);
        console.log(`  quando    : ${carimbo(pu.order_date)}`);
        console.log(`  comprador : ${b.name ?? "?"} <${b.email ?? "?"}>`);
        console.log(`  produto   : ${p.name ?? "?"} (${p.id ?? "?"}) · produtor ${pr.name ?? "?"}`);
        if (pu.payment) console.log(`  pagamento : ${pu.payment.method ?? "?"} ${pu.payment.installments_number ? pu.payment.installments_number + "x" : ""}`);
        if (pu.warranty_expire_date) console.log(`  garantia  : ate ${carimbo(pu.warranty_expire_date)}`);
      }
    }
    console.log(`\n⚠️  Status REFUNDED/CHARGEBACK aqui explica zero em pagou_de_verdade.cjs,`);
    console.log(`    aluno.cjs e no balde de nome. Zero la NAO era "nunca comprou".`);
    process.exit(0);
  }

  const data = arg("--data");
  const valores = args("--valor").map(num).filter((v) => !isNaN(v));
  if (!data || !valores.length) {
    console.log('uso: node 2026-09-23_achar_compra_por_valor_e_data.cjs --data 2026-08-31 --valor 672,00 [--valor 303,40]');
    console.log('     [--tolerancia 20] [--folga 1] [--tudo] [--controle]');
    process.exit(1);
  }
  const tol = parseFloat(arg("--tolerancia", "20")) / 100;
  const folga = parseInt(arg("--folga", "1"), 10);
  const base = Date.parse(`${data}T00:00:00Z`);
  if (isNaN(base)) { console.log(`data invalida: ${data}`); process.exit(1); }
  const ini = base - folga * DIA, fim = base + (folga + 1) * DIA - 1000;

  const { itens, total, paginas, estourou } = await lerJanela(ini, fim, H);

  console.log(`🔎 HOTMART VIVA · TODAS as compras da casa na janela (sem filtro de comprador)`);
  console.log(`   alvo ${data} · folga ${folga}d → janela ${new Date(ini).toISOString().slice(0, 16).replace("T", " ")}Z a ${new Date(fim).toISOString().slice(0, 16).replace("T", " ")}Z`);
  console.log(`   ${paginas} pagina(s) · ${itens.length} de ${total ?? "?"} compra(s) lidas`);
  if (estourou) {
    console.log(`   ⚠️⚠️  PAREI NO TETO DE ${MAX_PAGINAS} PAGINAS — a janela continua e o resultado`);
    console.log(`        abaixo esta INCOMPLETO. Reduza a folga antes de concluir qualquer coisa.`);
  }
  if (total != null && itens.length < total) {
    console.log(`   ⚠️⚠️  LI MENOS DO QUE O TOTAL (${itens.length} < ${total}). Resultado INCOMPLETO.`);
  }
  console.log(`   procurando: ${valores.map((v) => "R$ " + brl(v)).join(" · ")}  (faixa +/- ${(tol * 100).toFixed(0)}%)\n`);

  let achouAlgum = false;
  for (const alvo of valores) {
    const lo = alvo * (1 - tol), hi = alvo * (1 + tol);
    const cand = itens.filter((it) => {
      const v = it.purchase && it.purchase.price && it.purchase.price.value;
      return v != null && v >= lo && v <= hi;
    }).sort((a, b) => Math.abs(a.purchase.price.value - alvo) - Math.abs(b.purchase.price.value - alvo));
    console.log(`── R$ ${brl(alvo)}  (faixa R$ ${brl(lo)} a R$ ${brl(hi)}) ──`);
    if (!cand.length) {
      console.log(`   NENHUM candidato na janela.`);
      console.log(`   ⚠️  Isto NAO prova que a pessoa nao pagou: pode ser juros de parcelamento`);
      console.log(`       jogando o valor pra fora da faixa, compra fora da janela, ou descritor`);
      console.log(`       que nao e nosso. Alargue --tolerancia/--folga antes de concluir.\n`);
    } else {
      achouAlgum = true;
      console.log(`   ${cand.length} CANDIDATO(S) — candidato, nao dono:\n`);
      cand.forEach(linha);
    }
  }

  if (process.argv.includes("--tudo") && itens.length) {
    console.log(`── JANELA INTEIRA (${itens.length}) ──\n`);
    itens.slice().sort((a, b) => (a.purchase.order_date || 0) - (b.purchase.order_date || 0)).forEach(linha);
  }

  console.log(`⚠️  VALOR NAO E IDENTIDADE. Confira comprador + produto + data + transacao`);
  console.log(`    antes de vincular. Vincular compra a conta e decidir reembolso sao atos HUMANOS.`);
  if (!achouAlgum) {
    console.log(`\n>>> VEREDITO: nenhum candidato nos valores pedidos na janela lida.`);
    console.log(`    Leia como "nao achei por ESTA chave", nunca como "nao pagou".`);
  }
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
