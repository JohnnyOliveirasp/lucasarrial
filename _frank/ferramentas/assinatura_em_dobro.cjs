/**
 * "Quem está pagando DUAS assinaturas do mesmo produto?" — dinheiro saindo do
 * bolso do aluno por defeito nosso.
 *
 * POR QUE ESTE SCRIPT EXISTE (incidente #222, medido em 01/09/2026)
 * O `grantAccess` casava compra↔conta só pelo e-mail. Quem comprava com um
 * e-mail e criava a conta com outro não recebia acesso — e o contorno natural
 * do aluno é **assinar de novo com o outro e-mail**. Aí ele fica com DUAS
 * assinaturas ativas do mesmo produto e paga as duas, sem ninguém perceber.
 * Não é hipótese: dois casos medidos no mesmo dia.
 *   Jackson Alves  — cadastros com 5 min de diferença em 19/08; R$97 + R$97
 *                    aprovados em 26/08; as duas renovam em 19/09.
 *   Nássara Mesquita — R$291 pagos em 3 cobranças, UMA recarga de crédito
 *                    recebida, e ainda por cima sem acesso (a compra que ela
 *                    pagou em 24/08 era a órfã).
 *
 * ⚠️ ISTO NÃO É O MESMO QUE "entitlement órfão". Órfã é o aluno sem acesso;
 * aqui é o aluno PAGANDO DUAS VEZES — que pode ter acesso e parecer saudável
 * em qualquer varredura de travados. O Jackson não aparecia em varredura
 * nenhuma: acesso ativo, crédito cheio, nada travado. Só o cruzamento por
 * pessoa acusa.
 *
 * ⚠️ A ARMADILHA DA CHAVE, que já produziu contagem errada.
 * O primeiro detector do #222 agrupou por **nome normalizado + telefone** e
 * cravou "5 alunos". Ele deixou de fora as DUAS pessoas que estavam realmente
 * pagando em dobro:
 *   - Nássara assinou como "Nássara Mesquita" e "Nassara Borges Mesquita
 *     Oliveira" — nome normalizado diferente.
 *   - Gabriela Louly tem CPF numa compra e CPF vazio na outra.
 * Por isso aqui a pessoa é identificada por **CPF OU telefone OU nome**, em
 * grafo: duas compras entram no mesmo grupo se casarem por QUALQUER um dos
 * três. Chave única sempre subconta.
 *
 * ⚠️ E NÃO CONCLUA PELO NOSSO BANCO. `entitlements.status='active'` só diz o
 * que o último webhook contou; ele não sabe se a cobrança foi paga. Quem
 * decide "pagou" é a Hotmart viva, com a regra de sempre:
 * **pagou = price.value > 0 E status COMPLETE/APPROVED** (`OVERDUE` não é
 * pagamento). Duas assinaturas ativas cujas cobranças são todas R$0 são dois
 * trials, não cobrança em dobro — e tratar trial como dinheiro cobrado é o
 * erro que o #222 cometeu ao chamar de "5 alunos presos" gente que nunca pagou.
 * Falha de leitura da Hotmart é reportada como FALHA, nunca como "não pagou".
 *
 * Somente leitura. Não cancela, não estorna, não toca em crédito nem em
 * acesso — cancelar assinatura de aluno é decisão de gente.
 *
 * Uso:
 *   node _frank/ferramentas/assinatura_em_dobro.cjs [--produto 7851642] [--json]
 */
const { supa } = require("./_comum.cjs");

const PRODUTO_PADRAO = "7851642"; // FastCloner
const PAGO = new Set(["COMPLETE", "COMPLETED", "APPROVED"]);
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const produto = args.includes("--produto") ? args[args.indexOf("--produto") + 1] : PRODUTO_PADRAO;

const norm = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
const soDigitos = (s) => (s ?? "").toString().replace(/\D/g, "");

/**
 * Lê TODOS os entitlements ativos do produto, paginando.
 * O PostgREST corta em 1000 linhas EM SILÊNCIO e a tabela já tem ~1022 — uma
 * consulta ingênua perderia gente sem avisar (armadilha registrada na ordem
 * de 20/08).
 */
async function lerAtivos(db) {
  const PAG = 500;
  const todos = [];
  for (let de = 0; ; de += PAG) {
    const { data, error } = await db
      .from("entitlements")
      .select("external_id, buyer_email, user_id, status, access_until, raw_event")
      .eq("product_code", produto)
      .eq("status", "active")
      .order("external_id", { ascending: true })
      .range(de, de + PAG - 1);
    if (error) throw new Error(`Supabase: ${error.message}`);
    todos.push(...(data ?? []));
    if (!data || data.length < PAG) break;
  }
  return todos;
}

