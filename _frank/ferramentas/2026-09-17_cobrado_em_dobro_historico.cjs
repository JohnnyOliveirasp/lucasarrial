/**
 * "Quem FOI cobrado em dobro?" — irmão histórico do `assinatura_em_dobro.cjs`,
 * que só sabe responder "quem AINDA está sendo cobrado em dobro".
 *
 * POR QUE ESTE SCRIPT EXISTE (nota do #254 de 17/09 ~13hZ, medida)
 * O detector do card filtra `.eq("status","active")` (assinatura_em_dobro.cjs:76).
 * Basta UMA perna do par estar cancelada pra o par inteiro sumir do relatório —
 * mesmo com o dinheiro duplicado já cobrado e nunca devolvido. Medido: a
 * Herineth pagou US$ 88 pelo mesmo produto, US$ 44 são duplicata, e em 30/08
 * foi cobrada DUAS VEZES NO MESMO DIA. Ela NÃO aparece no detector, porque a
 * perna PPEVZBRG foi cancelada por nós em 07/09. Quem a achou foi uma ronda na
 * mão, não o instrumento.
 * Ironia registrada na nota: o docstring do detector manda NÃO concluir por
 * `entitlements.status` — e é por ali que ele filtra.
 *
 * A SEGUNDA CEGUEIRA, também medida: o `agrupar()` (linhas 86-102) une por CPF
 * OU telefone OU nome. Nas duas pernas da Herineth o documento está vazio numa
 * e preenchido na outra, o telefone é NULL nas duas, e os nomes normalizam
 * diferente ("herineth silva" x "HErineth Maria Lima da Silva"). O ÚNICO campo
 * que junta as duas é a chave normalizada de Gmail (o Gmail ignora o ponto) —
 * exatamente a normalização que falta na produção e que é o assunto do #306.
 * Aqui essa chave entra no grafo.
 *
 * ⚠️ A DISTINÇÃO QUE ESTE SCRIPT EXISTE PRA NÃO BORRAR, e que o filtro de
 * `active` escondia de graça: tirar o filtro faz aparecer MUITA gente que
 * cancelou e voltou meses depois. Isso é churn, NÃO é cobrança em dobro, e
 * contar essa gente como vítima seria inflar o número — o mesmo erro que o
 * #222 cometeu ao chamar trial de cobrança. Por isso o veredito aqui não é
 * "tem duas pernas pagas", é **SOBREPOSIÇÃO DE COBERTURA**.
 *
 * ⚠️⚠️ E AQUI MORA O ERRO QUE EU MESMO COMETI NA PRIMEIRA VERSÃO DESTE SCRIPT,
 * em 17/09, registrado pra ninguém repetir. Eu comparava as janelas
 * [primeira paga, última paga] de cada perna. Isso trata **pagamento como
 * instante**, e pagamento de assinatura NÃO é instante: é um MÊS DE SERVIÇO
 * comprado. Consequência medida: perna com UMA só cobrança vira janela de
 * largura ZERO e não consegue cruzar com nada, nunca.
 *   Nássara — perna ZKJBP56C pagou R$97 em 30/07, perna 4C8EVSH4 pagou R$97
 *   em 31/07. UM DIA de diferença, o mesmo mês comprado duas vezes, e a regra
 *   antiga disse "sem sobreposição, é churn".
 *   Leandro Lopardi — 28/08 numa perna e 05/09 na outra: idem.
 * As duas eram vítimas REAIS, já nomeadas no título do #254 desde 04/09, e eu
 * ia publicá-las como "assinou de novo depois". Errei 2 de 5.
 * A regra certa: cada cobrança paga cobre **[data, data + ciclo)**, e o ciclo
 * sai da cadência da própria assinatura (mediana dos intervalos entre
 * cobranças; 31 dias quando só há uma). Duas pernas se sobrepõem se QUALQUER
 * cobertura de uma cruzar QUALQUER cobertura da outra.
 *
 * ⚠️ QUEM DECIDE "pagou" é a Hotmart viva: price.value > 0 E status
 * COMPLETE/APPROVED (OVERDUE não é pagamento). Falha de leitura é reportada
 * como FALHA, nunca como "não pagou".
 *
 * ⚠️ CONTROLE POSITIVO OBRIGATÓRIO. O script ABORTA se a Herineth
 * (herysilva.27@gmail.com + herysilva27@gmail.com) não voltar agrupada. Um
 * detector cego devolve zero com a mesma cara de um mundo limpo, e zero de
 * instrumento cego já enganou esta casa em 07/09 e outra vez em 13/09. Sem o
 * controle, "não achei mais ninguém" não vale nada.
 *
 * Somente leitura. Não cancela, não estorna, não toca em crédito nem acesso.
 *
 * Uso:
 *   node _frank/ferramentas/2026-09-17_cobrado_em_dobro_historico.cjs [--produto 7851642]
 *        [--so-grupos]   → para antes de falar com a Hotmart (quantos pares existem)
 *        [--json]
 */
