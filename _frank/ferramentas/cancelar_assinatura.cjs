#!/usr/bin/env node
/**
 * cancelar_assinatura.cjs — cancela a assinatura de quem PEDIU pra cancelar.
 *
 * POR QUE EXISTE (decisão do Johnny, 21/08 — regra 9-C). Cancelamento virou
 * AUTOMÁTICO: é o pedido do titular, e nós nem temos acesso ao painel da
 * Hotmart pra fazer na mão. O resto (reembolso, garantia de 7 dias) é entre
 * o aluno e a Hotmart. A partir de 24/08 o Johnny está na estrada e não vai
 * responder "pode cancelar?" — por isso isto existe.
 *
 * A SALVAGUARDA (e ela NÃO consulta o Johnny): antes de cancelar, esta
 * ferramenta resolve o e-mail NO BANCO e mostra tudo que achou. Ela não
 * confia no e-mail escrito no card do incidente. Já existiram duas contas
 * "csitya" e a errada existe — cancelar a assinatura da pessoa errada é o
 * único jeito de transformar um pedido banal em incidente grave.
 *
 * ⚠️ NÃO TEM DESFAZER. Por isso o ensaio é o padrão e `--confirmar` é
 * obrigatório pra valer.
 *
 * ⚠️ Cancelar a recorrência NÃO apaga o crédito já pago (regra 9): quem pagou
 * continua usando até o período acabar. Esta ferramenta não encosta em
 * crédito nem em acesso — só para a cobrança futura.
 *
 * USO (de qualquer pasta):
 *   node _frank/ferramentas/cancelar_assinatura.cjs --aluno maria@exemplo.com
 *   node _frank/ferramentas/cancelar_assinatura.cjs --aluno maria@exemplo.com --confirmar
 *   ... --incidente <id>   registra o cancelamento como nota no incidente
 */
const path = require("node:path");
const { supa } = require("./_comum.cjs");

const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};
const EMAIL = (arg("--aluno") || "").toLowerCase().trim();
const INCIDENTE = arg("--incidente");
const CONFIRMAR = argv.includes("--confirmar");

const BASE = "https://developers.hotmart.com/payments/api/v1";
const db = supa();

async function token() {
  const u =
    `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, {
    method: "POST",
    headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` },
  });
  const raw = await r.text();
  const t = JSON.parse(raw).access_token;
  if (!t) throw new Error(`Hotmart sem access_token (HTTP ${r.status}): ${raw.slice(0, 200)}`);
  return t;
}

/** GET que devolve o cru junto — erro de API não pode virar "não existe". */
async function get(url, H) {
  const r = await fetch(url, { headers: H });
  const raw = await r.text();
  try {
    return { json: JSON.parse(raw), raw, status: r.status };
  } catch {
    return { json: null, raw, status: r.status };
  }
}

