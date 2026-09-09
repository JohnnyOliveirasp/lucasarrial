/**
 * Ronda do VIGIA 09/09 ~12hZ — abre o chamado da guarda anti-mojibake do
 * `mailText` ser TUDO-OU-NADA: um unico byte indecodificavel na CITACAO
 * condena o texto inteiro, inclusive a frase do aluno, que converteria limpa.
 *
 * Nasce `investigating` (o Vigia ABRE e ANOTA; quem investiga, decide e fecha
 * e o Frank — regra 14-A). NAO acusa dinheiro: nenhum ref_id contestado,
 * entao a checagem §3.3 da ordem de 27/08 nao se aplica — e digo isso de
 * proposito, porque foi a armadilha que produziu o #100, o #125 e o #152.
 * O que ele afirma tem arquivo:linha e foi MEDIDO com a funcao de PRODUCAO,
 * nao com um porte e nao por leitura de codigo no olho.
 *
 * ⚠️ Sem `--confirmar` ele SO ENSAIA.
 * ⚠️ Se a busca de duplicata FALHAR, ele PARA: consulta que erra volta vazia,
 *    e "0 duplicatas" por erro nao autoriza abrir chamado repetido.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const SIGNATURE = "vigia:mailtext-guarda-mojibake-tudo-ou-nada";

const TITULO =
  "A FAST LE O ALUNO COM O TEXTO CORROMPIDO EM 25 DE 60 E-MAILS: mail-respond.ts:86-91 converte o corpo "
  + "INTEIRO de latin1 pra utf8 e joga a conversao fora se sobrar UM U+FFFD — e o byte ruim quase sempre "
  + "esta na CITACAO do e-mail anterior (0,03% a 0,24% do texto), nao na fala do aluno, que sozinha "
  + "converteria limpa. Hoje isso fez a Fast responder a um comprador pagante que a mensagem dele \"parece "
  + "estar vazia ou com problema de codificacao\" e pedir reenvio; 4 minutos depois ele ameacou cancelar.";

const DESCRICAO = `ABERTO PELO VIGIA NA RONDA DE 09/09 ~12hZ. Nao e a planilha
(ordem de 29/08): e o agente de atendimento (Fast) lendo a caixa do suporte@,
em producao. Sensor: eu ABRO e ANOTO, nao investigo, nao fecho e nao respondo
aluno (14-A).

O DEFEITO, COM ARQUIVO:LINHA
frontend/src/lib/agent/mail-respond.ts:86-91, no fim do mailText():

    // Bytes UTF-8 lidos como latin1 -> reconverte se sair limpo.
    try {
      const round = Buffer.from(text, "latin1").toString("utf8");
      if (!/\\uFFFD/.test(round)) text = round;      // <-- TUDO OU NADA
    } catch {
      /* mantem */
    }

A guarda esta CERTA na intencao e ERRADA no escopo. Ela converte o texto
INTEIRO — que inclui a CITACAO do e-mail anterior, muitas vezes maior que a
mensagem nova — e so aceita o resultado se NENHUM caractere de troca (U+FFFD)
aparecer em lugar nenhum. Basta um byte indecodificavel na citacao pra guarda
recusar TUDO e devolver o mojibake integral, inclusive a frase do aluno, que
isolada converteria perfeitamente.

O byte que mais aparece e o 0xA0 (NBSP solto em latin1) que clientes de e-mail
portugueses emitem no "as" de "as 10:50" da linha de citacao. Ele nao e do
aluno, nao e do nosso texto, e e ele que decide o que o cerebro da Fast le.

COMO EU MEDI (nao e leitura de codigo no olho, e execucao)
Duas ferramentas novas, commitadas junto, ambas LEITURA PURA (EXAMINE +
BODY.PEEK[], nunca BODY[]; imprimem as FLAGS/a fila antes e depois e acusam se
mudarem — a fila de nao-lidos e da Fast e nao pode encolher por medicao minha):

  _frank/ferramentas/2026-09-09_dump_mime_cru.cjs
      dump do MIME cru + BODYSTRUCTURE de um uid.
  _frank/ferramentas/2026-09-09_medir_mojibake_na_caixa.cjs
      baixa os N e-mails JA LIDOS mais recentes e roda o mailText **DE
      PRODUCAO** (mail-respond.ts importado via jiti — NAO um porte) sobre
      cada um, exatamente como o cerebro da Fast recebe, e classifica.

Isso responde a ressalva que ficou por provar no #261 (ab485826), onde eu
mesmo escrevi: "NAO li o MIME cru do uid 436 ... quem pegar o card deve
comecar dumpando o BODYSTRUCTURE antes de mexer no mailText". Desta vez a
fonte veio antes do chamado, nao depois.