const { supa } = require("./_comum.cjs");

const PRODUTO_PADRAO = "7851642"; // FastCloner
const PAGO = new Set(["COMPLETE", "COMPLETED", "APPROVED"]);
const BASE = process.env.HOTMART_API_BASE ?? "https://developers.hotmart.com/payments/api/v1";

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const SO_GRUPOS = args.includes("--so-grupos");
const produto = args.includes("--produto") ? args[args.indexOf("--produto") + 1] : PRODUTO_PADRAO;

// Controle positivo DE AGRUPAMENTO: as duas pernas da Herineth precisam cair
// no mesmo grupo (só a chave de Gmail as une — CPF, telefone e nome divergem).
const CONTROLE = ["herysilva.27@gmail.com", "herysilva27@gmail.com"];

/**
 * Controle positivo DE VEREDITO — a lição de 17/09.
 * Agrupar certo e concluir errado são erros independentes, e eu só tinha
 * controle pro primeiro. Estas 3 pessoas são vítimas JÁ MEDIDAS e nomeadas no
 * título do #254 desde 04/09; se a regra de sobreposição não as reencontrar,
 * a regra está quebrada — foi exatamente assim que a primeira versão jogou
 * Nássara e Leandro na vala do "churn". Controle que só testa o passo que eu
 * já confiava não é controle.
 */
const CONTROLE_DOBRO = [
  "nassarab@hotmail.com",            // Nássara      — pernas pagas 30/07 e 31/07
  "leandro@aeroclubejf.com.br",      // Leandro      — pernas pagas 28/08 e 05/09
  "caplastica@hotmail.com",          // Carlos       — duas cobranças em 28/08
];
const DIA = 86400000;
const CICLO_PADRAO = 31; // produto é mensal (R$97 / US$22 / R$1 na conta de teste)

const norm = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
const soDigitos = (s) => (s ?? "").toString().replace(/\D/g, "");

/**
 * Chave de e-mail como PESSOA, não como string.
 * No Gmail o ponto é ignorado e o "+tag" é descartável: herysilva.27@ e
 * herysilva27@ são a MESMA caixa. Fora do Gmail não invento regra — o ponto
 * pode ser significativo e supor o contrário entrega a conta de um pagante na
 * caixa de outra pessoa.
 */
function chaveEmail(e) {
  const s = norm(e);
  if (!s.includes("@")) return null;
  let [local, dominio] = s.split("@");
  if (dominio === "googlemail.com") dominio = "gmail.com";
  if (dominio === "gmail.com") local = local.split("+")[0].replace(/\./g, "");
  else local = local.split("+")[0];
  return `${local}@${dominio}`;
}

/**
 * Lê TODOS os entitlements do produto — SEM filtro de status, que é o ponto
 * deste script. Pagina de 500: o PostgREST corta em 1000 EM SILÊNCIO e a
 * tabela tem ~1.305 linhas neste produto, então a consulta ingênua perderia
 * 305 pessoas sem avisar (armadilha registrada na ordem de 20/08).
 */
