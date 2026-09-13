/**
 * RAIO PAGANTE REAL — quebra o número bruto do `_Bugs/prova_raio.cjs` em três
 * grupos que decidem coisas DIFERENTES, e nunca num bit só.
 *
 *   node _frank/ferramentas/raio_pagante_real.cjs [opções]
 *
 * ── POR QUE ESTA FERRAMENTA EXISTE (13/09/2026) ───────────────────────────
 * O `prova_raio.cjs` mede "entitlement active + saldo > 0 + access_until
 * vencido" e imprime UM número (147 em 18/08, 231 em 13/09). O próprio rodapé
 * dele avisa que "pagante" ali é o NOME do script, não um fato.
 *
 * Já existiam duas decomposições, e NENHUMA responde a pergunta deste script:
 *
 *   • `raio_honesto.cjs` separa "nunca pagou" de "pagou" — mas o lado "pagou"
 *     é `payment_events.PURCHASE_APPROVED` com valor > 0, de QUALQUER produto.
 *     Comprar o curso avulso (FCI/SGP) gera PURCHASE_APPROVED. Então o balde
 *     "PAGARAM de verdade" dele mistura assinante do FastCloner com aluno que
 *     só comprou curso — que é exatamente a confusão que o
 *     `pagou_de_verdade.cjs` documenta no cabeçalho e manda NÃO fazer.
 *   • `pagante_trancado.cjs` confere na Hotmart pelo `subscriber_code` do
 *     `raw_event` e classifica pelo status da assinatura. Também não separa
 *     compra avulsa, e pula quem não tem code no payload.
 *
 * Amostra manual de 6 dos 231 (13/09) que motivou o cartão: 5 de 6 pagaram
 * dinheiro real, mas só 1 de 6 pagou a ASSINATURA. Ler os 231 como "pagantes
 * trancados" é errado por um fator de ~6.
 *
 * ── OS TRÊS GRUPOS ────────────────────────────────────────────────────────
 *   (a) PAGOU A ASSINATURA  → cobrança de assinatura com valor > 0 e status
 *       COMPLETE/APPROVED na Hotmart. Sem acesso e com saldo parado, ESTE é o
 *       problema real: regra 9 diz que o crédito é deles.
 *   (b) PAGOU SÓ AVULSO     → curso (FCI/SGP) ou pacote de crédito no Stripe.
 *       Dinheiro real, mas não é assinatura. O que a compra avulsa dá direito
 *       é decisão COMERCIAL, não de script (#173). Só listar.
 *   (c) SEM PAGAMENTO NESTE E-MAIL → trial R$0 vencido com crédito residual.
 *       Trancar está certo (ordem do Johnny 13/08).
 *   (d) INDETERMINADO       → a consulta FALHOU. Nunca vira (c).
 *
 * ── ARMADILHAS QUE ESTE SCRIPT EVITA (todas já custaram caro aqui) ────────
 *  1. ZERO DE ENDPOINT CEGO NÃO É "NÃO PAGOU". Pular `/sales/history` fez o
 *     script dizer "NUNCA PAGOU" para quem tinha R$2.391 APPROVED (#173).
 *     Aqui a decisão é sempre do `pagou_de_verdade.cjs`, com as 4 fontes, e
 *     qualquer `erro` dele manda o e-mail para (d) — nunca para (c).
 *  2. `.error` DE TODA CONSULTA CONFERIDO antes de acreditar em qualquer zero
 *     (armadilha 1 do _frank/03: coluna inexistente devolve `data:null`).
 *  3. PAGINAÇÃO DE VERDADE. O PostgREST corta em 1000 linhas mesmo com
 *     `.limit(20000)`. O `prova_raio.cjs` e o `pagante_trancado.cjs` leem
 *     `entitlements` SEM paginar: acima de 1000 linhas `active` eles medem um
 *     teto, não a base. Aqui tudo pagina com `.range()` + ordem estável.
 *  4. NADA DE DATA CHUMBADA. O `prova_raio.cjs` já imprimiu "EXPIRARAM HOJE:
 *     0" por dez dias com a data fixa em "2026-08-18" (comentário linha 31).
 *     Aqui só existe `new Date()`, carimbado no cabeçalho da saída.
 *  5. `credits_extra` NÃO É "CRÉDITO COMPRADO". Medido em 13/09 no
 *     `credit_transactions`: `kind='extra_purchase'` cobre estorno de treino,
 *     estorno de vídeo/imagem, cortesia, bônus de desculpa, admin_grant e
 *     stock_seed — compra mesmo é só `ref_type='stripe_session'`. Por isso o
 *     relatório mostra a PROCEDÊNCIA do saldo, em vez de chamar a coluna de
 *     "comprado".
 *  6. TOKEN EXPIRA NO MEIO DE 231 CHAMADAS. HTTP 401/403/429/5xx renova o
 *     token e repete com espera; só depois de 3 tentativas vira (d).
 *
 * ── O QUE ESTE SCRIPT NÃO FAZ ─────────────────────────────────────────────
 * NÃO mexe em saldo, acesso, entitlement nem status. Regra 9-A: detector
 * propõe, nunca executa. A saída é uma LISTA para um humano decidir.
 *
 * Opções:
 *   --limite N       só os N primeiros do bruto (para testar rápido)
 *   --sem-cache      ignora o cache e rebate na Hotmart
 *   --cache-horas H  validade do cache (padrão 24)
 *   --saida ARQUIVO  onde gravar o relatório completo
 *                    (padrão _frank/prova/<data>_raio_pagante_real.md)
 */
