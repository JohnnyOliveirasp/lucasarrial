/**
 * PERGUNTA ÚNICA (card de 20/08, Johnny viaja dia 24):
 *   Das pessoas TRANCADAS hoje, quantas JÁ TIVERAM pagamento APROVADO alguma vez?
 *
 * Por que este script existe em vez de só o pagante_trancado.cjs:
 * a ferramenta oficial responde "quem pagou E está indevidamente sem acesso",
 * e por isso ela SÓ consulta /purchases de assinatura ACTIVE — pra cancelada e
 * inadimplente ela para antes, sem olhar o histórico. A pergunta do card é
 * sobre HISTÓRICO ("já pagou alguma vez"), então aqui o /purchases é
 * consultado pra TODO MUNDO, cancelado e inadimplente incluídos.
 *
 * Critério de "pagou" (o do card, com a armadilha de 18/08 no radar):
 *   cobrança com price.value > 0 E status COMPLETE/APPROVED.
 *   OVERDUE com valor > 0 NÃO conta (a Hotmart deixa mensalidade OVERDUE
 *   pra quem nunca pagou).
 *
 * Classificação por PESSOA (e-mail), não por assinatura: todos os
 * subscriber codes da pessoa entram, e por code TODAS as assinaturas.
 * Se a pessoa não tiver code no nosso payload, cai no fallback de buscar
 * na Hotmart por subscriber_email.
 *
 * LEITURA PURA: nenhuma escrita no banco, na Hotmart, em lugar nenhum.
 * Endpoint que voltar vazio tem o corpo cru impresso (playbook W).
 *
 *   node _frank/prova/2026-08-20_pagante_trancado_historico.cjs
 */
