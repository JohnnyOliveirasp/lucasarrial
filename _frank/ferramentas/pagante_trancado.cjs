/**
 * PAGANTE TRANCADO — a conta certa.
 *
 *   node _frank/ferramentas/pagante_trancado.cjs
 *
 * Substitui o `_Bugs/prova_raio.cjs` na varredura diária.
 *
 * ── POR QUE ESTA FERRAMENTA EXISTE (19/08) ────────────────────────────────
 * O prova_raio contava "pagante com crédito e sem acesso" olhando SÓ o nosso
 * banco: entitlement `active` + saldo > 0 + `access_until` vencido. Em 18/08
 * isso deu 147 e virou "o problema mais grave aberto". Em 19/08 deu 68.
 * Conferido na Hotmart, um a um: **nenhum dos 68 era pagante trancado.**
 *
 * Os três motivos pelos quais aquele número mente:
 *
 * 1. `entitlements.status = 'active'` é o status da LINHA, não da assinatura.
 *    Ninguém volta lá pra escrever 'cancelled' quando a pessoa sai. Dos 68,
 *    22 tinham cancelado na Hotmart e 25 estavam inadimplentes (DELAYED).
 * 2. `raw_event` é uma FOTO do último webhook. "ACTIVE" ali é o status
 *    naquele dia, não hoje.
 * 3. **O grosso do número é a virada das 12:00.** `access_until` é gravado
 *    com a data da próxima cobrança. Todo dia ao meio-dia UTC um lote inteiro
 *    "vence" no mesmo segundo em que a cobrança nova fica devida. Eles não
 *    estão travados: estão na fronteira. Em 19/08 eram 21 dos 68. É por isso
 *    que o número balança tanto de um dia pro outro — 147 e 68 estavam
 *    medindo o tamanho do lote do dia, não o tamanho do problema.
 *
 * A ÚNICA prova de que alguém pagou é o histórico de cobranças da Hotmart:
 * `GET /subscriptions/{code}/purchases`. Se a última recorrência está
 * APPROVED/COMPLETE e o acesso está vencido, aí sim é bug nosso e é dinheiro.
 *
 * ⚠️ /purchases devolve um ARRAY puro, não `{items:[...]}`. Ler `.items` traz
 * undefined e o script cospe "0 pagantes trancados" com toda a confiança —
 * eu caí nessa em 19/08 antes de conferir. É o playbook W de novo.
 *
 * Só leitura: não muda nada.
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
const { supa } = require("./_comum.cjs");
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";
const PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
const dia = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 10) : "—");

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

  const codigoDe = new Map();
  for (const e of ents) {
    const c = e.raw_event?.subscription?.subscriber?.code;
    if (c && !codigoDe.has(e.user_id)) codigoDe.set(e.user_id, c);
  }

  console.log(`suspeitos no nosso banco (a conta antiga, a que mente): ${suspeitos.length}`);
  console.log(`conferindo cada um na Hotmart…\n`);

  const H = { Authorization: `Bearer ${await tokenHotmart()}` };
  const trancado = [], fronteira = [], naoPagou = [], cancelou = [], inadimplente = [], semProva = [];

  for (const p of suspeitos) {
    const saldo = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
    const code = codigoDe.get(p.id);
    const base = { email: p.email, acesso: p.access_until, saldo };
    if (!code) { semProva.push({ ...base, porque: "sem subscriber code no payload" }); continue; }

    try {
      const rs = await fetch(`${BASE}/subscriptions?subscriber_code=${code}`, { headers: H });
      const js = await rs.json();
      const s = (js.items ?? [])[0];
      if (!rs.ok || !s) { semProva.push({ ...base, porque: `subscriptions HTTP ${rs.status}` }); continue; }
      const st = String(s.status ?? "").toUpperCase();

      if (st.includes("CANCEL")) { cancelou.push({ ...base, st }); continue; }
      if (st !== "ACTIVE") { inadimplente.push({ ...base, st, prox: dia(s.date_next_charge) }); continue; }

      const rp = await fetch(`${BASE}/subscriptions/${code}/purchases`, { headers: H });
      const cru = await rp.json();
      const compras = Array.isArray(cru) ? cru : cru.items;   // ⚠️ array puro
      if (!rp.ok || !compras) { semProva.push({ ...base, porque: `purchases HTTP ${rp.status}` }); continue; }

      const ord = [...compras].sort((a, b) => (a.recurrency_number ?? 0) - (b.recurrency_number ?? 0));
      const ultima = ord[ord.length - 1] ?? {};
      const jaPagouValor = ord.some((c) => PAGO.has(String(c.status).toUpperCase()) && Number(c.price?.value ?? 0) > 0);
      const extrato = ord.map((c) => `#${c.recurrency_number} R$${c.price?.value ?? "?"} ${c.status}`).join(" · ");
      const venceuHaHoras = p.access_until ? (agora - new Date(p.access_until)) / 3600000 : Infinity;

      if (!PAGO.has(String(ultima.status).toUpperCase())) { naoPagou.push({ ...base, extrato, st: ultima.status }); continue; }
      // Pagou. Mas venceu na virada das 12:00 de hoje? Então é fronteira, não vítima.
      if (venceuHaHoras <= 24) fronteira.push({ ...base, extrato, prox: dia(s.date_next_charge) });
      else if (jaPagouValor) trancado.push({ ...base, extrato, prox: dia(s.date_next_charge), diasVencido: (venceuHaHoras / 24).toFixed(1) });
      else naoPagou.push({ ...base, extrato, st: "só trial R$0" });
    } catch (e) {
      semProva.push({ ...base, porque: e.message });
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  const L = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}`);
  L(`🔴 PAGANTE TRANCADO — pagou de verdade e está sem acesso: ${trancado.length}`);
  for (const t of trancado) console.log(`  ${t.email} | vencido há ${t.diasVencido}d | ${t.saldo} créditos\n     ${t.extrato}`);
  if (!trancado.length) console.log("  (nenhum — ninguém que pagou está trancado)");

  L(`🟡 NA FRONTEIRA — venceu na virada das 12:00 (recheque em algumas horas): ${fronteira.length}`);
  for (const f of fronteira.slice(0, 30)) console.log(`  ${f.email} | acesso até ${String(f.acesso).slice(0, 10)} | próxima cobrança ${f.prox}`);

  L("⚪ TRANCAR ESTÁ CERTO (ordem do Johnny 13/08: sem assinatura = trancado)");
  console.log(`  ${cancelou.length} cancelaram · ${inadimplente.length} inadimplentes · ${naoPagou.length} trial que nunca virou pagamento`);

  if (semProva.length) {
    L(`⚠️ NÃO CONSEGUI PROVAR: ${semProva.length} — os números acima estão incompletos`);
    for (const s of semProva.slice(0, 20)) console.log(`  ${s.email}: ${s.porque}`);
  }

  console.log(`\n>>> NÚMERO PRO RELATÓRIO: ${trancado.length} pagante(s) trancado(s)` +
    ` · ${fronteira.length} na fronteira · ${semProva.length} sem prova`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
