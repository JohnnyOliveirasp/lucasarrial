/**
 * Ronda 08/09 ~14hZ — abre o chamado do dedupe ETERNO do convite de compra
 * órfã, JÁ com a correção em produção (PR #212, merge e449783).
 *
 * Ele nasce `fixed` de propósito: a causa foi medida, corrigida, testada e
 * mergeada na mesma ronda. O chamado existe pra deixar RASTRO da classe —
 * senão o defeito volta e ninguém lembra que já foi visto.
 *
 * ⚠️ Sem `--confirmar` ele SÓ ENSAIA.
 * ⚠️ Se a busca de duplicata FALHAR, ele PARA: consulta que erra volta vazia,
 *    e "0 duplicatas" por erro não autoriza abrir chamado repetido.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const SIGNATURE = "frank:convite-orfa-dedupe-eterno";
const COMMIT = "e449783";

const TITULO =
  "PAGANTE SEM CONTA FICAVA CALADO PARA SEMPRE: o dedupe do convite de compra orfa era por E-MAIL e PERMANENTE, "
  + "entao assinante mensal cobrado todo mes sem nunca ter conseguido entrar nunca mais era procurado. "
  + "5 pessoas com janela paga viva e ZERO perfil, todas as 5 CANCELARAM. Corrigido: o ciclo agora e da COBRANCA.";

const DESCRICAO = `CAUSA (frontend/src/lib/payments/orphan-outreach.ts)

O dedupe morava em agent_state.orphan_invites e era por E-MAIL, para sempre:
quem recebia o convite + o lembrete unico de 3 dias nunca mais era procurado.
Em compra avulsa isso esta certo. Em ASSINATURA MENSAL esta errado, e o erro
tem a forma mais cara que existe: a pessoa e cobrada todo mes por uma
plataforma onde nunca conseguiu entrar, e a casa, que sabe disso, fica calada.

MEDIDO EM PRODUCAO (ensaio _frank/rascunhos/medir_convite_ciclico.ts, que usa
as funcoes de decisao DE PRODUCAO, nao manda e-mail e nao grava nada):

  regra velha (producao ate hoje):  1 convite  + 1 lembrete = 2 e-mails
  regra nova (PR #212):             5 convites + 0 lembretes = 5 e-mails

NAO era rajada — 5 pessoas. As 3 do delta estavam caladas PARA SEMPRE mesmo
tendo pago DEPOIS do ultimo contato:

  gustavocasarotto@hotmail.com  convite 04/08, lembrete 07/08 -> pagou 12/08
  herysilva.27@gmail.com        convite 04/08, lembrete 07/08 -> pagou 30/08
  jkakorio@hotmail.com          convite 20/08, lembrete 24/08 -> pagou 26/08

Conferido um a um no banco (nao herdado de ronda anterior): os 5 tem ZERO
perfil, entitlement.user_id NULO e janela paga AINDA VIVA:

  alinecuida@gmail.com          access_until 2026-09-10
  gustavocasarotto@hotmail.com  access_until 2026-09-12
  jkakorio@hotmail.com          access_until 2026-09-19
  herysilva.27@gmail.com        access_until 2026-09-21
  rodrigo.limas.1978@gmail.com  access_until 2026-09-30

E OS CINCO CANCELARAM (status=canceled com data futura). Pagaram, nao
conseguiram entrar, ninguem falou com eles de novo, e foram embora. O custo do
dedupe eterno esta visivel na propria coluna.

O QUE TORNOU ISTO URGENTE HOJE: o 5aef886 (PR #211), mergeado nesta manha,
alargou compradorMereceConvite citando 6 pagantes com janela viva e sem conta.
Conferido contra o estado do dedupe, ele alcancaria 2 dos 6 que ele mesmo
nomeia — os outros 4 seguiam calados. PR mergeado nao e PR que funciona.

LIGACAO COM O #305: rodrigo.limas.1978 e a mesma pessoa do #305 (aviso de
compra orfa que nao disparou). Sao caminhos DIFERENTES — o #305 e o
avisarCompraOrfa do webhook, este e a varredura diaria — e a causa do #305
segue NAO determinada. O que mudou e que a varredura passa a alcanca-lo.`;

const RESOLUCAO = `CORRIGIDO E EM PRODUCAO — PR #212, merge ${COMMIT}.

O ciclo passou a ser do PAGAMENTO, nao do e-mail: pagamento novo depois do
ciclo ja atendido reabre convite + lembrete; sem pagamento novo, silencio. O
teto continua 1 convite + 1 lembrete POR COBRANCA, entao assinante mensal ve no
maximo ~2 mensagens por mes, e so enquanto NAO tiver conta.

Regra isolada em frontend/src/lib/payments/orphan-ciclo.ts, modulo PURO (zero
import), com 11 testes em node --test, todos passando. tsc --noEmit limpo.

GUARDA NOVA (jaTemDono): compra ja ligada a uma conta nao recebe convite. A
guarda hasAccount procura perfil com o e-mail DA COMPRA e por isso e cega pra
quem compra com um endereco e usa a plataforma por outro (classe do
#20/#27/#36/#195/#218). Sem ela, tornar o dedupe ciclico recriaria o incidente
72a4c9db: "crie sua conta" mandado pra cliente ATIVO.

ARMADILHA QUE NAO ENTROU: comparar as datas como STRING. received_at chega
"...982633+00:00" e o estado grava "...982Z"; lexicograficamente o 6 vem antes
do Z, entao o MESMO instante compararia como mais antigo e o ciclo nunca
reabriria — falha silenciosa, sem erro nenhum. Compara-se em MILISSEGUNDOS, de
proposito. Data ilegivel NAO reabre ciclo (falha fechada: na duvida, nao manda).

O QUE AINDA NAO ESTA FEITO (nao confundir com resolvido): os 5 nomeados acima
ainda NAO receberam nada. Quem escreve pra eles e a varredura diaria do cron,
na proxima passada. Se na proxima ronda eles seguirem sem convite, o defeito
NAO e este — e o cron.`;

(async () => {
  const db = supa();

  const { data: todos, error } = await db.from("incidents")
    .select("id,numero,title,status,signature,created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (error) { console.error(`PARANDO — a busca de duplicata falhou: ${error.message}`); process.exit(1); }
  console.log(`contraprova: ${todos.length} incidentes lidos`);

  const porSig = todos.filter((i) => i.signature === SIGNATURE);
  const parecidos = todos.filter((i) => /dedupe|orphan_invites|convite/i.test(`${i.title} ${i.signature}`));
  console.log(`\nmesma signature: ${porSig.length}`);
  for (const i of porSig) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 90)}`);
  console.log(`\nparecidos (dedupe/convite): ${parecidos.length}`);
  for (const i of parecidos) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 110)}`);

  if (porSig.length) { console.log("\nJA EXISTE com esta signature — nao abro de novo."); return; }

  // `numero` NAO e automatico nesta tabela — quem insere calcula. E se a
  // leitura tiver batido no teto, o max e MENTIRA (daria numero repetido):
  // nesse caso PARA, em vez de colidir com a unique.
  const TETO = 500;
  if (todos.length >= TETO) {
    console.error(`PARANDO — li ${todos.length} incidentes (teto ${TETO}): o max(numero) nao e confiavel.`);
    process.exit(1);
  }
  const numero = Math.max(0, ...todos.map((i) => Number(i.numero) || 0)) + 1;

  const agora = new Date().toISOString();
  const linha = {
    numero,
    kind: "system",
    cause: "bug",
    status: "fixed",
    signature: SIGNATURE,
    title: TITULO,
    description: DESCRICAO,
    occurrences: 5,
    affected_emails: [
      "alinecuida@gmail.com",
      "gustavocasarotto@hotmail.com",
      "herysilva.27@gmail.com",
      "jkakorio@hotmail.com",
      "rodrigo.limas.1978@gmail.com",
    ],
    reported_by: "frank",
    resolution_note: RESOLUCAO,
    resolved_commit: COMMIT,
    resolved_by: "frank",
    resolved_at: agora,
    first_seen_at: agora,
    last_seen_at: agora,
  };

  if (!CONFIRMAR) {
    console.log("\n=== ENSAIO — nada gravado. Rode com --confirmar. ===");
    console.log(`titulo: ${TITULO.slice(0, 120)}...`);
    console.log(`status: ${linha.status} | commit: ${COMMIT} | afetados: ${linha.affected_emails.length}`);
    return;
  }

  const { data: novo, error: insErr } = await db.from("incidents").insert(linha).select("id,numero,status");
  if (insErr) { console.error(`FALHOU ao inserir: ${insErr.message}`); process.exit(1); }
  if (!novo || novo.length !== 1) { console.error(`ESPERAVA 1 linha, veio ${novo?.length ?? 0}`); process.exit(1); }
  console.log(`\nGRAVADO: #${novo[0].numero} (${novo[0].id}) status=${novo[0].status}`);
})();
