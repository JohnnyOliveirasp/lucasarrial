#!/usr/bin/env node
/**
 * As 14 cartas do #270 — o estorno da "foto extra".
 *
 * POR QUE EXISTE. O #270 teve o codigo consertado em 15/09 (PR #297) e UM aluno
 * avisado. Os outros 14 foram cobrados por geracoes que ignoraram a instrucao
 * deles e nunca souberam disso. Os 25.000 cr foram devolvidos nesta ronda
 * (20/09 10:44Z, conferidos no banco). Isto escreve pra cada um, um caso por
 * carta — nao e e-mail em massa: cada carta tem o valor, as datas e o numero de
 * geracoes DAQUELE aluno, e cada um e um caso que esta sendo tratado (regra 8).
 *
 * ENSAIO por padrao. Com --confirmar envia de verdade, um por um, e para no
 * primeiro erro pra nao mandar meia leva as cegas.
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RAIZ = path.resolve(__dirname, "..", "..");
const ENVIAR = path.join(RAIZ, "_frank", "ferramentas", "enviar_email.cjs");
const CHAVE = "estorno-270-foto-extra";
const CONFIRMAR = process.argv.includes("--confirmar");

// cr e datas CONFERIDOS no banco em 20/09 10:44Z (saida do estornar_foto_extra.cjs)
const ALUNOS = [
  { email: "thiagobarros.orl@gmail.com", nome: "Thiago", cr: 8425, ger: ["10/09"] },
  { email: "joaomarcos@grupofielpr.com.br", nome: "João Marcos", cr: 1845, ger: ["11/08"] },
  { email: "kuka.psicologa@gmail.com", nome: "Vilciane", cr: 1845, ger: ["11/08"] },
  { email: "draellenca@hotmail.com", nome: "Ellen", cr: 1845, ger: ["25/08"] },
  { email: "valterpjunior@gmail.com", nome: "Valtermir", cr: 1845, ger: ["25/08"] },
  { email: "lilian.meneguetti@travelsolution.tur.br", nome: "Lilian", cr: 1575, ger: ["02/09", "02/09", "02/09"] },
  { email: "viniciushbsilva@gmail.com", nome: "Vinícius", cr: 1320, ger: ["30/07"] },
  { email: "caio_colorado@hotmail.com", nome: "Caio", cr: 2100, ger: ["24/08", "24/08", "24/08", "26/08"] },
  { email: "dayane_calixto@yahoo.com.br", nome: "Dayane", cr: 525, ger: ["13/08"] },
  { email: "susiklunk@gmail.com", nome: "Suzáne", cr: 525, ger: ["14/08"] },
  { email: "adm@hub2decor.com.br", nome: "Igor", cr: 525, ger: ["31/08"] },
  { email: "costa.anaelson@gmail.com", nome: "Anaelson", cr: 525, ger: ["03/09"] },
  { email: "rafaluanravi29@gmail.com", nome: "Rafaela", cr: 525, ger: ["09/09"] },
  // Paulo tem paragrafo proprio: ele JA recebeu a carta do conserto em 15/09 e
  // voltou em 16/09 com outras tres queixas. A carta dele nao pode ignorar isso
  // nem se passar por primeira noticia — o acidente do Carlos (#254) nasceu de
  // duas cartas da casa que se anulavam.
  { email: "pcezardireito@icloud.com", nome: "Paulo", cr: 1575, ger: ["05/09", "12/09", "13/09"], paulo: true },
];

const br = (n) => n.toLocaleString("pt-BR");

function corpo(a) {
  const n = a.ger.length;
  const quando = n === 1
    ? `na sua geração de <strong>${a.ger[0]}</strong>`
    : `nas suas <strong>${n} gerações</strong> de ${[...new Set(a.ger)].join(", ")}`;

  const abertura = a.paulo
    ? `<p>Oi, Paulo.</p>

<p>Voltando na conversa de 15/09, quando eu te expliquei o defeito do botão
"Gerar prompt automático". Naquele dia eu consertei o problema e te avisei —
mas <strong>não te devolvi o crédito</strong> das gerações que já tinham sido
cobradas. Estou voltando pra fechar essa parte, e pra responder o que você
levantou depois, em 16/09.</p>`
    : `<p>Oi, ${a.nome}.</p>

<p>Escrevo pra contar uma falha nossa e o que já foi feito sobre ela. Você não
precisa responder nem pedir nada.</p>`;

  return `${abertura}

<p><strong>O que aconteceu.</strong> No Gerador de Imagem, quando você usava o
botão "Gerar prompt automático", ele apagava do texto final justamente a parte
em que você dizia de qual foto vinha o quê — por exemplo "da foto extra". O
sistema gerava a imagem ignorando essa instrução e cobrava os créditos
normalmente. Foi isso que aconteceu ${quando}.</p>

<p>Ou seja: o pedido estava certo do seu lado. O defeito era nosso, e ele
apagava a sua instrução em silêncio — sem avisar nem você nem nós.</p>

<p><strong>O que já está feito:</strong></p>

<ul>
  <li>O defeito está <strong>corrigido e no ar desde 15/09</strong>. O botão
      passou a preservar a atribuição por foto.</li>
  <li>Devolvemos <strong>${br(a.cr)} créditos</strong> para a sua conta — o
      valor exato do que foi cobrado ${n === 1 ? "naquela geração" : "naquelas gerações"}.
      <strong>Já está lá</strong>, não precisa solicitar.</li>
</ul>

<p>Se quiser refazer o pedido, pode escrever do mesmo jeito que você tinha
escrito antes: agora ele é obedecido. E o crédito para refazer é exatamente o
que acabou de voltar.</p>
${a.paulo ? `
<p><strong>Sobre o que você trouxe em 16/09</strong>, e aqui eu prefiro te dar o
que eu já conferi em vez de uma promessa:</p>

<ul>
  <li><strong>Os gestos e a fala fora de sincronia no Vídeo Clone. Você está
      certo, e agora eu tenho isso medido.</strong> Em vez de te responder por
      cima, eu mandei alguém <em>assistir de verdade</em> o seu vídeo de 16/09
      (o de 20:39). O parecer, sem maquiagem:
      <ul>
        <li>A <strong>sincronia labial está boa</strong> — a boca acompanha o
            áudio, sem atraso perceptível. Essa parte não é o problema.</li>
        <li>O problema são os <strong>gestos</strong>: as mãos e os braços sobem
            e voltam para a mesa de forma abrupta, com aceleração artificial e
            sem relação com a ênfase da fala. Está concentrado em três momentos
            — por volta de <strong>1,6s a 3,2s</strong>, <strong>12,5s a
            13,5s</strong> e <strong>18,5s a 19,5s</strong>. É exatamente o
            "desconexo" que você descreveu.</li>
        <li>Nota geral pra uso profissional: <strong>5 de 10</strong>.</li>
      </ul>
      Isso é <strong>limite do nosso motor de vídeo hoje</strong>, não erro de
      configuração sua e não tem ajuste na tela que resolva. Abri um registro
      interno próprio pra esse ponto, com esses tempos anotados, pra ele não
      morrer dentro de um e-mail.</li>
  <li><strong>As gerações que falhavam repetidamente.</strong> Fui conferir no
      sistema: os seus <strong>12 vídeos clone</strong> estão todos como
      concluídos, inclusive os 4 de 16/09, e <strong>nenhum</strong> aparece
      como falha. Então o que te incomodou ali não foi o vídeo não sair, foi ele
      sair diferente do que você esperava — que é o item de cima. Se você viu
      uma mensagem de erro na tela, me manda o print que eu vou atrás.</li>
  <li><strong>A assinatura que aparecia inativa.</strong> Está resolvido: sua
      compra de 06/09 está ativa e o seu acesso está garantido
      <strong>até 06/10</strong>. Não há nada travado na sua conta.</li>
</ul>

<p><strong>Uma observação honesta, porque é o seu dinheiro:</strong> em 16/09
você gerou o mesmo vídeo de 24 segundos <strong>quatro vezes</strong>, e isso
custou cerca de <strong>10.000 créditos</strong>. Pelo que foi medido acima,
refazer <strong>não</strong> corrige os gestos — o defeito está no motor, não no
seu pedido. Então não gaste mais crédito tentando por esse caminho.</p>

<p>Sobre esses 10.000: eu <strong>não</strong> vou te prometer devolução. Os
quatro vídeos foram entregues, então isso não é uma falha técnica como a do
Gerador de Imagem — é o nosso produto não estar bom o suficiente, e essa decisão
é do dono do produto, não minha. Levei a pergunta pra ele hoje, junto com esse
parecer do seu vídeo. Se a resposta for sim, eu te escrevo. Não vou te dar uma
data que eu não controlo.</p>
` : ""}
<p><strong>O que eu te devo:</strong> ${a.paulo
    ? "você foi avisado do defeito em 15/09, mas o crédito só voltou hoje. Foram cinco dias com o dinheiro do lado errado do balcão, e a demora foi nossa."
    : `isso aconteceu ${n === 1 ? `em ${a.ger[0]}` : `a partir de ${a.ger[0]}`} e você só está sabendo agora. Ninguém tinha te avisado antes, e essa demora foi falha nossa, não sua.`}</p>

<p>Qualquer coisa, responde neste mesmo e-mail que eu resolvo.</p>

<p>Abraço,<br>
Fast — suporte FastCloner</p>
`;
}

(async () => {
  const dir = path.join("/tmp", "cartas-270");
  fs.mkdirSync(dir, { recursive: true });
  let enviadas = 0;
  for (const a of ALUNOS) {
    const arq = path.join(dir, `${a.email.replace(/[^a-z0-9]/gi, "_")}.html`);
    fs.writeFileSync(arq, corpo(a));
    const assunto = `Devolvemos ${br(a.cr)} créditos para você — uma falha nossa no Gerador de Imagem`;
    const args = [ENVIAR, a.email, assunto, arq, "--chave", CHAVE, "--bcc", "suporte@lucasarrial.com"];
    if (!CONFIRMAR) args.push("--dry-run");
    console.log(`\n=================== ${a.email} (${br(a.cr)} cr) ===================`);
    try {
      const out = execFileSync("node", args, { cwd: RAIZ, encoding: "utf8", timeout: 120000 });
      console.log(out.split("\n").filter(l => !/MODULE_TYPELESS|Reparsing|eliminate this warning|trace-warnings/.test(l)).join("\n"));
      enviadas++;
    } catch (e) {
      console.error(`FALHOU em ${a.email}: ${e.message}`);
      console.error((e.stdout || "") + (e.stderr || ""));
      if (CONFIRMAR) { console.error("\n🔴 PAREI AQUI. Nao mando o resto as cegas."); process.exit(1); }
    }
  }
  console.log(`\n${CONFIRMAR ? "ENVIADAS" : "ENSAIADAS"}: ${enviadas}/${ALUNOS.length}`);
})();
