/**
 * "Esta pessoa PAGOU de verdade?" — a pergunta que já nos enganou.
 *
 * ⚠️ O ENGANO QUE ESTE SCRIPT EXISTE PARA IMPEDIR (18/08/2026):
 * a Hotmart emite a mensalidade de R$97 assim que o trial acaba e a deixa com
 * status OVERDUE para quem NUNCA pagou. Quem filtra só por `price.value > 0`
 * vê "R$97" e conclui "pagou". Isso levou a devolver 1.356.554 créditos a 14
 * pessoas que nunca pagaram. **O que decide é o `status`, não o valor.**
 *
 * Regra: pagou = price.value > 0  E  status IN (COMPLETE, APPROVED).
 *
 * ⚠️ O SEGUNDO ENGANO, medido em 31/08/2026 (incidente #173): este script
 * perguntava à Hotmart SOMENTE por `/subscriptions`. Compra AVULSA
 * (UNIQUE_PAYMENT / MULTIPLE_PAYMENTS) não é assinatura e NÃO aparece ali —
 * então ele imprimia **"NUNCA PAGOU" para quem pagou**, e o `payment_events`
 * (a "segunda fonte independente") também devolvia zero, o que fazia as duas
 * fontes concordarem no erro e o resultado parecer confirmado.
 * Medido lado a lado no mesmo dia:
 *   johnathan.ppires@gmail.com  → "NUNCA PAGOU" · R$ 2.391,00 APPROVED (3 compras)
 *   comercial@roteironamao.com  → "NUNCA PAGOU" · R$   185,61 APPROVED (2 compras)
 *   70rrosusa@gmail.com         → "NUNCA PAGOU" · R$   684,92 APPROVED (3 compras)
 * Com base nessa leitura nós pedimos a um aluno pagante, duas vezes, que
 * provasse uma compra que estava lá o tempo todo. **Zero de um endpoint que
 * não faz a pergunta certa não é "não pagou": é instrumento cego.**
 *
 * ⚠️ E NÃO COLAPSE OS DOIS FATOS NUM BIT SÓ. "Pagou a assinatura do
 * FastCloner" e "comprou um curso avulso" são coisas diferentes e decidem
 * coisas diferentes. Este script agora responde as duas SEPARADAS, de
 * propósito: quem for decidir crédito precisa saber QUAL das duas é o caso.
 * Um booleano único aqui foi exatamente o que produziu o engano.
 *
 * ⚠️ O TERCEIRO ENGANO, medido em 01/09/2026: as "3 fontes independentes"
 * eram TODAS a Hotmart de chapéu trocado (/subscriptions, payment_events
 * FILTRADO em provider='hotmart', /sales/history) — e mesmo assim o script
 * cravava **"NUNCA PAGOU (nenhuma das 3 fontes)"**, uma frase que soa
 * definitiva sobre a PESSOA quando o que ele mediu foi um E-MAIL num
 * provedor só. Duas correções entraram por causa disso:
 *
 *   (a) STRIPE É UMA SEGUNDA VIA DE DINHEIRO E ESTAVA INVISÍVEL. Contado com
 *       paginação de verdade em 01/09: 5.178 payment_events = 5.124 hotmart
 *       + 54 stripe (`checkout.session.completed`, pacotes de crédito avulso,
 *       R$19/42/78). O `.eq("provider","hotmart")` jogava os 54 fora. Quem
 *       comprou crédito pelo Stripe e nunca assinou pela Hotmart recebia
 *       "NUNCA PAGOU" com dinheiro nosso no caixa. (mercadopago existe no
 *       `check` da tabela e no type, mas tem 0 evento — não é via ativa.)
 *   (b) ⚠️ E O MODO DE FALHA QUE MAIS DÓI NÃO É PROVEDOR, É E-MAIL. Este
 *       script é indexado por e-mail; a pessoa compra num endereço e entra
 *       no app com outro, e aí ele responde a verdade sobre o endereço e uma
 *       MENTIRA sobre a pessoa. Os dois casos de 01/09 são isso, não Stripe:
 *         zicasantos37@gmail.com  → "nunca pagou" · pagou em zicasantos08@hotmail.com (#214)
 *         luciane.garcia19@gmail.com → "nunca pagou" · comprou em luciane.garcia@icloud.com (#218)
 *       Por isso o veredito negativo agora diz SEM PAGAMENTO **NESTE E-MAIL**
 *       e manda procurar a pessoa por nome/CPF/prefixo antes de decidir.
 *       Ausência numa fonte não é prova de ausência de pagamento.
 *
 * ⚠️ MODO DE TESTE DO STRIPE NÃO É PAGAMENTO. Entre 09/06 e 14/08 a chave
 * estava em modo de teste em produção e 12 alunos "compraram" com o cartão
 * 4242. Dos 54 eventos, 24 são `livemode=false` — e TODOS os 54 vêm com
 * `payment_status:"paid"`. Só conta como pago com livemode=true.
 *
 * Classifica por PESSOA, não por assinatura (a outra armadilha: alguém pode
 * ter uma segunda assinatura viva). Somente leitura — não toca em saldo.
 *
 * Uso:  node _frank/ferramentas/pagou_de_verdade.cjs email@aluno.com [outro@...]
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
const { supa } = require("./_comum.cjs");
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
const PAGO = new Set(["COMPLETE", "APPROVED"]);

/**
 * MOEDA — armadilha medida em 03/09, na ronda da Ruti (Assunção/PY).
 *
 * Este script imprimia `R$` fixo em TODA linha e somava valores de moedas
 * diferentes num único total. Para a Ruti, que pagou em guaranis, a saída foi:
 *
 *     PAGOU | avulsas pagas: 2 (R$ 918549.20)
 *     assinatura rec#1 R$118887 COMPLETE
 *
 * O valor real da assinatura dela é 118.887 Gs (~R$88). Quem lesse a linha
 * como reais concluiria "cliente de R$918 mil" — e qualquer soma de receita
 * que passasse por aqui ficaria envenenada. Não é caso isolado: medido na
 * nossa base, 247 de 4.142 eventos com preço (6%) NÃO são BRL —
 * 120 USD, 98 EUR, 7 PYG, 6 ARS, 5 JPY, 4 CHF, 3 GBP, 2 AUD, 2 CAD.
 * Em JPY o erro é o inverso e pior: ¥2.000 sairia como "R$2000".
 *
 * A regra passou a ser: valor NUNCA aparece sem a moeda ao lado, e total só
 * existe POR MOEDA. Nada de conversão — não temos câmbio da data e chutar
 * cotação para dizer número a aluno é pior que mostrar duas moedas.
 *
 * O veredito (`pagou`) não muda: ele olha `value > 0` + status, que independe
 * de moeda. O que estava errado era só o que a gente LIA na tela.
 */