const fs = require("node:fs");
const path = require("node:path");
const { supa, RAIZ } = require("./_comum.cjs");
const { pagouDeVerdade, PAGO, fmtMoeda } = require("./pagou_de_verdade.cjs");

/* ------------------------------------------------------------------ */
/* argumentos                                                          */
/* ------------------------------------------------------------------ */
const ARGV = process.argv.slice(2);
const opt = (nome, padrao = null) => {
  const i = ARGV.indexOf(nome);
  return i >= 0 && ARGV[i + 1] !== undefined ? ARGV[i + 1] : padrao;
};
const flag = (nome) => ARGV.includes(nome);

const LIMITE = Number(opt("--limite", "0")) || 0;
const SEM_CACHE = flag("--sem-cache");
const CACHE_HORAS = Number(opt("--cache-horas", "24")) || 24;
const AGORA = new Date();
const HOJE = AGORA.toISOString().slice(0, 10); // nunca chumbado — armadilha 4
const SAIDA = opt("--saida", path.join(RAIZ, "_frank", "prova", `${HOJE}_raio_pagante_real.md`));

const PASTA_CACHE = path.join(__dirname, ".cache");
const ARQ_CACHE = path.join(PASTA_CACHE, "raio_pagante_real.json");

/* ------------------------------------------------------------------ */
/* leitura paginada — armadilha 3                                      */
/* ------------------------------------------------------------------ */

/**
 * Pagina até a página curta. Ordem estável (coluna + id de desempate) para que
 * um insert concorrente não desloque uma página já lida. Erro sobe cru: lista
 * parcial silenciosa é pior que falha.
 */