const fs = require("node:fs"), path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
for (const l of fs.readFileSync(path.join(RAIZ, "frontend", ".env.local"), "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0) {
    const k = l.slice(0, i).trim();
    const v = l.slice(i + 1).replace(/[\r\n]+$/g, "").replace(/^["']|["']$/g, "");
    if (/^[A-Za-z0-9_]+$/.test(k) && !process.env[k]) process.env[k] = v;
  }
}
const { supa } = require(path.join(RAIZ, "_frank", "ferramentas", "_comum.cjs"));
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
const PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function tokenHotmart() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const j = await (await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } })).json();
  if (!j.access_token) throw new Error(`sem token da Hotmart: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

(async () => {
  const db = supa();
  const agora = new Date();

  // ── mesmos "trancados hoje" da ferramenta oficial ──────────────────────
  const { data: ents, error: eE } = await db.from("entitlements").select("*").eq("status", "active");
  if (eE) throw new Error(`entitlements: ${eE.message}`);
  const ids = [...new Set(ents.map((e) => e.user_id).filter(Boolean))];

  let perfis = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("profiles")
      .select("id,email,access_until,credits_subscription,credits_extra")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error(`profiles: ${error.message}`);
    perfis = perfis.concat(data);
  }

  const suspeitos = perfis.filter((p) => {
    const saldo = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
    return saldo > 0 && (!p.access_until || new Date(p.access_until) <= agora);
  });

  // TODOS os codes de cada pessoa (a oficial pega só o primeiro)
  const codesDe = new Map();
  for (const e of ents) {
    const c = e.raw_event?.subscription?.subscriber?.code;
    if (!c) continue;
    if (!codesDe.has(e.user_id)) codesDe.set(e.user_id, new Set());
    codesDe.get(e.user_id).add(c);
  }

  // por PESSOA (e-mail), não por assinatura
  const pessoas = new Map();
  for (const p of suspeitos) {
    const em = String(p.email ?? "").toLowerCase();
    if (!pessoas.has(em)) pessoas.set(em, { emails: new Set(), perfis: [], codes: new Set() });
    const g = pessoas.get(em);
    g.emails.add(p.email);
    g.perfis.push(p);
    for (const c of codesDe.get(p.id) ?? []) g.codes.add(c);
  }

  console.log(`TRANCADAS HOJE (saldo > 0 e access_until vencido/ausente): ${suspeitos.length} perfis = ${pessoas.size} pessoas`);
  console.log(`data da medição: ${agora.toISOString()}\n`);

  const H = { Authorization: `Bearer ${await tokenHotmart()}` };

  async function comprasDoCode(code) {
    const rp = await fetch(`${BASE}/subscriptions/${code}/purchases`, { headers: H });
    const texto = await rp.text();
    let cru; try { cru = JSON.parse(texto); } catch { cru = null; }
    const compras = Array.isArray(cru) ? cru : cru?.items; // ⚠️ array puro
    if (!rp.ok || !Array.isArray(compras)) {
      return { erro: `purchases HTTP ${rp.status}`, corpoCru: texto.slice(0, 400) };
    }
    if (compras.length === 0) return { compras: [], corpoCru: texto.slice(0, 400) };
    return { compras };
  }

  const pagou = [], naoPagou = [], semProva = [];

  for (const [em, g] of pessoas) {
    // fallback: sem code no payload → busca na Hotmart por e-mail
    if (g.codes.size === 0) {
      try {
        const rs = await fetch(`${BASE}/subscriptions?subscriber_email=${encodeURIComponent(em)}`, { headers: H });
        const texto = await rs.text();
        let js; try { js = JSON.parse(texto); } catch { js = null; }
        const items = js?.items ?? [];
        if (!rs.ok) { semProva.push({ em, porque: `subscriptions(email) HTTP ${rs.status}`, corpoCru: texto.slice(0, 400) }); continue; }
        if (items.length === 0) { semProva.push({ em, porque: "sem code no payload E zero assinaturas por e-mail na Hotmart", corpoCru: texto.slice(0, 400) }); continue; }
        for (const s of items) { const c = s.subscriber?.code; if (c) g.codes.add(c); }
      } catch (e) { semProva.push({ em, porque: `subscriptions(email): ${e.message}` }); continue; }
      await dorme(120);
    }

    const provas = [], extratos = [], erros = [];
    for (const code of g.codes) {
      try {
        const r = await comprasDoCode(code);
        if (r.erro) { erros.push(`${code}: ${r.erro} | corpo cru: ${r.corpoCru}`); continue; }
        if (r.compras.length === 0) { extratos.push(`${code}: ZERO compras | corpo cru: ${r.corpoCru}`); continue; }
        const ord = [...r.compras].sort((a, b) => (a.recurrency_number ?? 0) - (b.recurrency_number ?? 0));
        extratos.push(`${code}: ` + ord.map((c) => `#${c.recurrency_number} R$${c.price?.value ?? "?"} ${c.status}`).join(" · "));
        for (const c of ord) {
          if (PAGO.has(String(c.status).toUpperCase()) && Number(c.price?.value ?? 0) > 0) {
            provas.push(`${code} rec#${c.recurrency_number} R$${c.price?.value} ${c.status}` +
              (c.transaction ? ` tx=${c.transaction}` : "") +
              (c.approved_date ? ` em ${new Date(Number(c.approved_date)).toISOString().slice(0, 10)}` : ""));
          }
        }
      } catch (e) { erros.push(`${code}: ${e.message}`); }
      await dorme(120);
    }

    const saldo = g.perfis.reduce((s, p) => s + (p.credits_subscription ?? 0) + (p.credits_extra ?? 0), 0);
    const base = { em, saldo, codes: [...g.codes].join(","), extratos, erros };
    if (provas.length > 0) pagou.push({ ...base, prova: provas[0], todasProvas: provas });
    else if (erros.length > 0 && extratos.length === 0) semProva.push({ em, porque: erros.join(" ; ") });
    else naoPagou.push(base);
  }

  const L = (t) => console.log(`\n${"─".repeat(70)}\n${t}\n${"─".repeat(70)}`);

  L(`✅ JÁ PAGOU ALGUMA VEZ (cobrança APPROVED/COMPLETE com valor > 0): ${pagou.length}`);
  for (const p of pagou.sort((a, b) => a.em.localeCompare(b.em)))
    console.log(`  ${p.em} | saldo ${p.saldo} | PROVA: ${p.prova}\n     extrato: ${p.extratos.join(" || ")}`);

  L(`❌ NUNCA PAGOU (só trial R$0 / OVERDUE sem aprovação): ${naoPagou.length}`);
  for (const p of naoPagou.sort((a, b) => a.em.localeCompare(b.em)))
    console.log(`  ${p.em} | saldo ${p.saldo}\n     extrato: ${p.extratos.join(" || ") || "(vazio)"}${p.erros.length ? `\n     erros parciais: ${p.erros.join(" ; ")}` : ""}`);

  if (semProva.length) {
    L(`⚠️ SEM PROVA (endpoint falhou/vazio — números acima INCOMPLETOS): ${semProva.length}`);
    for (const s of semProva) console.log(`  ${s.em}: ${s.porque}${s.corpoCru ? `\n     corpo cru: ${s.corpoCru}` : ""}`);
  }

  console.log(`\n>>> RESPOSTA: das ${pessoas.size} pessoas trancadas hoje, ${pagou.length} já tiveram pagamento aprovado` +
    ` · ${naoPagou.length} nunca pagaram · ${semProva.length} sem prova`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
