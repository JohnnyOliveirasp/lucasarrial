#!/usr/bin/env node
/**
 * 2026-09-24_portao_sgp_inicio.cjs — MEDIÇÃO do portão da tela 1 do SGP.
 *
 * POR QUE EXISTE: o Johnny mandou fechar o portão do /sgp/inicio ("só entra
 * quem tem compra confirmada") e o card exige medir QUANTAS contas passam a
 * ser barradas ANTES de subir — falso positivo aqui é expulsar pagante.
 *
 * O QUE ELE MEDE, com a MESMA régua que vai pra produção (nada reimplementado):
 *  - compradores do SGP: PURCHASE_APPROVED do produto em `payment_events`,
 *    extraído com os helpers canônicos (`hotmart-payload.ts`) e casado por
 *    `chaveEmail` (`compradores.ts`) — via jiti, o FONTE de verdade;
 *  - quem está no portal: e-mails distintos de `sgp_pedidos`;
 *  - a decisão: `portaoDoInicio` (o módulo novo), alimentada com o dado real.
 *
 * E imprime dois CASOS REAIS de ponta a ponta (item 5 do card):
 *  - um e-mail COM compra → tem que ENTRAR;
 *  - um e-mail SEM compra e sem pedido → tem que ser BARRADO.
 *
 * SOMENTE LEITURA: não grava, não manda e-mail, não mexe em pedido nenhum.
 * PAGINADO (incidente 72a4c9db): o PostgREST corta em 1000 EM SILÊNCIO.
 * Controle positivo: aborta se as fontes voltarem vazias — zero aqui é falha
 * de leitura, não "ninguém comprou".
 *
 * uso: node _frank/ferramentas/2026-09-24_portao_sgp_inicio.cjs
 *      (precisa de frontend/node_modules e frontend/.env.local resolvíveis)
 */
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
const FRONT = path.join(RAIZ, "frontend");
require(path.join(FRONT, "node_modules", "dotenv")).config({ path: path.join(FRONT, ".env.local") });

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("realtime nao e usado por esta ferramenta");
    }
  };
}

const { createClient } = require(path.join(FRONT, "node_modules", "@supabase/supabase-js"));
const jiti = require(path.join(FRONT, "node_modules", "jiti"))(__filename, { interopDefault: true });

const HP = jiti(path.join(FRONT, "src", "lib", "payments", "hotmart-payload.ts"));
const BV = jiti(path.join(FRONT, "src", "lib", "payments", "sgp-boas-vindas.ts"));
const C = jiti(path.join(FRONT, "src", "lib", "sgp", "compradores.ts"));
const PORTAO = jiti(path.join(FRONT, "src", "lib", "sgp", "portao-inicio.ts"));

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("credenciais do Supabase ausentes no .env.local");
  return createClient(url, key);
}

/** Paginação com aborto em erro — lista incompleta aqui vira número mentiroso. */
async function paginar(db, montar) {
  const tudo = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(db, de, de + 999);
    if (error) throw new Error(error.message);
    tudo.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return tudo;
}