REACH MEDIDO EM PRODUCAO (60 e-mails mais recentes do INBOX, 09/09 ~12hZ)
  CORROMPIDO (a Fast leu mojibake E dava pra converter limpo) ...... 25
  corrompido-total (mojibake por outra causa) ....................... 1
  ok (acento correto) ............................................... 16
  sem acento (nada a decidir) ....................................... 18
Ou seja: dos 42 e-mails que tinham acento, 26 chegaram corrompidos ao cerebro
da Fast e 25 desses eram recuperaveis pela propria guarda que ja existe.
Nao e cauda: e a MAIORIA de quem escreve em portugues com acento.

A DESPROPORCAO, QUE E O CORACAO DO DEFEITO — em cada caso medido, o numero de
U+FFFD que condenou o texto inteiro:
  uid 503 duartesoaresconsultor@gmail.com ... 2 U+FFFD em 2908 chars (0,069%)
  uid 480 elaneyani@gmail.com ................ 1 U+FFFD em 3001 chars (0,033%)
  uid 477 contatoecocannabis@gmail.com ....... 1 U+FFFD em 2808 chars (0,036%)
  uid 482 emanuelfmguerreiro@gmail.com ....... 2 U+FFFD em 2983 chars (0,067%)
  uid 492 victor.inscriptio@gmail.com ........ 1 U+FFFD em 1381 chars (0,072%)
  uid 498 elaneckis@gmail.com ................ 1 U+FFFD em  842 chars (0,119%)
  uid 484 simonelealandrade88@gmail.com ...... 1 U+FFFD em  496 chars (0,202%)
Um quinto de um por cento do texto, no pedaco que o aluno nem escreveu,
apagando a acentuacao da queixa inteira.

O CASO VIVO QUE PROVA O DANO (conferido por mim nesta ronda)
Duarte Soares <duartesoaresconsultor@gmail.com>, comprador em Portugal,
PAGANTE (acesso ativo ate 30/09, 100.261 creditos apos o pagamento de hoje).
  11:21Z INBOX uid 503 — ele escreve, em text/plain UTF-8 quoted-printable
         (BODYSTRUCTURE conferido), 3357 bytes: "Nao consigo pagar".
         O mailText de producao entregou a Fast:
             "NA£o consigo pagar Fast - FastCloner <suporte@fastcloner.com>
              escreveu (quarta, 9/09/2026 A (s) 10:50): > Ola, Duarte, ..."
         Contraprova, no mesmo script: convertendo SO a fala do aluno (os 18
         chars antes da citacao) sai "Nao consigo pagar" com ZERO U+FFFD. Os 2
         U+FFFD estao ambos na citacao, o primeiro no indice 89, no "A (s)".
  11:25Z a Fast responde ao aluno:
             "Recebi a sua mensagem, mas nao consegui ver o conteudo que queria
              enviar (a linha do assunto diz 'corrigindo o que lhe dissemos
              hoje', mas o corpo do e-mail parece estar vazio ou com problema de
              codificacao) ... pode reenviar a mensagem?"
         O modelo diagnosticou o sintoma CERTO e devolveu o problema pro aluno.
  11:29Z uid 504, resposta dele:
             "Nao consegui pagar direto no hotmart. Da erro no pagar
              pendente... Vejam se conseguem resolver caso contrario CANCELO
              SUBSCRICAO pois nao consigo pagar."
O e-mail dele nao tinha problema nenhum: 3357 bytes de text/plain UTF-8 bem
formado. Quem nao conseguiu ler foi o nosso codigo, e o aluno e que foi mandado
repetir.

O PADRAO ESTA SE ESPALHANDO (achado da checagem 2, registro aqui de proposito)
A MESMA logica tudo-ou-nada aparece, escrita de novo, em DOIS PRs abertos que
tratam outro caminho de leitura (e-mail acima do teto de 2MB):
  PR #41 e PR #42, funcao textoDoBuffer:
      const utf8 = buf.toString("utf8");
      return /\\uFFFD/.test(utf8) ? buf.toString("latin1") : utf8;
Eles NAO curam este defeito — reproduzem a mesma decisao binaria noutro lugar.
Quem for consertar o mailText deve olhar os dois antes de mergear, senao a
correcao nasce ja contornada.

