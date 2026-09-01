/**
 * CANCELAMENTOS DE ONTEM — quem saiu, era trial ou pagante, e o que aconteceu
 * com o crédito dela. SOMENTE LEITURA: este script NUNCA mexe em saldo.
 * Quem age é a varredura `expire_trial_credits` (sweep de 5min). Aqui só se
 * confere se a regra 9 do `01_REGRAS_DURAS.md` está sendo cumprida.
 *
 * A regra que está sendo auditada (Johnny + Lucas, 18/08):
 *   TRIAL que saiu sem nunca pagar  -> credits_subscription EXPIRA no dia 10
 *                                      da adesão (7 de teste + 3 de carência).
 *   ASSINANTE que pagou e cancelou  -> MANTÉM o crédito do ciclo já pago.
 *   ESTORNO / chargeback            -> zera (o dinheiro voltou pra pessoa).
 *   credits_extra                   -> NUNCA é tocado por nenhuma das três.
 *
 * ⚠️ ARMADILHA 1 (custou 1.356.554 créditos em 18/08): a Hotmart emite a
 * mensalidade e a deixa OVERDUE pra quem NUNCA pagou. Filtrar só por
 * `price.value > 0` faz um trial virar "pagante". Pagou = valor > 0 **E**
 * status COMPLETE/APPROVED. Mesmo critério do `pagou_de_verdade.cjs`.
 *
 * ⚠️ ARMADILHA 2: classificar por ASSINATURA em vez de por PESSOA. Alguém
 * cancela um trial e tem OUTRA assinatura viva — essa pessoa não perde nada.
 * Aqui a chave é sempre o e-mail, e todas as assinaturas dele são lidas.
 *
 * ⚠️ ARMADILHA 3: zero de um endpoint não é prova. Se a consulta vier vazia ou
 * não parsear, o corpo cru é impresso e o caso vira ERRO — nunca "ninguém
 * cancelou".
 *
 *   node _frank/ferramentas/cancelamentos_ontem.cjs            # ontem (UTC)
 *   node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-19
 *   node _frank/ferramentas/cancelamentos_ontem.cjs --json     # pro relatório
 */
const { supa } = require("./_comum.cjs");

const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
/** Pagou de verdade: valor > 0 E o dinheiro entrou. OVERDUE não é pagamento. */
const PAGO = new Set(["COMPLETE", "APPROVED"]);
/** Dinheiro que voltou pra pessoa — zera o crédito. */
const ESTORNO = new Set(["REFUNDED", "CHARGEBACK", "PROTESTED", "CHARGEBACK_REVERTED"]);
/** Assinatura ainda de pé (a armadilha 2 mora aqui). */
const VIVA = new Set(["ACTIVE", "STARTED", "DELAYED"]);
const GRACA_DIAS = 10;
const DIA = 86400000;

/**
 * A varredura que DEVERIA agir está viva, ou é um stub?
 *
 * ⚠️ Isto existe porque em 24/08 este relatório imprimiu "nenhum caso fora da
 * regra" para 5 trials — e estava tecnicamente certo (nenhum tinha passado do
 * dia 10) e materialmente errado: a `expire_trial_credits` está DESATIVADA
 * desde 18/08, então quando o dia 10 chegasse não ia acontecer nada. Relatório
 * que só olha o prazo, e nunca a máquina que cumpre o prazo, dá "tudo certo"
 * enquanto o crédito vaza.
 *
 * Lê o CORPO VIVO da função (pg_get_functiondef). NÃO chama a RPC de
 * propósito: chamar EXECUTARIA a varredura, e o dia em que ela estiver ativa
 * de novo isso mexeria em saldo de gente de verdade a partir de um relatório
 * somente-leitura. Ler o corpo é inerte; executar não é.
 *
 * Sem SUPABASE_ACCESS_TOKEN devolve "desconhecido" — nunca "está tudo bem".
 * Não saber conferir não é o mesmo que ter conferido (regra: zero de um
 * endpoint não é prova de nada).
 */
async function varreduraViva() {
  const tok = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\./)?.[1];
  if (!tok || !ref) return { estado: "desconhecido", motivo: "SUPABASE_ACCESS_TOKEN/URL ausente no .env.local" };
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: `select pg_get_functiondef(oid) as def from pg_proc where proname='expire_trial_credits'` }),
    });
    const raw = await r.text();
    if (r.status !== 200 && r.status !== 201) return { estado: "desconhecido", motivo: `HTTP ${r.status}: ${raw.slice(0, 200)}` };
    const linhas = JSON.parse(raw);
    if (!linhas.length) return { estado: "inexistente", motivo: "expire_trial_credits não existe no banco" };
    const def = linhas[0].def || "";
    const mexe = /\b(debit_credits|update\s+profiles|insert\s+into\s+credit_transactions)\b/i.test(def);
    return mexe ? { estado: "ativa" } : { estado: "desativada", motivo: (def.match(/--\s*(DESATIVADA[^\n]*)/i)?.[1] || "corpo não mexe em saldo").trim() };
  } catch (e) {
    return { estado: "desconhecido", motivo: e.message };
  }
}

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const diaArg = argv[argv.indexOf("--dia") + 1];