(async () => {
  const db = supa();
  const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? BV.SGP_PRODUCT_ID_PADRAO;
  console.log(`produto SGP: ${produtoSgp}\n`);

  const [eventos, pedidos] = await Promise.all([
    paginar(db, (dbx, de, ate) =>
      dbx.from("payment_events").select("payload").eq("event_type", "PURCHASE_APPROVED").order("id", { ascending: true }).range(de, ate),
    ),
    paginar(db, (dbx, de, ate) =>
      dbx.from("sgp_pedidos").select("id, email, status, criado_em, origem").order("id", { ascending: true }).range(de, ate),
    ),
  ]);

  // CONTROLE POSITIVO: fonte vazia é falha de leitura, não conclusão.
  if (eventos.length === 0) throw new Error("payment_events voltou VAZIO — leitura quebrada, nada a concluir");
  if (pedidos.length === 0) throw new Error("sgp_pedidos voltou VAZIO — leitura quebrada, nada a concluir");
  console.log(`PURCHASE_APPROVED lidos: ${eventos.length}`);
  console.log(`linhas em sgp_pedidos:   ${pedidos.length}`);

  // Compradores do SGP, pela régua canônica.
  const chavesComCompra = new Set();
  let comprasSgp = 0;
  for (const e of eventos) {
    const data = HP.asRecord(HP.asRecord(e.payload).data);
    if (HP.extractProductCode(data) !== produtoSgp) continue;
    comprasSgp += 1;
    const email = HP.extractBuyerEmail(data);
    if (email) chavesComCompra.add(C.chaveEmail(email));
  }
  console.log(`compras do SGP (eventos): ${comprasSgp}`);
  console.log(`compradores distintos:    ${chavesComCompra.size}\n`);
  if (chavesComCompra.size === 0) throw new Error("zero compradores de SGP — regua ou produto errado, aborta");

  // Quem está no portal, por pessoa.
  const porChave = new Map();
  for (const p of pedidos) {
    if (!p.email) continue;
    const k = C.chaveEmail(p.email);
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(p);
  }
  console.log(`pessoas no portal (e-mails distintos em sgp_pedidos): ${porChave.size}`);

  // O número do card: quem seria barrado SEM a cláusula de quem já estava
  // dentro (só compra decide) — é o teto do estrago possível…
  const semCompra = [...porChave.keys()].filter((k) => !chavesComCompra.has(k));
  console.log(`\n— pessoas do portal SEM compra registrada do SGP: ${semCompra.length}`);
  for (const k of semCompra) {
    const ps = porChave.get(k);
    const melhor = C.escolherPedido(ps);
    console.log(`   ${mascarar(k)}  status=${melhor.status}  origem=${melhor.origem ?? "portal"}  criado=${String(melhor.criado_em).slice(0, 10)}`);
  }

  // …e o número COM a régua que vai subir (compra OU pedido anterior):
  let barradosDosExistentes = 0;
  for (const k of porChave.keys()) {
    const d = PORTAO.portaoDoInicio({ temCompraSgp: chavesComCompra.has(k), temPedidoAnterior: true });
    if (d.acao === "barrar") barradosDosExistentes += 1;
  }
  console.log(`\ncom a régua que vai subir (compra OU pedido anterior):`);
  console.log(`  contas existentes barradas: ${barradosDosExistentes} (esperado: 0 — ninguém que já estava dentro é expulso)`);

  // Compradores que ainda NÃO começaram: têm que ENTRAR quando vierem.
  const compradoresSemPedido = [...chavesComCompra].filter((k) => !porChave.has(k));
  let compradorBarrado = 0;
  for (const k of compradoresSemPedido) {
    const d = PORTAO.portaoDoInicio({ temCompraSgp: true, temPedidoAnterior: false });
    if (d.acao === "barrar") compradorBarrado += 1;
  }
  console.log(`  compradores que nunca começaram: ${compradoresSemPedido.length} — barrados pela régua: ${compradorBarrado} (esperado: 0)`);

  // ── ITEM 5 DO CARD: um caso real de cada lado, ponta a ponta ──────────────
  console.log(`\n— CASO 1 (TEM compra, deve ENTRAR):`);
  const casoCom = compradoresSemPedido[0] ?? [...chavesComCompra][0];
  const d1 = PORTAO.portaoDoInicio({ temCompraSgp: chavesComCompra.has(casoCom), temPedidoAnterior: porChave.has(casoCom) });
  console.log(`   ${mascarar(casoCom)} → ${d1.acao.toUpperCase()}`);
  if (d1.acao !== "entrar") throw new Error("COMPRADOR BARRADO — a régua está errada, NÃO SUBIR");

  console.log(`— CASO 2 (NÃO tem compra nem pedido, deve ser BARRADO):`);
  const casoSem = "pessoa-sem-compra-nenhuma-24-09@example.com";
  const kSem = C.chaveEmail(casoSem);
  if (chavesComCompra.has(kSem) || porChave.has(kSem)) throw new Error("o caso de controle colide com dado real");
  const d2 = PORTAO.portaoDoInicio({ temCompraSgp: chavesComCompra.has(kSem), temPedidoAnterior: porChave.has(kSem) });
  console.log(`   ${casoSem} → ${d2.acao.toUpperCase()}`);
  if (d2.acao !== "barrar") throw new Error("NÃO-COMPRADOR ENTROU — a régua está errada, NÃO SUBIR");
  console.log(`   mensagem ao barrado: "${d2.mensagem}"`);

  console.log(`\nOK — régua conferida contra o banco real.`);
})().catch((e) => {
  console.error(`FALHOU: ${e.message}`);
  process.exit(1);
});

/** e-mail real sai mascarado no log (repo público de trabalho). */
function mascarar(email) {
  const [local, dominio] = String(email).split("@");
  if (!dominio) return "(inválido)";
  const l = local.length <= 3 ? `${local[0]}**` : `${local.slice(0, 3)}***`;
  return `${l}@${dominio}`;
}
