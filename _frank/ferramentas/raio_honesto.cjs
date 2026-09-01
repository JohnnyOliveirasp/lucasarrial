/**
 * "PAGANTES COM CREDITO E SEM ACESSO" — a versao que separa o que importa.
 *
 * ⚠️ POR QUE ESTE SCRIPT EXISTE (27/08/2026)
 * O `_Bugs/prova_raio.cjs` imprime UM numero (147 em 18/08, 160 em 27/08) e esse
 * numero vinha sendo lido como "160 pagantes trancados do lado de fora". Medido
 * em 27/08, ele NAO e isso. Decomposto:
 *
 *   160 bruto
 *   ├─ 122 NUNCA PAGARAM  → trial R$0 que venceu, credito residual no bolso.
 *   │                       Conferido na Hotmart em amostra de 4: 4/4 com rec#1
 *   │                       R$0 COMPLETE + rec#2/3 R$97 OVERDUE. E a armadilha
 *   │                       que o `pagou_de_verdade.cjs` ja documenta.
 *   └─  38 PAGARAM MESMO  → e nos 38 o entitlement TAMBEM esta vencido, com a
 *                           MESMA data do profile. Ninguem esta trancado por
 *                           dessincronia: sao assinaturas que lapsaram.
 *
 * O grupo que seria bug de verdade — entitlement VIVO e profile vencido, gente
 * que pagou e o sistema nao deixa entrar — deu **ZERO**.
 *
 * ENTAO POR QUE O NUMERO SO SOBE? Porque `entitlements.status` nunca vira
 * `expired` sozinho. Na tabela inteira (940 linhas) existe **1** linha
 * `expired`, contra 289 linhas `active` com `access_until` ja vencido (a mais
 * velha ha 51 dias). `canceled`/`refunded`/`chargeback` existem porque vem de
 * webhook explicito da Hotmart; vencimento natural nao tem transicao nenhuma.
 * Ou seja: a metrica e um ACUMULADOR — cresce a cada assinatura que lapsa,
 * independente de qualquer aluno estar sofrendo. 147 -> 160 e deriva, nao piora.
 *
 * ⚠️ ARMADILHAS DE MEDICAO que este script evita (as duas custaram caro aqui):
 *  1. `payment_events` PAGINADO. O Supabase corta em 1000 linhas mesmo com
 *     `.limit(20000)`. Sem paginar, davam 1000 eventos / 294 pagantes e o
 *     recorte saia contaminado. Paginado: 1373 eventos / 398 pagantes.
 *  2. Coluna que nao existe volta `data: null` e o script imprime zero feliz.
 *     `entitlements.plan` e `studio_scenes.updated_at` NAO existem — cada
 *     consulta aqui checa `error` antes de acreditar em qualquer numero.
 *
 * Somente leitura. Nao toca em saldo, acesso nem status.
 * Uso: node _frank/ferramentas/raio_honesto.cjs
 */
const { supa } = require("./_comum.cjs");

async function paginar(db, tabela, cols, filtros = (q) => q) {
  let tudo = [], de = 0;
  for (;;) {
    const { data, error } = await filtros(db.from(tabela).select(cols)).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    tudo = tudo.concat(data);
    if (data.length < 1000) return tudo;
    de += 1000;
    if (de > 200000) throw new Error(`${tabela}: paginacao sem fim`);
  }
}

(async () => {
  const db = supa();
  const agora = new Date();

  const ents = await paginar(db, "entitlements", "user_id,status,access_until");
  const semId = ents.filter((e) => !e.user_id || e.user_id === "null").length;
  const vivo = (e) => e.access_until && new Date(e.access_until) > agora;

  // guarda o entitlement de maior alcance por pessoa (alguem pode ter 2)
  const porUsuario = new Map();
  for (const e of ents) {
    if (e.status !== "active" || !e.user_id || e.user_id === "null") continue;
    const p = porUsuario.get(e.user_id);
    if (!p || String(e.access_until) > String(p.access_until)) porUsuario.set(e.user_id, e);
  }
  const ids = [...porUsuario.keys()];

  let perfis = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("profiles")
      .select("id,email,access_until,credits_subscription,credits_extra")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error(`profiles: ${error.message}`);
    perfis = perfis.concat(data);
  }
  if (perfis.length !== ids.length) {
    console.log(`⚠️  perfis truncados: pedi ${ids.length}, vieram ${perfis.length} — numeros abaixo sao PISO`);
  }

  const saldo = (p) => (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  const bruto = perfis.filter((p) => saldo(p) > 0 && (!p.access_until || new Date(p.access_until) <= agora));

  // pagou de verdade = PURCHASE_APPROVED com valor > 0 no NOSSO banco
  const evs = await paginar(db, "payment_events", "payload", (q) =>
    q.eq("provider", "hotmart").eq("event_type", "PURCHASE_APPROVED"));
  const pagantes = new Set();
  for (const ev of evs) {
    const v = ev.payload?.data?.purchase?.price?.value ?? 0;
    const em = (ev.payload?.data?.buyer?.email ?? "").toLowerCase();
    if (v > 0 && em) pagantes.add(em);
  }

  const pagos = bruto.filter((p) => pagantes.has((p.email ?? "").toLowerCase()));
  const nunca = bruto.length - pagos.length;
  const trancados = pagos.filter((p) => vivo(porUsuario.get(p.id))); // entitlement VIVO + profile vencido

  console.log(`entitlements: ${ents.length} linhas · ${ids.length} pessoas active · ${semId} SEM user_id (orfas)`);
  console.log(`payment_events PURCHASE_APPROVED: ${evs.length} · pagantes distintos: ${pagantes.size}`);
  console.log(`\n>>> BRUTO (o numero do prova_raio.cjs): ${bruto.length}`);
  console.log(`      dos quais NUNCA pagaram (trial vencido): ${nunca}`);
  console.log(`      dos quais PAGARAM de verdade:            ${pagos.length}`);
  console.log(`\n🚨 TRANCADOS DE VERDADE (pagou, entitlement VIVO, sem acesso): ${trancados.length}`);
  for (const t of trancados) {
    const e = porUsuario.get(t.id);
    console.log(`   ${t.email} | profile venceu ${String(t.access_until).slice(0, 10)}`
      + ` | entitlement vale ate ${String(e.access_until).slice(0, 10)} | ${saldo(t)} cred`);
  }
  if (!trancados.length) console.log("   (nenhum — ninguem que pagou esta sendo barrado)");

  const ativosVencidos = ents.filter((e) => e.status === "active" && e.access_until && new Date(e.access_until) <= agora);
  const expirados = ents.filter((e) => e.status === "expired").length;
  console.log(`\n📌 causa da deriva: status='active' com access_until vencido: ${ativosVencidos.length}`
    + ` · linhas com status='expired' na tabela inteira: ${expirados}`);
  console.log(`   enquanto nada expirar o entitlement, o numero bruto so sobe.`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
