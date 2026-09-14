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
 * ── A PERNA DO CARD FECHADO (#384 / 6509c3bc) ──────────────────────────────
 * A primeira versão só varria `open`/`investigating`. Medido pelo Frank em
 * 13/09 22:50Z: o Marcelo pediu pra sair em 09/09, DENTRO da janela da cobrança
 * de 05/09 (garantia até 12/09), e seguia sem devolução em 13/09 — invisível
 * aqui porque TODOS os cards dele (#32, #128, #337, #351) estão `fixed`/
 * `ignored`. Card fechado escondia aluno que ainda estava perdendo dinheiro na
 * fila, que é exatamente a classe que esta ferramenta existe pra achar.
 *
 * Então a varredura passou a ter DUAS pernas: os abertos (como antes) e os
 * NÃO-abertos com sinal recente (`last_seen_at` dentro de JANELA_FECHADO_DIAS,
 * 30 por padrão). A segunda perna é escrita por NEGAÇÃO (`not in
 * (open,investigating)`) de propósito: o vocabulário de status não tem CHECK no
 * banco (ver scripts/107) e já ganhou `fixing` e `suporte_necessario` depois de
 * escrito — enumerar os fechados criaria um vão novo a cada status novo.
 *
 * Fechar o card NÃO é o que decide: só muda o rótulo da linha. O que decide
 * continua sendo a data da garantia contra o relógio.
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

// ⚠️ O REGEX SOZINHO NÃO DIZ QUE ALGUÉM PEDIU — ele lê o TÍTULO DO CARD, e card
// técnico FALA de restituição sem que ninguém tenha pedido nada. Medido em
// 14/09 ~00h50Z (ronda das falhas), no MESMO recorte que esta ferramenta varre
// (status open/investigating), entre os cards que casam o PEDIDO:
//
//   categoria='atendimento' → 14 cards, 14 e-mails, no MÁXIMO 1 por card
//   categoria='tecnico'     →  7 cards, 48 e-mails, até 16 num card só
//
// Os 48 são COORTE: gente que a casa achou varrendo um defeito, não gente que
// escreveu pedindo dinheiro de volta. Eram 48 das 62 pessoas lidas (77%) e
// entravam nos blocos "PERDEU A JANELA ESPERANDO NA NOSSA FILA" e
// "VENCE EM ATÉ 48H — decida HOJE" como se tivessem pedido. Duas afirmações
// falsas na mesma linha: o `pediu em` era a data em que NÓS achamos o bug, e o
// relógio de garantia não estava correndo por pedido de ninguém.
//
// O caso que pegou (#341, 6 pessoas em "decida HOJE", 23h a 47h restantes):
// nenhuma das 6 tem card próprio além do #341, e nenhuma jamais escreveu pro
// suporte@ (conferido no INBOX, uma a uma). O card é `reported_by='frank'` —
// fui EU que achei o defeito. Ninguém pediu nada, e a casa estava a um passo de
// tratar 6 emergências inexistentes como se fossem dívida de fila.
//
// Por que isso é caro e não é frescura: urgência falsa não é só ruído, ela
// AFOGA a verdadeira. Em 09/09 uma escalação urgente minha foi desmentida 4,2
// dias depois, e a pergunta de verdade ficou esse tempo todo atrás do alarme.
//
// Efeito medido do corte, mesma varredura, antes → depois:
//   "PERDEU A JANELA na fila"  10 → 4   (os 6 que saíram não tinham pedido)
//   "VENCE EM 48H, decida HOJE"  6 → 0   (as 6 eram TODAS do #341)
//   pessoas lidas               62 → 62  (ninguém sumiu: só mudou de bloco)
//
// A COORTE NÃO SOME, de propósito — muda de bloco e ganha rótulo. Mesmo
// tratamento que a perna da RENOVAÇÃO já recebe aqui: rotular ≠ decidir, e a
// lição repetida desta casa é que honesto não pode significar invisível (o
// `aguardando_aluno` sumindo do filtro de abertos, 25/08). Assim o falso
// negativo continua impossível: ninguém deixa de ser lido, só deixa de ser
// chamado de emergência.
const ehPedidoDePessoa = (inc) => inc.categoria === "atendimento";

// Casos medidos em 11/09 que o instrumento TEM que reencontrar. Não é decoração:
// é o que separa "não há ninguém" de "não enxerguei ninguém".
// ⚠️ Os dois são `categoria='atendimento'` (#309 Victor, #299 Lucila), então
// continuam na perna de PEDIDO depois do corte — conferido antes de cortar, e
// não depois. O controle agora exige que apareçam COMO PEDIDO: se um deles só
// fosse reencontrado pela coorte, o corte teria cegado a ferramenta e passado
// no controle assim mesmo.
const CONTROLE = ["victor.inscriptio@gmail.com", "contatoecocannabis@gmail.com"];

// Quanto tempo um card FECHADO ainda conta como "sinal recente". Mensal: a
// cobrança que o aluno quer de volta cabe em 30 dias. Só lê, então errar pra
// mais custa linha lida; errar pra menos custa o prazo de alguém (#384).
const JANELA_FECHADO_DIAS = Number(process.env.JANELA_FECHADO_DIAS || 30);
if (!Number.isFinite(JANELA_FECHADO_DIAS) || JANELA_FECHADO_DIAS <= 0) {
  throw new Error(`JANELA_FECHADO_DIAS inválido: ${process.env.JANELA_FECHADO_DIAS} (dias, número > 0)`);
}

const ABERTOS = ["open", "investigating"];
// ⚠️ `categoria` é OBRIGATÓRIA aqui. É ela que `ehPedidoDePessoa` lê para separar
// PEDIDO de COORTE (#266). Se cair desta lista, o campo chega `undefined`, TODO
// card vira coorte técnica e os blocos de urgência ficam vazios para sempre —
// o instrumento pararia de acusar sem dizer que parou. Foi o risco real ao
// juntar o #266 (que ainda selecionava colunas inline) com o #384.
const COLUNAS = "id,numero,status,title,first_seen_at,last_seen_at,affected_emails,categoria";

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const horas = (ms) => (ms / 3600000).toFixed(1);
const fechado = (inc) => !ABERTOS.includes(String(inc.status ?? ""));

/** Pagina até o fim. `filtrar` recebe a query e devolve a query. */
async function varrer(c, rotulo, filtrar) {
  let todos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filtrar(c.from("incidents").select(COLUNAS)).range(from, from + 999);
    // erro cru ANTES de acreditar em qualquer zero.
    if (error) throw new Error(`incidents(${rotulo}): ` + JSON.stringify(error));
    todos = todos.concat(data);
    if (data.length < 1000) return todos;
  }
}

/**
 * As duas pernas. Devolve { abertos, fechadosVivos } separados porque o
 * cabeçalho tem que DIZER quanto cada uma enxergou — perna nova que volta
 * vazia em silêncio é o mesmo instrumento cego de antes, com outra cara.
 */
async function todosIncidentes(c, agora) {
  const corte = new Date(agora - JANELA_FECHADO_DIAS * 86400000).toISOString();
  const abertos = await varrer(c, "abertos", (q) =>
    q.in("status", ABERTOS).order("first_seen_at", { ascending: true }),
  );
  const fechadosVivos = await varrer(c, "fechados-com-sinal-recente", (q) =>
    q
      .not("status", "in", `(${ABERTOS.join(",")})`)
      .gte("last_seen_at", corte)
      .order("last_seen_at", { ascending: false }),
  );
  return { abertos, fechadosVivos, corte };
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
  // As duas pernas do #384 (aberto + fechado com sinal recente) passam pelo
  // corte do #266 (pedido de pessoa × coorte de card técnico). São filtros
  // ortogonais e os DOIS valem: o #384 decide QUEM é lido, o #266 decide quem
  // pode ser chamado de emergência.
  const { abertos, fechadosVivos, corte } = await todosIncidentes(c, agora);
  const incidentes = abertos.concat(fechadosVivos);
  const casam = incidentes.filter((i) => PEDIDO.test(i.title || ""));
  const pedidos = casam.filter(ehPedidoDePessoa);
  const coorte = casam.filter((i) => !ehPedidoDePessoa(i));
  const pedidosFechados = pedidos.filter(fechado);

  const achados = [];
  for (const inc of casam) {
    const souPedido = ehPedidoDePessoa(inc);
    const emails = Array.isArray(inc.affected_emails) ? inc.affected_emails : [];
    for (const email of emails) {
      const linhas = await comprasDe(c, email);
      const pediuEm = new Date(inc.first_seen_at);
      const jPediu = janelaGarantia(linhas, pediuEm);
      const jAgora = janelaGarantia(linhas, agora);
      const renov = renovacaoMaisRecente(linhas);

      let classe;
      if (!souPedido) {
        // Card TÉCNICO: a pessoa não pediu nada. Sem pedido não existe "perdeu a
        // janela esperando na NOSSA fila" — essa frase acusa a casa de uma
        // dívida que, aqui, não foi contraída. A janela segue medida e impressa
        // no bloco próprio; o que não acontece é virar emergência.
        classe = "COORTE_TECNICA";
      } else if (!jAgora) classe = "SEM_LINHA_NO_NOSSO_BANCO";
      else if (jPediu?.dentro && !jAgora.dentro) classe = "PERDEU_NA_FILA";
      else if (jAgora.dentro) classe = jAgora.fim - agora < 48 * 3600000 ? "VENCE_EM_48H" : "DENTRO";
      else if (renov && renov > agora) classe = "RENOVACAO_EM_ABERTO";
      else classe = "FORA_DESDE_ANTES";

      achados.push({ inc, email, jPediu, jAgora, renov, classe, pediuEm, souPedido });
    }
  }

  // ── controle positivo ────────────────────────────────────────────────────
  // Exige o reencontro NA PERNA DE PEDIDO. Contar a coorte aqui deixaria o
  // controle passar justamente no cenário que ele existe pra pegar: o corte
  // novo cegar a perna que importa e a pessoa sobreviver só como coorte.
  const vistos = new Set(achados.filter((a) => a.souPedido).map((a) => a.email.toLowerCase()));
  const faltando = CONTROLE.filter((e) => !vistos.has(e));
  if (faltando.length) {
    console.error(`\n❌ CONTROLE POSITIVO FALHOU — não reencontrei como PEDIDO: ${faltando.join(", ")}`);
    console.error(`   O instrumento não está enxergando casos que SABEMOS existir (#350).`);
    console.error(`   Abortando: lista vazia de detector cego já custou caro (07/09).\n`);
    process.exit(1);
  }

  // Perna de pedido vazia é defeito, não boa notícia: a casa SEMPRE tem pedido
  // de reembolso aberto. Zero aqui significa filtro cego (o `categoria` mudou de
  // vocabulário, por exemplo), e zero de instrumento cego já enganou a casa em
  // 07/09 e de novo em 13/09. Avisa alto em vez de imprimir um relatório limpo.
  if (!pedidos.length) {
    console.error(`\n⚠️  NENHUM card de PEDIDO (categoria='atendimento') casou o filtro.`);
    console.error(`   Isso quase certamente é o filtro cego, não a fila vazia. Confira`);
    console.error(`   o vocabulário de 'categoria' antes de acreditar neste relatório.\n`);
  }

  const ordem = ["PERDEU_NA_FILA", "VENCE_EM_48H", "DENTRO", "RENOVACAO_EM_ABERTO", "FORA_DESDE_ANTES", "SEM_LINHA_NO_NOSSO_BANCO", "COORTE_TECNICA"];
  const rotulo = {
    PERDEU_NA_FILA: "🩸 PERDEU A JANELA ENQUANTO ESPERAVA NA NOSSA FILA — pediu dentro, hoje está fora",
    VENCE_EM_48H: "🔴 VENCE EM ATÉ 48H — decida HOJE, com a data na mão",
    DENTRO: "🟢 DENTRO da janela — há prazo, mas o relógio corre",
    RENOVACAO_EM_ABERTO: "🟡 RENOVAÇÃO EM ABERTO — produção diz FORA (âncora na 1ª compra), mas a cobrança MAIS RECENTE tem warranty_date no futuro. É POLÍTICA, parada com o Johnny (#265). Rotular ≠ decidir.",
    FORA_DESDE_ANTES: "⚪ Fora da janela já quando pediu — não é dívida da fila",
    SEM_LINHA_NO_NOSSO_BANCO:
      "⚪ SEM LINHA NO NOSSO BANCO para este e-mail — NÃO É O MESMO QUE 'não pagou'. " +
      "Tudo que a ferramenta sabe é que não há PURCHASE_APPROVED em payment_events " +
      "casando por buyer_email. Pode ser adesão R$0, mas pode ser a classe do #222 " +
      "(pagou com um e-mail e pediu/criou conta com outro), que já voltou 7 vezes. " +
      "CONFIRA no detector_preso_fora_da_conta.cjs / pagou_de_verdade.cjs antes de responder.",
    COORTE_TECNICA:
      "🔵 COORTE DE CARD TÉCNICO — NINGUÉM AQUI PEDIU NADA. São pessoas que a casa " +
      "achou varrendo um defeito, não gente que escreveu pedindo dinheiro de volta. " +
      "NÃO existe relógio de garantia correndo por pedido delas, e o `first_seen_at` " +
      "do card é a data em que NÓS achamos o bug — não a data de um pedido. " +
      "Ficam listadas de propósito (invisível já custou caro aqui), mas fora dos " +
      "blocos de urgência. Se alguma DESTAS pessoas pedir reembolso de verdade, " +
      "ela ganha card de atendimento próprio e sobe para os blocos de cima sozinha.",
  };

  console.log(`\n${"=".repeat(78)}`);
  console.log(`GARANTIA × FILA — ${agora.toISOString()}`);
  const nPedido = achados.filter((a) => a.souPedido).length;
  const nCoorte = achados.length - nPedido;
  console.log(`${incidentes.length} incidentes varridos = ${abertos.length} abertos + ${fechadosVivos.length} FECHADOS com sinal desde ${dia(corte)} (${JANELA_FECHADO_DIAS}d)`);
  console.log(`${casam.length} casam o vocabulário de reembolso/cancelamento`);
  console.log(`  ├─ PEDIDO (categoria='atendimento'): ${pedidos.length} card(s) · ${nPedido} pessoa(s) — alguém escreveu pedindo (${pedidosFechados.length} em card FECHADO)`);
  console.log(`  └─ COORTE (card técnico):            ${coorte.length} card(s) · ${nCoorte} pessoa(s) — ninguém pediu; a casa achou varrendo`);
  console.log(`controle positivo: OK (reencontrados ${CONTROLE.length}/${CONTROLE.length} na perna de PEDIDO)`);
  if (!fechadosVivos.length) {
    console.log(
      `⚠️  a perna dos FECHADOS voltou VAZIA. Pode ser verdade, mas foi essa cegueira que\n` +
        `   escondeu o Marcelo por 4,2 dias (#384) — confira com 2026-08-20_fechados_que_disparam.cjs\n` +
        `   antes de tratar este relatório como "não há ninguém".`,
    );
  }
  console.log(`${"=".repeat(78)}`);

  for (const cl of ordem) {
    const bloco = achados.filter((a) => a.classe === cl);
    if (!bloco.length) continue;
    console.log(`\n${rotulo[cl]}  [${bloco.length}]`);
    for (const a of bloco) {
      const selo = fechado(a.inc)
        ? `  ⚠️ CARD FECHADO (${a.inc.status}) — último sinal ${dia(a.inc.last_seen_at)}; não aparece na fila de ninguém`
        : "";
      console.log(`   #${a.inc.numero} ${a.email}${selo}`);
      // "pediu em" só é verdade na perna de PEDIDO. Na coorte, essa data é o dia
      // em que a CASA achou o defeito — chamar isso de "pediu" foi metade da
      // mentira que o #266 veio desfazer, e ela não pode sobreviver no texto.
      const quando = a.souPedido ? `pediu em ${dia(a.pediuEm)}` : `card aberto pela casa em ${dia(a.pediuEm)} (ela não pediu)`;
      console.log(`      ${quando} · janela ${a.jAgora ? `${dia(a.jAgora.compra)} → ${a.jAgora.fim.toISOString()}` : "(SEM LINHA NO NOSSO BANCO p/ este e-mail — não é 'não pagou')"}`);
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
  const escondidos = achados.filter((a) => fechado(a.inc) && ["PERDEU_NA_FILA", "VENCE_EM_48H"].includes(a.classe)).length;
  console.log(`\n➡️  ${sangrando} perderam a janela na fila · ${urgente} vencem em 48h · ${achados.filter((a) => a.classe === "RENOVACAO_EM_ABERTO").length} na perna da renovação (Johnny).`);
  console.log(`   Os números acima contam SÓ quem pediu. ${nCoorte} pessoa(s) de card técnico`);
  console.log(`   ficaram no bloco 🔵 e de fora da conta — ninguém pediu nada por elas.`);
  if (escondidos) {
    console.log(`   🫥 ${escondidos} desses estão em card FECHADO: a casa considera o assunto resolvido e o aluno ainda está perdendo dinheiro (#384).`);
  }
  console.log(`   Nada foi alterado: esta ferramenta só lê.\n`);
})().catch((e) => {
  console.error("ABORTADO:", e.message);
  process.exit(1);
});
