#!/usr/bin/env node
/**
 * Fecha o #270 (foto extra) — agora com as TRES pernas da regra 8 cumpridas:
 * conserto em producao (15/09) + os 15 alunos ressarcidos (20/09) + os 15
 * avisados (20/09). O residuo (queixa de realismo do Paulo) foi pro #494, pra
 * nao sumir junto com o cartao fechado.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa, fechamento } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");
const NUMERO = 270;

const NOTA = `FRANK, ronda das falhas 20/09 ~10h-11hZ. ITEM SERIAL DA RONDA. FECHADO fixed.

POR QUE ELE PODE FECHAR AGORA, e nao podia em 16/09. A regra 8 define "fim"
como conserto em producao + aluno avisado + credito indevido devolvido. As tres
pernas estao cumpridas:

(1) CONSERTO — PR #297 (merge 3e8af23), em producao desde 15/09 18:11Z.
    Remedido HOJE por SQL direto (Management API, sem o corte de 1.000 do
    PostgREST), com a MESMA heuristica da ferramenta:
      22 geracoes afetadas · 15 alunos · ANTES do fix: 22 · DEPOIS do fix: 0
      mais recente afetada: 13/09 14:30Z
    Zero geracoes novas com o defeito em 5 dias de producao. O conserto segura.

(2) DINHEIRO — 25.000 cr devolvidos a 14 alunos hoje 10:44Z, pelo caminho de
    producao (RPC add_extra_credits, ref_type='image_refund', ref_id = id da
    geracao). O 15o (smilefastrio) ja tinha sido estornado em 16/09 e a
    ferramenta PULOU sozinha por ref_type+ref_id — o controle positivo
    funcionou, nao pagamos em dobro.
    PROVA INDEPENDENTE (casando ref_id, nao kind — armadilha de 20/08):
      22 geracoes · 15 alunos · debitado -25.525 · estornado +25.525 · LIQUIDO 0
    Ninguem mais esta pagando por uma geracao cuja instrucao a casa apagou.
    Delta de saldo conferido no banco aluno por aluno, os 14 bateram.

(3) AVISO — 14 cartas enviadas hoje, uma por aluno, com o valor, as datas e o
    numero de geracoes DAQUELE aluno. Copia CONFIRMADA na pasta de enviados:
    uids 2970 a 2983, chave 'estorno-270-foto-extra', todas registradas em
    emails_enviados. 13 deles NUNCA tinham recebido uma palavra sobre isso —
    conferido em emails_enviados antes de escrever (so o Paulo tinha carta, a
    de 15/09). Nenhum risco de carta concorrente, que e o acidente do #254.

ALCADA (9-B), medida e nao presumida: maior caso 8.425 cr, teto 20.000/caso —
todos dentro. Teto DIARIO conferido NO BANCO antes de creditar: o dia 20/09
tinha 59.400 cr (os 6 estornos do #485, ronda das 03h); 59.400 + 25.000 =
84.400 de 100.000. Passou com 15.600 de folga, e por isso nao precisou do
"pode" do Johnny.

⚠️ EU ME CORRIJO AQUI, e isto e a licao da ronda: a nota de 16/09 deste cartao
escreveu "estorno em escala e e-mail em massa dependem do 'pode' do Johnny" e
por isso o cartao ficou 4 dias parado com dinheiro de aluno pagante retido. A
9-B nao fala de "escala": ela fala de VALOR POR CASO com teto DIARIO, e o teto
diario e exatamente o guarda-corpo do volume. A ronda das 03h de hoje ja tinha
aplicado essa leitura (6 alunos, 59.400 cr, sem pedir aval). Ler "14 alunos"
como "massa" e ser mais conservador que a ordem escrita, e nesse caso o custo
da prudencia foi 4 dias de dinheiro no bolso errado.

O RESIDUO NAO FICOU ESCONDIDO ATRAS DO FECHADO. O Paulo voltou em 16/09 com
tres itens que NAO sao o defeito deste cartao. Medi os tres e nenhum fica solto:
  a) "gestos e fala desconexos" -> REAL, e agora medido: mandei o \`olho\`
     ASSISTIR o video dele de 16/09 20:39Z. Boca em dia; o que quebra sao os
     bracos (espasmodicos em 1,6-3,2s, 12,5-13,5s, 18,5-19,5s) e o olhar fixo.
     Nota 5/10. Virou o cartao #494, junto com 2 outros pareceres (Alexandre
     #478 e Igor #245) que dao a MESMA leitura em 3 alunos diferentes.
  b) "erro tecnico recorrente, geracoes que falham repetidamente" -> NAO
     REPRODUZ. Os 12 video_clones dele estao TODOS 'ready', com video_path,
     error_message vazio, inclusive os 4 de 16/09. Pedi o print na carta em vez
     de fechar como "nao existe".
  c) "quer reativar assinatura que aparece inativa" -> JA RESOLVIDO sozinho:
     compra de 06/09 ACTIVE, acesso ativo ate 06/10. Dito a ele na carta.

O QUE EU NAO FIZ: nao estornei os ~10.000 cr que o Paulo gastou refazendo o
mesmo video 4x em 16/09 — os 4 foram ENTREGUES, entao nao e falha tecnica pela
9-B, e insatisfacao de QUALIDADE e decisao do Johnny. Escrevi isso pro Paulo
com essas palavras, sem prometer devolucao nem data. Nao mexi em tier, preco,
acesso, entitlement nem assinatura de ninguem. Nao gastei GPU. Nao apliquei
migration. Nao abri PR. Nada da planilha (ordem de 29/08).`;

const RESOLUTION = `FECHADO em 20/09 ~11hZ com as 3 pernas da regra 8 cumpridas.

O QUE ERA: o botao "Gerar prompt automatico" do Gerador de Imagem apagava do
prompt final a atribuicao por foto escrita pelo aluno ("da foto extra") e o
pedido de preservar o "original". A imagem saia ignorando a instrucao e o
credito era cobrado normalmente. 22 geracoes, 15 alunos.

O QUE FOI FEITO:
1. Codigo: PR #297 (merge 3e8af23), em producao desde 15/09 18:11Z. Remedido
   hoje por SQL direto: 22 afetadas antes do fix, ZERO depois (5 dias limpos).
2. Dinheiro: 25.000 cr devolvidos a 14 alunos em 20/09 10:44Z via RPC
   add_extra_credits (ref_type='image_refund', ref_id = id da geracao). O 15o
   ja estava estornado desde 16/09 e foi PULADO pelo controle de ref_type.
   Conta fechada, casada por ref_id: debitado -25.525 / estornado +25.525 /
   liquido ZERO.
3. Alunos: 14 cartas individuais em 20/09, uids 2970-2983 na pasta de enviados,
   chave 'estorno-270-foto-extra'. 13 dos 14 nunca tinham sido avisados.

ALCADA: 9-B, maior caso 8.425 (teto 20.000) e teto diario conferido no banco
(59.400 ja gastos + 25.000 = 84.400 de 100.000). Sem necessidade de aval.

RESIDUO, que NAO morre com este fechamento: as queixas que o Paulo trouxe em
16/09 sobre o realismo do Video Clone foram medidas (video assistido pelo
\`olho\`: lip-sync ok, corpo/olhar e que quebram, nota 5/10) e viraram o cartao
#494, que e a CLASSE inteira. Os outros dois itens dele foram medidos e
respondidos na carta: as "falhas repetidas" nao existem no banco (12 video
clones, todos ready) e a assinatura esta ativa ate 06/10.`;

async function main() {
  const { data: antes, error: e0 } = await db.from("incidents")
    .select("id,numero,status,agent_notes,resolution_note").eq("numero", NUMERO);
  if (e0) throw new Error("leitura falhou: " + e0.message);
  if (!antes || antes.length !== 1) throw new Error(`esperava 1 incidente #${NUMERO}, achei ${antes?.length}`);
  const inc = antes[0];
  console.log(`#${inc.numero} ${inc.id} status atual: ${inc.status} · ${inc.agent_notes.length} notas`);

  const notas = [...inc.agent_notes, { at: new Date().toISOString(), by: "frank", note: NOTA }];
  const patch = fechamento({
    status: "fixed",
    resolution_note: `${inc.resolution_note ?? ""}\n\n--- ${new Date().toISOString()} (frank) ---\n${RESOLUTION}`.trim(),
    resolved_commit: "3e8af23",
    agent_notes: notas,
  }, "frank/rotina-falhas");

  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria status=fixed, +1 nota, resolution_note +", RESOLUTION.length, "chars");
    return;
  }
  const { data, error } = await db.from("incidents").update(patch).eq("id", inc.id)
    .select("id,numero,status,resolved_at,resolved_by");
  if (error) throw new Error("update falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error(`update afetou ${data?.length ?? 0} linhas — NAO diga que fechou`);
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