function janela() {
  const base = argv.includes("--dia") && /^\d{4}-\d{2}-\d{2}$/.test(diaArg || "")
    ? new Date(`${diaArg}T00:00:00.000Z`)
    : new Date(Date.now() - DIA);
  const ini = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  return { ini, fim: new Date(ini.getTime() + DIA), dia: ini.toISOString().slice(0, 10) };
}

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  const t = JSON.parse(raw).access_token;
  if (!t) throw new Error(`Hotmart sem access_token (HTTP ${r.status}): ${raw.slice(0, 200)}`);
  return t;
}

/** GET que devolve { json, raw, status } — o cru sempre volta junto (armadilha 3). */
async function get(url, H) {
  const r = await fetch(url, { headers: H });
  const raw = await r.text();
  try { return { json: JSON.parse(raw), raw, status: r.status }; }
  catch { return { json: null, raw, status: r.status }; }
}

/** Retrato da PESSOA na Hotmart: todas as assinaturas + todas as cobranças. */
async function pessoaNaHotmart(email, H) {
  const s = await get(`${BASE}/subscriptions?subscriber_email=${encodeURIComponent(email)}`, H);
  if (!s.json) return { erro: `subscriptions HTTP ${s.status}: ${s.raw.slice(0, 200)}` };
  const assinaturas = s.json.items || (Array.isArray(s.json) ? s.json : []);

  const cobrancas = [];
  for (const a of assinaturas) {
    const code = a.subscriber_code || a.subscriber?.code || a.code;
    if (!code) continue;
    const p = await get(`${BASE}/subscriptions/${code}/purchases`, H); // ARRAY PURO
    if (!p.json) return { erro: `purchases ${code} HTTP ${p.status}: ${p.raw.slice(0, 200)}` };
    const lista = Array.isArray(p.json) ? p.json : (p.json.items || []);
    for (const c of lista) cobrancas.push({
      code,
      valor: c.price?.value ?? 0,
      status: c.status,
      rec: c.recurrency_number ?? c.recurrence_number ?? null,
      quando: c.approved_date ?? null,
    });
  }
  return {
    assinaturas: assinaturas.map((a) => ({
      code: a.subscriber_code || a.code,
      status: a.status,
      trial: a.trial === true,
      adesao: a.accession_date ?? null,
      fim: a.end_accession_date ?? null,
    })),
    cobrancas,
    pagas: cobrancas.filter((c) => c.valor > 0 && PAGO.has(c.status)),
    estornadas: cobrancas.filter((c) => ESTORNO.has(c.status)),
  };
}

/** O que o NOSSO banco diz do saldo dela. */
async function pessoaNoBanco(email, db) {
  const { data: p, error } = await db.from("profiles")
    .select("id,email,access_until,credits_subscription,credits_extra,created_at")
    .ilike("email", email).maybeSingle();
  if (error) return { erro: `profiles: ${error.message}` };
  if (!p) return { semConta: true };

  const { data: marca } = await db.from("trial_credit_expirations")
    .select("outcome,debited,trial_start,resolved_at").eq("email", email).maybeSingle();
  const { data: tx } = await db.from("credit_transactions")
    .select("kind,amount,ref_type,note,created_at").eq("user_id", p.id)
    .lt("amount", 0).order("created_at", { ascending: false }).limit(10);

  return {
    id: p.id,
    sub: p.credits_subscription ?? 0,
    extra: p.credits_extra ?? 0,
    acessoAte: p.access_until,
    marca: marca || null,
    // débitos que NÃO são consumo do produto: são zeramentos por rotina
    zeramentos: (tx || []).filter((t) => /trial_expirad|estorno|subscription_expired|refund|chargeback/i
      .test(`${t.ref_type ?? ""} ${t.kind ?? ""}`)),
  };
}

function classificar(hm) {
  if (hm.estornadas.length) return "ESTORNO";
  if (hm.pagas.length) return "ASSINANTE";
  return "TRIAL";
}