(async () => {
  if (!EMAIL) {
    console.error("uso: --aluno <email do aluno> [--incidente <id>] [--confirmar]");
    process.exit(1);
  }
  for (const v of ["HOTMART_CLIENT_ID", "HOTMART_CLIENT_SECRET", "HOTMART_BASIC"]) {
    if (!process.env[v]) {
      console.error(`${v} ausente no frontend/.env.local — sem isso não dá pra falar com a Hotmart.`);
      process.exit(1);
    }
  }

  console.log(`\n# cancelar_assinatura — ${CONFIRMAR ? "VALENDO" : "ENSAIO (nada será cancelado)"}`);
  console.log(`# aluno pedido: ${EMAIL}\n`);

  // ---- 1. TITULARIDADE: quem é essa pessoa no NOSSO banco --------------
  const perfil = await db
    .from("profiles")
    .select("id, email, access_until, credits_subscription, credits_extra")
    .ilike("email", EMAIL)
    .maybeSingle();
  if (perfil.error) {
    console.error("ERRO ao ler profiles:", perfil.error.message);
    process.exit(1);
  }

  const ents = await db
    .from("entitlements")
    .select("buyer_email, status, access_until, external_id, product_code")
    .ilike("buyer_email", EMAIL);
  if (ents.error) {
    console.error("ERRO ao ler entitlements:", ents.error.message);
    process.exit(1);
  }

  console.log("=== NO NOSSO BANCO ===");
  if (!perfil.data) {
    console.log("  ⚠️  NENHUM perfil com este e-mail.");
  } else {
    console.log(`  perfil:      ${perfil.data.email}  (id ${perfil.data.id})`);
    console.log(`  acesso até:  ${perfil.data.access_until ?? "(sem data)"}`);
    console.log(
      `  crédito:     ${(perfil.data.credits_subscription ?? 0).toLocaleString()} assinatura` +
        ` + ${(perfil.data.credits_extra ?? 0).toLocaleString()} extra`,
    );
  }
  console.log(`  entitlements: ${ents.data.length}`);
  for (const e of ents.data) {
    console.log(`     ${e.status.padEnd(10)} até ${e.access_until ?? "(null)"}  ${e.external_id ?? ""}`);
  }

  // ---- 2. O QUE A HOTMART DIZ (consulta antes, sempre) -----------------
  const H = { Authorization: `Bearer ${await token()}` };
  const s = await get(`${BASE}/subscriptions?subscriber_email=${encodeURIComponent(EMAIL)}`, H);
  if (!s.json) {
    console.error(`\nERRO na consulta à Hotmart (HTTP ${s.status}): ${s.raw.slice(0, 300)}`);
    console.error("NÃO cancelei nada. Erro de consulta nunca vira 'a pessoa não tem assinatura'.");
    process.exit(1);
  }
  const assinaturas = s.json.items || (Array.isArray(s.json) ? s.json : []);

  console.log("\n=== NA HOTMART ===");
  if (!assinaturas.length) {
    console.log("  nenhuma assinatura para este e-mail.");
    console.log("\n  Nada a cancelar. Se o aluno insiste que assina, o e-mail do PEDIDO pode");
    console.log("  ser diferente do e-mail da COMPRA — confirme com ele antes de seguir.");
    return;
  }
  for (const a of assinaturas) {
    const code = a.subscriber_code || a.subscriber?.code || a.code;
    console.log(`  code ${code} | status ${a.status} | trial: ${a.trial === true}`);
    console.log(`     plano: ${a.plan?.name ?? "(sem nome)"} | produto: ${a.product?.id ?? "?"}`);
  }

  const canceláveis = assinaturas.filter(
    (a) => !/cancel|inactive|expired/i.test(String(a.status ?? "")),
  );
  if (!canceláveis.length) {
    console.log("\n  todas já estão canceladas/inativas — nada a fazer (idempotente).");
    return;
  }

  // ---- 3. CONFERE que bate com o nosso banco ---------------------------
  console.log("\n=== CONFERÊNCIA DE TITULARIDADE ===");
  const problemas = [];
  if (!perfil.data) {
    problemas.push("não existe perfil nosso com este e-mail (pode ser conta com outro e-mail)");
  }
  if (!ents.data.length) {
    problemas.push("não existe entitlement nosso com este buyer_email");
  }
  if (canceláveis.length > 1) {
    problemas.push(`${canceláveis.length} assinaturas ativas — diga QUAL cancelar, não cancele em lote`);
  }
  if (problemas.length) {
    console.log("  ⚠️  DIVERGÊNCIA:");
    for (const p of problemas) console.log(`     - ${p}`);
    console.log("\n  NÃO vou cancelar. Confirme com o aluno qual é o e-mail da COMPRA");
    console.log("  e rode de novo com ele. Cancelar a assinatura errada não tem desfazer.");
    process.exit(1);
  }
  console.log("  ok — 1 assinatura ativa, e o e-mail bate com perfil e entitlement nossos.");

  const alvo = canceláveis[0];
  const code = alvo.subscriber_code || alvo.subscriber?.code || alvo.code;

  if (!CONFIRMAR) {
    console.log(`\n--- ENSAIO: cancelaria o code ${code} (status ${alvo.status}).`);
    console.log("--- Nada foi enviado. Repita com --confirmar pra valer.");
    return;
  }

  // ---- 4. CANCELA ------------------------------------------------------
  const r = await fetch(`${BASE}/subscriptions/${code}/cancel`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ send_email: true }),
  });
  const raw = await r.text();
  if (!r.ok) {
    console.error(`\nHotmart RECUSOU (HTTP ${r.status}): ${raw.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`\n✅ assinatura ${code} CANCELADA na Hotmart (o aluno recebe o e-mail deles).`);
  console.log("   O crédito já pago continua com ele até o período acabar (regra 9).");

  if (INCIDENTE) {
    const { data: row } = await db
      .from("incidents")
      .select("agent_notes")
      .eq("id", INCIDENTE)
      .maybeSingle();
    const notes = row?.agent_notes ?? [];
    notes.push({
      at: new Date().toISOString(),
      by: "frank",
      note:
        `CANCELAMENTO EXECUTADO (regra 9-C): assinatura ${code} de ${EMAIL} cancelada na ` +
        `Hotmart a pedido do aluno. Titularidade conferida no banco antes. ` +
        `Crédito pago NÃO foi tocado.`,
    });
    await db.from("incidents").update({ agent_notes: notes }).eq("id", INCIDENTE);
    console.log(`   registrado no incidente ${INCIDENTE}.`);
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
