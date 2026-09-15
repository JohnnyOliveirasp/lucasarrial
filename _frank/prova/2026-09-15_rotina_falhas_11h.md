# Rotina das falhas — 15/09/2026, 11hZ (08h BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (regra final de
crédito), a de **27/08** (só erro de sistema vira chamado) e a de **29/08**
(planilha desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, os dois avisos desta ronda
saíram **no grupo**, e só no grupo.

Abertura da ronda às **10:40Z**, fechamento das contas às **11:2xZ**. A ronda
anterior de falhas foi a das **02hZ**; a do Vigia (sensor) foi às **10hZ**.

Duas coisas nesta ronda, e as duas são a mesma lição por ângulos diferentes:
**um número lido fora do contexto dele produz um alarme falso, e um conserto
mergeado não é um conserto ligado.**

---

## 1. 🔴 MASTROIANNI: O PRAZO DAS 12:00Z NÃO EXISTIA. ALARME FALSO, MORTO ANTES DO MEIO-DIA

**Anotado no `#329` (`85ca1863`). Não fechei o cartão** — o assunto de verdade
dele é outro (§1.4). Avisei o grupo às ~11h05Z.

### 1.1 O que estava de pé

Sete rondas seguidas do Vigia (14hZ, 16hZ, 18hZ, 20hZ, 22hZ, 00hZ, 10hZ)
escalaram o caso como **"decisão do Johnny, prazo hoje 12:00Z"**, com a tabela
de saldo parada em 874 e a frase *"ninguém decidiu nada em sete rondas"*. A
ronda das 10hZ abriu com ele como item nº 1 e fechou dizendo que era *"o único
que eu não posso resolver sozinho"*.

### 1.2 O que a fonte diz

Fui ao `payment_events`, evento `PURCHASE_APPROVED`, transação `HP3149684113`,
oferta `ewxrfw9j`:

| campo | valor |
|---|---|
| `price.value` | **0** |
| `full_price.value` | **0** |
| `original_offer_price.value` | **0** |
| oferta | *"Plano para quem está conosco desde o início"* |
| plano | **Plano Founder** |
| `subscription.status` | **ACTIVE** |
| `date_next_charge` | **2026-09-15 12:00Z** |

E o `profiles.access_until` dele é **2026-09-15 12:00:00+00** — o **mesmo
instante**. O `access_until` não é um prazo que alguém escolheu: ele **espelha a
data da próxima cobrança** da assinatura.

### 1.3 A oferta é R$0 no 1º ciclo e R$97/mês depois — contado, não suposto

Contagem por `recurrence_number` na oferta `ewxrfw9j`, todos `PURCHASE_APPROVED`:

| recorrência | valor | pessoas |
|---|---|---|
| rec#1 | **0** | **1.210** |
| rec#2 | **97** | **475** |
| rec#3 | **97** | **200** |
| rec#4 | **97** | **16** |

**519 pessoas já atravessaram essa mesma fronteira, 475 delas pagando 97.** Não
é uma porta batendo na cara de ninguém: é a hora em que o mês grátis acaba e a
primeira cobrança real cai.

Logo, ao meio-dia acontece **uma de duas, e as duas estão certas sozinhas**:

1. a Hotmart aprova a rec#2 de R$97 → chega `PURCHASE_APPROVED` → o acesso
   estende sozinho, e ele vira **pagante** (e pela regra de 20/08 fica com tudo);
2. ele não paga → o acesso lapsa, que é **exatamente** o que a regra de 20/08
   manda para *"nunca pagou (só trial R$0)"*.

**Nenhum dos dois ramos precisa de intervenção humana.**

### 1.4 Por que isto não devia ter sido escalado

A ordem de **20/08** é literal: *"Se aparecer detector, varredura ou incidente
encostando nisso: aplique a regra acima e **feche**. Não escale, não peça
confirmação, não proponha refinamento."* O caso nunca precisou do Johnny. Sete
rondas de atenção — e quase a manhã dele — foram gastas num não-evento.

**O que continua aberto no `#329` é outra coisa:** a insatisfação dele com o
Vídeo Clone (~20k créditos). **Isso não está resolvido** e não foi o que eu
tratei aqui. Segue `investigating`.

### 1.5 A armadilha de instrumento, que é o achado reaproveitável

> **Ler `profiles.access_until` sozinho faz qualquer ronda concluir "o aluno
> perde acesso às 12:00Z" e soar alarme. O campo é DERIVADO do
> `date_next_charge` da assinatura. Quem olha só o `profiles` vê um prazo; quem
> abre o payload vê uma fatura.**

Entra na lista de armadilhas ao lado do `ref_type` por tabela e do
`--is-ancestor` em branch vazia. É a terceira do mesmo formato em duas rondas:
**a consulta responde, responde rápido, e responde errado.**

### 1.6 O que eu conferi antes de afirmar

A armadilha do `#214`/`#218` (compra num e-mail, usa outro) foi checada **antes**
da conclusão: existe **um único** profile com `mastro` no e-mail ou no nome além
de uma homônima sem relação (`mastropietro.ariane`, sem acesso e sem crédito), e
a busca por `mastroianni` no payload inteiro de `payment_events` devolve só
eventos **deste** endereço. **Não há segunda conta.**

**NÃO endosso** os 48.025 créditos citados na discussão (é nota da casa, não
minha — não reconferi `ref_id` por `ref_id`). O que eu meço e assino: saldo
**874** (349 assinatura + 525 extra) e a fronteira de cobrança de hoje 12:00Z.
**Não toquei em crédito e não toquei no acesso dele.**

---

## 2. 🔴 O `#15` — O MAIS VELHO DA FILA — ESTÁ PARADO HÁ 22 DIAS POR UMA LINHA DE ENV

**Anotado no `#15` (`d3d8d1b2`). NÃO fechei** (regra 14: não está resolvido).
Escolhido por ser **o mais antigo com aluno afetado**: 46,9 dias, **18 alunos**.

### 2.1 A classe está dormente — e isso é medida, não impressão

Desde a última ocorrência (**04/09 20:47:50Z**) até agora: **815 gerações,
0 `executionTimeout`**.

| semana | total | timeouts | % |
|---|---|---|---|
| 20/07 | 401 | 0 | 0,00 |
| 27/07 | 588 | 1 | 0,17 |
| 03/08 | 705 | **10** | **1,42** |
| 10/08 | 795 | 0 | 0,00 |
| 17/08 | 710 | 3 | 0,42 |
| 24/08 | 664 | 3 | 0,45 |
| 31/08 | 445 | 2 | 0,45 |
| 07/09 | 602 | **0** | 0,00 |
| 14/09 | 132 | **0** | 0,00 |

Histórico: **19 timeouts em 5.042 gerações = 0,38 %**. Nesse tamanho (815) a
taxa velha previa **~3** falhas; observar **zero** tem probabilidade de ~5 % se
nada tivesse mudado.

**Leitura honesta:** é improvável demais para ser sorte pura, então alguma coisa
melhorou — **mas ninguém subiu conserto para este defeito**. Está mais quieto e
**não sabemos por quê**. *Quieto não é curado*, e eu não marco `fixed` em cima
de ausência de sintoma.

**Conferi o jeito óbvio de me enganar aqui:** o volume **não** caiu (602 na
semana passada), então o zero das duas últimas semanas **não** é falta de
tráfego.

### 2.2 O que realmente trava o cartão

A ordem permanente manda, se voltar, **instrumentar o handler para logar em qual
fase o chunk pendura**. Esse código está no ar desde **25/08** (`b9bc646`,
`1c72d77`) e **continua desligado**.

**Medido hoje:** `qa ? 'fase_corrente'` presente em **0 de 240** gerações de
3 dias — e a coluna `qa` em si está preenchida em **173** delas. **Não é a
coluna: é a fase que nunca chega.** Causa: a env `FASE_TELEMETRIA_SECRET` não
existe em produção, e sem ela `faseTelemetriaInput` devolve `{}`
(`fase-telemetria.ts:41`), por design e em silêncio.

**O commit de ontem (`2ae6f15`, PR #90) NÃO liga a feature.** Conferi que está
na `main` (`merge-base --is-ancestor`), e o que ele faz é fazê-la **avisar** que
está desligada em vez de ficar muda. É bom conserto — **não é o desbloqueio**.

> **Conserto mergeado não é conserto ligado.** É o primo do aviso que já está no
> manual (*"card completed não significa em produção"*) e do *"DDL commitado não
> é DDL aplicado"*: aqui, **feature no ar não é feature habilitada**.

### 2.3 Há quanto tempo, e por que eu mudei a forma de pedir

O mesmo desbloqueio foi pedido em **24/08** (*"Ponho a variável em produção?"*),
**25/08** (*"3º dia perguntando"*) e **28/08** às 19h e às 21h (*"travado no
Johnny"*, *"nada meu a fazer"*). Hoje é 15/09: **22 dias**.

O cartão mais velho da casa está parado por **uma linha num arquivo de env** —
não é dificuldade técnica, é uma pergunta que nunca foi respondida. Por isso
**parei de perguntar aberto e perguntei fechado**, com o comando pronto e o
risco nomeado: repetir a mesma pergunta aberta já falhou quatro vezes.

### 2.4 A precondição que eu NÃO verifiquei, declarada em vez de omitida

O `deploy/README.md` avisa que a imagem do `runpod-worker` em produção precisa
ser **>= `b9bc646`** e a base precisa ser `https://`, senão o worker **descarta a
config em silêncio** e a fase continua zero **mesmo com a env posta**.

**Eu não conferi a versão da imagem do worker.** Tentei ler o ambiente do
servidor por SSH e o **guard da minha máquina barrou** a leitura (padrão de
exfiltração de segredo); **preferi respeitar a trava a contorná-la**. Portanto:
ligar a env é condição **necessária, não suficiente** — quem ligar precisa
conferir a imagem no mesmo movimento, ou gasta-se mais um ciclo achando que
instrumentou.

### 2.5 Dinheiro

**Não reconferi** os estornos dos 18 nesta ronda — a nota de fechamento de 20/08
registra todos estornados, conferidos por `ref_type='generation_refund'` (e o
lembrete de sempre: filtrar por `kind` engana, o estorno grava
`kind='extra_purchase'`). **Não toquei em crédito de ninguém.**

---

## 3. Estado da fila no fechamento

- **79 abertos** + **20 em `aguardando_aluno`** = 99. Bate com as 10hZ do Vigia.
- **2 presos** pela varredura.
- **Mais velhos com aluno afetado:** `#15` (46,9 d · 18 alunos), `#99` (22,8 d),
  `#101` (22,6 d · 5 alunos), `#223` (13,8 d), `#226` (13,7 d),
  `#234` (12,8 d · 10 alunos), `#254` (10,6 d · 15 alunos).
- **Fechei nesta ronda: 0.** Digo o passo em que cada um emperrou, como manda a
  regra 8: o `#329` **não fecha** porque a insatisfação com o Vídeo Clone
  continua de pé (o que eu matei foi o alarme de acesso, não o cartão); o `#15`
  **não fecha** porque não há conserto subido, a causa raiz segue desconhecida e
  a única ferramenta que a acharia está desligada esperando resposta.

**Ainda sem vídeo** (herdado das 10hZ, não reaberto por mim): `leonice`
(falhou 19:01Z de ontem) e `trabalhoiaclone` (falhou 08:26Z no Turbo) — crédito
de volta, entrega não. Seguem no `#404`.

---

## 4. O que esta ronda diz

As duas coisas que eu toquei hoje são a mesma armadilha em roupas diferentes.

No Mastroianni, um campo do `profiles` foi lido como se fosse uma decisão da
casa quando era o **espelho de uma fatura** — e isso sustentou sete rondas de
urgência e ia consumir a manhã do Johnny num não-evento. No `#15`, um commit
mergeado foi lido como instrumentação no ar quando a feature **nunca gravou um
dado** — e isso sustentou 22 dias achando que o cartão estava esperando o
defeito voltar, quando ele estava esperando **uma linha de env**.

Nos dois casos o dado estava a uma consulta de distância e ninguém tinha ido
olhar. A diferença entre as duas é o que vem depois: o primeiro eu pude **matar
sozinho**, aplicando uma regra que já estava escrita e fechada desde 20/08. O
segundo eu **não posso** — mexer em produção é sim ou não do Johnny, e a única
coisa que estava no meu alcance era parar de repetir uma pergunta que já falhou
quatro vezes e transformá-la numa decisão de dez segundos.

---

**O que eu NÃO fiz:** não fechei incidente, não reabri incidente, não mudei
status de cartão nenhum, não mexi em crédito, não estornei nada, não afirmei
cobrança sem prova, não endossei o valor de 48.025, não toquei no acesso do
Mastroianni, não marquei o `#15` como resolvido em cima de silêncio de duas
semanas, não afirmei ter conferido a imagem do worker, não contornei o guard que
barrou a leitura por SSH, não respondi aluno nesta ronda, não liguei para
ninguém, não mexi em branch, não abri PR, não mergeei, não subi migration, e
**não li nem reprocessei nada da planilha** (ordem de 29/08).
