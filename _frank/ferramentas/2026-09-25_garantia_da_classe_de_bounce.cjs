/**
 * 2026-09-25_garantia_da_classe_de_bounce.cjs
 * "Quem da classe de bounce JÁ PERDEU a janela, e quem ainda dá pra salvar?"
 *
 * ══════════════════════════════════════════════════════════════════════
 * POR QUE EXISTE
 * ══════════════════════════════════════════════════════════════════════
 * A classe #249 (carta de acesso que quica) tem pagante que nunca recebeu
 * nada. Desde 13/09 o passo que falta é sempre o mesmo: aval pro canal
 * EXTERNO (telefone/WhatsApp), porque pra esses o e-mail está morto com
 * prova. O pedido foi feito em 13/09, 17/09 e 19/09 e não foi respondido —
 * e o cartão do Ulysses (#340) passou 11,2 dias parado esperando.
 *
 * O que faltava no pedido era RELÓGIO. "Pode falar com eles?" é uma pergunta
 * sem prazo, e pergunta sem prazo espera para sempre. Esta ferramenta põe a
 * data de garantia da Hotmart em cima de cada nome, e separa:
 *
 *   - quem JÁ PERDEU a janela  → o dano está feito; decidir é sobre reparar
 *   - quem AINDA ESTÁ DENTRO   → decidir HOJE ainda evita o dano
 *
 * Medido em 25/09 no Ulysses: `warranty_date` 2026-09-17T00:00Z, vencida há
 * 8 dias, R$ 741,00 de SGP, entrega ZERO. É o mesmo desfecho do #207 (a
 * garantia venceu com o aluno na nossa fila e ele ficou sem devolução) e do
 * #363. Portanto o dano desta classe não é hipótese: já aconteceu 1x aqui.
 *
 * ══════════════════════════════════════════════════════════════════════
 * ⚠️ SÓ LEITURA. Não manda e-mail, não liga, não escreve no banco, não
 *    fecha incidente, não toca em crédito/acesso/estorno.
 * ══════════════════════════════════════════════════════════════════════
 *
 * ══════════════════════════════════════════════════════════════════════
 * AS ARMADILHAS QUE ESTA FERRAMENTA NÃO REPETE
 * ══════════════════════════════════════════════════════════════════════
 *
 * (1) NÃO reimplementa a regra de garantia. Usa `janelasPorProduto()` do
 *     `frontend/src/lib/agent/garantia.ts`, que é onde mora o conserto do
 *     #265. Reimplementar aqui ressuscitaria a constante de 7 dias, que o
 *     #265 provou errada em 648+24+3+1 compras.
 *
 * (2) A DATA VEM DA HOTMART, NÃO DE CONTA NOSSA. O campo é
 *     `payload.data.product.warranty_date`. Sem ele, o estado é
 *     `indefinida` → ESCALAR, e esta ferramenta imprime NÃO MEDIDA.
 *     Nunca "sem garantia", que é afirmação que não se tem.
 *
 * (3) ⚠️ O QUE ESTA FERRAMENTA **NÃO** ENXERGA: compra que a Hotmart
 *     confirma mas cujo WEBHOOK nunca chegou no nosso `payment_events`.
 *     Medido em 25/09: o Ulysses tem 2 compras pagas na Hotmart
 *     (SGP 741,00 + Fábrica 252,45) e **1 linha só** no nosso banco.
 *     Por isso cada e-mail imprime quantas linhas temos: linha de menos
 *     aqui é buraco de webhook, e o veredito sai PARCIAL, não completo.
 *     Quem quiser a verdade da Hotmart viva usa o `contato_hotmart.cjs`.
 *
 * (4) Consulta ao Supabase corta em 1000 linhas em silêncio → pagina.
 *     Erro de HTTP aborta; nunca vira "não tem nada".
 *
 * ⚠️ CONTROLE POSITIVO OBRIGATÓRIO (disciplina da casa): o Ulysses tem
 *    valor conferido no olho em 25/09 — `warranty_date` 2026-09-17T00:00Z,
 *    estado `fora`. Se o controle não bater, a ferramenta ABORTA em vez de
 *    imprimir número bonito e errado.
 *
 * uso:
 *   node _frank/ferramentas/2026-09-25_garantia_da_classe_de_bounce.cjs
 *   node _frank/ferramentas/2026-09-25_garantia_da_classe_de_bounce.cjs <email> [...]
 */
const path = require("node:path");
const FRONT = path.join(__dirname, "..", "..", "frontend");
require(path.join(FRONT, "node_modules", "dotenv")).config({ path: path.join(FRONT, ".env.local") });

const jiti = require(path.join(FRONT, "node_modules", "jiti"))(__filename, { interopDefault: true });
const G = jiti(path.join(FRONT, "src", "lib", "agent", "garantia.ts"));

const PROJECT = "yizerthyrgrajivlotcw";

// A classe de bounce, como o contato_hotmart.cjs --fichas a enxerga em 25/09.
const CLASSE = [
  "glaubermed@ig.com.br",
  "andy.silvestre@icloud.com",
  "sunesacristina01@gmail.com",
  "valdene_marques@msn.com",
  "ulyssemmachado@gmail.com",
  "horta.pericias@gmail.com.br",
  "luctec@gmail.com",
  "elianecaurim@ig.com.br",
  "thallitamachado@hotmail.com",
  "pc.sul157@gmail.com",
  "alinedutra_@hotmail.com.br",
];

