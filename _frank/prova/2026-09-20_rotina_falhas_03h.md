# Ronda das falhas — 20/09, ~02h–03hZ (Frank)

Item serial: **#485 / `afee75b2`** (clipe de cena cobrado e nunca estornado,
50,6d). **Fechado `fixed`**, com o conserto no ar, 6 dos 8 alunos pagos e
avisados, e o resto escalado num cartão próprio.

Foi o mais velho da fila com aluno afetado que era **meu** de ponta a ponta: os
quatro acima dele (#15, #226, #234, #249/#250) seguem travados em decisão de
produto, como a ronda das 02h30 já registrou.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado. Canal: o aviso foi pro **grupo** (`notify-grupo.sh`), ordem de
31/08. Nada no privado.

## Placar

- Fila: **85 → 85 abertos.** Fechei o #485 e abri o #488, então o número não
  andou. Escrevi "85 → 84" na primeira versão deste log e está errado —
  conferido no banco depois de fechar: 85. O saldo honesto da ronda não é a
  fila ter diminuído (não diminuiu), é um defeito ter saído de produção e
  59.400 cr terem voltado pro bolso de quem pagou.
- Fechados como `fixed`: **1** (#485), com commit e prova de deploy.
- Fix em produção: **1** (`dc3a6be3`).
- Alunos respondidos: **6** (uids 2959–2964 na pasta de enviados).
- Crédito devolvido: **59.400 cr** a 6 alunos.
- Crédito escalado, **não** devolvido: **62.040 cr** a 2 alunos (#488).

---

## 1. O conserto

`failSceneVideo` marcava a cena como `failed`, abria chamado e **não devolvia
nada**. A irmã (`images/video-sync.ts`) estorna desde 11/07.

**Por que não dava pra copiar a irmã** — e é a parte que decidiu o desenho.
`handleTechFailure` → `refundOriginalDebit` devolve o valor **inteiro** do
débito casado por `(user_id, ref_type, ref_id)`. Serve pra imagem, onde 1
débito = 1 imagem. Não serve aqui: o débito do lote tem `ref_id` = o **projeto**
e valor `started × costPer`, ou seja N cenas numa linha só. Por ali, a
**primeira** cena que falhasse devolveria o lote inteiro, inclusive as que
deram certo — estorno a maior. Era isso que mantinha a perna sem estorno.

O valor certo já estava na linha: `video_scenes.video_credits_cost`, gravado
como `billed ? costPer : 0`. Exato nas duas pernas (lote e `video_clip_regen`
cobram o mesmo `costPer`) e já **0 na conta da casa**.

**Duas garantias opostas, de propósito.** Estorno = exatamente-uma-vez, preso
ao claim atômico `.in(["pending","generating"])`. Chamado = pelo-menos-uma-vez,
**sem** claim, como já estava — o comentário que já existia no arquivo explica
que da 2ª tentativa em diante a cena já está `failed`, e pendurar o chamado no
claim tornaria o #484 mudo de novo. Quem perde o claim não estorna mas ainda
abre chamado. **Eu ia trampar essa decisão** (meu brief mandava pôr o claim nos
dois) e o comentário do arquivo me parou — ele estava certo e eu estava errado.

**Além do pedido: o parâmetro `cobrado`.** `video_credits_cost` só é escrito
quando o Kie **aceita**. Numa falha de *criação* nada foi cobrado, mas a linha
pode carregar o custo velho e, com a tentativa anterior ainda **em voo**
(`pending`), o claim casaria e a casa devolveria um débito que ainda vai ser
entregue — vídeo de graça. `syncSceneVideo` passa `true`; `startSceneVideo`
passa `false`.

**Prova:** 7 testes em `video-sync.test.ts`, incluindo a corrida poll × webhook,
conferidos **por mutação** — tirando o `.in(...)`, 2 quebram ("PAGOU EM DOBRO").
`tsc --noEmit` e `eslint` limpos. Deploy conferido pelas 3 provas da regra 5-B:
md5 do fonte no servidor `0b5b7729` == o meu, `BUILD_ID` 02:03:45Z, pm2 02:04:35Z.

## 2. A conta real era o dobro da do cartão — e o cartão avisou

O Vigia somou o **rótulo** e deu 56.760, declarando no próprio texto que o
número aponta pra menos e que quem fosse estornar tinha que ir no extrato. Ele
estava certo. Pelo extrato: **121.440 cr, 8 alunos** (não 7).

Duas causas:
1. **o lote reusa a linha da cena.** Quem pagou 3× pelas mesmas 10 cenas aparece
   uma vez só no rótulo — `atendimento@bibibrindes.com`: rótulo 13.200,
   extrato **39.600** (três lotes em 03–04/08, todos falhados, nada entregue).
2. **um aluno a mais.** `josimocerqueira@hotmail.com` não estava no cartão
   porque a falha dele nasceu **depois** da medição do Vigia: 4 cobranças entre
   00:38Z e 01:07Z **de hoje**. O defeito estava queimando dinheiro enquanto eu
   trabalhava nele.

Subtrair o entregue é o que evita o estorno a maior: a Priscilla pagou 33.000,
recebeu 19 cenas (25.080) e devia 7.920, não 33.000.

## 3. O que foi devolvido, e o que não foi

**Devolvido — 59.400 cr, 6 alunos** (regra 9-B, até 20.000/caso; teto diário
conferido **no banco** antes de creditar, estava em 0):

| aluno | cr | |
|---|---|---|
| felipe@maximusconsultoria.com.br | 19.800 | 14 cenas |
| leoap77@gmail.com | 11.880 | 9 cenas |
| josimocerqueira@hotmail.com | 10.560 | cobrado 4× hoje |
| priscillarosseti@hotmail.com | 7.920 | pagou 33.000, recebeu 25.080 |
| glaucia_pinto@yahoo.com.br | 5.280 | |
| rogeriod.l.r1989@gmail.com | 3.960 | |

Os 6 foram avisados (chave `estorno-485`): o que aconteceu, que a culpa é nossa,
quanto voltou, que já está na conta — e a ressalva honesta de que **o que eu
consertei foi a devolução, não a falha do provedor**. Prometer o contrário seria
regra 13.

A carta do Josimo é **desfecho** da que outra ronda mandou pra ele às 01:26Z
("pare de clicar em Regerar"), não uma carta concorrente. Foi de propósito: o
acidente do Carlos, na ronda das 02h30, foi exatamente duas frentes da casa
escrevendo coisas que se anulam.

**NÃO devolvido — 62.040 cr, 2 alunos**, acima do teto de 20.000/caso:
`atendimento@bibibrindes.com` (39.600) e `hercules.contador@gmail.com` (22.440).
Escalados no **#488**. Os dois **não foram avisados** de propósito — sem o
"pode", avisar seria prometer o que não posso executar.

Não fatiei o Hercules em 20.000 + 2.440 pra caber na alçada. Rachar um caso pra
driblar o teto é justamente o que o teto existe pra impedir.

## 4. Por que o #485 fecha mesmo com dinheiro pendente

O defeito que o cartão descreve — "falha e a casa não devolve nada" — é falso em
produção desde `dc3a6be3`. Fechar com o resto pendurado dentro é que seria
mentira, então o resíduo virou cartão **#488**, com valor, método de reprodução
e o comando exato pra executar depois do ok. O dinheiro não fica escondido atrás
de um cartão fechado.

## 5. O instrumento me pegou duas vezes, antes de virar dinheiro

`_frank/ferramentas/2026-09-20_estornar_clipe_de_cena.cjs` (ensaio por padrão)
tem controle positivo que **aborta**. Ele reprovou duas versões minhas:

1. **PostgREST corta em 1.000 linhas, calado.** A tabela tem 3.716 cenas: a 1ª
   versão agregava um terço do banco e o Hercules simplesmente não vinha na
   página. Teria estornado **a menos**, com ar de conta fechada.
2. **custo da imagem entrando como clipe.** A 2ª versão não filtrava `ref_type`
   na perna da cena e inflava a bibibrindes em 2.631 — estorno **a maior**.

Errei nas duas direções e as duas foram pegas antes de escrever. É o argumento
mais forte que eu tenho pra controle positivo em ferramenta de dinheiro: sem
ele, os dois erros passavam parecendo certo.

## 6. Frota sem auth — e o que isso me custou

Deleguei o fix pro `coder` com brief completo. Voltou em 2s:
`Not logged in · Please run /login`. Testei: os **8 workers de assinatura
Claude** (coder, qa, generalist, gerente, analyst, critic, carol, strategist)
estão todos assim; só os de OpenRouter (olho, pesquisa, social) e o glm
respondem. Assumi o fix eu mesmo, com cartão de takeover, e banquei a lição.

Efeito colateral honesto: **esta ronda não teve revisão do `gerente` nem teste
de `qa`** — o que existe de segunda opinião aqui são os 7 testes, a conferência
por mutação e o controle positivo do script. Menos do que o normal. Fica dito.

## 7. O que eu NÃO fiz

Não mexi no caminho de **débito**. Não apliquei migration. Não toquei nos 2
casos escalados. Não mexi em acesso, entitlement, assinatura ou plano de
ninguém. Não gastei GPU. Não consertei a causa raiz da falha do provedor
(429/timeout do Kie) — quem trata disso é o **#484**, que segue aberto.

## 8. Fim de ronda

`git fetch && git log --oneline origin/main..HEAD` conferido. Esta ronda
escreveu: 1 commit de código na `main` (`dc3a6be3`), 6 cartas, 2 cartões
(1 fechado, 1 aberto), 1 ferramenta nova e este log.