async function lerTodos(db) {
  const PAG = 500;
  const todos = [];
  for (let de = 0; ; de += PAG) {
    const { data, error } = await db
      .from("entitlements")
      .select("external_id, buyer_email, user_id, status, access_until, created_at, raw_event")
      .eq("product_code", produto)
      .order("external_id", { ascending: true })
      .range(de, de + PAG - 1);
    if (error) throw new Error(`Supabase: ${error.message}`);
    todos.push(...(data ?? []));
    if (!data || data.length < PAG) break;
  }
  // uma linha por assinatura (external_id); se houver repetida, fica a mais recente
  const porCode = new Map();
  for (const l of todos) {
    const ant = porCode.get(l.external_id);
    if (!ant || String(l.created_at) > String(ant.created_at)) porCode.set(l.external_id, l);
  }
  return { linhas: [...porCode.values()], brutas: todos.length };
}

/** Une assinaturas da mesma pessoa por CPF OU telefone OU nome OU caixa de e-mail. */
function agrupar(linhas) {
  const pai = new Map();
  const acha = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
  const une = (a, b) => { pai.has(a) || pai.set(a, a); pai.has(b) || pai.set(b, b); const ra = acha(a), rb = acha(b); if (ra !== rb) pai.set(ra, rb); };

  for (const l of linhas) {
    const b = l.raw_event?.buyer ?? {};
    const eu = `E:${l.external_id}`;
    pai.has(eu) || pai.set(eu, eu);
    const cpf = soDigitos(b.document);
    const fone = soDigitos(b.checkout_phone);
    const nome = norm(b.name);
    if (cpf.length === 11) une(eu, `D:${cpf}`);
    if (fone.length >= 10) une(eu, `F:${fone}`);
    if (nome.includes(" ")) une(eu, `N:${nome}`);
    for (const e of [l.buyer_email, b.email]) {
      const k = chaveEmail(e);
      if (k) une(eu, `M:${k}`);
    }
  }

  const grupos = new Map();
  for (const l of linhas) {
    const r = acha(`E:${l.external_id}`);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(l);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}

async function token() {
  const u = `https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials`
    + `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}`
    + `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, { method: "POST", headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` } });
  const t = JSON.parse(await r.text()).access_token;
  if (!t) throw new Error(`sem access_token (HTTP ${r.status})`);
  return t;
}

