#!/usr/bin/env node
/**
 * saida_x_assinatura.cjs — quem PEDIU PRA SAIR e ainda tem assinatura VIVA
 * na Hotmart, ou seja: quem vai ser cobrado de novo achando que já saiu.
 *
 * É a PERNA 1 do #384. Só LEITURA — não cancela, não estorna, não escreve.
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────────
 * O #384, na frase dele: "o pedido de cancelamento do aluno vira RECADO e nunca
 * vira AÇÃO". O caso que deu nome ao cartão: em 09/09 o titular escreveu "Eu não
 * quero mais seguir no programa", a casa respondeu TRÊS vezes que o pedido
 * estava "registrado", e 4,2 dias depois a Hotmart ainda dizia ACTIVE. Ele seria
 * cobrado R$ 97 em 05/10 acreditando que tinha saído, porque foi isso que a casa
 * escreveu pra ele 3x.
 *
 * O `cancelar_assinatura.cjs` existe desde 21/08 pra isso ser automático, mas
 * NADA o dispara. Não havia detector, nem fila, nem alarme: o pedido chegava por
 * e-mail, virava nota, e dependia de um humano lembrar. Este script é o alarme.
 *
 * ⚠️ `subscription_cancellations` NÃO serve como fonte (é onde a perna 1 morreu
 * antes): é tabela de FEEDBACK de quem cancela PELA PLATAFORMA (13_credits.sql:37).
 * Quem pede por e-mail — que é a classe inteira deste cartão — nunca teria linha
 * ali, então consultá-la responderia "ninguém pediu" justamente para os que
 * pediram. A única fonte de verdade da assinatura é a Hotmart viva.
 *
 * ── O DISCRIMINADOR, E POR QUE ELE **NÃO** É O DO `garantia_na_fila.cjs` ────
 * Aquele instrumento usa `categoria === 'atendimento'` pra separar quem PEDIU de
 * quem a casa achou varrendo (#266), e ali está certo. Aqui isso cegaria o
 * script no caso que nomeia o cartão: **os 8 cards do Marcelo são
 * `categoria='tecnico'`** — conferido um a um (#32, #65, #128, #138, #265, #337,
 * #351, #384). O pedido de saída dele, escrito com todas as letras, nunca gerou
 * card de atendimento. Copiar o discriminador do irmão faria esta varredura
 * imprimir "0 pessoas" e ser acreditada, que é o defeito clássico desta casa.
 *
 * Então aqui o corte é por FORÇA DE EVIDÊNCIA, e o card diz qual é:
 *   • `atendimento`      → alguém escreveu pedindo. 1 pessoa por card.
 *   • `tecnico/individual` → card técnico de UMA pessoa só. É a classe do #384:
 *                          pedido real que virou card técnico. Entra na urgência.
 *   • `tecnico/coorte`   → card técnico com VÁRIAS pessoas: a casa achou varrendo
 *                          um defeito, ninguém ali pediu nada. Fica LISTADO com
 *                          rótulo próprio e FORA da urgência (#266: urgência falsa
 *                          afoga a verdadeira), mas não some — invisível já custou
 *                          caro aqui (`aguardando_aluno`, 25/08).
 *
 * A assimetria que justifica ser inclusivo na esquerda: falso positivo custa uma
 * linha lida por mim; falso negativo custa R$ 97 na conta de quem pediu pra sair.
 * E o lado DIREITO (a Hotmart dizer ACTIVE) é o filtro duro — ninguém vira
 * urgência sem estar sendo cobrado de verdade.
 *
 * ── CONTROLE POSITIVO, NOS DOIS LADOS, E ABORTA ───────────────────────────
 * "Zero" de instrumento cego é a mentira mais cara que este script pode contar,
 * e já enganou a casa em 07/09 e em 13/09. Aqui o controle cobre as DUAS pontas,
 * porque cegar uma delas basta pra zerar o relatório:
 *   ESQUERDA: o Marcelo tem que ser reencontrado como pedido de saída.
 *   DIREITA:  a consulta da Hotmart pra ele tem que devolver a assinatura
 *             conhecida (SUR21VU9).
 * Ele é o controle ideal justamente porque JÁ foi cancelado em 13/09: exercita o
 * caminho inteiro e cai no balde "já resolvido", provando a tubulação sem ser
 * vítima. Se qualquer uma das pontas falhar, ABORTA (exit 1) em vez de imprimir
 * um relatório limpo e vazio.
 *
 * ── LIMITE MEDIDO: ELE VARRE POR E-MAIL, E PESSOA NÃO É E-MAIL ────────────
 * ⚠️ Esta é a cegueira conhecida, e ela JÁ deixou dinheiro na mesa na estreia
 * (14/09). A Lucila tem três e-mails. O pedido dela existe no card #299
 * (`atendimento`, contatoecocannabis@) e o script a pegou por ali — mas a
 * SEGUNDA assinatura dela, `2Q4Y1CDE`, vive no blancolucila539@, cujo único
 * card é o #254 (técnico, coorte). Resultado: o script acusou UMA assinatura e
 * a outra, igualmente viva e igualmente prestes a cobrar (23/09), ficou
 * invisível. Eu só a encontrei porque fui ler o e-mail dela na mão e vi os três
 * endereços. As duas foram canceladas; a segunda NÃO por mérito deste script.
 *
 * É a mesma classe do #222 (paga com um e-mail, fala com outro), que já voltou
 * 7 vezes. A cura certa é casar PESSOA (CPF/nome, como o
 * `detector_preso_fora_da_conta.cjs` faz) antes de perguntar à Hotmart — não
 * foi feito aqui de propósito, porque casar no escuro põe cancelamento na conta
 * errada, e isso não tem desfazer. Até lá: **quando alguém aparecer na urgência,
 * confira se a pessoa tem outros e-mails antes de dar o caso por fechado.**
 *
 * USO:
 *   node _frank/ferramentas/saida_x_assinatura.cjs
 *   node _frank/ferramentas/saida_x_assinatura.cjs --json
 *   node _frank/ferramentas/saida_x_assinatura.cjs --autoteste
 *   JANELA_FECHADO_DIAS=60 node _frank/ferramentas/saida_x_assinatura.cjs
 */