function somarPorMoeda(itens) {
  const m = {};
  for (const i of itens) m[i.moeda || "?"] = (m[i.moeda || "?"] ?? 0) + (i.valor ?? 0);
  return m;
}

/** "118887 PYG" — valor colado na moeda, alinhado, sem inventar símbolo. */
function fmtValor(valor, moeda, largura = 10) {
  const n = Number(valor ?? 0);
  const txt = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${txt.padStart(largura)} ${String(moeda || "?").padEnd(3)}`;
}

/** { BRL: 97, PYG: 918549.2 } -> "97 BRL + 918549.20 PYG" */
function fmtMoeda(porMoeda) {
  const e = Object.entries(porMoeda || {}).filter(([, v]) => v);
  if (!e.length) return "";
  return e.map(([m, v]) => `${Number.isInteger(v) ? v : v.toFixed(2)} ${m}`).join(" + ");
}

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  const t = JSON.parse(raw).access_token;
  if (!t) throw new Error(`sem access_token (HTTP ${r.status})`);
  return t;
}

/** Devolve { pagou, cobrancas, pagas, erro } para um e-mail. */
async function pagouDeVerdade(email, H, db) {
  email = email.toLowerCase();
  const rs = await fetch(`${BASE}/subscriptions?subscriber_email=${encodeURIComponent(email)}`, { headers: H });
  const rawS = await rs.text();
  let subs;
  // zero de um endpoint não é prova: se não parsear, devolve o corpo cru
  try { const j = JSON.parse(rawS); subs = j.items || (Array.isArray(j) ? j : []); }
  catch { return { erro: `subscriptions HTTP ${rs.status}: ${rawS.slice(0, 150)}` }; }

  const cobrancas = [];
  for (const s of subs) {
    const code = s.subscriber_code || s.subscriber?.code || s.code;
    if (!code) continue;
    const rp = await fetch(`${BASE}/subscriptions/${code}/purchases`, { headers: H });
    const rawP = await rp.text();
    let lista;
    try { const j = JSON.parse(rawP); lista = Array.isArray(j) ? j : (j.items || []); } // array PURO
    catch { return { erro: `purchases ${code} HTTP ${rp.status}: ${rawP.slice(0, 150)}` }; }
    for (const c of lista) cobrancas.push({
      code,
      valor: c.price?.value ?? 0,
      moeda: c.price?.currency_value || c.price?.currency_code || "?",
      status: c.status,
      rec: c.recurrency_number ?? c.recurrence_number,
      data: c.approved_date ? new Date(c.approved_date).toISOString().slice(0, 10) : null,
    });
  }
  const pagas = cobrancas.filter((c) => c.valor > 0 && PAGO.has(c.status));

  // segunda fonte, independente: o nosso próprio banco
  const { data: evs, error } = await db.from("payment_events")
    .select("event_type,payload").eq("provider", "hotmart")
    .or(`payload->data->buyer->>email.ilike.${email}`);
  if (error) return { erro: `payment_events: ${error.message}` };
  const aprovados = (evs || []).filter((ev) => ev.event_type === "PURCHASE_APPROVED"
    && (ev.payload?.data?.purchase?.price?.value ?? 0) > 0);

  // QUARTA fonte, e a única que NÃO é Hotmart: STRIPE (pacotes de crédito
  // avulso). Sem ela as "3 fontes" eram a mesma fonte de chapéu trocado.
  // O e-mail do Stripe fica em data.object.customer_email (a coluna
  // buyer_email vem NULL nesses eventos — não dá para filtrar por ela).
  const { data: stripeEvs, error: errStripe } = await db.from("payment_events")
    .select("event_id,received_at,payload").eq("provider", "stripe")
    .filter("payload->data->object->>customer_email", "ilike", email);
  if (errStripe) return { erro: `payment_events(stripe): ${errStripe.message}` };
  const stripePagas = (stripeEvs || []).map((ev) => {
    const o = ev.payload?.data?.object ?? {};
    return {
      sessao: o.id,
      valor: (o.amount_total ?? 0) / 100, // Stripe manda em centavos
      moeda: (o.currency ?? "").toUpperCase(),
      status: o.payment_status,
      // livemode=false = cartão 4242 do modo de teste: NÃO é dinheiro (14/08)
      live: o.livemode === true || ev.payload?.livemode === true,
      creditos: Number(o.metadata?.credits ?? 0) || null,
      data: ev.received_at ? ev.received_at.slice(0, 10) : null,
    };
  }).filter((s) => s.status === "paid" && s.valor > 0 && s.live);
  const totalStripePorMoeda = somarPorMoeda(stripePagas);
  const totalStripe = stripePagas.reduce((s, v) => s + v.valor, 0);

  // TERCEIRA fonte, e a que faltava: VENDAS. É aqui que mora a compra avulsa,
  // que /subscriptions não conhece. Sem esta pergunta o script mente (#173).
  const rv = await fetch(`${BASE}/sales/history?buyer_email=${encodeURIComponent(email)}&max_results=50`, { headers: H });
  const rawV = await rv.text();
  let vendasBrutas;
  // mesma disciplina do resto: zero que veio de falha NÃO pode virar "não pagou"
  if (!rv.ok) return { erro: `sales/history HTTP ${rv.status}: ${rawV.slice(0, 150)}` };
  try { const j = JSON.parse(rawV); vendasBrutas = j.items || (Array.isArray(j) ? j : []); }
  catch { return { erro: `sales/history não-JSON (HTTP ${rv.status}): ${rawV.slice(0, 150)}` }; }

  const vendas = vendasBrutas.map((i) => ({
    produto: (i.product?.name ?? "").trim() || "(sem nome)",
    valor: i.purchase?.price?.value ?? 0,
    moeda: i.purchase?.price?.currency_value || i.purchase?.price?.currency_code || "?",
    status: i.purchase?.status,
    modo: i.purchase?.offer?.payment_mode,
    // is_subscription vem da Hotmart; só tratamos como avulsa quando ela diz
    // explicitamente que NÃO é assinatura — undefined não vira "avulsa".
    avulsa: i.purchase?.is_subscription === false,
    transacao: i.purchase?.transaction,
    data: i.purchase?.approved_date ? new Date(i.purchase.approved_date).toISOString().slice(0, 10) : null,
  }));
  const vendasPagas = vendas.filter((v) => v.valor > 0 && PAGO.has(v.status));
  const avulsasPagas = vendasPagas.filter((v) => v.avulsa);
  const totalAvulsoPorMoeda = somarPorMoeda(avulsasPagas);
  // mantido só para quem já lia esta chave; é a soma CRUA, sem moeda. Não use
  // para dizer valor a ninguém — use `totalAvulsoPorMoeda`.
  const totalAvulso = avulsasPagas.reduce((s, v) => s + v.valor, 0);

  return {
    // os TRÊS fatos, SEPARADOS de propósito — ver o cabeçalho
    pagouAssinatura: pagas.length > 0 || aprovados.length > 0,
    pagouAvulso: avulsasPagas.length > 0,
    pagouCreditoStripe: stripePagas.length > 0,
    // mantido para quem só quer saber "entrou dinheiro DESTE E-MAIL?"
    pagou: pagas.length > 0 || aprovados.length > 0 || avulsasPagas.length > 0
      || stripePagas.length > 0,
    assinaturas: subs.length,
    cobrancas,
    pagas,
    aprovadosNoBanco: aprovados.length,
    vendas,
    avulsasPagas,
    totalAvulso,
    totalAvulsoPorMoeda,
    stripePagas,
    totalStripe,
    totalStripePorMoeda,
  };
}

module.exports = { pagouDeVerdade, PAGO, somarPorMoeda, fmtMoeda, fmtValor };

if (require.main === module) (async () => {
  const emails = process.argv.slice(2);
  if (!emails.length) return console.log("uso: node pagou_de_verdade.cjs email@aluno.com [...]");
  const H = { Authorization: `Bearer ${await token()}` }, db = supa();
  for (const e of emails) {
    const r = await pagouDeVerdade(e, H, db);
    console.log("\n" + "=".repeat(70));
    if (r.erro) { console.log(`${e}\n  ERRO: ${r.erro}`); continue; }
    // ⚠️ O veredito negativo NÃO é sobre a pessoa — é sobre ESTE E-MAIL nas
    // fontes que sabemos consultar. Dizer "NUNCA PAGOU" aqui já nos fez negar
    // liberação a duas alunas que tinham pago noutro endereço (#214, #218).
    const comprou = [
      r.pagouAssinatura ? "assinatura" : null,
      r.pagouAvulso ? "compra avulsa" : null,
      r.pagouCreditoStripe ? "créditos no Stripe" : null,
    ].filter(Boolean);
    const veredito = r.pagou
      ? `PAGOU — ${comprou.join(" + ")}`
      : "SEM PAGAMENTO ENCONTRADO NESTE E-MAIL (hotmart + stripe)";
    console.log(`${e}\n  ${veredito}`
      + ` | assinaturas: ${r.assinaturas} | PURCHASE_APPROVED>0 no nosso banco: ${r.aprovadosNoBanco}`
      + ` | avulsas pagas: ${r.avulsasPagas.length}${fmtMoeda(r.totalAvulsoPorMoeda) ? ` (${fmtMoeda(r.totalAvulsoPorMoeda)})` : ""}`
      + ` | stripe pago: ${r.stripePagas.length}${fmtMoeda(r.totalStripePorMoeda) ? ` (${fmtMoeda(r.totalStripePorMoeda)})` : ""}`);
    // moeda SEMPRE ao lado do valor — ver o bloco MOEDA no topo do arquivo
    const moedas = new Set([...r.cobrancas, ...r.vendas, ...r.stripePagas]
      .filter((x) => x.valor > 0).map((x) => x.moeda || "?"));
    if (moedas.size > 1 || (moedas.size === 1 && !moedas.has("BRL"))) {
      console.log(`    ⚠️  moeda diferente de real nesta conta: ${[...moedas].join(", ")}.`
        + " Os valores abaixo NAO sao reais e NAO foram convertidos — leia a moeda ao lado.");
    }
    for (const c of r.cobrancas) {
      console.log(`    assinatura rec#${c.rec} ${fmtValor(c.valor, c.moeda, 9)} ${String(c.status).padEnd(16)} ${c.data ?? ""}`
        + `${c.valor > 0 && !PAGO.has(c.status) ? "   <-- cobranca EXISTE mas NAO foi paga" : ""}`);
    }
    for (const v of r.vendas) {
      console.log(`    venda     ${(v.avulsa ? "AVULSA" : "assin.").padEnd(7)} ${fmtValor(v.valor, v.moeda)}`
        + ` ${String(v.status).padEnd(16)} ${v.data ?? "sem data"} ${v.transacao ?? ""} ${v.produto}`
        + `${v.valor > 0 && !PAGO.has(v.status) ? "   <-- venda EXISTE mas NAO foi paga" : ""}`);
    }
    for (const s of r.stripePagas) {
      console.log(`    stripe    CREDITO ${fmtValor(s.valor, s.moeda)}`
        + ` ${String(s.status).padEnd(16)} ${s.data ?? "sem data"} ${s.sessao ?? ""}`
        + `${s.creditos ? ` ${s.creditos} creditos` : ""}`);
    }
    if (!r.pagou) {
      console.log("    ⚠️  Isto NAO quer dizer 'a pessoa nunca pagou'. Quer dizer que ESTE ENDERECO"
        + " nao tem pagamento na Hotmart nem no Stripe. O erro que mais nos pegou e a pessoa"
        + " comprar num e-mail e entrar no app com outro (#214 zicasantos37/zicasantos08,"
        + " #218 luciane.garcia19/luciane.garcia@icloud). ANTES de negar qualquer coisa ao aluno:"
        + " procure por NOME, CPF e prefixo do e-mail em profiles/payment_events/entitlements,"
        + " e confira o comprovante que ele mandou (valor + data batem com full_price).");
    }
    if (r.pagouAvulso && !r.pagouAssinatura) {
      console.log("    ⚠️  Esta pessoa PAGOU, mas nao pela assinatura do FastCloner."
        + " O que a compra avulsa da direito no FastCloner e decisao COMERCIAL, nao de script:"
        + " leve a gente. Nao trate como 'nunca pagou' (#173).");
    }
  }
})();
