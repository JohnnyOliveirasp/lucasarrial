#!/usr/bin/env node
/**
 * 2026-09-21_garantia_dos_90_vazios.cjs — O RELÓGIO da decisão do #506.
 *
 * POR QUE EXISTE: a escalação das 17hZ de 21/09 levou ao Johnny quantos dos 90
 * pedidos vazios do SGP ainda têm ACESSO (18) e CRÉDITO>0 (22). Nenhum desses
 * números tem prazo. O que tem prazo — e não volta depois de vencido — é a
 * JANELA DE GARANTIA da Hotmart: a cada dia sem decisão, aluno pagante migra de
 * "dá pra devolver" para "não dá mais". É a família do #207, em que o aviso
 * ficou na nota, a garantia venceu e o aluno ficou com R$97 sem devolução.
 * Medido em 21/09 23h50Z: 7 JÁ fora, 5 ainda dentro, e TRÊS deles vencendo em
 * 23/09. Rode a cada ronda enquanto o #506 estiver aberto.
 *
 * COMO ELE NÃO MENTE:
 *  - roda a MESMA função de produção que a Fast usa (`lib/agent/garantia.ts`,
 *    `janelasPorProduto`), não uma régua paralela reimplementada aqui;
 *  - PAGINA o `payment_events` (a consulta corta em 1000 linhas EM SILÊNCIO);
 *  - NÃO conta "sem compra aprovada naquele endereço" como não-pagante — pela
 *    doutrina da casa isso NÃO é prova de não-pagamento (pode ser outro e-mail),
 *    e é por isso que eles saem numa faixa própria em vez de virarem zero.
 *
 * ⚠️ MARGEM DE ±1 DIA, DECLARADA: para hellengrasso@gmail.com esta leitura dá
 * fim em 12/09 e o `2026-09-15_garantia_por_produto.cjs` dá 11/09 (borda de fim
 * de dia). A borda NÃO foi investigada. Trate a data como LIMITE MÁXIMO e aja
 * um dia antes — nunca no próprio dia do vencimento.
 *
 * ⚠️ NÃO lê a planilha (ordem de 29/08). Lê `sgp_pedidos`, que é o sistema NOVO
 * em produção desde 29/08, e `payment_events`.
 *
 * SOMENTE LEITURA: não grava, não devolve dinheiro, não escreve pra ninguém.
 *
 * uso: node _frank/ferramentas/2026-09-21_garantia_dos_90_vazios.cjs
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
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  // erro de consulta NUNCA pode virar "não tem nada": aborta, não conclui zero.
  if (!r.ok) throw new Error(`SQL HTTP ${r.status}: ${t.slice(0, 400)}`);
  return JSON.parse(t);
}

(async () => {
  const agora = new Date();
  const pedidos = await sql(`
    select id, lower(email) as email, criado_em, status
    from sgp_pedidos
    where origem='planilha_antiga' and fotos='[]'::jsonb and audios='[]'::jsonb
    order by criado_em;`);
  const emails = [...new Set(pedidos.map((p) => p.email).filter(Boolean))];
  console.log(`pedidos importados VAZIOS da planilha antiga: ${pedidos.length}`);
  console.log(`e-mails distintos: ${emails.length}\n`);
  if (!emails.length) return;

  const inList = emails.map((e) => `'${e.replace(/'/g, "''")}'`).join(",");
  const linhas = [];
  for (let off = 0; ; off += 1000) {
    const page = await sql(`
      select lower(buyer_email) as email, payload from payment_events
      where provider='hotmart' and event_type='PURCHASE_APPROVED'
        and lower(buyer_email) in (${inList})
      order by id limit 1000 offset ${off};`);
    linhas.push(...page);
    if (page.length < 1000) break;
  }
  console.log(`payment_events PURCHASE_APPROVED lidos: ${linhas.length}`);

  const porEmail = new Map();
  for (const l of linhas) {
    if (!porEmail.has(l.email)) porEmail.set(l.email, []);
    porEmail.get(l.email).push({ payload: l.payload });
  }
  console.log(`com compra aprovada NAQUELE endereço: ${porEmail.size} de ${emails.length}\n`);

  const dentro = [];
  const fora = [];
  const sem = [];
  for (const e of emails) {
    const evs = porEmail.get(e);
    if (!evs) {
      sem.push(e);
      continue;
    }
    let melhor = null;
    for (const p of G.janelasPorProduto(evs, agora)) {
      const fim = p.fim ?? p.fimGarantia ?? null;
      if (!fim) continue;
      const d = new Date(fim);
      if (!melhor || d > melhor.d) melhor = { d, nome: p.produto ?? p.nome ?? "?" };
    }
    if (!melhor) {
      sem.push(e);
      continue;
    }
    (melhor.d >= agora ? dentro : fora).push({ e, fim: melhor.d, prod: melhor.nome });
  }

  console.log("══════════════════════════════════════════════");
  console.log(`JÁ FORA da janela (não dá mais reembolso normal): ${fora.length}`);
  console.log(`AINDA DENTRO da janela (dá pra devolver hoje)   : ${dentro.length}`);
  console.log(`sem compra aprovada nesse endereço              : ${sem.length}`);
  console.log("   ⚠️ estes NÃO são não-pagantes: ausência de pagamento naquele");
  console.log("      endereço não é prova de não-pagamento (pode ser outro e-mail).");
  console.log("══════════════════════════════════════════════\n");

  if (dentro.length) {
    console.log("AINDA DENTRO — o que vence primeiro é o que decide o prazo:");
    dentro.sort((a, b) => a.fim - b.fim);
    for (const x of dentro) {
      console.log(`   vence ${x.fim.toISOString().slice(0, 10)}  ${x.e}  (${x.prod})`);
    }
    console.log(`\n>>> PRAZO DA DECISÃO: ${dentro[0].fim.toISOString().slice(0, 10)} é LIMITE MÁXIMO.`);
    console.log("    Aja UM DIA ANTES — a leitura tem margem declarada de ±1 dia.");
  } else {
    console.log("AINDA DENTRO: nenhum. Não há mais janela a salvar nesta classe.");
  }
  if (fora.length) {
    console.log("\nFORA — os 10 que venceram mais recentemente:");
    fora.sort((a, b) => b.fim - a.fim);
    for (const x of fora.slice(0, 10)) {
      console.log(`   venceu ${x.fim.toISOString().slice(0, 10)}  ${x.e}  (${x.prod})`);
    }
  }
})();