O QUE ESTE CHAMADO **NAO** AFIRMA (de proposito — ordem de 27/08 §3.3)
  - NAO afirma cobranca indevida, debito errado nem estorno faltando. NENHUM
    ref_id esta sendo contestado e NADA deve ser estornado por este card. E a
    armadilha que produziu o #100, o #125 e o #152, e eu nao a repito.
  - NAO afirma que o Duarte esta trancado por engano: ele PAGOU hoje por
    multibanco e a conta reativou sozinha (#318, fechado pelo Frank as 11:43Z,
    conferido por mim em aluno.cjs — acesso ATIVO ate 30/09, +100.000 creditos
    as 11:38Z). O fechamento do #318 esta CERTO e nao estou reabrindo nada.
  - NAO afirma que a resposta da Fast foi de ma qualidade. Dado o texto
    corrompido que ela recebeu, a resposta dela foi razoavel. O defeito esta a
    montante, na leitura.
  - NAO conta os 25 corrompidos como 25 alunos prejudicados. O que esta medido
    e que o cerebro leu texto degradado em 25 mensagens; quantas respostas
    ficaram piores por isso eu NAO medi, e nao vou afirmar. O unico dano com
    consequencia OBSERVADA e o uid 503.

CHECAGENS DA ORDEM DE 27/08 §3, ESCRITAS COMO ELA EXIGE
  1. "JA EXISTE?" — varri a base INTEIRA (aberta E fechada) por
     mojibake|acento|codific|utf|latin|mailtext|mail-respond|charset em
     signature, title e kind: ZERO resultados. Os dois parentes conhecidos sao
     de outra causa e estao ambos IGNORED: o #261 (ab485826) e sobre a escolha
     text/plain-vs-html quando o plain vem VAZIO, e foi REFUTADO na fonte (o
     uid 436 era autorresposta bulk e nem tinha parte text/plain); o #248
     (1b5dbfa0) e sobre o ler_caixa.cjs ficar cego a html puro, ou seja,
     ferramenta minha, nao producao. Nenhum dos dois toca a guarda das linhas
     86-91, que e o que este card reivindica. NAO reabri nenhum (14-A).
  2. "JA FOI CORRIGIDO?" — git log origin/main em mail-respond.ts (8 commits,
     nenhum toca a guarda) e os 29 PRs abertos. Os tres que mexem em leitura de
     e-mail foram lidos linha a linha: o #188 ("text/plain vazio para de virar
     silencio", #261/#248) mexe no ler_caixa.cjs e nos testes, nao na guarda; o
     #41 e o #42 tratam o teto de 2MB e, como registrado acima, REPETEM o
     padrao em vez de corrigi-lo. Nenhum PR aberto conserta este defeito.
  3. DINHEIRO — nao se aplica, ver o bloco acima. Ainda assim ha arquivo:linha
     e medicao com a funcao de producao, que e a prova que a ordem pede.

TESTE DE BOLSO (ordem de 27/08 §2): "se o codigo estivesse certo, isso nao
teria acontecido?" SIM. Se a guarda decidisse por TRECHO em vez de pelo texto
inteiro — ou tolerasse uma fracao de U+FFFD, ou decodificasse pelo charset
declarado no proprio BODYSTRUCTURE (o uid 503 declara charset UTF-8, entao a
informacao estava la e nao foi usada) — a Fast teria lido "Nao consigo pagar" e
respondido a pergunta, em vez de mandar um comprador pagante reenviar a
mensagem que ele ja tinha mandado certa.

O QUE EU **NAO** FIZ (14-A): nao respondi o aluno, nao escrevi rascunho de
e-mail, nao toquei em credito nem em acesso, nao fechei nem reabri nada, nao
mexi em codigo de producao, nao mergeei PR e nao toquei em e-mail nao-lido (a
fila de nao-lidos foi medida antes e depois: 0 e 0).`;

// Os 25 CORROMPIDOS medidos nesta ronda, por remetente distinto.
const AFETADOS = [
  "duartesoaresconsultor@gmail.com",
  "elaneckis@gmail.com",
  "elaneyani@gmail.com",
  "emanuelfmguerreiro@gmail.com",
  "victor.inscriptio@gmail.com",
  "contatoecocannabis@gmail.com",
  "simonelealandrade88@gmail.com",
  "iran@ogr.com.br",
];

(async () => {
  const db = supa();

  const { data: todos, error } = await db.from("incidents")
    .select("id,numero,title,status,signature,created_at")
    .order("created_at", { ascending: false }).limit(500);
  if (error) { console.error(`PARANDO — a busca de duplicata falhou: ${error.message}`); process.exit(1); }
  console.log(`contraprova: ${todos.length} incidentes lidos (aberta E fechada)`);

  const porSig = todos.filter((i) => i.signature === SIGNATURE);
  const parecidos = todos.filter((i) =>
    /mojibake|acento|acentua|codific|utf|latin|mailtext|mail-respond|charset|corpo vazio|sem corpo/i.test(`${i.title} ${i.signature}`));
  console.log(`\nmesma signature: ${porSig.length}`);
  for (const i of porSig) console.log(`  #${i.numero} ${i.status} ${String(i.title).slice(0, 90)}`);
  console.log(`\nparecidos (mojibake/codificacao/corpo): ${parecidos.length}`);
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
    occurrences: 25,
    affected_emails: AFETADOS,
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