// Controle positivo: conferido no olho em 25/09 no payload cru.
const CONTROLE = { email: "ulyssemmachado@gmail.com", fim: "2026-09-17", estado: "fora" };

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`SQL HTTP ${r.status}: ${txt.slice(0, 400)}`);
  return JSON.parse(txt);
}

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

(async () => {
  const alvos = process.argv.slice(2).map((s) => s.toLowerCase());
  const lista = alvos.length ? alvos : CLASSE;
  const agora = new Date();

  const inList = lista.map((e) => `'${e.replace(/'/g, "''")}'`).join(",");
  const linhas = [];
  for (let off = 0; ; off += 1000) {
    const page = await sql(`
      select lower(buyer_email) as email, payload
      from payment_events
      where provider='hotmart' and event_type='PURCHASE_APPROVED'
        and lower(buyer_email) in (${inList})
      order by id limit 1000 offset ${off};
    `);
    linhas.push(...page);
    if (page.length < 1000) break;
  }

  const porEmail = new Map();
  for (const l of linhas) {
    if (!porEmail.has(l.email)) porEmail.set(l.email, []);
    porEmail.get(l.email).push({ payload: l.payload });
  }

  // ── controle positivo ───────────────────────────────────────────────
  const ctrlEvs = porEmail.get(CONTROLE.email);
  if (!ctrlEvs) {
    console.error(`✖ CONTROLE POSITIVO FALHOU: ${CONTROLE.email} sem linha em payment_events.`);
    process.exit(1);
  }
  const ctrl = G.janelasPorProduto(ctrlEvs, agora);
  const ok = ctrl.some((p) => p.estado === CONTROLE.estado && iso(p.fim) === CONTROLE.fim);
  if (!ok) {
    console.error(
      `✖ CONTROLE POSITIVO FALHOU: esperava ${CONTROLE.email} estado=${CONTROLE.estado} fim=${CONTROLE.fim}; ` +
        `veio ${JSON.stringify(ctrl.map((p) => ({ estado: p.estado, fim: iso(p.fim) })))}`,
    );
    process.exit(1);
  }
  console.log(`✅ controle positivo OK (${CONTROLE.email}: ${CONTROLE.estado} até ${CONTROLE.fim})\n`);

  const dias = (d) => Math.round((new Date(d) - agora) / 86400000);
  const perdeu = [];
  const dentro = [];
  const naoMedido = [];

  for (const email of lista) {
    const evs = porEmail.get(email);
    console.log(`── ${email}`);
    if (!evs) {
      console.log(`   ⚠️  NÃO MEDIDA — 0 linha de webhook no nosso banco.`);
      console.log(`      (não é "não pagou": o contato_hotmart.cjs lê a Hotmart viva)`);
      naoMedido.push({ email, motivo: "0 linha de webhook" });
      continue;
    }
    console.log(`   linhas de webhook no nosso banco: ${evs.length}`);
    const produtos = G.janelasPorProduto(evs, agora);
    for (const p of produtos) {
      const nome = p.produto ?? p.produtoId ?? "(sem identidade)";
      if (p.estado === "indefinida" || !p.fim) {
        console.log(`   ❓ ${nome}: NÃO MEDIDA (sem warranty_date legível) → ESCALAR`);
        naoMedido.push({ email, motivo: `sem warranty_date (${nome})` });
        continue;
      }
      const d = dias(p.fim);
      if (p.estado === "fora") {
        console.log(`   ⛔ ${nome}: PERDEU a janela em ${iso(p.fim)} (há ${-d}d)`);
        perdeu.push({ email, nome, fim: iso(p.fim), d: -d });
      } else {
        console.log(`   ✅ ${nome}: DENTRO até ${iso(p.fim)} (faltam ${d}d)`);
        dentro.push({ email, nome, fim: iso(p.fim), d });
      }
    }
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`⛔ JÁ PERDERAM a janela: ${perdeu.length}`);
  for (const p of perdeu.sort((a, b) => b.d - a.d)) {
    console.log(`   ${String(p.d).padStart(3)}d atrás · ${p.email} · ${p.nome} (fim ${p.fim})`);
  }
  console.log(`\n✅ AINDA DENTRO (decidir hoje ainda evita o dano): ${dentro.length}`);
  for (const p of dentro.sort((a, b) => a.d - b.d)) {
    console.log(`   faltam ${String(p.d).padStart(3)}d · ${p.email} · ${p.nome} (fim ${p.fim})`);
  }
  console.log(`\n❓ NÃO MEDIDAS: ${naoMedido.length}`);
  for (const p of naoMedido) console.log(`   ${p.email} — ${p.motivo}`);
  console.log(`${"═".repeat(70)}`);
  console.log(`Nada foi alterado: esta ferramenta só lê.`);
  console.log(`Telefone é canal EXTERNO — falar por ele precisa do aval de quem fala pela casa.`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
