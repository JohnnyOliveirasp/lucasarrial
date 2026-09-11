#!/usr/bin/env node
/**
 * GARANTIA × FILA — quem pediu reembolso DENTRO do prazo e está perdendo (ou já
 * perdeu) a janela enquanto o chamado espera na nossa fila.
 *
 * ── POR QUE EXISTE (incidente #350 / 3a9a4854) ─────────────────────────────
 * `janelaGarantia()` (garantia.ts) tem UM único chamador em produção:
 * `account.ts:174`, dentro de `linhaGarantiaHotmart()`. Esse caminho só roda
 * quando a Fast vai MONTAR UMA RESPOSTA para o aluno. Ou seja: a casa só olha a
 * garantia no instante em que fala com a pessoa — nunca enquanto o pedido dela
 * está parado esperando atendimento.
 *
 * O relógio corre dentro da fila e ninguém vê. Medido em 11/09: Victor pediu em
 * 08/09 com a janela até 11/09 e a janela virou com o chamado ainda aberto;
 * Lucila pediu em 07/09 com janela até 10/09, idem. Não foi decisão de ninguém
 * negar — foi ausência de instrumento. É a mesma forma do
 * `detector_preso_fora_da_conta.cjs`: a classe não some porque alguém prometeu
 * olhar, some quando vira medição que roda toda ronda.
 *
 * ── O QUE ELE NÃO DECIDE ───────────────────────────────────────────────────
 * Nada. É SÓ LEITURA. Não estorna, não escreve no banco, não manda e-mail. A
 * decisão de devolver dinheiro é de gente — a ferramenta existe pra que a
 * decisão seja tomada DENTRO do prazo, com a data na mão, em vez de descoberta
 * depois que virou.
 *
 * ── AS DUAS PERGUNTAS, E POR QUE SÃO DIFERENTES ────────────────────────────
 * A mesma função de produção é avaliada em DOIS instantes:
 *   (a) `first_seen_at` do incidente  → a pessoa estava dentro QUANDO PEDIU?
 *   (b) agora                          → a pessoa está dentro AGORA?
 * Dentro em (a) e fora em (b) = perdeu a janela na nossa fila. Esse é o
 * achado; o resto é contexto. Usar a função de produção (e não uma cópia) é
 * deliberado: foi a CÓPIA da regra de MIME que criou o vão do #351.
 *
 * ── A PERNA DA RENOVAÇÃO (os 54 do #265) ───────────────────────────────────
 * `janelaGarantia()` ancora na janela que FECHA PRIMEIRO entre as compras
 * pagas. Em assinatura, a Hotmart emite `warranty_date` NOVO a cada cobrança.
 * Se a renovação reabre a garantia é POLÍTICA DE DINHEIRO, não conta — e está
 * parada esperando o Johnny (ver garantia.ts). A ferramenta NÃO decide isso:
 * ela separa esses casos num bloco próprio, rotulado, pra que apareçam em vez
 * de ficarem invisíveis. Rotular ≠ decidir.
 *
 * ── CONTROLE POSITIVO, E POR QUE ABORTA ────────────────────────────────────
 * "Zero" de instrumento cego foi exatamente o que fez a casa reportar
 * "pagante sem acesso: zero" em 07/09 com um varredor que não enxergava o SGP.
 * Aqui o script é OBRIGADO a reencontrar os casos conhecidos do #350 antes de
 * afirmar qualquer coisa. Se o controle zerar, ele ABORTA em vez de imprimir
 * uma lista vazia tranquilizadora.
 */
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));

// ── produção, carregada de verdade (sem cópia) ─────────────────────────────
const createJiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"));
const jiti = (createJiti.default || createJiti)(path.join(RAIZ, "frontend", "noop.js"), {
  alias: { "@": path.join(RAIZ, "frontend", "src") },
  interopDefault: true,
});
const { janelaGarantia } = jiti(path.join(RAIZ, "frontend", "src", "lib", "agent", "garantia.ts"));
if (typeof janelaGarantia !== "function") {
  throw new Error("garantia.ts não exporta janelaGarantia() — ferramenta abortada (não vou adivinhar a regra)");
}

// Pedido de reembolso/cancelamento. Abrangente de propósito: um falso positivo
// custa uma linha lida; um falso negativo custa o prazo de um aluno.
const PEDIDO = /reembols|restitui|estorn|devolu[çc]|cancela|garantia|dinheiro de volta|chargeback/i;

// Casos medidos em 11/09 que o instrumento TEM que reencontrar. Não é decoração:
// é o que separa "não há ninguém" de "não enxerguei ninguém".
const CONTROLE = ["victor.inscriptio@gmail.com", "contatoecocannabis@gmail.com"];

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const horas = (ms) => (ms / 3600000).toFixed(1);

async function todosIncidentes(c) {
  let todos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c
      .from("incidents")
      .select("id,numero,status,title,first_seen_at,affected_emails")
      .in("status", ["open", "investigating"])
      .order("first_seen_at", { ascending: true })
      .range(from, from + 999);
    // erro cru ANTES de acreditar em qualquer zero.
    if (error) throw new Error("incidents: " + JSON.stringify(error));
    todos = todos.concat(data);
    if (data.length < 1000) return todos;
  }
}

async function comprasDe(c, email) {
  const { data, error } = await c
    .from("payment_events")
    .select("payload")
    .eq("provider", "hotmart")
    .eq("event_type", "PURCHASE_APPROVED")
    .ilike("buyer_email", email);
  if (error) throw new Error(`payment_events(${email}): ` + JSON.stringify(error));
  return data || [];
}