async function paginar(db, tabela, cols, filtros = (q) => q, ordem = "id") {
  let tudo = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtros(db.from(tabela).select(cols))
      .order(ordem, { ascending: true })
      .range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`); // armadilha 2
    tudo = tudo.concat(data ?? []);
    if ((data ?? []).length < 1000) return tudo;
    if (de > 400000) throw new Error(`${tabela}: paginação sem fim`);
  }
}

/** `.in(coluna, ids)` em lotes, cada lote paginado (um lote pode passar de 1000). */
async function paginarIn(db, tabela, cols, coluna, ids, filtros = (q) => q, ordem = "id") {
  let tudo = [];
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    tudo = tudo.concat(
      await paginar(db, tabela, cols, (q) => filtros(q).in(coluna, lote), ordem),
    );
  }
  return tudo;
}

/* ------------------------------------------------------------------ */
/* Hotmart: token com renovação + repetição                            */
/* ------------------------------------------------------------------ */
async function tokenHotmart() {
  const u =
    `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, {
    method: "POST",
    headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` },
  });
  const raw = await r.text();
  let j;
  try { j = JSON.parse(raw); } catch { throw new Error(`token não-JSON (HTTP ${r.status}): ${raw.slice(0, 150)}`); }
  if (!j.access_token) throw new Error(`sem access_token (HTTP ${r.status}): ${raw.slice(0, 150)}`);
  return j.access_token;
}

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
/** erro que pede nova tentativa (token velho, limite de taxa, tropeço do lado deles) */
const valeRepetir = (msg) => /HTTP (401|403|408|429|5\d\d)\b/.test(String(msg));

/**
 * `pagouDeVerdade` com renovação de token e 3 tentativas. Devolve o objeto
 * dele; se sair com `erro` depois das tentativas, quem chama manda para (d).
 * `H` é mutado no lugar de propósito: a mesma referência circula por todas as
 * chamadas seguintes, então renovar aqui conserta o resto da varredura.
 */
async function consultarComRepeticao(email, H, db) {
  let ultimo = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const r = await pagouDeVerdade(email, H, db);
    if (!r.erro) return r;
    ultimo = r;
    if (!valeRepetir(r.erro)) return r; // erro que repetir não conserta
    await dorme(1500 * tentativa);
    try { H.Authorization = `Bearer ${await tokenHotmart()}`; }
    catch (e) { return { erro: `${r.erro} | e a renovação do token também falhou: ${e.message}` }; }
  }
  return ultimo;
}

/* ------------------------------------------------------------------ */
/* cache em disco — só sucesso, nunca erro                             */
/* ------------------------------------------------------------------ */
function lerCache() {
  if (SEM_CACHE) return {};
  try { return JSON.parse(fs.readFileSync(ARQ_CACHE, "utf8")); } catch { return {}; }
}
function gravarCache(cache) {
  fs.mkdirSync(PASTA_CACHE, { recursive: true });
  // o cache carrega e-mail de aluno: não entra no git, e a pasta se protege sozinha
  const gi = path.join(PASTA_CACHE, ".gitignore");
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, "*\n");
  fs.writeFileSync(ARQ_CACHE, JSON.stringify(cache));
}
const cacheVivo = (e) => e && AGORA - new Date(e.ts) < CACHE_HORAS * 3600000;

/* ------------------------------------------------------------------ */
/* classificação                                                       */
/* ------------------------------------------------------------------ */

/**
 * Decide o grupo de UMA pessoa a partir do resultado do `pagou_de_verdade`.
 *
 * ⚠️ A prova de "pagou a ASSINATURA" é a cobrança vinda de
 * `/subscriptions/{code}/purchases` (`r.pagas`) ou uma venda paga que a
 * própria Hotmart marca como NÃO-avulsa em `/sales/history`.
 * `aprovadosNoBanco` (PURCHASE_APPROVED no nosso `payment_events`) NÃO entra
 * na decisão: ele não distingue produto, e é justamente por isso que o
 * `raio_honesto.cjs` mistura assinante com comprador de curso. Quando ele diz
 * "pagou" e as fontes da Hotmart não mostram assinatura, o caso sai marcado
 * como DIVERGÊNCIA para um humano olhar — não é resolvido no chute.
 */
function classificar(r) {
  if (r.erro) return { grupo: "d", motivo: r.erro };

  const assinaturasPagas = r.pagas ?? [];
  const vendasAssinaturaPagas = (r.vendas ?? []).filter(
    (v) => v.valor > 0 && PAGO.has(v.status) && v.avulsa === false,
  );
  const pagouAssinatura = assinaturasPagas.length > 0 || vendasAssinaturaPagas.length > 0;

  if (pagouAssinatura) {
    return {
      grupo: "a",
      assinaturasPagas,
      vendasAssinaturaPagas,
      produtos: [...new Set(vendasAssinaturaPagas.map((v) => v.produto))],
    };
  }

  const avulsas = r.avulsasPagas ?? [];
  const stripe = r.stripePagas ?? [];
  if (avulsas.length || stripe.length) {
    return {
      grupo: "b",
      avulsas,
      stripe,
      produtos: [...new Set(avulsas.map((v) => v.produto))],
      // dinheiro no nosso banco sem assinatura visível na Hotmart: olho humano
      divergencia: r.aprovadosNoBanco > 0
        ? `${r.aprovadosNoBanco} PURCHASE_APPROVED>0 no nosso banco sem assinatura paga na Hotmart`
        : null,
    };
  }

  if (r.aprovadosNoBanco > 0) {
    // nem assinatura, nem avulsa, nem stripe — mas o nosso banco viu dinheiro.
    // Isso é contradição entre fontes, não é "nunca pagou".
    return { grupo: "d", motivo: `DIVERGÊNCIA: ${r.aprovadosNoBanco} PURCHASE_APPROVED>0 no nosso banco e nada na Hotmart` };
  }
  return { grupo: "c" };
}

/* ------------------------------------------------------------------ */
/* procedência do saldo — armadilha 5                                  */
/* ------------------------------------------------------------------ */
const COMPRA_DE_VERDADE = new Set(["stripe_session"]); // crédito avulso pago
const DA_ASSINATURA = new Set(["payment_event"]);      // recarga do ciclo pago

function resumoProcedencia(linhas) {
  const porTipo = {};
  for (const t of linhas) {
    const k = `${t.kind}/${t.ref_type ?? "-"}`;
    porTipo[k] = (porTipo[k] ?? 0) + (t.amount ?? 0);
  }
  return {
    porTipo,
    comprado: linhas.filter((t) => COMPRA_DE_VERDADE.has(t.ref_type)).reduce((s, t) => s + (t.amount ?? 0), 0),
    daAssinatura: linhas.filter((t) => DA_ASSINATURA.has(t.ref_type)).reduce((s, t) => s + (t.amount ?? 0), 0),
    outros: linhas
      .filter((t) => !COMPRA_DE_VERDADE.has(t.ref_type) && !DA_ASSINATURA.has(t.ref_type))
      .reduce((s, t) => s + (t.amount ?? 0), 0),
  };
}

/* ------------------------------------------------------------------ */
/* principal                                                           */
/* ------------------------------------------------------------------ */
(async () => {
  const db = supa();
  const linhas = []; // relatório completo em arquivo (a tela trunca)
  const P = (s = "") => { console.log(s); linhas.push(s); };

  P(`RAIO PAGANTE REAL — rodado em ${AGORA.toISOString()}`);
  P(`(somente leitura: nada de saldo, acesso ou status é tocado)`);
  P();

  // 1. entitlements, paginado
  // `id` existe e é único nas duas tabelas — serve de ordem estável sem desempate extra
  const ents = await paginar(db, "entitlements", "id,user_id,status,access_until,product_code");
  const ativos = ents.filter((e) => e.status === "active" && e.user_id && e.user_id !== "null");
  const porUsuario = new Map();
  for (const e of ativos) {
    const p = porUsuario.get(e.user_id);
    if (!p || String(e.access_until) > String(p.access_until)) porUsuario.set(e.user_id, e);
  }
  const ids = [...porUsuario.keys()];
  P(`entitlements: ${ents.length} linhas · ${ids.length} pessoas com linha 'active'`);

  // 2. perfis
  let perfis = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("profiles")
      .select("id,email,access_until,credits_subscription,credits_extra")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error(`profiles: ${error.message}`); // armadilha 2
    perfis = perfis.concat(data ?? []);
  }
  if (perfis.length !== ids.length) {
    P(`⚠️  perfis: pedi ${ids.length}, vieram ${perfis.length} — os números abaixo são PISO`);
  }

  // 3. o bruto: a MESMA conta do prova_raio.cjs, para os números serem comparáveis
  const saldoDe = (p) => (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  let bruto = perfis
    .filter((p) => saldoDe(p) > 0 && (!p.access_until || new Date(p.access_until) <= AGORA))
    .sort((a, b) => saldoDe(b) - saldoDe(a));
  const brutoTotal = bruto.length;
  P(`\n>>> BRUTO (o número do prova_raio.cjs, hoje): ${brutoTotal}`);
  if (LIMITE && bruto.length > LIMITE) {
    P(`⚠️  --limite ${LIMITE}: conferindo só ${LIMITE} de ${brutoTotal}. NÃO é a medição completa.`);
    bruto = bruto.slice(0, LIMITE);
  }

  // 4. procedência do saldo (armadilha 5) — crédito é do aluno? de onde veio?
  const trans = await paginarIn(
    db, "credit_transactions", "id,user_id,kind,ref_type,amount",
    "user_id", bruto.map((p) => p.id), (q) => q.gt("amount", 0),
  );
  const transPorUsuario = new Map();
  for (const t of trans) {
    if (!transPorUsuario.has(t.user_id)) transPorUsuario.set(t.user_id, []);
    transPorUsuario.get(t.user_id).push(t);
  }
  P(`créditos: ${trans.length} lançamentos positivos lidos para as ${bruto.length} pessoas`);

  // 5. Hotmart + Stripe, um a um, serializado e com cache
  const cache = lerCache();
  const H = { Authorization: `Bearer ${await tokenHotmart()}` };
  const res = { a: [], b: [], c: [], d: [] };
  let doCache = 0;

  P(`\nconferindo ${bruto.length} e-mail(s) na Hotmart + Stripe…`);
  for (let i = 0; i < bruto.length; i++) {
    const p = bruto[i];
    const email = (p.email ?? "").toLowerCase();
    if (!email) {
      res.d.push({ p, motivo: "perfil sem e-mail" });
      continue;
    }

    let r;
    if (cacheVivo(cache[email])) { r = cache[email].r; doCache++; }
    else {
      r = await consultarComRepeticao(email, H, db);
      if (!r.erro) {            // ⚠️ erro NUNCA entra no cache
        cache[email] = { ts: AGORA.toISOString(), r };
        gravarCache(cache);     // grava a cada acerto: queda no meio não perde a varredura
      }
      await dorme(150);
    }

    const c = classificar(r);
    res[c.grupo].push({ p, r, c, proc: resumoProcedencia(transPorUsuario.get(p.id) ?? []) });
    if ((i + 1) % 25 === 0) P(`  … ${i + 1}/${bruto.length}`);
  }
  P(`  (${doCache} vindo(s) do cache, ${bruto.length - doCache} consultado(s) ao vivo)`);

  /* --------------------------- saída --------------------------- */
  const fmtSaldo = (p) =>
    `${saldoDe(p).toLocaleString("pt-BR")} cred (${(p.credits_subscription ?? 0).toLocaleString("pt-BR")} plano`
    + ` + ${(p.credits_extra ?? 0).toLocaleString("pt-BR")} extra)`;
  const venceu = (p) => (p.access_until ? String(p.access_until).slice(0, 10) : "nunca teve access_until");
  // o produto da linha de entitlement: 7851642 = assinatura FastCloner, 7283229 = SGP.
  // Mostrado como EVIDÊNCIA, nunca como classificador — quem decide é a Hotmart.
  const produtoEnt = (p) => porUsuario.get(p.id)?.product_code ?? "?";
  const T = (t) => { P(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); };

  T(`🔴 (a) PAGOU A ASSINATURA, está sem acesso e com saldo parado: ${res.a.length}`);
  P(`    Regra 9: o crédito é deles. ESTE é o grupo que decide alguma coisa.`);
  for (const x of res.a) {
    P(`\n  ${x.p.email} | venceu ${venceu(x.p)} | ${fmtSaldo(x.p)} | entitlement do produto ${produtoEnt(x.p)}`);
    if (x.proc.comprado > 0) P(`     crédito COMPRADO (stripe_session): ${x.proc.comprado.toLocaleString("pt-BR")}`);
    if (x.proc.daAssinatura > 0) P(`     crédito de recarga da assinatura: ${x.proc.daAssinatura.toLocaleString("pt-BR")}`);
    if (x.proc.outros > 0) P(`     crédito de estorno/cortesia/admin: ${x.proc.outros.toLocaleString("pt-BR")}`);
    for (const c of x.c.assinaturasPagas) P(`     assinatura rec#${c.rec} ${c.valor} ${c.moeda} ${c.status} ${c.data ?? ""}`);
    for (const v of x.c.vendasAssinaturaPagas) P(`     venda assinatura ${v.valor} ${v.moeda} ${v.status} ${v.data ?? ""} — ${v.produto}`);
    P(`     ⚠️  confira o PRODUTO acima: assinatura paga de OUTRO produto não é assinatura do FastCloner.`);
  }
  if (!res.a.length) P(`  (nenhum)`);

  T(`🟡 (b) PAGOU SÓ AVULSO (curso ou crédito no Stripe), sem assinatura: ${res.b.length}`);
  P(`    Dinheiro real, mas o que a compra avulsa dá direito é decisão COMERCIAL (#173).`);
  P(`    Este script só LISTA. Não trate como "nunca pagou".`);
  for (const x of res.b) {
    const av = x.c.avulsas.length ? `avulsas: ${x.c.avulsas.length} (${fmtMoeda(x.r.totalAvulsoPorMoeda)})` : "";
    const st = x.c.stripe.length ? `stripe: ${x.c.stripe.length} (${fmtMoeda(x.r.totalStripePorMoeda)})` : "";
    P(`  ${x.p.email} | venceu ${venceu(x.p)} | ${fmtSaldo(x.p)} | ${[av, st].filter(Boolean).join(" · ")}`);
    if (x.c.produtos.length) P(`     produtos: ${x.c.produtos.join(" · ")}`);
    if (x.proc.comprado > 0) P(`     crédito COMPRADO (stripe_session): ${x.proc.comprado.toLocaleString("pt-BR")} — dinheiro nosso no caixa`);
    if (x.c.divergencia) P(`     ⚠️  ${x.c.divergencia} — olho humano`);
  }
  if (!res.b.length) P(`  (nenhum)`);

  T(`⚪ (c) SEM PAGAMENTO NESTE E-MAIL — trial vencido, trancar está certo: ${res.c.length}`);
  P(`    ⚠️  "neste e-mail", não "esta pessoa": comprar num endereço e entrar com`);
  P(`    outro já nos fez negar liberação a duas alunas que tinham pago (#214, #218).`);
  P(`    Antes de negar qualquer coisa a um aluno DESTA lista, procure por nome,`);
  P(`    CPF e prefixo do e-mail. (lista completa no arquivo do relatório)`);
  for (const x of res.c.slice(0, 15)) P(`  ${x.p.email} | venceu ${venceu(x.p)} | ${fmtSaldo(x.p)}`);
  if (res.c.length > 15) P(`  … e mais ${res.c.length - 15} (todos no arquivo)`);

  T(`⚠️ (d) INDETERMINADO — a consulta falhou, NÃO é "não pagou": ${res.d.length}`);
  for (const x of res.d) P(`  ${x.p.email ?? x.p.id}: ${x.c?.motivo ?? x.motivo}`);
  if (!res.d.length) P(`  (nenhum — todos os e-mails foram conferidos)`);

  T("NÚMEROS PRO RELATÓRIO");
  P(`  bruto do prova_raio.cjs .................. ${brutoTotal}`);
  if (LIMITE && brutoTotal > LIMITE) P(`  conferidos nesta rodada (--limite) ........ ${bruto.length}`);
  P(`  (a) pagou a ASSINATURA e está sem acesso .. ${res.a.length}`);
  P(`  (b) pagou só AVULSO ....................... ${res.b.length}`);
  P(`  (c) sem pagamento neste e-mail ............ ${res.c.length}`);
  P(`  (d) INDETERMINADO ......................... ${res.d.length}`);
  if (res.d.length) P(`  ⚠️  com ${res.d.length} indeterminado(s), (a) é PISO e (c) é TETO.`);
  P(`\n  crédito parado em (a): ${res.a.reduce((s, x) => s + saldoDe(x.p), 0).toLocaleString("pt-BR")}`);
  P(`  crédito parado em (b): ${res.b.reduce((s, x) => s + saldoDe(x.p), 0).toLocaleString("pt-BR")}`);
  P(`  crédito parado em (c): ${res.c.reduce((s, x) => s + saldoDe(x.p), 0).toLocaleString("pt-BR")}`);

  // lista completa de (c) só no arquivo — a tela não aguenta 200 linhas
  linhas.push(`\n\n## (c) lista completa — ${res.c.length}`);
  for (const x of res.c) linhas.push(`  ${x.p.email} | venceu ${venceu(x.p)} | ${fmtSaldo(x.p)}`);

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, linhas.join("\n") + "\n");
  console.log(`\nrelatório completo: ${SAIDA}`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
