#!/usr/bin/env node
/**
 * saida_por_pessoa.cjs — o ALCANCE do #390, que ninguém tinha medido.
 *
 * SÓ LEITURA. Não cancela, não estorna, não escreve em lugar nenhum.
 *
 * ── A PERGUNTA ────────────────────────────────────────────────────────────
 * O #390 (aberto 14/09) diz, com todas as letras, o que NÃO foi medido:
 *
 *   "quantas outras pessoas hoje têm assinatura viva num e-mail silencioso
 *    enquanto pediram pra sair por outro. Pode ser zero e pode não ser."
 *
 * Este script responde essa frase e só ela. Ele NÃO é a cura do #390 — a cura
 * é casar pessoa DENTRO do `saida_x_assinatura.cjs`, e isso merece PR próprio
 * com controle positivo e negativo, porque casar no escuro não gera número
 * errado: gera cancelamento na conta de outra pessoa, e isso não tem desfazer.
 *
 * ── O DEFEITO QUE ELE ENXERGA ─────────────────────────────────────────────
 * As varreduras de dinheiro juntam evidência por `affected_emails`, então elas
 * raciocinam sobre ENDEREÇO, não sobre GENTE. Uma pessoa com 3 e-mails vira 3
 * pessoas, e a proteção que ela ganha por UM deles não alcança os outros.
 *
 * Caso que nomeou o cartão (14/09): a Lucila Blanco pediu reembolso por escrito
 * pelo `contatoecocannabis@` (card #299, atendimento). A SEGUNDA assinatura
 * dela, `2Q4Y1CDE`, vive no `blancolucila539@`, cujo único card é o #254
 * (técnico, COORTE — que pela decisão correta do #266 não conta como pedido de
 * ninguém). O instrumento acusou uma e ficou cego pra outra, que renovaria R$97
 * em 23/09. Ela só não foi cobrada porque um humano foi ler o e-mail na mão.
 *
 * ── COMO ELE CASA PESSOA (e por que assim) ────────────────────────────────
 * Union-find por CPF **ou** telefone **ou** nome-com-sobrenome, igual ao
 * `assinatura_em_dobro.cjs` — que já mediu a armadilha: agrupar por
 * "nome normalizado + telefone" deixou de fora justamente as duas pessoas que
 * pagavam em dobro (Nássara assinou com dois nomes diferentes; Gabriela tem CPF
 * numa compra e CPF vazio na outra). Chave única sempre subconta.
 *
 * ⚠️ DUAS FORMAS DE PAYLOAD, e ignorar isso cega o script pela metade.
 * O webhook de COMPRA grava `raw_event.buyer` (com `document`/`checkout_phone`).
 * O de CANCELAMENTO grava `raw_event.subscriber` (com `phone:{ddd,cell}` e SEM
 * documento). Ler só `buyer` faria toda assinatura cancelada perder a chave de
 * pessoa — e é exatamente nas canceladas que mora o controle positivo.
 *
 * ── CONTROLE POSITIVO, E ABORTA SE FALHAR ─────────────────────────────────
 * "Zero" de instrumento cego é a mentira mais cara que um script destes conta,
 * e esta casa já foi enganada por ela em 07/09, 13/09 e 14/09. Então a Lucila
 * TEM que ser reencontrada: o grupo dela tem que juntar `contatoecocannabis@`
 * (que pediu) com `blancolucila539@` (o endereço silencioso). Ela é o controle
 * ideal porque as duas assinaturas dela JÁ foram canceladas em 14/09 11:52Z:
 * exercita a tubulação inteira e cai no balde "já resolvido", provando o
 * caminho sem ser vítima. Se ela não for reencontrada, ABORTA (exit 1) em vez
 * de imprimir um relatório limpo e vazio.
 *
 * ── O QUE É URGÊNCIA AQUI ─────────────────────────────────────────────────
 * Só entra na urgência quem tem as TRÊS coisas ao mesmo tempo:
 *   1. pediu pra sair por ALGUM endereço (vocabulário do saida_x_assinatura);
 *   2. tem entitlement `active` com `access_until` no FUTURO em OUTRO endereço;
 *   3. esse outro endereço NÃO tem card próprio de pedido de saída.
 * É a definição literal de "invisível pra varredura que existe hoje".
 *
 * Quem tem assinatura viva no MESMO endereço que pediu já é pego pelo
 * `saida_x_assinatura.cjs` — aqui ele aparece rotulado `JA_VISIVEL`, pra a
 * diferença entre os dois instrumentos ficar medida em vez de suposta.
 *
 * USO:
 *   node _frank/ferramentas/saida_por_pessoa.cjs
 *   node _frank/ferramentas/saida_por_pessoa.cjs --json
 */
