/**
 * Ronda do VIGIA 09/09 ~10hZ — abre o chamado do aviso de Pix/boleto que a
 * Fast anuncia como PENDENTE sem nenhuma janela de recencia.
 *
 * Nasce `investigating` (o Vigia ABRE e ANOTA; quem investiga, decide e fecha
 * e o Frank — regra 14-A). NAO acusa dinheiro: nao afirma cobranca indevida
 * nem estorno faltando, entao a checagem §3.3 da ordem de 27/08 nao se aplica.
 * O que ele afirma tem arquivo:linha nos DOIS lados da divergencia.
 *
 * ⚠️ Sem `--confirmar` ele SO ENSAIA.
 * ⚠️ Se a busca de duplicata FALHAR, ele PARA: consulta que erra volta vazia,
 *    e "0 duplicatas" por erro nao autoriza abrir chamado repetido.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const SIGNATURE = "vigia:fast-anuncia-pix-pendente-sem-janela-de-recencia";

const TITULO =
  "A FAST MANDA PAGAR UM PIX QUE JA VENCEU: account.ts:271 injeta \"Pix/boleto PENDENTE\" no contexto dela "
  + "com um null check CRU sobre pending_payment_at, enquanto o proprio /app (layout.tsx:112-115) so mostra o "
  + "mesmo aviso dentro de 3 DIAS. 106 perfis carregam a flag vencida, 12 deles vencida E sem acesso. "
  + "Caso vivo: comprador em Portugal que paga em EUR foi orientado a pagar por Pix duas vezes hoje.";

const DESCRICAO = `ABERTO PELO VIGIA NA RONDA DE 09/09 ~10hZ. Nao e a planilha
(ordem de 29/08): e o agente de atendimento (Fast) + o /app, os dois em
producao. Sensor: eu ABRO e ANOTO, nao investigo, nao fecho e nao respondo
aluno (14-A).

A DIVERGENCIA, COM ARQUIVO:LINHA NOS DOIS LADOS
A MESMA coluna (profiles.pending_payment_at) e lida por dois caminhos nossos,
com regras DIFERENTES:

  frontend/src/app/[locale]/app/layout.tsx:112-115  (a regra CERTA, escrita)
      const pendingRecent = pendingAt
        ? Date.now() - new Date(pendingAt).getTime() < 3 * 24 * 60 * 60 * 1000
        : false;
      const showPendingBanner = !!pendingAt && pendingRecent && !subscribed && !unlimited;
    e o comentario diz o proposito: "mostra o banner so se ainda SEM acesso e o
    aviso for recente (< 3 dias — janela tipica do Pix). Some quando
    liberar/expirar."

  frontend/src/lib/agent/account.ts:271  (a que NAO tem janela nenhuma)
      \`Plano: \${profile.plan} · Acesso: \${acesso}\${profile.pending_payment_at ? " · ⚠️ Pix/boleto PENDENTE aguardando pagamento" : ""}\`

O contexto da Fast usa null check CRU. Nao ha recencia, nao ha \`!subscribed\`,
nao ha expiracao. Ou seja: a tela do aluno esconde o aviso quando o Pix vence,
e a Fast continua anunciando o MESMO Pix como pendente para sempre. A regra
correta ja existe escrita na nossa base — este caminho simplesmente nao a usa.

REACH MEDIDO EM PRODUCAO (consulta em profiles, 09/09 ~10hZ)
  pending_payment_at NAO nulo ................................ 131
  ... mais velho que 3 dias (fora da janela do proprio /app) .. 106
  ... mais velho que 7 dias ................................... 79
  ... mais velho que 3 dias E sem access_until ................ 12
Os 12 sao a populacao exata em que a Fast dira "voce tem um Pix aguardando, e
so pagar" para quem esta sem acesso e cujo codigo ja morreu.

O CASO VIVO QUE PROVA (conferido por mim nesta ronda, nao herdado)
Duarte Soares <duartesoaresconsultor@gmail.com>, profile b1006494.
  - profiles.pending_payment_at = 31/08/2026 13:13 -> 9 DIAS na data de hoje,
    3x fora da janela de 3 dias do proprio /app. access_until NULO, plan free.
  - Hoje 09/09 09:00Z a Fast respondeu a ele exatamente o roteiro do Pix:
    "Vi aqui que voce tem um Pix ou boleto pendente aguardando pagamento. Se
    voce gerou o codigo Pix e ainda nao pagou, e so fazer o pagamento..."
  - Ele respondeu TRES vezes em 4 minutos (INBOX uid 500, 501, 502):
      09:02 "nao posso fazer por piz... tem de ser por multibanco por estar em Portugal"
      09:02 "tem de ter entidade e referencia"
      09:04 "esta ja nao se encontra a pagamento e nao sabia que a tinha recebido"
            (com print anexo, image.png 11KB)
    A ultima frase e a confirmacao do lado do aluno: a referencia ja NAO e
    pagavel, e ele nem sabia que a tinha.

A SEGUNDA METADE DO MESMO DEFEITO: O CONTEXTO NAO TEM MOEDA NEM PAIS
buildAccountContext (account.ts:196-283) monta nome, e-mail, plano, acesso,
saldo, cadastro, garantia, ultimos trabalhos e movimentacoes de credito. NAO
carrega moeda nem pais. Duarte paga em EUR (pagou_de_verdade.cjs na Hotmart
viva: assinatura rec#1 19 EUR COMPLETE 31/07, venda 22,04 EUR COMPLETE
HP1178293240), e Pix nao existe para ele. Sem a moeda no contexto, a Fast so
tem o roteiro brasileiro do manual.ts:366 pra oferecer.
Isto NAO e caso isolado da conta dele: o commit 2fff555 ja registrou que a
integracao europeia funciona e movimenta EUR (30 PURCHASE_APPROVED em EUR, 15
com valor > 0), e o #214 (zicasantos) foi outro comprador PT com Millennium BCP.
Existe populacao europeia; o contexto da Fast e cego pra ela.

O QUE ESTE CHAMADO **NAO** AFIRMA (de proposito — ordem de 27/08 §3.3)
  - NAO afirma cobranca indevida, debito errado nem estorno faltando. Nao ha
    acusacao de dinheiro aqui e nenhum ref_id esta sendo contestado.
  - NAO afirma que o Duarte esta trancado por engano. Ele NAO esta: a rec#2
    dele e OVERDUE (cobranca existe e NAO foi paga) e OVERDUE nao e pagamento
    pela regra vigente. pagante_trancado.cjs nesta ronda: 0 trancados, 176
    suspeitos conferidos na Hotmart viva. Os 261 creditos dele foram MANTIDOS,
    como manda a REGRA FINAL DE CREDITO de 20/08. Trancar esta certo.
  - NAO afirma que a Hotmart deveria oferecer multibanco. O meio de pagamento
    e da Hotmart e nao e nosso codigo.
O defeito que este chamado reivindica e so um, e e nosso: a Fast produz uma
AFIRMACAO FALSA sobre o estado da conta ("voce tem um Pix pendente, e so
pagar") porque o caminho que monta o contexto dela ignora a janela de recencia
que a nossa propria base ja define.

CHECAGENS DA ORDEM DE 27/08 §3, ESCRITAS COMO ELA EXIGE
  1. "JA EXISTE?" — varri os 47 abertos + as signatures da base. Nenhum card
     cobre pending_payment_at nem aviso de Pix vencido. O #318 e o card de
     ATENDIMENTO do proprio Duarte (fast-email:atend:), nao do defeito. O #315
     e da mesma FAMILIA (contexto da Fast pobre -> resposta errada) mas outro
     endereco e outra populacao: la e sgp_pedidos/last_sign_in_at, aqui e
     pending_payment_at. NAO e duplicata; a ligacao fica registrada.
  2. "JA FOI CORRIGIDO?" — git log origin/main desde 25/08 e os 28 PRs abertos,
     lidos um a um. Nenhum toca pending_payment_at nem moeda no contexto da
     Fast. O mais proximo e o PR #203 ("nao dizer ao assinante pagante que ele
     nao tem a plataforma", #290): mesma familia, campo diferente, nao cura
     este.
  3. DINHEIRO — nao se aplica, ver o bloco acima. Ainda assim ha arquivo:linha
     dos dois lados da divergencia, que e o que a ordem pede como prova.

TESTE DE BOLSO (ordem de 27/08 §2): "se o codigo estivesse certo, isso nao
teria acontecido?" SIM. Se account.ts:271 usasse a mesma janela de 3 dias que
layout.tsx:112-115 ja usa, a Fast nao teria dito a um comprador que ele tinha
um Pix pendente 9 dias depois de vencido.

O QUE EU **NAO** FIZ (14-A): nao respondi o aluno, nao escrevi rascunho de
e-mail, nao toquei em credito nem em acesso, nao fechei nem reabri nada, nao
mexi em codigo de producao e nao toquei em e-mail nao-lido.`;

(async () => {
  const db = supa();

  const { data: todos, error } = await db.from("incidents")
    .select("id,numero,title,status,signature,created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (error) { console.error(`PARANDO — a busca de duplicata falhou: ${error.message}`); process.exit(1); }
  console.log(`contraprova: ${todos.length} incidentes lidos`);

  const porSig = todos.filter((i) => i.signature === SIGNATURE);
  const parecidos = todos.filter((i) =>
    /pending_payment|pix|boleto|moeda|currency|multibanco|recencia/i.test(`${i.title} ${i.signature}`));
  console.log(`\nmesma signature: ${porSig.length}`);
  for (const i of porSig) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 90)}`);
  console.log(`\nparecidos (pix/boleto/pending/moeda): ${parecidos.length}`);
  for (const i of parecidos) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 130)}`);

  if (porSig.length) { console.log("\nJA EXISTE com esta signature — nao abro de novo."); return; }

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
    categoria: "tecnico",
    status: "investigating",
    signature: SIGNATURE,
    title: TITULO,
    description: DESCRICAO,
    occurrences: 12,
    affected_emails: ["duartesoaresconsultor@gmail.com"],
    reported_by: "vigia",
    first_seen_at: agora,
    last_seen_at: agora,
  };

  if (!CONFIRMAR) {
    console.log("\n=== ENSAIO — nada gravado. Rode com --confirmar. ===");
    console.log(`numero que sairia: #${numero}`);
    console.log(`signature: ${SIGNATURE}`);
    console.log(`status: ${linha.status} | categoria: ${linha.categoria} | reported_by: ${linha.reported_by}`);
    console.log(`ocorrencias: ${linha.occurrences} | afetados nomeados: ${linha.affected_emails.length}`);
    console.log(`\ntitulo:\n${TITULO}`);
    return;
  }

  const { data: novo, error: insErr } = await db.from("incidents").insert(linha).select("id,numero,status");
  if (insErr) { console.error(`FALHOU ao inserir: ${insErr.message}`); process.exit(1); }
  if (!novo || novo.length !== 1) { console.error(`ESPERAVA 1 linha, veio ${novo?.length ?? 0}`); process.exit(1); }
  console.log(`\nGRAVADO: #${novo[0].numero} (${novo[0].id}) status=${novo[0].status}`);
})();
