# Ronda das falhas — 20/09, ~10h–11hZ (Frank)

Item serial: **#270 / `9d9baab6`** (o botão "Gerar prompt automático" apagava a
atribuição por foto, 14,8d). **Fechado `fixed`** — com as três pernas da regra 8
cumpridas pela primeira vez: conserto em produção, **25.000 cr devolvidos a 14
alunos** e **14 cartas** enviadas.

O saldo honesto: **a fila não andou** (90 → 90). Fechei o #270 e abri o #494, e
o #494 é maior que o que fechei. O que a ronda entregou não é fila menor, é
dinheiro de aluno pagante que saiu do nosso bolso e voltou pro dele, mais uma
causa medida que estava sendo respondida errada há 19 dias.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — tudo foi pro **grupo**
(`notify-grupo.sh`). Nada no privado do Johnny.

## Placar

- Fila: **90 → 90 abertos** · 38 com 7d+ · 1 patch do Vigia · 118 recados.
- Fechados `fixed`: **1** (#270), com resolution_note e prova.
- Abertos por mim: **1** (#494, a classe do realismo).
- Fix na main: **1** (PR #365, merge `9a8ca328`).
- Alunos respondidos: **14** (uids 2970–2983 na pasta de enviados).
- **Crédito devolvido: 25.000 cr a 14 alunos.**
- Percepção travada: **4 cartões**, mais velho parado há 1,9d — nenhum é parada
  real (ver §6, que é onde essa medição falha).
- Passo fixo dos envios: **0 cartas fora da tabela** depois do corte.

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): 801
cartas lidas da pasta `Sent`, 724 já tinham linha, 77 fora da janela do corte,
**0 escrituráveis, 0 recusadas**. A contagem fecha (801 = 801). O instrumento
independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito **"0 carta
depois do corte"**. Buraco segue **passivo**.
(Ronda das 02h30: 784 lidas / 707 com linha. +17 cartas, todas escrituradas.)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

---

## 1. Por que este cartão, e não o de cima da lista

Os seis mais velhos da fila com aluno afetado estão parados em decisão que não é
minha, e eu conferi **um por um** em vez de herdar o veredito:

| cartão | idade | por que não move |
|---|---|---|
| #15 `d3d8d1b2` | 51,9d | itens (b) e (c) são decisão de produto, no grupo desde 17/09 |
| #226 `702cc916` | 18,7d | mesma decisão do #15 |
| #234 `f8587cef` | 17,8d | mesma decisão do #15 |
| #249 / #250 | 15,7d | propostas aguardando o "pode" |
| #254 `f1ada07e` | 15,6d | Carlos + Johnny; carta saiu 20/09 01h, **saiu do meu colo** (regra 8) |
| #263 `5c68eb33` | 14,9d | falta **só** a definição do Johnny sobre os R$ 97; li as 4 notas pra confirmar |

O #270 é o sétimo — e é o primeiro da fila em que **o que faltava era meu**.

---

## 2. A correção que eu faço em mim mesmo, e é a lição da ronda

A nota de 16/09 deste cartão escreveu, com todas as letras:

> *"O QUE FICA, E NÃO É MINHA ALÇADA: os outros 14 alunos, 25.000 cr. Estorno em
> escala e e-mail em massa dependem do 'pode' do Johnny."*

**Está errado, e o erro custou 4 dias de dinheiro de aluno pagante retido.** A
9-B não fala em "escala" em lugar nenhum: ela fala em **valor por caso** (teto
20.000) com **teto diário** (100.000) — e o teto diário *é* o guarda-corpo do
volume. Medido neste cartão: maior caso **8.425**, nenhum perto do teto.

E não era interpretação nova: **a ronda das 03h de hoje** já tinha aplicado essa
leitura, devolvendo 59.400 cr a 6 alunos sem pedir aval. Eu li "14 alunos" como
"massa" e fui mais conservador que a ordem escrita. Nesse caso o preço da
prudência foi pago pelo aluno, não por mim.

**Teto diário conferido NO BANCO antes de creditar** (regra 9-B: "conte o dia
inteiro, não a sua rodada"): o dia 20/09 tinha 59.400 cr devolvidos (os 6 do
#485). 59.400 + 25.000 = **84.400 de 100.000**. Passou com 15.600 de folga.

---

## 3. O que foi devolvido, e a prova de que a conta fecha

Ferramenta do próprio cartão (`2026-09-16_estornar_foto_extra.cjs`), ensaio
primeiro nos 15, depois valendo — pelo caminho de produção (RPC
`add_extra_credits`, `ref_type='image_refund'`, `ref_id` = id da geração).

| aluno | cr | gerações |
|---|---|---|
| thiagobarros.orl@gmail.com | 8.425 | 1 |
| joaomarcos@grupofielpr.com.br | 1.845 | 1 |
| kuka.psicologa@gmail.com | 1.845 | 1 |
| draellenca@hotmail.com | 1.845 | 1 |
| valterpjunior@gmail.com | 1.845 | 1 |
| pcezardireito@icloud.com | 1.575 | 3 |
| lilian.meneguetti@travelsolution.tur.br | 1.575 | 3 |
| caio_colorado@hotmail.com | 2.100 | 4 |
| viniciushbsilva@gmail.com | 1.320 | 1 |
| dayane_calixto@yahoo.com.br | 525 | 1 |
| susiklunk@gmail.com | 525 | 1 |
| adm@hub2decor.com.br | 525 | 1 |
| costa.anaelson@gmail.com | 525 | 1 |
| rafaluanravi29@gmail.com | 525 | 1 |
| **total** | **25.000** | **21** |

**O controle positivo funcionou:** o 15º aluno (`smilefastrio@gmail.com`, já
estornado em 16/09) foi **PULADO** pela conferência `ref_type` + `ref_id`. Não
pagamos em dobro — que é o falso negativo de que este repositório tem histórico.

**Prova independente da ferramenta**, por SQL direto (Management API, sem o
corte de 1.000 do PostgREST), casando `ref_id` e somando o sinal:

```
22 gerações · 15 alunos · debitado -25.525 · estornado +25.525 · LÍQUIDO 0
```

**Ninguém** está mais pagando por uma geração cuja instrução a casa apagou. E o
delta de saldo foi conferido no banco **aluno por aluno**: os 14 bateram com o
esperado.

Dois dos 14 estavam no chão por causa disso: a `susiklunk@` tinha **saldo 0** e o
`viniciushbsilva@` tinha exatamente 1.320 — o valor que a gente devia a ele.

---

## 4. O conserto ainda segura (remedido, não herdado)

SQL direto com a mesma heurística da ferramenta:

```
afetadas ANTES do fix (15/09 18:11Z): 22
afetadas DEPOIS do fix:                0
mais recente afetada:                  13/09 14:30Z
```

**Cinco dias de produção sem uma ocorrência nova.** O PR #297 (`3e8af23`)
sustenta.

---

## 5. As 14 cartas — e por que não houve acidente do Carlos

Antes de escrever, conferi em `emails_enviados` **quem já tinha recebido carta
da casa**. Resultado: **1 dos 14** (o Paulo, em 15/09). Os outros **13 nunca
receberam uma palavra** sobre um defeito que os cobrou. Nenhuma carta
concorrente, nenhum risco das duas frentes se anulando — que é exatamente o
acidente registrado no #254 em 20/09 02h30.

Cada carta é **individual e sobre o caso daquele aluno** (regra 8): valor, datas
e número de gerações dele. Chave `estorno-270-foto-extra`, cópias
**confirmadas** na pasta de enviados, uids **2970–2983**, todas registradas em
`emails_enviados`.

O que a carta diz: o defeito, que a culpa é nossa e o pedido dele estava certo,
o conserto no ar, o valor exato que voltou e que **já está na conta**, e que dá
pra refazer o pedido do mesmo jeito. E assume a demora: *"você só está sabendo
agora, e essa demora foi falha nossa"*.

**A carta do Paulo é diferente de propósito**, porque ele não é primeira
notícia: ela retoma a de 15/09, explica que naquele dia consertei e avisei mas
**não devolvi o crédito**, e responde os três itens que ele trouxe em 16/09
(§6). Não é carta concorrente, é desfecho.

---

## 6. O residual do Paulo, medido em vez de empurrado — e o achado da ronda

Fechar o #270 sem tratar o que o Paulo trouxe em 16/09 faria três queixas
sumirem junto com o cartão. Medi as três:

**(a) "gestos e fala desconexos" → REAL, e agora medido.** Ordem de 17/09:
percepção não é estado de parada, é despacho. Baixei o vídeo dele do R2 (bucket
`voices-clone-ai-verse`, **não** o de generations) e mandei o `olho` **assistir**.
Veredito: **boca em dia**, sem atraso perceptível; o que quebra são os **braços**
(sobem e voltam com aceleração antinatural em 1,6–3,2s, 12,5–13,5s e
18,5–19,5s) e o **olhar fixo**. Nota **5/10**. Confirma a queixa dele.

**(b) "erro técnico recorrente, gerações que falham" → NÃO REPRODUZ.** Os **12**
`video_clones` dele estão **todos `ready`**, com `video_path` e `error_message`
vazio, inclusive os 4 de 16/09. Na carta eu pedi o print em vez de fechar como
"não existe" — pode ser erro de tela que o banco não registra.

**(c) "quer reativar assinatura que aparece inativa" → JÁ RESOLVIDO sozinho.**
Compra de 06/09 `ACTIVE`, acesso até **06/10**. Dito a ele.

### O achado: a queixa de "realismo" do Vídeo Clone não é lip-sync

Em vez de tratar o (a) como caso isolado, procurei a classe. Ela existe: **13
cartões desde 24/08, 9 abertos, o mais velho de 01/09**. Despachei **mais dois
vídeos** pro `olho`, de dois alunos diferentes, **cegos entre si** (nenhum
parecer citou a hipótese nem os outros):

| aluno | cartão | lip-sync | corpo | nota |
|---|---|---|---|---|
| Paulo `pcezardireito@` | #270 | acompanha, sem atraso | **espasmódico** (1,6–3,2s / 12,5–13,5s / 18,5–19,5s) | 5/10 |
| Alexandre `alexandre@novaconexao` | #478 | acompanha a cadência | **congelado** — "foto estática animada" | 5/10 |
| Igor `igorlramalho@` | #245 | acompanha o ritmo | **nenhum** movimento de braços | 5/10 |

**3 de 3 dão 5/10. 3 de 3 absolvem a boca. 3 de 3 acusam o corpo e o olhar
fixo.** Os três são o mesmo motor (480p-v2/v3). Isso deixa de ser gosto de aluno
e passa a ser leitura repetível do produto.

**Por que isso importa mais que os 9 cartões:** a casa vem respondendo essa
classe com **orientação de foto** (enquadramento, rosto frontal, foto melhor).
Foto melhor **não cria gesto que o motor não gera**, nem piscada que ele não
anima. O aluno que segue a dica volta **pior**: gasta crédito refazendo e recebe
o mesmo resultado. O #245 diz isso com todas as letras — *"diz que seguiu as
orientações"* — e está esperando **16,5 dias**.

Custo já medido na classe: **#411 cancelou** a assinatura por isso, **#412 pediu
reembolso**, **#329 gastou ~20.000 cr** insatisfeito, e o **#270 refez o mesmo
vídeo 4x** (~10.000 cr).

Virou o **cartão #494**, com os três pareceres, a lista dos 9 e a receita pra
despachar os 6 que faltam (~1 min de `olho` por vídeo).

### E o instrumento de percepção tem ponto cego — isto é o mais sério

`percepcao_travada.cjs` acusou **4 cartões** nesta ronda e **nenhum** deles é o
#245, que está há **16,5 dias** esperando exatamente "alguém assistir um vídeo".
Duas causas, as duas estruturais:

1. **ele casa FRASE, não necessidade.** Procura `%humano olhar%`, `%assistir%`,
   `%ouvir%` na nota. O #245 nunca escreveu isso — a nota dele fala de
   "insatisfação com realismo", que é a mesma necessidade com outro nome.
2. **ele só olha `open`/`investigating`.** **6 dos 9** cartões da classe estão
   em `aguardando_aluno`, que é um rótulo de "a bola está com o aluno". Nesses
   casos a bola **não** está com o aluno: está com quem precisa assistir.

Ou seja: a classe exatamente descrita pela ordem de 17/09 está **invisível pro
instrumento que a ordem criou**, e do jeito mais previsível — atrás de um rótulo
que parece saúde. É o mesmo formato do que a ordem denuncia
(*"silêncio nessa classe não pode parecer saúde"*). **Não consertei o
instrumento nesta ronda** e registro isso como dívida, no #494, com a causa
localizada — não como "precisa olhar".

---

## 7. O defeito que eu achei em mim: a lista de estornos (PR #365, na main)

Conferindo o teto diário, o `ref_type` **`video_clip_refund_backfill`** apareceu
somando 59.400 cr e **não existia** em `_estornos.cjs`. O tipo nasceu na **minha
própria ronda das 03h de hoje**.

Consequência real: por ~8h, `ehEstorno()` dava **false** para 6 linhas / 6
alunos / 59.400 cr. Quem perguntasse *"o Felipe já foi ressarcido?"* leria
**NÃO** — o falso negativo que paga em dobro, que é o acidente que aquele
arquivo nasceu pra impedir. **Quarta reincidência** da classe (#185, #342, 19/09
`edicao_broll_refund`, agora esta).

**O guarda funcionou, e é a boa notícia:** `conferirListaCompleta` varreu 3.489
linhas e acusou exatamente `["video_clip_refund_backfill"]` — em **horas**, não
nos 6 a 11 dias das reincidências anteriores. Depois do cadastro: `ok:true,
novos:[]`. Testes 10/10.

### E a armadilha nova que a prova revelou — eu quase dei alarme falso

Provando pelo critério do arquivo (casar `ref_id`, somar o sinal), somando **só**
`video_clips`, três alunos **pareciam** ter recebido estorno **a maior**. Fui
medir antes de gritar. Falta a perna `video_clip_regen`:

| aluno | `video_clips` | `video_clip_regen` | estorno | líquido |
|---|---|---|---|---|
| felipe@maximus… | -18.480 | -1.320 | +19.800 | **0** |
| josimocerqueira@… | -9.240 | -1.320 | +10.560 | **0** |
| glaucia_pinto@… | -2.640 | -2.640 | +5.280 | **0** |

A ronda das 03h estava **certa**; minha primeira consulta era cega. Medir clipe
de cena por **uma perna só** faz a conta certa parecer errada — e uma ronda
apressada "corrigiria" isso **tirando crédito de aluno pagante**, que é
literalmente o que a 9-A proíbe. Ficou escrito no comentário do arquivo, com os
números, pra ninguém repetir.

---

## 8. Frota: os 8 workers de assinatura seguem sem auth

O `olho` (OpenRouter) respondeu as 3 vezes, em 55–65s cada, e foi ele que
produziu o achado do §6. Os workers de assinatura Claude continuam como a ronda
das 03h registrou (`Not logged in`), então **esta ronda também não teve revisão
do `gerente` nem teste de `qa`**. O que existe de segunda opinião aqui são as
medições independentes (SQL direto contra a ferramenta, o guarda dos estornos, e
os 3 pareceres cegos entre si). Menos do que o normal. Fica dito.

---

## 9. O que eu NÃO fiz

Não estornei os ~10.000 cr que o Paulo gastou refazendo o vídeo 4x — os 4 foram
**entregues**, então não é falha técnica pela 9-B, e insatisfação de **qualidade**
é decisão do Johnny. Escrevi isso pra ele com essas palavras, **sem prometer
devolução nem data**. Não mexi em tier, preço, motor de vídeo, acesso,
entitlement, assinatura ou plano de ninguém. Não **tirei** crédito de ninguém
(9-A). Não gastei GPU. Não apliquei migration. Não toquei nos cartões travados
em decisão alheia. Não li e-mail não lido. **Nada da planilha** (ordem 29/08).
Não consertei o `percepcao_travada.cjs` (§6) — registrado como dívida, não como
feito.

---

## 10. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido **vazio**
depois do commit deste log. O PR #365 foi **mergeado na main** (`9a8ca328`) — não
ficou fix preso em branch, que foi o acidente de 19/08. O branch foi apagado no
merge.

Esta ronda escreveu: **1 fix na main** (PR #365), **14 cartas**, **2 cartões**
(1 fechado com resolution_note, 1 aberto), **25.000 cr devolvidos**, 3 rascunhos
de execução e este log.