const { supa } = require("./_comum.cjs");

const PRODUTO = "7851642"; // FastCloner
const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");

/** Card FECHADO ainda conta como sinal recente por esta janela (mesma régua do irmão). */
const JANELA_FECHADO_DIAS = Number(process.env.JANELA_FECHADO_DIAS || 30);

// ── vocabulário: copiado do saida_x_assinatura.cjs, medido lá contra 4 falsos
const SAIDA_PESSOA =
  /cancel|encerr|n[ãa]o quero mais|desist|desligar|descadastr|reembols|restitui|estorn|devolu[çc]|chargeback/i;
const SAIDA_TECNICA =
  /pedido de cancelamento|pedido de sa[íi]da|pediu\s+(pra|para)\s+(sair|cancelar)|n[ãa]o quero mais|encerrar o plano|quer\s+(sair|cancelar)|solicit\w*\s+cancelamento/i;

const ABERTOS = ["open", "investigating"];
const norm = (s) => (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
const soDigitos = (s) => (s ?? "").toString().replace(/\D/g, "");
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

/** O controle positivo. Ver o bloco no cabeçalho. */
const CONTROLE_PEDIU = "contatoecocannabis@gmail.com";
const CONTROLE_SILENCIOSO = "blancolucila539@gmail.com";

/** Pagina até o fim. O PostgREST corta em 1000 EM SILÊNCIO (armadilha de 20/08). */
async function paginar(monta, rotulo) {
  let todos = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await monta().range(de, de + 999);
    if (error) throw new Error(`${rotulo}: ${JSON.stringify(error)}`); // erro CRU antes de acreditar em zero
    todos = todos.concat(data ?? []);
    if (!data || data.length < 1000) return todos;
  }
}

/** Força da evidência de que ESTA pessoa pediu pra sair (regra do #266/#384). */
function forcaDaEvidencia(inc) {
  if (inc.categoria === "atendimento") return "atendimento";
  return (inc.affected_emails || []).length === 1 ? "tecnico/individual" : "tecnico/coorte";
}

const casaVocabulario = (inc) =>
  (inc.categoria === "atendimento" ? SAIDA_PESSOA : SAIDA_TECNICA).test(inc.title || "");

/**
 * Chaves de identidade de uma linha de entitlement. Lê as DUAS formas de
 * payload (compra -> buyer, cancelamento -> subscriber). Ver cabeçalho.
 */
function chavesDaPessoa(raw) {
  const b = raw?.buyer ?? {};
  const s = raw?.subscriber ?? {};
  const chaves = [];

  const cpf = soDigitos(b.document ?? s.document);
  if (cpf.length === 11) chaves.push(`D:${cpf}`);

  // buyer: checkout_phone plano. subscriber: {ddd,phone,dddCell,cell}
  const fones = [
    soDigitos(b.checkout_phone),
    soDigitos(`${s.phone?.dddPhone ?? ""}${s.phone?.phone ?? ""}`),
    soDigitos(`${s.phone?.dddCell ?? ""}${s.phone?.cell ?? ""}`),
  ];
  for (const f of fones) if (f.length >= 10) chaves.push(`F:${f}`);

  const nome = norm(b.name ?? s.name);
  if (nome.includes(" ")) chaves.push(`N:${nome}`);

  return chaves;
}

