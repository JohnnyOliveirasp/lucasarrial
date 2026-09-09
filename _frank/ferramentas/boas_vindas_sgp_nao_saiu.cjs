#!/usr/bin/env node
/**
 * "Algum comprador do SGP pagou e o e-mail de boas-vindas NAO saiu?" (#324)
 *
 * POR QUE EXISTE. O envio das boas-vindas do SGP e marcado como tratado mesmo
 * quando falha — de proposito, pra que o reenvio da Hotmart (ate 5x) nao vire
 * rajada em cima do aluno (sgp-boas-vindas.ts:448-453). O preco desse desenho e
 * que a falha PRECISA ser denunciada por outro caminho, e os dois caminhos
 * previstos nao funcionavam:
 *
 *   1. `avisos_enviados` com `ok=false` — a tabela vem da migration 104, que
 *      NUNCA FOI APLICADA. A consulta responde "Could not find the table".
 *   2. `payment_events.error` — existia, mas sem a CAUSA (so "boas-vindas do
 *      SGP nao sairam"), e ninguem varria esse campo procurando por isto.
 *
 * Resultado medido em 09/09: dois compradores pagaram de manha (R$ 997,00 e
 * R$ 915,74, ambos APPROVED), o SMTP recusou os dois, a trava gravou os dois
 * como avisados e eles ficaram 7 HORAS sem receber nada — sem conseguir nem
 * entrar, porque o link de definir senha so viajava dentro daquele e-mail.
 * Ninguem ia procura-los: nenhum caminho automatico tenta de novo.
 *
 * O QUE ELE FAZ: le a trava (`agent_state["sgp_boas_vindas"]`) e acusa toda
 * transacao com `canais` VAZIO — que e, literalmente, "tentamos e ninguem
 * recebeu". Para cada uma diz se a pessoa tem conta, se ja logou e se chegou a
 * abrir pedido no portal, que e o que decide a urgencia.
 *
 * ⚠️ CONTROLE POSITIVO, e ABORTA se ele falhar. O modo de falha real deste tipo
 * de varredor nao e acusar demais: e ler a chave errada (ou o formato mudar) e
 * devolver "zero vitimas" com ar de boa noticia — foi assim que a casa reportou
 * "pagante sem acesso: zero" em 07/09 com um instrumento cego. Entao a
 * ferramenta e obrigada a reencontrar os DOIS casos conhecidos do #324 (hoje
 * reparados e carimbados com `reparo_nota`) antes de ter direito de afirmar que
 * nao ha ninguem preso. Nao achou o controle => o instrumento esta cego => sai
 * com erro, em vez de mentir baixo.
 *
 * Nao altera nada. Nao manda e-mail.
 */
const { supa } = require("./_comum.cjs");

const CHAVE_ESTADO = "sgp_boas_vindas";
/** Os 2 casos do #324: o controle positivo. Reparados, mas continuam legiveis. */
const CONTROLE = ["HP0150302636", "HP1390733090"];

(async () => {
  const db = supa();
  const { data: est, error } = await db
    .from("agent_state")
    .select("value,updated_at")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  if (error) throw new Error(`nao consegui ler agent_state: ${error.message}`);

  const valor = est?.value ?? {};
  const entradas = Object.entries(valor);
  if (!entradas.length) {
    throw new Error(
      `agent_state["${CHAVE_ESTADO}"] veio VAZIO. Ou a chave mudou, ou a leitura ` +
        `falhou — nos dois casos "zero vitimas" seria mentira. Abortando.`,
    );
  }

  // ── controle positivo: os 2 casos conhecidos ainda sao legiveis? ──────────
  const achadosControle = CONTROLE.filter((tx) => {
    const r = valor[tx];
    return r && typeof r === "object" && typeof r.buyerEmail === "string";
  });
  if (achadosControle.length !== CONTROLE.length) {
    throw new Error(
      `CONTROLE POSITIVO FALHOU: esperava reencontrar ${CONTROLE.length} registros ` +
        `conhecidos do #324 e achei ${achadosControle.length}. O formato do estado ` +
        `mudou ou a chave nao e mais esta. NAO confie no resultado. Abortando.`,
    );
  }

  // ── a varredura ──────────────────────────────────────────────────────────
  const vitimas = [];
  let formatoEstranho = 0;
  for (const [tx, r] of entradas) {
    if (!r || typeof r !== "object" || !Array.isArray(r.canais)) {
      formatoEstranho++;
      continue;
    }
    if (r.canais.length === 0) vitimas.push([tx, r]);
  }

  console.log(`trava lida em ${est?.updated_at ?? "?"} · ${entradas.length} transacoes`);
  console.log(`controle positivo: ${achadosControle.length}/${CONTROLE.length} OK`);
  if (formatoEstranho) {
    console.log(`⚠️  ${formatoEstranho} registro(s) em formato inesperado (contados, nao ignorados)`);
  }

  if (!vitimas.length) {
    console.log("\n✅ nenhum comprador do SGP com e-mail de boas-vindas nao entregue.");
    return;
  }

  console.log(`\n🚨 ${vitimas.length} COMPRADOR(ES) PAGARAM E O E-MAIL NAO SAIU:`);
  vitimas.sort((a, b) => String(a[1].at).localeCompare(String(b[1].at)));
  for (const [tx, r] of vitimas) {
    const email = r.buyerEmail;
    const { data: perfis } = await db
      .from("profiles")
      .select("id,last_sign_in_at")
      .ilike("email", email);
    const { data: peds } = await db.from("sgp_pedidos").select("id").ilike("email", email);
    const p = perfis?.[0];
    console.log(
      `  ${tx} · ${r.at} · ${email}\n` +
        `      conta=${r.conta ?? "?"} perfil=${p ? "sim" : "NAO"} ` +
        `login=${p?.last_sign_in_at ?? "NUNCA"} pedido_sgp=${peds?.length ?? 0}` +
        (r.envioErro ? `\n      causa: ${r.envioErro}` : "\n      causa: (nao gravada — registro anterior ao fix do #324)"),
    );
  }
  console.log(
    `\nReparo: gere link de senha novo e reenvie as boas-vindas (o texto sai da\n` +
      `propria montarBoasVindas, nao escreva a mao) — receita em _frank/04_PLAYBOOKS.md.`,
  );
  process.exitCode = 1;
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