const { supa } = require("./_comum.cjs");
const { assinaturasDe, ehAtiva, codeDe, faltando } = require("./_hotmart.cjs");

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");

/**
 * ── DOIS VOCABULÁRIOS, E POR QUÊ (medido, não suposto) ─────────────────────
 * A primeira versão deste script usou UM vocabulário largo pros dois tipos de
 * card e produziu 5 acusados, dos quais **3 eram falsos**. Conferi um a um antes
 * de reportar qualquer nome, e os 3 falharam por motivos que valem ficar escritos:
 *
 *   #178 giovannaveterinaria  → casou em `sair` DENTRO de "o Turbo costuma
 *                               SAIR mais natural". Substring, não pedido.
 *   #185 priscillarosseti     → casou em `estorn` no título "A LISTA CANÔNICA
 *                               DE ESTORNO envelheceu calada" — card sobre CÓDIGO.
 *   #224 grupohcmarketing     → casou em `estorn` em "-5680 cr estornados", que
 *                               é o SISTEMA devolvendo crédito, não a pessoa
 *                               pedindo pra sair.
 *
 * A lição: num card de ATENDIMENTO, "estorno/reembolso" significa que uma pessoa
 * escreveu pedindo. Num card TÉCNICO, as mesmas palavras são o vocabulário
 * interno da casa falando de crédito e de código. A mesma palavra, dois sentidos
 * — então não pode ser o mesmo filtro.
 *
 * Testado contra os 4 cards conhecidos em `--autoteste`: #384 (pedido real num
 * card técnico) TEM que casar; #178, #185 e #224 TÊM que ser recusados.
 */

/** Card de ATENDIMENTO: a Fast só abre um destes quando alguém ESCREVEU. Largo. */
const SAIDA_PESSOA =
  /cancel|encerr|n[ãa]o quero mais|desist|desligar|descadastr|reembols|restitui|estorn|devolu[çc]|chargeback/i;

/**
 * Card TÉCNICO: só frase EXPLÍCITA de pedido de saída. Estreito de propósito —
 * aqui a palavra solta é vocabulário da casa, não vontade do aluno.
 * É esta que reencontra o #384 ("O PEDIDO DE CANCELAMENTO DO ALUNO...").
 */
const SAIDA_TECNICA =
  /pedido de cancelamento|pedido de sa[íi]da|pediu\s+(pra|para)\s+(sair|cancelar)|n[ãa]o quero mais|encerrar o plano|quer\s+(sair|cancelar)|solicit\w*\s+cancelamento/i;

const casaVocabulario = (inc) =>
  (inc.categoria === "atendimento" ? SAIDA_PESSOA : SAIDA_TECNICA).test(inc.title || "");

const ABERTOS = ["open", "investigating"];

/**
 * ⚠️ `categoria` e `affected_emails` são OBRIGATÓRIAS: são elas que decidem a
 * força da evidência. Se caírem desta lista chegam `undefined`, todo card vira
 * um balde só e o relatório para de discriminar sem dizer que parou — foi
 * exatamente o risco que o patch do #384 criou no irmão deste script.
 */
