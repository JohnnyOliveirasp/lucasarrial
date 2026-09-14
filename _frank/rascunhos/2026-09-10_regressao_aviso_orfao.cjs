#!/usr/bin/env node
/**
 * REVISÃO DO FIX DO #333, antes de mergear: a trava de pagamento nova
 * silenciaria algum PAGANTE de verdade?
 *
 * O risco real não é o falso alarme que eu quero matar — é o oposto: se o
 * evento que dispara o aviso (PURCHASE_APPROVED / PURCHASE_COMPLETE) NÃO
 * carregar `price.value` ou vier com status fora de COMPLETE/APPROVED, a
 * guarda nova cala um comprador que pagou. Isso é o incidente 54c14038
 * ("AVISO DE COMPRA ORFA NAO DISPAROU PARA UM PAGANTE") de novo, criado por
 * mim.
 *
 * Então: rodo a regra NOVA contra o histórico REAL de eventos do produto e
 * separo quem perderia o aviso, cruzando com quem tem perfil.
 *
 * Só lê. Não altera nada.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const PRODUTO = "7851642";
const EVENTOS_QUE_LIBERAM = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const STATUS_PAGO = new Set(["COMPLETE", "COMPLETED", "APPROVED"]);

/** cópia byte a byte da regra de acesso-regra.ts que o fix passa a usar */
function eventoEhPagamento(valor, status) {
  const v = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(v) || v <= 0) return false;
  return STATUS_PAGO.has(String(status ?? "").toUpperCase());
}

async function paginar(tabela, colunas, aplicar) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(tabela).select(colunas).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (aplicar) q = aplicar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${JSON.stringify(error)}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function main() {
  const evs = await paginar("payment_events", "id, buyer_email, event_type, received_at, payload", (q) =>
    q.in("event_type", [...EVENTOS_QUE_LIBERAM]),
  );
  console.log(`payment_events que liberam acesso, paginados: ${evs.length}`);

  const doProduto = evs.filter((e) => String(e.payload?.data?.product?.id ?? "") === PRODUTO);
  console.log(`do produto ${PRODUTO}: ${doProduto.length}\n`);

  // 1) Quantos eventos a regra nova silenciaria?
  const cala = [];
  const passa = [];
  for (const e of doProduto) {
    const p = e.payload?.data?.purchase;
    const ok = eventoEhPagamento(p?.price?.value, p?.status);
    (ok ? passa : cala).push({
      email: String(e.buyer_email ?? "").toLowerCase(),
      tipo: e.event_type,
      em: e.received_at,
      valor: p?.price?.value ?? null,
      status: p?.status ?? null,
    });
  }
  console.log(`regra NOVA: ${passa.length} eventos seguem avisando, ${cala.length} passam a ser silenciados`);

  // 2) Dos silenciados, quem é PAGANTE por OUTRO evento? Esse é o perigo.
  const pagouAlgumaVez = new Set(passa.map((p) => p.email));
  const caladosDePagante = cala.filter((c) => pagouAlgumaVez.has(c.email));
  console.log(
    `dos silenciados, de gente que PAGOU em algum outro evento: ${caladosDePagante.length} ` +
      `(${new Set(caladosDePagante.map((c) => c.email)).size} pessoas)`,
  );

  // 3) O que importa de verdade: pagante SEM conta cujo aviso sumiria por
  //    completo — nenhum evento dele passa na regra nova.
  const emailsCalados = [...new Set(cala.map((c) => c.email))].filter((e) => e && !pagouAlgumaVez.has(e));
  const semPerfil = new Set(emailsCalados);
  const CHUNK = 300;
  const listaCalados = [...emailsCalados];
  for (let i = 0; i < listaCalados.length; i += CHUNK) {
    const { data, error } = await db
      .from("profiles")
      .select("email")
      .in("email", listaCalados.slice(i, i + CHUNK));
    if (error) throw new Error("profiles: " + JSON.stringify(error));
    for (const p of data ?? []) semPerfil.delete(String(p.email).toLowerCase());
  }
  console.log(
    `\ncompradores que perderiam o aviso POR COMPLETO (nenhum evento pago): ${emailsCalados.length}\n` +
      `   destes, SEM perfil hoje (seriam de fato silenciados): ${semPerfil.size}`,
  );

  // 4) Prova por amostra: os status/valores desses silenciados totais.
  const porMotivo = new Map();
  for (const c of cala) {
    if (!semPerfil.has(c.email)) continue;
    const v = Number(c.valor);
    const motivo = !Number.isFinite(v) || v <= 0 ? `valor ${c.valor}` : `status ${c.status}`;
    porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
  }
  console.log("\n   por que seriam silenciados (evento a evento):");
  for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`      ${m}: ${n}`);

  // 5) O teste que decide o merge: existe alguém com dinheiro > 0 em QUALQUER
  //    evento do produto que a regra nova silenciaria de vez?
  const comDinheiro = [...semPerfil].filter((em) =>
    cala.some((c) => c.email === em && Number(c.valor) > 0),
  );
  console.log(
    `\nVEREDITO: silenciados-sem-conta que em ALGUM evento tiveram valor > 0: ${comDinheiro.length}` +
      (comDinheiro.length ? `\n   ${comDinheiro.join(", ")}` : "  -> nenhum. A guarda nao cala pagante."),
  );
  if (comDinheiro.length) {
    for (const em of comDinheiro) {
      for (const c of cala.filter((x) => x.email === em)) {
        console.log(`   ${em} | ${c.tipo} | ${c.em} | valor ${c.valor} | status ${c.status}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
