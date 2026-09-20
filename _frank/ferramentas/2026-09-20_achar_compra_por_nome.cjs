/**
 * "O e-mail do aluno esta morto — ele pagou com QUAL endereco?"
 *
 * POR QUE EXISTE (20/09, chamados #249 e #250): glaubermed@ig.com.br devolve
 * 550 5.1.1 "user unknown" — endereco que NAO EXISTE e nunca vai receber. Todo
 * instrumento da casa pra "pagou?" (`pagou_de_verdade.cjs`, `_hotmart.cjs`) e
 * indexado por E-MAIL, que e justamente o dado quebrado nesses casos. O
 * proprio `pagou_de_verdade.cjs` manda, no cabecalho, "procurar a pessoa por
 * nome/CPF/prefixo antes de decidir" — e nao existia com o que fazer isso.
 *
 * ⛔ AS DUAS ARMADILHAS DO /sales/history QUE ME PEGARAM ANTES DE VIRAREM CODIGO
 *
 * A primeira versao deste script mandava o nome INTEIRO em `buyer_name`, sem
 * data e sem paginar. Ela devolveu "SEM COMPRA" para DOIS alunos que tinham
 * pagado, e eu cheguei a escrever esse "achado" em dois chamados antes de
 * conferir por e-mail. Medido em 20/09 na Hotmart viva, com o nome lido do
 * PROPRIO registro da compra:
 *
 *   (1) NOME COMPOSTO DEVOLVE ZERO ATE NO CASAMENTO EXATO.
 *       nome gravado na compra: "Anderson Silvestre"
 *         buyer_name=Anderson Silvestre  ->  0 item(s)   <- EXATO, e zero
 *         buyer_name=Anderson            -> 12 item(s)
 *       "Glauber jiordany" -> 0, "Glauber" -> 1. E nao e um prefixo coerente:
 *       "Maria Luiza" -> 2, esse funciona. O parametro e silenciosamente
 *       nao-confiavel pra nome composto. => SO MANDAMOS O PRIMEIRO TOKEN.
 *
 *   (2) SEM start_date/end_date A API APLICA UMA JANELA CURTA, CALADA.
 *         buyer_name=Anderson, sem datas          -> total_results 12
 *         buyer_name=Anderson, 01/2025 a 09/2026  -> total_results 93
 *       87% do balde estava invisivel e nada no corpo dizia isso. As compras
 *       do Anderson (06 e 07/08) estavam fora da janela padrao.
 *       => SEMPRE mandamos start_date/end_date largos E paginamos.
 *
 * Com as duas correcoes, o controle positivo fecha: balde "Anderson" paginado
 * = 93 compras, 62 nomes distintos, e as 2 do "Anderson Silvestre"
 * (andy.silvestre@icloud.com, HP3039359775 e HP2049800928) aparecem. Os mesmos
 * R$ 733,60 que a versao quebrada jurava nao existir.
 *
 * ⚠️ NOME NAO E CHAVE, e ZERO AQUI CONTINUA NAO SENDO PROVA. Homonimo existe
 * (62 "Anderson" diferentes num balde so); nome de compra diferente do nome de
 * cadastro (conjuge, apelido, razao social — ha "ANDERSON TREINAMENTOS E
 * NEGOCIOS DIGITAIS EIRELE" no balde) tambem. Este script MEDE e entrega
 * candidatos com valor, produto, data e transacao. Vincular compra a conta e
 * ato HUMANO. Se der zero, o proximo passo e `pagou_de_verdade.cjs` no
 * e-mail — nunca uma conclusao.
 *
 * SOMENTE LEITURA. Nao escreve em banco, nao manda e-mail, nao vincula nada.
 *
 * Uso:  node _frank/ferramentas/2026-09-20_achar_compra_por_nome.cjs "Nome Sobrenome"
 *       [--tudo]    imprime o balde inteiro do primeiro nome, nao so quem casou
 *       [--desde AAAA-MM-DD]  default 2024-01-01
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
const MAX_PAGINAS = 40;

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };

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

function linha(it) {
  const b = it.buyer || {}, p = it.product || {}, pu = it.purchase || {};
  const price = pu.price || {};
  const st = String(pu.status || it.status || "?").toUpperCase();
  const data = pu.order_date ? new Date(pu.order_date).toISOString().slice(0, 10) : "?";
  console.log(`  ${PAGO.has(st) ? "💰 PAGO " : "⬜ " + st.padEnd(8)} ${data}  ${String(price.value ?? "?").padStart(9)} ${price.currency_value ?? ""}`);
  console.log(`     comprador : ${b.name ?? "?"}`);
  console.log(`     E-MAIL    : ${b.email ?? "?"}   <<< o endereco REAL da compra`);
  console.log(`     produto   : ${p.name ?? "?"} (${p.id ?? "?"})`);
  console.log(`     transacao : ${pu.transaction ?? "?"}`);
  console.log("");
}

(async () => {
  const tudo = process.argv.includes("--tudo");
  // 2025-01-01 e o default por medicao, nao por gosto: com 2024-01-01 a API
  // devolve HTTP 400 "invalid_parameter" (janela longa demais). O erro sai
  // como FALHA DE INSTRUMENTO, nunca como "nao pagou" — ver o catch acima.
  const desde = arg("--desde") ?? "2025-01-01";
  const nome = process.argv.slice(2).filter((x, i, a) => !x.startsWith("--") && a[i - 1] !== "--desde")[0];
  if (!nome) {
    console.log('uso: node 2026-09-20_achar_compra_por_nome.cjs "Nome Sobrenome" [--tudo] [--desde AAAA-MM-DD]');
    process.exit(1);
  }

  const tokens = semAcento(nome).split(/\s+/).filter(Boolean);
  const primeiro = nome.trim().split(/\s+/)[0];
  const resto = tokens.slice(1);
  const ini = Date.parse(`${desde}T00:00:00Z`);
  const fim = Date.now();

  const H = { Authorization: `Bearer ${await token()}` };
  let pageToken = null, paginas = 0, itens = [], total = null;
  do {
    // SO o primeiro token + janela larga + paginacao. Ver o bloco ⛔ no topo:
    // qualquer um dos tres faltando devolve zero ou um pedaco, em silencio.
    const qs = `buyer_name=${encodeURIComponent(primeiro)}&start_date=${ini}&end_date=${fim}&max_results=50`
      + (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "");
    const r = await fetch(`${BASE}/sales/history?${qs}`, { headers: H });
    const raw = await r.text();
    if (!r.ok) {
      console.log(`\n❌ /sales/history HTTP ${r.status} na pagina ${paginas + 1}. ISTO NAO E "NAO PAGOU"`);
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
  } while (pageToken && paginas < MAX_PAGINAS);

  console.log(`\n🔎 HOTMART VIVA · balde buyer_name="${primeiro}" (SO o primeiro nome, de proposito)`);
  console.log(`   janela ${desde} → hoje · ${paginas} pagina(s) · ${itens.length} de ${total ?? "?"} compra(s) lidas`);
  if (pageToken) console.log(`   ⚠️  PAREI NO TETO DE ${MAX_PAGINAS} PAGINAS — o balde continua. Reduza a janela.`);
  console.log(`   casando o resto do nome aqui: [${resto.join(" ") || "(nada a casar)"}]\n`);

  const casaram = itens.filter((it) => {
    const n = semAcento(it.buyer && it.buyer.name);
    return resto.every((t) => n.includes(t));
  });

  if (casaram.length) {
    console.log(`✔ ${casaram.length} compra(s) com o nome inteiro batendo:\n`);
    casaram.forEach(linha);
  } else {
    console.log(`   NENHUMA das ${itens.length} compras do balde casou o nome inteiro.`);
    console.log(`   ⚠️  Isto NAO e "a pessoa nao pagou". Rode com --tudo pra ver o balde e`);
    console.log(`       confirme por e-mail com pagou_de_verdade.cjs antes de concluir.`);
    console.log(`       Em 20/09 um zero da versao quebrada deste script era R$ 733,60 pagos.\n`);
  }

  if (tudo && itens.length) {
    console.log(`── BALDE INTEIRO de "${primeiro}" (${itens.length}) ──\n`);
    itens.forEach(linha);
  }

  console.log(`⚠️  NOME NAO E CHAVE. Confira nome completo + produto + data antes de`);
  console.log(`    vincular qualquer coisa. Vincular compra a conta e ato humano.`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