const COLUNAS = "id,numero,status,title,first_seen_at,last_seen_at,affected_emails,categoria";

/** Card FECHADO ainda conta como sinal recente por esta janela (lição da perna 2). */
const JANELA_FECHADO_DIAS = Number(process.env.JANELA_FECHADO_DIAS || 30);
if (!Number.isFinite(JANELA_FECHADO_DIAS) || JANELA_FECHADO_DIAS <= 0) {
  throw new Error(`JANELA_FECHADO_DIAS inválido: ${process.env.JANELA_FECHADO_DIAS}`);
}

/** O controle positivo. Ver o bloco no cabeçalho. */
const CONTROLE_EMAIL = "marcelopersonalthe32@gmail.com";
const CONTROLE_CODE = "SUR21VU9";

/** Gentileza com a API: a varredura é sequencial e com respiro entre chamadas. */
const PAUSA_MS = Number(process.env.HOTMART_PAUSA_MS || 150);
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const fechado = (inc) => !ABERTOS.includes(String(inc.status ?? ""));

/** Pagina até o fim. O PostgREST corta em 1000 EM SILÊNCIO. */
async function varrer(c, rotulo, filtrar) {
  let todos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filtrar(c.from("incidents").select(COLUNAS)).range(from, from + 999);
    // o erro CRU antes de acreditar em qualquer zero.
    if (error) throw new Error(`incidents(${rotulo}): ${JSON.stringify(error)}`);
    todos = todos.concat(data);
    if (data.length < 1000) return todos;
  }
}

/** Força da evidência de que ESTA pessoa pediu pra sair. Ver cabeçalho. */
function forcaDaEvidencia(inc) {
  if (inc.categoria === "atendimento") return "atendimento";
  const n = (inc.affected_emails || []).length;
  return n === 1 ? "tecnico/individual" : "tecnico/coorte";
}

/**
 * SÓ card de ATENDIMENTO vira urgência automática. O técnico, mesmo passando no
 * vocabulário estreito, vai pro balde REVISAR: ali o título prova que a CASA
 * falou de um pedido, não que a pessoa o fez agora — o #384 é exatamente isso
 * (o pedido do Marcelo é de 09/09, o card é meu, de 13/09). Chamar isso de
 * emergência automática repetiria o #266 com outro n.
 */
const ehUrgencia = (f) => f === "atendimento";

/**
 * `--autoteste`: tranca o vocabulário contra os 4 casos REAIS que o mediram.
 * Roda sem banco e sem rede, então pode ir em qualquer gate. Se alguém alargar
 * o filtro e os falsos positivos voltarem, isto falha ANTES de virar acusação.
 */
const CASOS = [
  { n: 384, categoria: "tecnico", esperado: true,
    title: "O PEDIDO DE CANCELAMENTO DO ALUNO VIRA RECADO E NUNCA VIRA ACAO: a casa escreveu 3x 'pedido para encerrar o plano registrado' e a assinatura seguia ACTIVE" },
  { n: 178, categoria: "tecnico", esperado: false,
    title: "A FAST INVENTA FATO TECNICO SOBRE O VIDEO CLONE: disse a aluna que 'o Turbo costuma sair mais natural' e mandou trocar de modo - claim que nao existe" },
  { n: 185, categoria: "tecnico", esperado: false,
    title: "A LISTA CANONICA DE ESTORNO ENVELHECEU CALADA: _estornos.cjs:27-38 nao conhece 'studio_audio_refund', que finalize.ts:104 ja grava em producao - 7 est" },
  { n: 224, categoria: "tecnico", esperado: false,
    title: "Fast (chat do app): Vídeo Clone Turbo de 71s (gerado 01/09 12:00, -5680 cr estornados) apresentou dois problemas" },
  { n: 299, categoria: "atendimento", esperado: true,
    title: "Fast (e-mail, atendimento): Lucila pediu reembolso das duas assinaturas (R$ 291). Ela diz que é direito dela e quer tudo certo" },
  { n: 307, categoria: "atendimento", esperado: true,
    title: "Fast (e-mail, atendimento): aluna solicita cancelamento e reembolso (compra 04/09, dentro da garantia). Frustração com" },
];

if (argv.includes("--autoteste")) {
  let falhas = 0;
  for (const c of CASOS) {
    const got = casaVocabulario(c);
    const ok = got === c.esperado;
    if (!ok) falhas++;
    console.log(`${ok ? "ok  " : "FALHA"} #${c.n} [${c.categoria}] esperado=${c.esperado} obtido=${got}`);
  }
  console.log(falhas ? `\n❌ ${falhas} falha(s)` : `\n✅ ${CASOS.length}/${CASOS.length} — vocabulário trancado`);
  process.exit(falhas ? 1 : 0);
}