/** warranty_date da compra PAGA mais RECENTE — a perna da renovação (não é decisão). */
function renovacaoMaisRecente(linhas) {
  let melhor = null;
  for (const e of linhas) {
    const d = e.payload?.data;
    if (!(Number(d?.purchase?.price?.value ?? 0) > 0)) continue;
    const t = Date.parse(String(d?.product?.warranty_date ?? ""));
    if (!Number.isFinite(t)) continue;
    if (!melhor || t > melhor) melhor = t;
  }
  return melhor ? new Date(melhor) : null;
}

(async () => {
  const c = supa();
  const agora = new Date();
  const incidentes = await todosIncidentes(c);
  const pedidos = incidentes.filter((i) => PEDIDO.test(i.title || ""));

  const achados = [];
  for (const inc of pedidos) {
    const emails = Array.isArray(inc.affected_emails) ? inc.affected_emails : [];
    for (const email of emails) {
      const linhas = await comprasDe(c, email);
      const pediuEm = new Date(inc.first_seen_at);
      const jPediu = janelaGarantia(linhas, pediuEm);
      const jAgora = janelaGarantia(linhas, agora);
      const renov = renovacaoMaisRecente(linhas);

      let classe;
      if (!jAgora) classe = "SEM_COMPRA_PAGA";
      else if (jPediu?.dentro && !jAgora.dentro) classe = "PERDEU_NA_FILA";
      else if (jAgora.dentro) classe = jAgora.fim - agora < 48 * 3600000 ? "VENCE_EM_48H" : "DENTRO";
      else if (renov && renov > agora) classe = "RENOVACAO_EM_ABERTO";
      else classe = "FORA_DESDE_ANTES";

      achados.push({ inc, email, jPediu, jAgora, renov, classe, pediuEm });
    }
  }

  // ── controle positivo ────────────────────────────────────────────────────
  const vistos = new Set(achados.map((a) => a.email.toLowerCase()));
  const faltando = CONTROLE.filter((e) => !vistos.has(e));
  if (faltando.length) {
    console.error(`\n❌ CONTROLE POSITIVO FALHOU — não reencontrei: ${faltando.join(", ")}`);
    console.error(`   O instrumento não está enxergando casos que SABEMOS existir (#350).`);
    console.error(`   Abortando: lista vazia de detector cego já custou caro (07/09).\n`);
    process.exit(1);
  }

  const ordem = ["PERDEU_NA_FILA", "VENCE_EM_48H", "DENTRO", "RENOVACAO_EM_ABERTO", "FORA_DESDE_ANTES", "SEM_COMPRA_PAGA"];
  const rotulo = {
    PERDEU_NA_FILA: "🩸 PERDEU A JANELA ENQUANTO ESPERAVA NA NOSSA FILA — pediu dentro, hoje está fora",
    VENCE_EM_48H: "🔴 VENCE EM ATÉ 48H — decida HOJE, com a data na mão",
    DENTRO: "🟢 DENTRO da janela — há prazo, mas o relógio corre",
    RENOVACAO_EM_ABERTO: "🟡 RENOVAÇÃO EM ABERTO — produção diz FORA (âncora na 1ª compra), mas a cobrança MAIS RECENTE tem warranty_date no futuro. É POLÍTICA, parada com o Johnny (#265). Rotular ≠ decidir.",
    FORA_DESDE_ANTES: "⚪ Fora da janela já quando pediu — não é dívida da fila",
    SEM_COMPRA_PAGA: "⚪ Sem compra PAGA (adesão R$0 / e-mail da compra diferente) — nada a reembolsar; se contesta, escale",
  };

  console.log(`\n${"=".repeat(78)}`);
  console.log(`GARANTIA × FILA — ${agora.toISOString()}`);
  console.log(`${incidentes.length} incidentes abertos · ${pedidos.length} parecem pedido de reembolso/cancelamento · ${achados.length} pessoa(s)`);
  console.log(`controle positivo: OK (reencontrados ${CONTROLE.length}/${CONTROLE.length})`);
  console.log(`${"=".repeat(78)}`);

  for (const cl of ordem) {
    const bloco = achados.filter((a) => a.classe === cl);
    if (!bloco.length) continue;
    console.log(`\n${rotulo[cl]}  [${bloco.length}]`);
    for (const a of bloco) {
      console.log(`   #${a.inc.numero} ${a.email}`);
      console.log(`      pediu em ${dia(a.pediuEm)} · janela ${a.jAgora ? `${dia(a.jAgora.compra)} → ${a.jAgora.fim.toISOString()}` : "(sem compra paga)"}`);
      if (cl === "PERDEU_NA_FILA") {
        console.log(`      ⏱️  virou há ${horas(agora - a.jAgora.fim)}h · esperou ${horas(a.jAgora.fim - a.pediuEm)}h de prazo dentro da fila`);
      }
      if (cl === "VENCE_EM_48H") {
        console.log(`      ⏱️  RESTAM ${horas(a.jAgora.fim - agora)}h`);
      }
      if (a.renov) console.log(`      renovação mais recente: warranty_date ${a.renov.toISOString()}`);
      console.log(`      ${(a.inc.title || "").slice(0, 120)}`);
    }
  }

  const sangrando = achados.filter((a) => a.classe === "PERDEU_NA_FILA").length;
  const urgente = achados.filter((a) => a.classe === "VENCE_EM_48H").length;
  console.log(`\n➡️  ${sangrando} perderam a janela na fila · ${urgente} vencem em 48h · ${achados.filter((a) => a.classe === "RENOVACAO_EM_ABERTO").length} na perna da renovação (Johnny).`);
  console.log(`   Nada foi alterado: esta ferramenta só lê.\n`);
})().catch((e) => {
  console.error("ABORTADO:", e.message);
  process.exit(1);
});
