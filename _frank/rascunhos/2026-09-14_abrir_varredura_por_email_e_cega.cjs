#!/usr/bin/env node
/**
 * Abre o incidente medido na rotina das falhas de 14/09 ~12hZ:
 * as varreduras de dinheiro varrem por E-MAIL, e pessoa nao e e-mail.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

// A vitima MEDIDA da classe: a Lucila, cuja 2a assinatura ficou invisivel.
const AFETADOS = ["contatoecocannabis@gmail.com", "blancolucila539@gmail.com"];

const TITULO =
  "AS VARREDURAS DE DINHEIRO VARREM POR E-MAIL, E PESSOA NAO E E-MAIL: quem fala com um endereco e " +
  "assina com outro tem a 2a assinatura invisivel. Medido na estreia do saida_x_assinatura.cjs: a " +
  "assinatura 2Q4Y1CDE da Lucila (R$ 97 marcados pra 23/09) NAO foi achada pelo instrumento — eu a " +
  "peguei na mao lendo o e-mail dela. E a classe do #222, que ja voltou 7 vezes";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA ROTINA DAS FALHAS DE 14/09 ~12hZ, EM PRODUCAO.
Saiu de dentro da perna 1 do #384, na PRIMEIRA execucao do instrumento novo.

O DEFEITO, EM UMA FRASE: as varreduras que decidem dinheiro (saida_x_assinatura,
garantia_na_fila) juntam evidencia por AFFECTED_EMAILS, entao elas raciocinam
sobre enderecos, nao sobre gente. Uma pessoa com 3 e-mails vira 3 pessoas
diferentes, e a protecao que ela ganha por UM deles nao alcanca os outros.

O CASO MEDIDO (nao e hipotese, e o que aconteceu hoje)
A Lucila Blanco tem TRES enderecos e DUAS assinaturas:
  - contatoecocannabis@gmail.com -> 6JEANY3Z, renovaria 30/09. Card #299, categoria ATENDIMENTO.
  - blancolucila539@gmail.com    -> 2Q4Y1CDE, renovaria 23/09. Unico card: #254, categoria TECNICO (coorte).
  - lucilablanco75@gmail.com     -> sem assinatura, sem perfil.
Ela pediu reembolso das DUAS por escrito em 07/09 (INBOX uid 475 e 477), pelo
endereco contatoecocannabis@.

O instrumento achou a PRIMEIRA e nao a segunda. O motivo e estrutural, nao e
regex: o pedido dela so existe como card de ATENDIMENTO no e-mail com que ela
ESCREVEU. O outro endereco so aparece em coorte tecnica, que por decisao correta
do #266 NAO conta como pedido de ninguem. Logo: a assinatura do e-mail silencioso
fica fora da urgencia, mesmo com a dona tendo pedido pra sair por escrito.

DINHEIRO QUE ISSO CUSTARIA HOJE: R$ 97 em 23/09. Nao custou porque eu fui LER o
e-mail dela antes de dar o caso por fechado e vi os tres enderecos. Ou seja: foi
leitura manual que salvou, nao instrumento. Se eu tivesse confiado no relatorio
"0 sangrando", a cobranca acontecia.

POR QUE ISSO E GRAVE E NAO E DETALHE
E exatamente a classe do #222 (pagou com um e-mail, criou conta/pediu com outro),
que esta registrada como tendo voltado SETE vezes (#20, #27, #36, #195, #218,
#222 e o Fernando de 08/09) e que em TODAS foi achada por acidente, nunca por
instrumento. Esta e a oitava, e tambem foi por acidente.

A CURA, E POR QUE EU NAO A FIZ AGORA
Existe precedente pronto: detector_preso_fora_da_conta.cjs ja casa pessoa por
CPF e por NOME (regra medida: primeiro nome igual E pelo menos um outro token em
comum, que pega 5 de 6 casos reais e recusa o 6o, que e legitimamente outra
pessoa). O caminho e: antes de perguntar a Hotmart, expandir cada e-mail para o
CONJUNTO de enderecos da mesma pessoa, e tratar o conjunto como uma unidade.

NAO fiz nesta ronda de proposito. Casar no escuro aqui nao gera so um numero
errado: gera CANCELAMENTO NA CONTA DE OUTRA PESSOA, que nao tem desfazer. O
proprio detector ja marca AMBIGUO e se recusa a sugerir vinculo quando casa com
mais de um perfil, e essa prudencia tem que ser herdada inteira. Merece PR
proprio, com controle positivo (a Lucila tem que ser reencontrada com os 2
enderecos) e controle negativo (ambiguidade nao pode virar vinculo).

O QUE JA FOI FEITO PRA NAO FICAR INVISIVEL ENQUANTO ISSO
O limite esta escrito no cabecalho do saida_x_assinatura.cjs, na tabela do
_frank/ferramentas/README.md, e o script IMPRIME o aviso no rodape de toda
execucao, citando o caso da Lucila pelo codigo da assinatura. Tambem entrou na
rotina (_frank/03_ROTINA.md secao 2-B): "antes de dar um caso por fechado,
confira se a pessoa tem outros e-mails".

ALCANCE QUE EU NAO MEDI, E DIGO QUE NAO MEDI: quantas OUTRAS pessoas hoje tem
assinatura viva num e-mail silencioso enquanto pediram pra sair por outro. Nao
levantei porque a medicao honesta disso exige justamente o casamento por pessoa
que este cartao pede. O numero pode ser zero e pode nao ser.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "frank:varredura-por-email-e-cega-a-pessoa",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: AFETADOS,
    reported_by: "frank",
    first_seen_at: agora,
    last_seen_at: agora,
    agent_notes: [],
  };

  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }

  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}

main();
