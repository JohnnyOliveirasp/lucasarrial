/**
 * #265 — o que a linha de GARANTIA da Fast diz ANTES e DEPOIS, nos payloads VIVOS.
 *
 * POR QUE EXISTE (regra 25-B): os testes do `account-garantia.test.ts` rodam em
 * fixture, e fixture não é produção. Este script roda a função NOVA contra o
 * `payment_events` de verdade e imprime, aluno a aluno, a linha que a Fast
 * receberia hoje. É ele que sustenta os números da ronda — e por isso mora em
 * `_frank/ferramentas/` (rastreado), não em `_Bugs/` (ignorado).
 *
 * uso:
 *   node _frank/ferramentas/2026-09-15_garantia_por_produto.cjs            # resumo + os que MUDAM
 *   node _frank/ferramentas/2026-09-15_garantia_por_produto.cjs <email>    # um aluno, bloco inteiro
 *
 * ⚠️ SÓ LEITURA. Não escreve nada, não cobra nada, não toca em crédito.
 */
const path = require("node:path");
const FRONT = path.join(__dirname, "..", "..", "frontend");
require(path.join(FRONT, "node_modules", "dotenv")).config({ path: path.join(FRONT, ".env.local") });

const jiti = require(path.join(FRONT, "node_modules", "jiti"))(__filename, { interopDefault: true });
const G = jiti(path.join(FRONT, "src", "lib", "agent", "garantia.ts"));

const PROJECT = "yizerthyrgrajivlotcw";
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  // erro de consulta NUNCA pode virar "não tem nada": aborta, não conclui zero.
  if (!r.ok) throw new Error(`SQL HTTP ${r.status}: ${txt.slice(0, 400)}`);
  return JSON.parse(txt);
}

(async () => {
  const alvo = process.argv[2]?.toLowerCase() || null;
  const agora = new Date();

  // Paginado de propósito: a consulta corta em 1000 linhas em silêncio.
  const linhas = [];
  for (let off = 0; ; off += 1000) {
    const page = await sql(`
      select lower(buyer_email) as email, payload
      from payment_events
      where provider='hotmart' and event_type='PURCHASE_APPROVED'
        ${alvo ? `and lower(buyer_email) = '${alvo.replace(/'/g, "''")}'` : ""}
      order by id limit 1000 offset ${off};
    `);
    linhas.push(...page);
    if (page.length < 1000) break;
  }
  console.log(`linhas lidas: ${linhas.length}`);

  const porEmail = new Map();
  for (const l of linhas) {
    if (!porEmail.has(l.email)) porEmail.set(l.email, []);
    porEmail.get(l.email).push({ payload: l.payload });
  }

  let comBloco = 0;
  let viraDentro = 0;
  const mudam = [];

  for (const [email, evs] of porEmail) {
    const antes = G.janelaGarantia(evs, agora);
    const produtos = G.janelasPorProduto(evs, agora);
    const bloco = G.blocoGarantiaMultiProduto(produtos, agora);

    if (alvo) {
      console.log(`\n=== ${email}`);
      console.log(
        `ANTES: ${antes ? `compra ${G.diaBR(antes.compra)} · fim ${G.diaBR(antes.fim)} · ${antes.dentro ? "DENTRO" : "FORA"}` : "ESCALAR"}`,
      );
      console.log(`DEPOIS:\n${bloco ?? "(bloco null → cai na linha única de sempre)"}`);
      continue;
    }
    if (!bloco) continue;
    comBloco++;

    // O que importa: produto que a linha única dava por FORA e que agora aparece
    // DENTRO. É o conserto — e é também o único jeito de prometer a mais, então
    // cada um destes é conferido no olho, não no agregado.
    const abre = produtos.filter((p) => p.estado === "dentro");
    if (antes && !antes.dentro && abre.length) {
      viraDentro++;
      mudam.push({ email, antes, abre, produtos });
    }
  }

  if (alvo) return;

  console.log(`\nalunos com compras de 2+ produtos e bloco multi-produto: ${comBloco}`);
  console.log(`destes, os que a linha ÚNICA declarava FORA e que agora têm ALGUM produto DENTRO: ${viraDentro}`);
  console.log(`\n=== OS QUE MUDAM DE VEREDITO (um a um) ===`);
  for (const m of mudam) {
    console.log(`\n--- ${m.email}`);
    console.log(`  ANTES (linha única): fim ${G.diaBR(m.antes.fim)} → FORA`);
    for (const p of m.produtos) {
      const nome = p.produto ?? p.produtoId ?? "(sem identidade)";
      const fim = p.fim ? G.diaBR(p.fim) : "—";
      console.log(`  DEPOIS · ${nome}: ${p.estado}${p.fim ? ` até ${fim}` : ""}`);
    }
  }
  const indef = [...porEmail.values()].flatMap((evs) =>
    G.janelasPorProduto(evs, agora).filter((p) => p.estado === "indefinida"),
  );
  console.log(`\nprodutos em estado 'indefinida' na base inteira: ${indef.length} (0 = nenhuma ignorância viva hoje)`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