/** Cobranças PAGAS de uma assinatura, direto da Hotmart. Erro nunca vira zero. */
async function cobrancasPagas(code, H) {
  const r = await fetch(`${BASE}/subscriptions/${code}/purchases`, { headers: H });
  const raw = await r.text();
  if (r.status !== 200) return { erro: `HTTP ${r.status}: ${raw.slice(0, 140)}` };
  let j;
  try { j = JSON.parse(raw); } catch { return { erro: `resposta nao-JSON: ${raw.slice(0, 140)}` }; }
  const lista = Array.isArray(j) ? j : (j.items ?? []);
  const pagas = lista.filter((x) => Number(x.price?.value) > 0
    && PAGO.has(String(x.purchase?.status ?? x.status).toUpperCase()));
  return {
    total: lista.length,
    pagas: pagas.map((x) => ({
      valor: Number(x.price.value),
      moeda: x.price.currency_code ?? "BRL",
      status: String(x.purchase?.status ?? x.status),
      transacao: x.transaction,
      em: x.approved_date ? new Date(x.approved_date).toISOString().slice(0, 10) : null,
    })).sort((a, b) => String(a.em).localeCompare(String(b.em))),
  };
}

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const db = supa();
  const { linhas, brutas } = await lerTodos(db);
  console.log(`Entitlements do produto ${produto}: ${brutas} linhas lidas, ${linhas.length} assinaturas distintas`);
  const porStatus = {};
  for (const l of linhas) porStatus[l.status] = (porStatus[l.status] ?? 0) + 1;
  console.log(`  por status: ${Object.entries(porStatus).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`  (o detector do card enxerga SO as ${porStatus.active ?? 0} active)\n`);

  const grupos = agrupar(linhas);
  console.log(`Pessoas com mais de uma assinatura: ${grupos.length}\n`);

  // ---- CONTROLE POSITIVO, antes de qualquer conclusão ----
  const achouControle = grupos.some((g) => {
    const mails = g.map((l) => norm(l.buyer_email));
    return CONTROLE.every((c) => mails.includes(c));
  });
  if (!achouControle) {
    console.error(`\n⛔ ABORTADO: o controle positivo (${CONTROLE.join(" + ")}) NAO voltou agrupado.`);
    console.error(`   Sem ele, qualquer numero daqui e indistinguivel de instrumento cego. Nao publique nada.`);
    process.exit(2);
  }
  console.log(`✅ controle positivo OK: as duas pernas da Herineth caem no mesmo grupo.\n`);

  if (SO_GRUPOS) {
    for (const g of grupos) {
      const nome = g.map((l) => l.raw_event?.buyer?.name).find(Boolean) ?? "(sem nome)";
      console.log(`### ${nome}`);
      for (const l of g) console.log(`   ${l.external_id} <${l.buyer_email}> ${l.status} dono=${l.user_id ? l.user_id.slice(0, 8) : "ORFAO"}`);
    }
    return;
  }

  const H = { Authorization: `Bearer ${await token()}` };
  const saida = [];

  for (const g of grupos) {
    const nome = g.map((l) => l.raw_event?.buyer?.name).find(Boolean) ?? "(sem nome)";
    const detalhes = [];
    let falhou = false;
    for (const l of g) {
      const c = await cobrancasPagas(l.external_id, H);
      if (c.erro) falhou = true;
      detalhes.push({ ...l, hotmart: c });
      await dorme(220); // a Hotmart estrangula; ir devagar e mais barato que reler tudo
    }

    const pagantes = detalhes.filter((d) => d.hotmart.pagas?.length);

    // COBERTURA: cada cobranca paga compra [data, data + ciclo) de servico.
    // O ciclo sai da cadencia da propria assinatura (mediana dos intervalos
    // entre cobrancas consecutivas), com 31 dias quando so ha uma cobranca.
    // NAO uso access_until: ele vem do NOSSO banco, que e justamente a fonte
    // que o docstring do detector manda nao usar pra concluir.
    const janelas = pagantes.map((d) => {
      const datas = d.hotmart.pagas.map((p) => p.em).filter(Boolean);
      const ts = datas.map((s) => Date.parse(s + "T00:00:00Z")).sort((a, b) => a - b);
      let ciclo = CICLO_PADRAO;
      if (ts.length > 1) {
        const gaps = ts.slice(1).map((t, i) => Math.round((t - ts[i]) / DIA)).sort((a, b) => a - b);
        const mediana = gaps[Math.floor(gaps.length / 2)];
        if (mediana >= 20 && mediana <= 45) ciclo = mediana; // cadencia mensal plausivel
      }
      return {
        code: d.external_id,
        ciclo,
        coberturas: ts.map((t) => [t, t + ciclo * DIA]),
        total: d.hotmart.pagas.reduce((s, p) => s + p.valor, 0),
        moeda: d.hotmart.pagas[0].moeda,
        datas,
      };
    });

    let sobrepoe = null;
    let janelaComum = null;
    for (let i = 0; i < janelas.length && !sobrepoe; i++) {
      for (let j = i + 1; j < janelas.length && !sobrepoe; j++) {
        for (const [a0, a1] of janelas[i].coberturas) {
          for (const [b0, b1] of janelas[j].coberturas) {
            if (a0 < b1 && b0 < a1) {
              sobrepoe = [janelas[i], janelas[j]];
              janelaComum = [new Date(Math.max(a0, b0)).toISOString().slice(0, 10),
                             new Date(Math.min(a1, b1)).toISOString().slice(0, 10)];
              break;
            }
          }
          if (sobrepoe) break;
        }
      }
    }
    const mesmoDia = [...new Set(janelas.flatMap((w) => w.datas))]
      .filter((d) => janelas.filter((w) => w.datas.includes(d)).length > 1);

    const totalPago = janelas.reduce((s, w) => s + w.total, 0);
    const duplicado = sobrepoe
      ? Math.min(...sobrepoe.map((w) => w.total))
      : 0;

    const veredito = falhou ? "LEITURA FALHOU — nao concluir"
      : pagantes.length < 2 ? (pagantes.length === 1 ? "uma paga so — ok" : "nenhuma paga (trials)")
      : sobrepoe ? `COBRADO EM DOBRO (${janelas[0].moeda} ${totalPago} pagos, ~${duplicado} duplicado)`
      : "duas pagas SEM sobreposicao — assinou de novo depois, NAO e dobro";

    const interessa = falhou || (pagantes.length >= 2);
    if (interessa) {
      const aindaAtivas = detalhes.filter((d) => d.status === "active").length;
      console.log(`### ${nome} — ${veredito}${sobrepoe && aindaAtivas < 2 ? "  [INVISIVEL ao detector do card]" : ""}`);
      for (const d of detalhes) {
        const dono = d.user_id ? d.user_id.slice(0, 8) : "ORFAO";
        const h = d.hotmart.erro ? `⚠️ ${d.hotmart.erro}`
          : (d.hotmart.pagas.length
              ? d.hotmart.pagas.map((p) => `${p.moeda} ${p.valor} ${p.status} ${p.transacao} ${p.em}`).join(" ; ")
              : "nenhuma cobranca paga");
        console.log(`   ${d.external_id} <${d.buyer_email}> ${d.status} dono=${dono} ate ${String(d.access_until).slice(0, 10)}`);
        console.log(`      ${h}`);
      }
      if (janelaComum) console.log(`   ⏱  mes pago em duplicidade: ${janelaComum[0]} → ${janelaComum[1]}`);
      if (mesmoDia.length) console.log(`   ⚠️ COBRADO DUAS VEZES NO MESMO DIA: ${mesmoDia.join(", ")}`);
      console.log("");
    }
    saida.push({ nome, veredito, sobrepoe: !!sobrepoe, janelaComum, mesmoDia, totalPago, duplicado,
      emails: detalhes.map((d) => d.buyer_email),
      aindaAtivas: detalhes.filter((d) => d.status === "active").length,
      assinaturas: detalhes.map((d) => ({ code: d.external_id, email: d.buyer_email, status: d.status, orfa: !d.user_id, hotmart: d.hotmart })) });
  }

  const dobro = saida.filter((s) => s.sobrepoe);
  const invisiveis = dobro.filter((s) => s.aindaAtivas < 2);
  const churn = saida.filter((s) => s.veredito.startsWith("duas pagas SEM"));
  const falhas = saida.filter((s) => s.veredito.startsWith("LEITURA"));
  // ---- CONTROLE POSITIVO DE VEREDITO: as vitimas ja conhecidas do #254 ----
  const faltando = CONTROLE_DOBRO.filter((e) =>
    !dobro.some((d) => (d.emails ?? []).some((m) => norm(m) === e)));
  if (faltando.length) {
    console.error(`\n⛔ ABORTADO: a regra de sobreposicao NAO reencontrou vitima(s) ja medida(s) do #254:`);
    for (const f of faltando) console.error(`     ${f}`);
    console.error(`   Foi exatamente assim que a 1a versao deste script jogou Nassara e Leandro`);
    console.error(`   na vala do "churn". Enquanto isto falhar, NENHUM numero daqui vale.`);
    process.exit(2);
  }
  console.log("─".repeat(70));
  console.log(`✅ controle de veredito OK: as ${CONTROLE_DOBRO.length} vitimas ja conhecidas do #254 foram reencontradas.`);
  console.log(`COBRADO EM DOBRO (cobertura sobreposta): ${dobro.length}`);
  for (const d of dobro) console.log(`   ${d.nome} — ${d.totalPago} pagos, ~${d.duplicado} duplicado${d.aindaAtivas < 2 ? "  [INVISIVEL ao detector do card]" : ""}${d.mesmoDia.length ? `  [mesmo dia: ${d.mesmoDia.join(",")}]` : ""}`);
  console.log(`\nDESSES, INVISIVEIS ao assinatura_em_dobro.cjs (menos de 2 pernas active): ${invisiveis.length}`);
  console.log(`Assinou de novo depois (churn, NAO e dobro): ${churn.length}`);
  if (falhas.length) console.log(`⚠️  SEM VEREDITO (a Hotmart nao respondeu): ${falhas.length} — ${falhas.map((f) => f.nome).join(", ")}`);
  if (JSON_OUT) console.log("\n" + JSON.stringify(saida, null, 2));
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