(async () => {
  const { ini, fim, dia } = janela();
  const db = supa();
  const varredura = await varreduraViva();

  const { data: evs, error } = await db.from("payment_events")
    .select("id,received_at,payload")
    .eq("event_type", "SUBSCRIPTION_CANCELLATION")
    .gte("received_at", ini.toISOString())
    .lt("received_at", fim.toISOString())
    .order("received_at", { ascending: true });

  if (error) {
    console.error(`ERRO em payment_events (nao e "ninguem cancelou"): ${error.message}`);
    console.error("corpo cru:", JSON.stringify(error));
    process.exit(1);
  }

  const cab = `janela UTC ${ini.toISOString()} -> ${fim.toISOString()} (dia ${dia})`;
  if (!evs.length) {
    // zero de um endpoint nao e prova: mostra que a tabela responde
    const { count } = await db.from("payment_events")
      .select("id", { count: "exact", head: true }).eq("event_type", "SUBSCRIPTION_CANCELLATION");
    const out = { dia, janela: cab, eventos: 0, totalHistorico: count ?? null, varredura, pessoas: [] };
    if (JSON_OUT) return console.log(JSON.stringify(out, null, 2));
    console.log(cab);
    console.log(`0 eventos na janela. Prova de que a consulta funciona: ${count} SUBSCRIPTION_CANCELLATION no historico.`);
    // dia sem cancelamento nao isenta a varredura: ela cobre o backlog inteiro
    if (varredura.estado !== "ativa") {
      console.log(`\n!! varredura expire_trial_credits: ${varredura.estado.toUpperCase()}`
        + `${varredura.motivo ? ` — ${varredura.motivo}` : ""}`);
      console.log("   ninguem cancelou hoje, mas o trial de quem cancelou antes tambem nao esta expirando.");
    }
    return;
  }

  // agrupa por PESSOA (e-mail), nunca por assinatura
  const porEmail = new Map();
  for (const e of evs) {
    const d = e.payload?.data ?? {};
    const email = String(d.subscriber?.email ?? "").toLowerCase().trim(); // NAO data.subscription.subscriber
    if (!email) { console.error(`evento ${e.id} sem data.subscriber.email — payload cru:`, JSON.stringify(e.payload).slice(0, 400)); continue; }
    const p = porEmail.get(email) ?? { email, nome: d.subscriber?.name ?? "", eventos: [] };
    p.eventos.push({
      id: e.id, recebido: e.received_at,
      code: d.subscriber?.code ?? null,
      subId: d.subscription?.id ?? null,
      canceladoEm: d.cancellation_date ?? null,
    });
    porEmail.set(email, p);
  }

  const H = { Authorization: `Bearer ${await token()}` };
  const saida = [];

  for (const p of porEmail.values()) {
    const hm = await pessoaNaHotmart(p.email, H);
    if (hm.erro) { saida.push({ ...p, erro: hm.erro }); continue; }
    const banco = await pessoaNoBanco(p.email, db);

    const tipo = classificar(hm);
    const outrasVivas = hm.assinaturas.filter(
      (a) => VIVA.has(a.status) && !p.eventos.some((ev) => ev.code === a.code),
    );

    // quanto tempo ficou: da adesao mais antiga ate o cancelamento
    const adesoes = hm.assinaturas.map((a) => a.adesao).filter(Boolean);
    const inicio = adesoes.length ? Math.min(...adesoes) : null;
    const cancel = Math.max(...p.eventos.map((e) => e.canceladoEm || 0).filter(Boolean), 0) || null;
    const dias = inicio && cancel ? Math.round((cancel - inicio) / DIA) : null;

    // o dia 10 do trial conta da adesao (mesma conta da mig 80)
    const venceEm = tipo === "TRIAL" && inicio ? new Date(inicio + GRACA_DIAS * DIA) : null;
    const jaVenceu = venceEm ? venceEm.getTime() < Date.now() : null;

    const alertas = [];
    if (banco.erro) alertas.push(`nao consegui ler o banco: ${banco.erro}`);
    else if (banco.semConta) alertas.push("cancelou na Hotmart mas NAO existe conta na plataforma com esse e-mail");
    else {
      if (tipo === "ASSINANTE" && banco.zeramentos.length) {
        alertas.push(`PAGANTE COM CREDITO ZERADO POR ROTINA — regra 9 diz MANTEM. Lancamentos: `
          + banco.zeramentos.map((t) => `${t.created_at?.slice(0, 16)} ${t.amount} (${t.ref_type ?? t.kind})`).join(" | "));
      }
      if (tipo === "ASSINANTE" && banco.marca?.outcome === "zeroed") {
        alertas.push(`PAGANTE marcado como 'zeroed' em trial_credit_expirations (${banco.marca.debited} cr) — regra 9 diz MANTEM.`);
      }
      if (tipo === "ESTORNO" && banco.sub > 0) {
        alertas.push(`ESTORNO com credits_subscription ainda em ${banco.sub} — o webhook nao zerou.`);
      }
      if (tipo === "TRIAL" && jaVenceu && banco.sub > 0 && !outrasVivas.length) {
        alertas.push(`TRIAL passou do dia ${GRACA_DIAS} (venceu ${venceEm.toISOString().slice(0, 10)}) e ainda tem ${banco.sub} cr — a varredura NAO pegou.`);
      }
      // Trial DENTRO do prazo, mas a maquina que cumpre o prazo esta parada:
      // sem isto o relatorio diz "tudo certo" e o credito nunca expira.
      if (tipo === "TRIAL" && !jaVenceu && banco.sub > 0 && !outrasVivas.length && varredura.estado !== "ativa") {
        alertas.push(`TRIAL ainda no prazo (dia ${GRACA_DIAS} em ${venceEm?.toISOString().slice(0, 10)}), mas a varredura esta ${varredura.estado.toUpperCase()}`
          + `${varredura.motivo ? ` (${varredura.motivo})` : ""} — os ${banco.sub} cr NAO vao expirar sozinhos.`);
      }
      if (outrasVivas.length && banco.sub === 0 && banco.extra === 0) {
        alertas.push(`tem assinatura VIVA (${outrasVivas.map((a) => `${a.code}/${a.status}`).join(", ")}) e esta com saldo zerado.`);
      }
    }

    saida.push({
      email: p.email, nome: p.nome, tipo,
      outrasAssinaturasVivas: outrasVivas,
      diasNaCasa: dias,
      adesao: inicio ? new Date(inicio).toISOString().slice(0, 10) : null,
      cancelamento: cancel ? new Date(cancel).toISOString().slice(0, 10) : null,
      trialVenceEm: venceEm ? venceEm.toISOString().slice(0, 10) : null,
      trialJaVenceu: jaVenceu,
      hotmart: { assinaturas: hm.assinaturas, cobrancas: hm.cobrancas },
      banco,
      alertas,
    });
  }

  if (JSON_OUT) return console.log(JSON.stringify({ dia, janela: cab, eventos: evs.length, varredura, pessoas: saida }, null, 2));

  console.log(cab);
  console.log(`${evs.length} evento(s) de cancelamento -> ${saida.length} pessoa(s)`);
  console.log(`varredura expire_trial_credits: ${varredura.estado.toUpperCase()}`
    + `${varredura.motivo ? ` — ${varredura.motivo}` : ""}\n`);
  for (const s of saida) {
    console.log("=".repeat(74));
    if (s.erro) { console.log(`${s.email}\n  ERRO: ${s.erro}`); continue; }
    console.log(`${s.email}  (${s.nome})`);
    console.log(`  ${s.tipo} | adesao ${s.adesao} -> cancelou ${s.cancelamento} = ${s.diasNaCasa} dia(s)`);
    for (const a of s.hotmart.assinaturas) console.log(`    assinatura ${a.code} ${a.status}${a.trial ? " (trial)" : ""}`);
    for (const c of s.hotmart.cobrancas) {
      const marca = c.valor > 0 && !PAGO.has(c.status) ? "  <-- cobranca EXISTE mas NAO foi paga" : "";
      console.log(`    rec#${c.rec} R$${String(c.valor).padStart(6)} ${String(c.status).padEnd(16)}`
        + `${c.quando ? new Date(c.quando).toISOString().slice(0, 10) : ""}${marca}`);
    }
    if (s.outrasAssinaturasVivas.length) console.log(`    >>> TEM OUTRA ASSINATURA VIVA — nao perde nada`);
    if (s.banco.semConta) console.log(`    banco: SEM CONTA na plataforma`);
    else if (!s.banco.erro) {
      console.log(`    banco: mensalidade ${s.banco.sub} cr | extra ${s.banco.extra} cr | acesso ate ${s.banco.acessoAte?.slice(0, 10) ?? "-"}`);
      console.log(`    marcador trial: ${s.banco.marca ? `${s.banco.marca.outcome} (${s.banco.marca.debited} cr, ${s.banco.marca.resolved_at?.slice(0, 10)})` : "nenhum"}`);
      if (s.tipo === "TRIAL") console.log(`    dia ${GRACA_DIAS} do trial: ${s.trialVenceEm} (${s.trialJaVenceu ? "JA passou" : "ainda vai chegar"})`);
      for (const t of s.banco.zeramentos) console.log(`    zeramento: ${t.created_at?.slice(0, 16)} ${t.amount} ${t.ref_type ?? t.kind}`);
    }
    for (const a of s.alertas) console.log(`    !! ${a}`);
  }
  const comAlerta = saida.filter((s) => s.alertas?.length || s.erro);
  console.log("\n" + "=".repeat(74));
  console.log(comAlerta.length ? `${comAlerta.length} caso(s) FORA DA REGRA: ${comAlerta.map((s) => s.email).join(", ")}` : "nenhum caso fora da regra");
})();