(async () => {
  const falta = faltando();
  if (falta.length) {
    console.error(`❌ credenciais da Hotmart ausentes: ${falta.join(", ")}`);
    console.error("   Sem elas este script NÃO roda — não existe modo 'só o banco'.");
    console.error("   Metade da pergunta viria de graça e a resposta seria falsamente tranquila.");
    process.exit(1);
  }

  const c = supa();
  const agora = Date.now();
  const corte = new Date(agora - JANELA_FECHADO_DIAS * 86400000).toISOString();

  // ── 1. ESQUERDA: quem pediu pra sair ────────────────────────────────────
  const abertos = await varrer(c, "abertos", (q) =>
    q.in("status", ABERTOS).order("first_seen_at", { ascending: true }),
  );
  const fechadosVivos = await varrer(c, "fechados-com-sinal-recente", (q) =>
    q.not("status", "in", `(${ABERTOS.join(",")})`).gte("last_seen_at", corte),
  );
  const incidentes = [...abertos, ...fechadosVivos];
  const casam = incidentes.filter(casaVocabulario);

  // pessoa → melhor evidência + cards dela
  const porPessoa = new Map();
  for (const inc of casam) {
    const f = forcaDaEvidencia(inc);
    for (const raw of inc.affected_emails || []) {
      const email = String(raw).toLowerCase().trim();
      if (!email) continue;
      const cur = porPessoa.get(email) || { email, forca: f, cards: [] };
      cur.cards.push({ numero: inc.numero, status: inc.status, forca: f, title: inc.title, first: inc.first_seen_at, last: inc.last_seen_at });
      // a evidência MAIS FORTE manda: quem tem card de atendimento é pedido,
      // mesmo que também apareça na coorte de um card técnico.
      const ordem = { atendimento: 3, "tecnico/individual": 2, "tecnico/coorte": 1 };
      if (ordem[f] > ordem[cur.forca]) cur.forca = f;
      porPessoa.set(email, cur);
    }
  }

  // CONTROLE ESQUERDA
  if (!porPessoa.has(CONTROLE_EMAIL)) {
    console.error(`\n❌ CONTROLE POSITIVO FALHOU (ESQUERDA) — não reencontrei ${CONTROLE_EMAIL}`);
    console.error("   Ele é o caso que nomeia o #384 e TEM que aparecer como pedido de saída.");
    console.error("   Não imprimo relatório: um zero daqui seria filtro cego, não fila limpa.");
    process.exit(1);
  }

  // ── 2. DIREITA: a Hotmart, uma pessoa por vez ───────────────────────────
  const pessoas = [...porPessoa.values()].sort((a, b) => a.email.localeCompare(b.email));
  const sangrando = [];
  const revisar = [];
  const resolvidos = [];
  const naoSei = [];
  const coorte = [];

  for (const p of pessoas) {
    const r = await assinaturasDe(p.email);
    await dorme(PAUSA_MS);

    if (!r.ok) {
      // erro NUNCA vira "não tem assinatura".
      naoSei.push({ ...p, erro: r.erro });
      continue;
    }
    const vivas = r.assinaturas.filter((a) => ehAtiva(a.status));
    const reg = {
      ...p,
      assinaturas: r.assinaturas.map((a) => ({ code: codeDe(a), status: a.status, trial: a.trial === true, plano: a.plan?.name ?? null })),
      vivas: vivas.length,
    };
    if (!vivas.length) resolvidos.push(reg);
    else if (ehUrgencia(p.forca)) sangrando.push(reg);
    else if (p.forca === "tecnico/individual") revisar.push(reg);
    else coorte.push(reg);
  }

  // CONTROLE DIREITA — a consulta da Hotmart tem que enxergar o code conhecido.
  const ctrl = [...sangrando, ...resolvidos, ...coorte].find((p) => p.email === CONTROLE_EMAIL);
  const ctrlErro = naoSei.find((p) => p.email === CONTROLE_EMAIL);
  if (!ctrl || !ctrl.assinaturas.some((a) => a.code === CONTROLE_CODE)) {
    console.error(`\n❌ CONTROLE POSITIVO FALHOU (DIREITA) — a Hotmart não devolveu ${CONTROLE_CODE} para ${CONTROLE_EMAIL}`);
    if (ctrlErro) console.error(`   a consulta falhou: ${ctrlErro.erro}`);
    console.error("   O lado que decide quem está sangrando está cego. Relatório abortado.");
    process.exit(1);
  }

  // ── 3. RELATÓRIO ────────────────────────────────────────────────────────
  if (JSON_OUT) {
    console.log(JSON.stringify({ sangrando, revisar, resolvidos, naoSei, coorte, varridos: incidentes.length }, null, 2));
    return;
  }

  const L = "=".repeat(78);
  console.log(L);
  console.log(`PEDIDO DE SAÍDA × ASSINATURA VIVA — ${new Date(agora).toISOString()}`);
  console.log(`${incidentes.length} incidentes varridos = ${abertos.length} abertos + ${fechadosVivos.length} fechados com sinal desde ${dia(corte)} (${JANELA_FECHADO_DIAS}d)`);
  console.log(`${casam.length} casam o vocabulário de saída · ${pessoas.length} pessoa(s) · ${pessoas.length} consulta(s) à Hotmart`);
  console.log(`controle positivo: OK nos dois lados (esquerda: ${CONTROLE_EMAIL} reencontrado · direita: ${CONTROLE_CODE} devolvido)`);
  console.log(L);

  console.log(`\n🩸 PEDIU PRA SAIR E A ASSINATURA CONTINUA VIVA — vai ser cobrado de novo  [${sangrando.length}]`);
  if (!sangrando.length) console.log("   (ninguém — e o controle acima prova que isto é fila limpa, não cegueira)");
  for (const p of sangrando) {
    console.log(`   ${p.email}  ·  evidência: ${p.forca}`);
    for (const a of p.assinaturas) console.log(`      Hotmart: ${a.code} | ${a.status}${a.trial ? " | trial" : ""} | ${a.plano ?? "(sem plano)"}`);
    for (const cd of p.cards) console.log(`      #${cd.numero} [${cd.status}] ${dia(cd.first)} → ${dia(cd.last)} · ${String(cd.title).slice(0, 90)}`);
  }

  console.log(`\n🟠 REVISAR — card TÉCNICO de 1 pessoa com assinatura viva. O título diz que a CASA`);
  console.log(`   falou de um pedido; não prova que a pessoa pediu AGORA. Confira antes de tratar`);
  console.log(`   como pedido — e NÃO cancele por conta disto sozinho  [${revisar.length}]`);
  for (const p of revisar) {
    console.log(`   ${p.email}`);
    for (const a of p.assinaturas) console.log(`      Hotmart: ${a.code} | ${a.status}${a.trial ? " | trial" : ""}`);
    for (const cd of p.cards) console.log(`      #${cd.numero} [${cd.status}] ${dia(cd.first)} → ${dia(cd.last)} · ${String(cd.title).slice(0, 90)}`);
  }

  if (naoSei.length) {
    console.log(`\n❓ NÃO SEI — a consulta à Hotmart falhou. NÃO é "está tudo bem"  [${naoSei.length}]`);
    for (const p of naoSei) console.log(`   ${p.email} · ${p.erro}`);
  }

  console.log(`\n✅ PEDIU E JÁ ESTÁ FORA — nada a fazer  [${resolvidos.length}]`);
  for (const p of resolvidos) {
    const st = p.assinaturas.map((a) => `${a.code}:${a.status}`).join(", ") || "(nenhuma assinatura)";
    console.log(`   ${p.email} · ${st}`);
  }

  console.log(`\n🔵 COORTE DE CARD TÉCNICO — ninguém aqui pediu nada; a casa achou varrendo um defeito.`);
  console.log(`   Listados de propósito (invisível já custou caro), FORA da urgência (#266)  [${coorte.length}]`);
  for (const p of coorte) console.log(`   ${p.email} · ${p.vivas} assinatura(s) viva(s) · cards ${p.cards.map((c) => "#" + c.numero).join(", ")}`);

  console.log(`\n➡️  ${sangrando.length} sangrando · ${revisar.length} a revisar · ${naoSei.length} sem resposta da Hotmart · ${resolvidos.length} já fora · ${coorte.length} na coorte.`);
  if (sangrando.length) console.log(`   Cancelar é AUTOMÁTICO (regra 9-C) quando o titular pediu por escrito: cancelar_assinatura.cjs --aluno <email> --confirmar`);
  console.log(`\n⚠️  LIMITE: a varredura é por E-MAIL, e pessoa não é e-mail. Quem fala com um`);
  console.log(`   endereço e assina com outro tem a segunda assinatura invisível aqui — foi o que`);
  console.log(`   aconteceu com a Lucila na estreia (2Q4Y1CDE, achada na mão). Antes de dar um`);
  console.log(`   caso por fechado, confira se a pessoa tem outros e-mails.`);
})();
