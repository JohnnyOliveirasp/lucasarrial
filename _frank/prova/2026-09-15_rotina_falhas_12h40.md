# Rotina das falhas — 15/09/2026, 12h40Z (09h40 BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (regra final de
crédito), a de **27/08** (só erro de sistema vira chamado) e a de **29/08**
(planilha desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, o aviso desta ronda saiu **no
grupo**, e só no grupo.

Abertura **12:40Z**, fechamento **13:0xZ**. A ronda anterior foi a das **12hZ**,
quarenta minutos antes — esta é continuação dela, não recomeço.

Peguei o backlog serial onde as 12hZ pararam. O `#15` segue travado na linha de
env (decisão do Johnny, 22 dias) e o `#99` segue travado na decisão comercial
com prazo de sábado — nenhum dos dois andou e eu não fiquei girando neles.
Fui para **o próximo: o `#101`**, que era o único dos três velhos cuja trava
estava **dentro do meu alcance** — faltava responder uma pergunta, não esperar
uma pessoa.

A pergunta foi respondida. O que ela abriu é maior que ela.

---

## 1. `#101` — A PERGUNTA QUE FALTAVA ESTÁ RESPONDIDA, E A RESPOSTA É NÃO

**Anotado no `#101` (`b2651a6f`). NÃO fechei.**

A ronda das 12hZ deixou escrito o que faltava: *"NÃO conferi se os 17 bounces
ORIGINAIS de agosto chegaram a ser tratados um a um. Essa é a pergunta que falta
para decidir o fechamento."*

### 1.1 A medição

`varrer_bounces.mjs --desde 1-Aug-2026` (EXAMINE + BODY.PEEK, **nada foi marcado
como lido, não atropelei a fila da Fast**): 60 mensagens candidatas, 50 falhas de
entrega, **19 alunos que não receberam**.

Dos que quicaram **antes** da abertura do cartão (23/08 20:54), quatro endereços:

| endereço | bounces | último | classe |
|---|---|---|---|
| epotentia@gmail.com | 8 | 22/08 | inexistente |
| pc.sul157@gmail.com | 2 | 23/08 | caixa-cheia |
| betobass27@hotmail.com | 1 | 07/08 | bloqueio-destino |
| leusousavedder@gmail.com | 1 | 14/08 | inexistente |

Busquei incidente para cada um desses endereços, em `title` **e** em
`description`: **zero chamados próprios**. Contra isso, bounce de setembro vira
chamado individual — **13 cartões** "E-mail não chegou no aluno".

**A resposta é não: o backlog velho nunca foi tocado.** O conserto pegou o bounce
NOVO, exatamente como o cabeçalho do próprio `varrer_bounces.mjs` já avisava
(*"os que já chegaram estão marcados como lidos e não voltam pela varredura"*).

### 1.2 Honestidade sobre o número

O título diz 17 e eu consigo amarrar **12** bounces a esses 4 endereços (8+2+1+1).
Os outros 5 **não consigo reconstruir da caixa de hoje** e não vou fingir que
consigo. O que decide o cartão não é o 17 exato: é que a taxa de tratamento do
backlog velho é **zero**.

---

## 2. 🔴 O QUE A PERGUNTA ABRIU: 29 PESSOAS COM O PRODUTO PRONTO QUE NUNCA ENTRARAM

Dois dos quatro endereços acima — `epotentia` (MAURILIO OLIVEIRA BRANDAO) e
`leusousavedder` (Leu Sousa) — têm **voz `ready`, geração `ready` e
`onboarding_ready_email_at` preenchido**: a casa fez o produto e avisou que
estava pronto. E `last_sign_in_at` **NULL** nos dois. Nunca entraram uma vez.
24 e 32 dias. O único endereço que a casa tem deles quicou como **inexistente** —
reenviar nunca vai funcionar.

Puxei o fio. **38 contas** no banco inteiro têm voz `ready` e nunca logaram.
Tirando a conta da casa (`vozes@fastcloner.com`) e as 8 recentes do SGP, sobram
**29**, todas de **14/08 a 27/08**.

### 2.1 O controle — e é ele que transforma isso em evento

Contas criadas por dia, 13/08 a 28/08, quantas **nunca logaram**:

| dia | nunca / criados | | dia | nunca / criados |
|---|---|---|---|---|
| 13/08 | 3 / 47 | | 21/08 | 2 / 33 |
| **14/08** | **22 / 55 (40%)** | | **22/08** | **28 / 58 (48%)** |
| 15/08 | 2 / 29 | | 23/08 | 0 / 36 |
| 16/08 | 1 / 27 | | 24/08 | 3 / 35 |
| 17/08 | 1 / 41 | | 25/08 | 1 / 48 |
| 18/08 | 2 / 39 | | 26/08 | 3 / 34 |
| 19/08 | 2 / 48 | | 27/08 | 2 / 37 |
| 20/08 | 2 / 44 | | 28/08 | 2 / 26 |

**Todos os dias entre 0 e 3, menos dois.** Baseline dos outros 14 dias:
26 em 574 = **4,5%**. Nesses dois dias, **50 contas criadas e ninguém entrou**.

Isso não é desinteresse de aluno distribuído no tempo. É um evento, em dois dias.

### 2.2 O estado dos 29

Todos com **zero crédito** (`credits_subscription + credits_extra = 0`) e
`access_until` **NULL**. **27** com o e-mail "plataforma pronta" carimbado.

**Duplicata conferida antes de acusar** (armadilha #214/#218 — a pessoa compra num
endereço e entra com outro): procurei por **NOME** outra conta que funcione. Dos
15 que olhei, **só a Adriana Diniz tem** (`adrianacdiniz@yahoo.com.br`, entrou
28/07, acesso até 23/09) — a conta dela de 14/08 é duplicata e ela está bem. Os
outros 14 **não têm para onde ter entrado**.

### 2.3 O dinheiro

`pagou_de_verdade.cjs` (Hotmart viva, só `COMPLETE`) em 28 deles. **9 têm compra
COMPLETE nesse mesmo endereço**, somando **R$ 6.411,10 + 56,40 GBP**:

| aluno | valor | lote |
|---|---|---|
| claudiasantos23504@gmail.com | R$ 313,32 | 14/08 |
| appolonio71@outlook.com | 56,40 GBP + R$ 594,00 | 14/08 |
| nikolasfk@gmail.com | R$ 794,00 | 14/08 |
| luizguilhermecaranjo@gmail.com | R$ 368,64 | 14/08 |
| soltechelp@gmail.com | R$ 985,44 | 14/08 |
| facilita@hotmail.com | R$ 973,70 | 14/08 |
| ericrodriguesr@yahoo.com.br | R$ 794,00 | 22/08 |
| dr.duva@hotmail.com | R$ 794,00 | 22/08 |
| logmatias@gmail.com | R$ 794,00 | 22/08 |

Todas **avulsas** (Fábrica de Conteúdo Invisível / Sistema de Geração Pronto),
compradas entre **abril e junho** — meses ANTES da conta ser criada em agosto.

**Não é assinatura do FastCloner, e o que a avulsa dá direito aqui é decisão
COMERCIAL, não minha (#173).** Eu **não** estou dizendo que a casa deve acesso a
eles. O que eu afirmo é o descasamento, e ele é nosso de qualquer jeito: **a casa
cobrou, construiu a voz, gerou o conteúdo, avisou "sua plataforma está pronta", e
a pessoa nunca entrou** — e faz 24 a 32 dias que está assim sem ninguém notar.

Sobre os outros 19: *"SEM PAGAMENTO NESTE ENDEREÇO"* **não é** "nunca pagou". Não
conferi um a um por nome/CPF e **não vou tratar esses 19 como não-pagantes**.

---

## 3. A CAUSA — E A HIPÓTESE QUE EU MESMO DERRUBEI

**Causa não estabelecida.** E o registro do que eu tentei vale mais que um palpite.

Achei que tinha o mecanismo: o e-mail não levaria caminho de entrada, porque
`recovery_sent_at` e `invited_at` estão **NULL nos 9**. Era limpo, explicava tudo,
e eu estava a um parágrafo de publicar.

Fui buscar o controle antes: **dos 63 que ENTRARAM nesses mesmos dois dias, só 2
têm `recovery_sent_at`.** O campo é NULL para quase todo mundo, **inclusive para
quem entrou**. Ele não separa nada.

> **Um campo NULL nos afetados só vira causa se ele estiver preenchido nos
> não-afetados.** Sem o grupo de controle, "NULL em 9 de 9" é 100% de correlação
> com zero de informação.

Fica registrado no cartão como **hipótese TESTADA E DESCARTADA**, para a próxima
ronda não gastar o mesmo tempo nela.

É a quarta ronda seguida com a mesma lição de instrumento, e desta vez o formato
é novo: não foi o dado que estava fora de contexto, foi **a ausência de dado que
parecia explicação**.

---

## 4. Onde isso emperrou, e por que não é meu

Anotei nos dois cartões e levei ao grupo **como urgente** (regra de aluno pagante
travado + canal de 31/08). O que trava daqui pra frente:

1. **Escrever para os 29** é envio em **massa** — precisa do "pode" do Johnny
   (regra 8 libera o e-mail individual, não a leva). E oferecer *o quê* é decisão
   comercial, não minha.
2. **14/08 e 22/08 são anteriores ao SGP** — `sgp_pedidos` começa em **29/08
   15:39** (conferi `min(criado_em)` **antes** de ler o vazio como ausência, que é
   a armadilha que a ronda das 12hZ mediu). Esses dois lotes vieram do processo
   velho. Se rastrear exigir abrir a planilha, isso está **fora do meu alcance
   pela ordem de 29/08** e é decisão do Johnny.

Do lado de cá ainda sobra trabalho que é meu: **por que o lote cria conta sem
crédito e sem `access_until`** — que é literalmente o título do `#03e7b34b`, aberto
em 06/09, com a nota **vazia** até hoje, e que agora tem a medição dos dois lotes
velhos dentro dele.

---

## 5. Estado da fila no fechamento

- **81 abertos** (era 78 nas 12hZ; a diferença é movimento normal da fila, não
  fechamento meu). Por idade: 1 com 30d+, 2 entre 15-30d, 27 entre 7-15d,
  34 entre 3-7d, 17 com menos de 3d.
- **0 patches do Vigia** esperando.
- **86 recados `para_frank_*`**, o mais velho com **11,6 dias**. Eram 82 nas 12hZ.
  Não os tratei e não vou fingir que tratei — a dívida **cresceu** nesta ronda e
  já passou de ronda própria: precisa de decisão sobre o que fazer com a leva.
- **Fechei nesta ronda: 0.** Onde cada um emperrou, como manda a regra 8: o `#101`
  **não fecha** porque a pergunta do título ("sabemos se nosso e-mail chega?")
  segue com resposta NÃO para tudo que saiu antes de 24/08 — a cópia em Enviados
  só começa aí e o `emails_enviados` só em 14/09, então não existe como provar a
  entrega dos 27 e-mails de "plataforma pronta"; o `#03e7b34b` **não fecha**
  porque a causa do lote segue viva; o `#15` e o `#99` seguem travados em decisão
  humana, sem novidade.
- **2 alunos com acesso vivo, crédito e nenhuma voz pronta** (`ericb.malzone`
  2 dias, `euneivaprestes` 1 dia) — herdados das 12hZ, **ainda não investigados**.
  Não entraram no serial desta ronda. Seguem anotados.

---

## 6. O que esta ronda diz

As 12hZ fecharam zero e escreveram que o cartão parou "onde o meu alcance acaba".
Esta também fechou zero, mas por um motivo diferente, e a diferença importa: eu
**respondi** a pergunta que travava o `#101`. O cartão não anda porque a resposta
foi **não**, e o "não" abriu 29 pessoas que ninguém estava olhando.

O padrão de quatro rondas seguidas continua sendo instrumento, mas mudou de
forma. Nas outras três foi um número lido fora do contexto dele — `access_until`
que era fatura, commit que era feature desligada, tabela recém-nascida cujo zero
parecia inocência. Hoje foi o oposto: **um campo vazio que parecia explicação.**
`recovery_sent_at` NULL em 9 de 9 é uma correlação perfeita, e não vale nada sem
o grupo de controle — que estava a uma consulta de distância e desmontou a
hipótese inteira.

E vale dizer o que essa medição custou de verdade: 9 pessoas pagaram entre
R$ 313 e R$ 985, a casa treinou a voz delas, gerou o primeiro conteúdo, mandou
dizer que estava pronto, e **nenhuma delas conseguiu entrar uma única vez.** Isso
esteve visível no banco o tempo todo, a uma consulta de `last_sign_in_at is null`,
por 32 dias. Não foi um bug escondido. Foi um número que ninguém pediu.

---

**O que eu NÃO fiz:** não fechei incidente, não reabri incidente, não mudei status
de cartão nenhum, não dei crédito, não dei acesso, não escrevi para nenhum dos 29
(envio em massa precisa do "pode"), não gerei link de recovery (apagaria a única
prova de entrega que existiria — armadilha `b32af5ff`), não cancelei assinatura,
não estornei nada, não prometi devolução, não li a caixa de entrada para triagem
(só a varredura de bounces, em modo somente-leitura, sem marcar nada), não tratei
os 86 recados, não investiguei as 2 vozes paradas, não mexi em branch, não abri
PR, não mergeei, não subi migration, não rodei nada que gastasse GPU ou crédito de
aluno, e **não li nem reprocessei nada da planilha** (ordem de 29/08).
