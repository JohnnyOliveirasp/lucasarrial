/**
 * contato_hotmart.cjs — QUAL CANAL SOBRA quando o e-mail do aluno quica.
 *
 * O problema que isto resolve (incidente #101 / #249 e a classe inteira dos
 * "E-mail não chegou no aluno"): quando a carta de acesso quica, a casa abre
 * uma ficha que contém UM único dado — o endereço que já se provou morto. Quem
 * pega a ficha depois não tem o que fazer além de reenviar pro mesmo lugar. Em
 * 13/09 havia 10 fichas dessas abertas, a mais velha de 9,1 dias, TODAS paradas.
 *
 * O que ninguém tinha perguntado: a Hotmart viva guarda o TELEFONE do comprador
 * (`/sales/users`, bloco `role: BUYER`). Ele nunca entrou no nosso banco —
 * `payment_events` guarda o payload do webhook, que não traz telefone, e para
 * os compradores de 04/09 nem payload existe (o desvio do SGP no webhook é de
 * 03/09 e só pegou de 07/09 em diante; medido: Glauber, Anderson e Hamilto têm
 * ZERO linhas em `payment_events`, Sheila/Sunesa/Ulysses/Valdene/Ollem têm 1).
 * Então o canal existia o tempo todo, a uma chamada de API, e ninguém sabia.
 *
 * ⚠️ ESTA FERRAMENTA NÃO ESCREVE, NÃO MANDA E NÃO ADIVINHA. Ela pergunta e
 * imprime. Especificamente, ela NÃO tenta "corrigir" o endereço do aluno:
 * trocar `gmail.com.br` por `gmail.com` é o palpite que entrega a compra de um
 * pagante na caixa de outra pessoa (regra fixada em 13/09, PR #260).
 * Endereço parecido não é identidade.
 *
 * ⚠️ CONTROLE POSITIVO OBRIGATÓRIO. A ferramenta é obrigada a reencontrar um
 * caso conhecido antes de afirmar qualquer coisa, e ABORTA se o controle voltar
 * vazio. "Zero" de instrumento cego foi o que fez a casa reportar "pagante sem
 * acesso: zero" em 07/09, e nesta mesma fila um SELECT com coluna inexistente
 * devolveu "SEM CONTA" para 11 alunos em 13/09. Um zero só vale depois que o
 * controle prova que a pergunta chega ao outro lado.
 *
 * Uso:
 *   node _frank/ferramentas/contato_hotmart.cjs <email> [<email> ...]
 *   node _frank/ferramentas/contato_hotmart.cjs --fichas     # todas as fichas de bounce abertas
 *   node _frank/ferramentas/contato_hotmart.cjs --json
 *
 * Credenciais: as MESMAS do pagou_de_verdade.cjs, de frontend/.env.local.
 * Nada de segredo é impresso.
 */
const path = require("node:path");
const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv"))
  .config({ path: path.join(RAIZ, "frontend", ".env.local") });

const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

/**
 * O controle positivo. Glauber é o caso do #249: comprador de 04/09, ZERO
 * linhas em payment_events, e telefone presente na Hotmart. Se a pergunta
 * parar de chegar (credencial trocada, endpoint mudado, produto migrado), este
 * controle volta vazio e a ferramenta para — em vez de relatar "nenhum aluno
 * tem telefone", que é a mentira mais cara que ela poderia contar.
 */
const CONTROLE = "glaubermed@ig.com.br";

/** Só COMPLETE/APPROVED com valor > 0 é dinheiro. OVERDUE não é pagamento. */
const PAGO = new Set(["COMPLETE", "APPROVED"]);

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const raw = await r.text();
  let t;
  try { t = JSON.parse(raw).access_token; } catch { t = null; }
  if (!t) throw new Error(`sem access_token (HTTP ${r.status}) — credencial da Hotmart`);
  return t;
}

/** Corpo cru nunca vira [] em silêncio: se não parsear, o erro sobe. */
async function pedir(url, H, rotulo) {
  const r = await fetch(url, { headers: H });
  const raw = await r.text();
  try {
    const j = JSON.parse(raw);
    return { itens: j.items || (Array.isArray(j) ? j : []), http: r.status };
  } catch {
    throw new Error(`${rotulo} HTTP ${r.status}: ${raw.slice(0, 200)}`);
  }
}

/**
 * Normaliza telefone brasileiro para leitura humana. NÃO inventa DDD e NÃO
 * completa o nono dígito: se o número vier torto, ele sai torto e visível, em
 * vez de sair bonito e errado. Quem liga precisa ver o que a Hotmart gravou.
 */
function formatarTelefone(bruto) {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d; // fora do padrão: mostra cru, marcado pelo chamador
}