(async () => {
  const db = supa();

  // ── 1) QUEM PEDIU PRA SAIR, por endereço ────────────────────────────────
  const corte = new Date(Date.now() - JANELA_FECHADO_DIAS * 86400000);
  const incidentes = await paginar(
    () => db.from("incidents").select("numero,status,title,affected_emails,categoria,last_seen_at"),
    "incidents",
  );

  /** email -> [{numero, forca, title}] */
  const pediu = new Map();
  for (const inc of incidentes) {
    if (!casaVocabulario(inc)) continue;
    const aberto = ABERTOS.includes(String(inc.status ?? ""));
    if (!aberto && new Date(inc.last_seen_at ?? 0) < corte) continue; // fechado e velho: não é sinal
    const forca = forcaDaEvidencia(inc);
    if (forca === "tecnico/coorte") continue; // #266: coorte não é pedido de ninguém
    for (const e of inc.affected_emails || []) {
      const k = norm(e);
      if (!k) continue;
      if (!pediu.has(k)) pediu.set(k, []);
      pediu.get(k).push({ numero: inc.numero, forca, status: inc.status, title: String(inc.title).slice(0, 90) });
    }
  }

  // ── 2) TODOS os entitlements do produto (qualquer status) ───────────────
  const ents = await paginar(
    () => db.from("entitlements")
      .select("external_id,buyer_email,user_id,status,access_until,raw_event,updated_at")
      .eq("product_code", PRODUTO)
      .order("external_id", { ascending: true }),
    "entitlements",
  );

  // ── 3) agrupa por PESSOA (union-find) ───────────────────────────────────
  const pai = new Map();
  const acha = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
  const une = (a, b) => {
    pai.has(a) || pai.set(a, a); pai.has(b) || pai.set(b, b);
    const ra = acha(a), rb = acha(b);
    if (ra !== rb) pai.set(ra, rb);
  };
  for (const l of ents) {
    const eu = `E:${l.external_id}`;
    pai.has(eu) || pai.set(eu, eu);
    for (const k of chavesDaPessoa(l.raw_event)) une(eu, k);
  }
  const grupos = new Map();
  for (const l of ents) {
    const r = acha(`E:${l.external_id}`);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(l);
  }

  // ── 4) cruza ────────────────────────────────────────────────────────────
  const agora = new Date();
  const urgentes = [], jaVisiveis = [], resolvidos = [];
  let controleOk = false;

  for (const linhas of grupos.values()) {
    const emails = [...new Set(linhas.map((l) => norm(l.buyer_email)).filter(Boolean))];
    const quemPediu = emails.filter((e) => pediu.has(e));
    if (quemPediu.length === 0) continue; // ninguém deste grupo pediu pra sair

    // controle positivo: o grupo da Lucila tem que juntar os dois endereços
    if (emails.includes(CONTROLE_PEDIU) && emails.includes(CONTROLE_SILENCIOSO)) controleOk = true;

    for (const l of linhas) {
      const e = norm(l.buyer_email);
      const viva = String(l.status) === "active" && l.access_until && new Date(l.access_until) > agora;
      const item = {
        pessoa: norm(l.raw_event?.buyer?.name ?? l.raw_event?.subscriber?.name) || "(sem nome)",
        code: l.external_id,
        email: e,
        status: l.status,
        access_until: dia(l.access_until),
        pediu_por: quemPediu,
        cards: (pediu.get(e) ?? []).map((c) => `#${c.numero}(${c.forca})`),
      };
      if (!viva) { if (pediu.has(e) || quemPediu.length) resolvidos.push(item); continue; }
      if (pediu.has(e)) jaVisiveis.push(item); // o saida_x_assinatura.cjs já pega
      else urgentes.push(item);               // INVISÍVEL pra varredura de hoje
    }
  }

  if (!controleOk) {
    console.error(
      "ABORTADO — controle positivo FALHOU: o grupo da Lucila Blanco não juntou\n" +
      `  ${CONTROLE_PEDIU} (pediu) com ${CONTROLE_SILENCIOSO} (silencioso).\n` +
      "Sem isso, qualquer 'zero' aqui é instrumento cego e NÃO deve ser acreditado.",
    );
    process.exit(1);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ urgentes, jaVisiveis, resolvidos, controleOk }, null, 2));
    return;
  }

  const bloco = (titulo, lista) => {
    console.log(`\n=== ${titulo}: ${lista.length} ===`);
    for (const i of lista) {
      console.log(`  ${i.code} <${i.email}> ${i.status} ate ${i.access_until}  [${i.pessoa}]`);
      console.log(`      pediu por: ${i.pediu_por.join(", ")}   cards deste endereco: ${i.cards.join(" ") || "NENHUM"}`);
    }
  };

  console.log("saida_por_pessoa — alcance do #390 (somente leitura)");
  console.log(`controle positivo (Lucila, 2 enderecos no mesmo grupo): OK`);
  bloco("URGENTE — assinatura VIVA num endereco SILENCIOSO (invisivel hoje)", urgentes);
  bloco("JA VISIVEL — viva no mesmo endereco que pediu (o saida_x ja pega)", jaVisiveis);
  console.log(`\n(assinaturas ja canceladas/vencidas nos grupos que pediram: ${resolvidos.length})`);
  console.log(
    "\n⚠️ Este numero e o ALCANCE do #390, nao a cura dele. Antes de agir em\n" +
    "   qualquer linha URGENTE: confirme na Hotmart VIVA e confirme que a pessoa\n" +
    "   e a mesma. Cancelamento na conta errada nao tem desfazer.",
  );
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