/** Une compras da mesma pessoa por CPF OU telefone OU nome (union-find). */
function agrupar(linhas) {
  const pai = new Map();
  const acha = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
  const une = (a, b) => { pai.has(a) || pai.set(a, a); pai.has(b) || pai.set(b, b); const ra = acha(a), rb = acha(b); if (ra !== rb) pai.set(ra, rb); };

  for (const l of linhas) {
    const b = l.raw_event?.buyer ?? {};
    const eu = `E:${l.external_id}`;
    pai.has(eu) || pai.set(eu, eu);
    const cpf = soDigitos(b.document);
    const fone = soDigitos(b.checkout_phone);
    const nome = norm(b.name);
    // só chaves com substância: CPF de 11 dígitos, telefone de 10+, nome com sobrenome
    if (cpf.length === 11) une(eu, `D:${cpf}`);
    if (fone.length >= 10) une(eu, `F:${fone}`);
    if (nome.includes(" ")) une(eu, `N:${nome}`);
  }

  const grupos = new Map();
  for (const l of linhas) {
    const r = acha(`E:${l.external_id}`);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(l);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
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

/** Cobranças PAGAS de uma assinatura, direto da Hotmart. Erro nunca vira zero. */
async function cobrancasPagas(code, H) {
  const r = await fetch(`${BASE}/subscriptions/${code}/purchases`, { headers: H });
  const raw = await r.text();
  if (r.status !== 200) return { erro: `HTTP ${r.status}: ${raw.slice(0, 140)}` };
  let j;
  try { j = JSON.parse(raw); } catch { return { erro: `resposta não-JSON: ${raw.slice(0, 140)}` }; }
  const lista = Array.isArray(j) ? j : (j.items ?? []);
  const pagas = lista.filter((x) => Number(x.price?.value) > 0
    && PAGO.has(String(x.purchase?.status ?? x.status).toUpperCase()));
  return {
    total: lista.length,
    pagas: pagas.map((x) => ({
      valor: Number(x.price.value),
      moeda: x.price.currency_code ?? "BRL",
      status: String(x.purchase?.status ?? x.status),
      transacao: x.transaction,
      em: x.approved_date ? new Date(x.approved_date).toISOString().slice(0, 10) : null,
    })),
  };
}

(async () => {
  const db = supa();
  const linhas = await lerAtivos(db);
  const grupos = agrupar(linhas);
  console.log(`Assinaturas ativas do produto ${produto}: ${linhas.length}`);
  console.log(`Pessoas com mais de uma: ${grupos.length}\n`);
  if (!grupos.length) return;

  const H = { Authorization: `Bearer ${await token()}` };
  const saida = [];

  for (const g of grupos) {
    const nome = g.map((l) => l.raw_event?.buyer?.name).find(Boolean) ?? "(sem nome)";
    const detalhes = [];
    let falhou = false;
    for (const l of g) {
      const c = await cobrancasPagas(l.external_id, H);
      if (c.erro) falhou = true;
      detalhes.push({ ...l, hotmart: c });
    }
    const comPagamento = detalhes.filter((d) => d.hotmart.pagas?.length);
    const emDobro = !falhou && comPagamento.length > 1;
    const total = comPagamento.flatMap((d) => d.hotmart.pagas).reduce((s, p) => s + p.valor, 0);

    const veredito = falhou ? "LEITURA FALHOU — nao concluir"
      : emDobro ? `PAGANDO EM DOBRO (${total} no total)`
      : comPagamento.length === 1 ? "uma paga so — ok"
      : "nenhuma paga (trials)";

    console.log(`### ${nome} — ${veredito}`);
    for (const d of detalhes) {
      const dono = d.user_id ? d.user_id.slice(0, 8) : "ORFAO";
      const h = d.hotmart.erro
        ? `⚠️ ${d.hotmart.erro}`
        : (d.hotmart.pagas.length
            ? d.hotmart.pagas.map((p) => `${p.moeda} ${p.valor} ${p.status} ${p.transacao} ${p.em}`).join(" ; ")
            : "nenhuma cobranca paga");
      console.log(`   ${d.external_id} <${d.buyer_email}> dono=${dono} ate ${String(d.access_until).slice(0, 10)}`);
      console.log(`      ${h}`);
    }
    console.log("");
    saida.push({ nome, veredito, emDobro, total, assinaturas: detalhes.map((d) => ({ code: d.external_id, email: d.buyer_email, orfa: !d.user_id, hotmart: d.hotmart })) });
  }

  const dobro = saida.filter((s) => s.emDobro);
  const falhas = saida.filter((s) => s.veredito.startsWith("LEITURA"));
  console.log("─".repeat(66));
  console.log(`PAGANDO EM DOBRO: ${dobro.length}${dobro.length ? " → " + dobro.map((d) => d.nome).join(", ") : ""}`);
  if (falhas.length) console.log(`⚠️  SEM VEREDITO (a Hotmart nao respondeu): ${falhas.length} — ${falhas.map((f) => f.nome).join(", ")}`);
  if (JSON_OUT) console.log("\n" + JSON.stringify(saida, null, 2));
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