async function contatoDe(email, H) {
  email = String(email).toLowerCase().trim();

  const { itens: vendas } = await pedir(
    `${BASE}/sales/history?buyer_email=${encodeURIComponent(email)}&max_results=50`, H, "sales/history");

  const compras = vendas.map((v) => ({
    produto: v.product?.name?.trim() ?? "?",
    produtoId: v.product?.id ?? null,
    transacao: v.purchase?.transaction ?? null,
    valor: v.purchase?.price?.value ?? 0,
    moeda: v.purchase?.price?.currency_code ?? "?",
    status: v.purchase?.status ?? "?",
    aprovado: v.purchase?.approved_date ? new Date(v.purchase.approved_date).toISOString().slice(0, 10) : null,
    nome: v.buyer?.name ?? null,
  }));
  const pagas = compras.filter((c) => c.valor > 0 && PAGO.has(c.status));
  const totalPago = pagas.reduce((s, c) => s + c.valor, 0);

  const { itens: usuarios } = await pedir(
    `${BASE}/sales/users?buyer_email=${encodeURIComponent(email)}&max_results=50`, H, "sales/users");

  // Só o bloco BUYER. O bloco PRODUCER é o telefone da CASA — confundir os dois
  // faria a ferramenta oferecer o telefone do Johnny como se fosse o do aluno.
  let telefones = [];
  let nome = null;
  for (const u of usuarios) {
    for (const p of u.users || []) {
      if (p.role !== "BUYER") continue;
      nome = nome || p.user?.name || null;
      for (const bruto of [p.user?.cellphone, p.user?.phone]) {
        const f = formatarTelefone(bruto);
        if (f && !telefones.includes(f)) telefones.push(f);
      }
    }
  }

  return {
    email,
    nome: nome || compras[0]?.nome || null,
    telefones,
    temCanal: telefones.length > 0,
    compras,
    pagas: pagas.length,
    totalPago,
    moeda: pagas[0]?.moeda ?? null,
  };
}

(async () => {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const porFichas = args.includes("--fichas");
  let alvos = args.filter((a) => !a.startsWith("--"));

  const H = { Authorization: `Bearer ${await token()}` };

  // ---- CONTROLE POSITIVO, antes de qualquer conclusão ----
  const ctrl = await contatoDe(CONTROLE, H);
  if (!ctrl.temCanal || ctrl.pagas === 0) {
    console.error(`CONTROLE POSITIVO FALHOU: ${CONTROLE} deveria ter compra paga E telefone na Hotmart.`);
    console.error(`  veio: pagas=${ctrl.pagas} telefones=${ctrl.telefones.length}`);
    console.error("ABORTANDO — sem o controle, um resultado vazio aqui não é prova de nada.");
    process.exit(1);
  }
  if (!json) console.log(`✅ controle positivo OK (${CONTROLE}: ${ctrl.pagas} compra(s) paga(s), telefone presente)\n`);

  if (porFichas) {
    const { createClient } = require(path.join(RAIZ, "frontend", "node_modules", "@supabase/supabase-js"));
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await db.from("incidents")
      .select("numero,title,first_seen_at,affected_emails,status")
      .like("title", "E-mail não chegou no aluno%")
      .not("status", "in", "(fixed,ignored)")
      .order("first_seen_at", { ascending: true });
    if (error) throw new Error(`incidents: ${error.message}`); // erro nunca vira lista vazia
    if (!data?.length) throw new Error("nenhuma ficha de bounce aberta — confira o filtro antes de acreditar");
    alvos = [];
    for (const inc of data) for (const e of inc.affected_emails || []) {
      if (!alvos.includes(e)) alvos.push(e);
    }
    if (!json) console.log(`${data.length} ficha(s) de bounce aberta(s) → ${alvos.length} endereço(s)\n`);
  }

  if (!alvos.length) throw new Error("uso: contato_hotmart.cjs <email> [...] | --fichas");

  const saida = [];
  for (const email of alvos) {
    let r;
    try { r = await contatoDe(email, H); }
    catch (e) { r = { email, erro: e.message }; }
    saida.push(r);
    if (json) continue;

    if (r.erro) { console.log(`❌ ${email}\n   erro: ${r.erro}\n`); continue; }
    const marca = r.temCanal ? "📞" : "🚫";
    console.log(`${marca} ${r.email}`);
    console.log(`   nome: ${r.nome ?? "(não informado)"}`);
    console.log(`   telefone: ${r.telefones.length ? r.telefones.join(" · ") : "NENHUM na Hotmart"}`);
    if (r.pagas) {
      console.log(`   pagou: ${r.totalPago.toFixed(2)} ${r.moeda} em ${r.pagas} compra(s)`);
      for (const c of r.compras) {
        const $ = c.valor > 0 && PAGO.has(c.status) ? "✓" : "·";
        console.log(`     ${$} ${c.aprovado ?? "?"} ${c.produto} — ${c.valor} ${c.moeda} [${c.status}] ${c.transacao ?? ""}`);
      }
    } else {
      console.log("   pagou: NENHUMA compra paga encontrada na Hotmart neste e-mail");
    }
    console.log("");
  }

  if (json) { console.log(JSON.stringify({ controle: CONTROLE, resultados: saida }, null, 2)); return; }

  const comCanal = saida.filter((r) => r.temCanal).length;
  const semCanal = saida.filter((r) => !r.erro && !r.temCanal).length;
  const comErro = saida.filter((r) => r.erro).length;
  console.log("─".repeat(56));
  console.log(`${saida.length} endereço(s): ${comCanal} COM telefone · ${semCanal} sem · ${comErro} com erro`);
  console.log("Telefone é canal EXTERNO: falar com o aluno por ele precisa do aval de quem fala pela casa.");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
