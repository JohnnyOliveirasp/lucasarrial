# Ronda das falhas — 31/08/2026, 12h40–13h00 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**, e nenhum incidente
de causa-planilha foi aberto ou reaberto.

## Placar

- Fila no início: **5 abertos + 3 aguardando_aluno**.
- Fila no fim: **5 abertos + 3 aguardando_aluno**.
- Fechados como `fixed`: **0** — o motivo está escrito, caso a caso.
- Alunos avisados: **1** (Leonardo Gonçalves, #200, uid 367).
- Fix em produção: **0**. Os 4 PRs que destravariam a fila seguem OPEN.
- Achado que muda uma decisão pendente: **o #200 está 3,8x maior do que diz**.

## Por que não peguei o #99 nem o #192 (o serial mandava, e eu conferi)

O serial manda pegar o mais antigo com aluno afetado. Conferi os dois antes de
seguir, em vez de assumir a leitura da ronda anterior:

- **#99 Luciano** (23/08, o mais antigo): a ronda das 11h41Z escreveu a ele
  corrigindo o prazo (uid 365). Não há passo técnico meu. O que trava é a
  decisão dos R$ 97, que vence **amanhã (01/09)** e já foi escalada 12 vezes.
  Repetir a 13ª escalação na mesma hora seria ruído, não progresso.
- **#192 Robert**: li as 16 notas. O passo que a nota das 21h46Z deixou
  ("transcrever a b298e5be e achar a palavra intrusa") **já foi executado** na
  nota 14, e a hipótese caiu ali. Sobram dois passos que não são meus: a decisão
  binária do Johnny no PR #135 e alguém **ouvir** o timbre.

Ambos travados em outra pessoa, e eu digo em que passo. Segui pro próximo.

## O caso que eu levei: #200, e o aluno que tinham deixado de fora

### 1. O silêncio de 51h que ninguém tinha visto

O `affected_emails` do #200 tem 3 alunos. A nota de 30/08 18h48Z escreveu para
dois (Túlio e Reinaldo) e **deixou o terceiro de fora de propósito**, com este
argumento: *"escrever pra todo mundo da classe vira e-mail em massa, que precisa
do 'pode' do Johnny"*.

Três pessoas não são e-mail em massa. Conferi antes de discordar: **ZERO** em
Sent para `lgoncal@gmail.com` e **ZERO** no INBOX vindo dele. Ou seja, ~51h em
silêncio, e ele não sabia de nada — o padrão da Viviana, na lista do próprio
incidente. E-mail individual sobre um caso que eu estou tratando é alçada minha
(regra 8); massa é outra coisa.

### 2. O experimento controlado que estava na mão e ninguém percebeu

O PR #132 prova o descarte por **correlação** (rastro `qa.rate_global_wps`,
10/10). Faltava a prova no **áudio que o aluno recebeu** — e o caso do Leonardo
é o A/B perfeito: mesmo texto, mesma voz, 3 minutos de diferença, mudando só o
seletor.

| geração | quando | escolha | duração real | articulação |
|---|---|---|---|---|
| `931f2cb1` | 30/08 09:53:58Z | nenhuma | 88,92s | **3,149 pal/s** |
| `50dcf9f0` | 30/08 09:57:09Z | `speech_rate_factor=1.15`, `rate_qa` NULL | 90,29s | **3,106 pal/s** |

Ele pediu ~15% mais rápido e recebeu **1,4% mais lento**. Com o fator aplicado a
saída seria ~77s. O descarte agora está provado no artefato entregue, não só no
rastro. De quebra: a duração real do `ffprobe` **bate** com `duration_seconds` do
banco (88,872/90,242), então a armadilha do Xing (`a2b528a4`) não está em jogo.

### 3. A correção de escala — o achado principal

O incidente está escrito como *"5 gerações de 3 alunos"*. Varri a tabela inteira
**sem filtro de data**, pela assinatura exata do descarte
(`request_params ? 'speech_rate_factor' AND rate_qa IS NULL`):

> **19 gerações · 12 alunos distintos · 8.422 créditos · de 28/08 22h28Z até
> 31/08 02h03Z.**

| aluno | n | créditos |
|---|---|---|
| reinaldo.guernelli | 4 | 2.725 |
| lgoncal | 1 | **1.572** |
| kauanpatrickmertz | 2 | 1.246 |
| tuliocanella | 2 | 978 |
| konexiva | 1 | 752 |
| uriasdercilia | 2 | 428 |
| digital@semente.agr.br | 1 | 263 |
| francielly.mazete | 1 | 193 |
| claudionirqs | 2 | 116 |
| adm@hub2decor | 1 | 103 |
| braboblindagem | 1 | 31 |
| joaomarcos@grupofielpr | 1 | 15 |

**Por que a conta original ficou pequena:** ela olhou só o dia em que o Vigia
abriu (30/08). O defeito é mais velho — o mais antigo é de 28/08 22h28Z, anterior
ao `1e9dedd`; ali o descarte vem da env `TTS_RATE_QA` desligada, mesma causa e
mesmo efeito. O maior prejuízo individual numa única geração é o do Leonardo
(1.572), porque o texto dele era o mais longo dos 19.

### 4. A classe NÃO está congelada esperando o merge

`uriasdercilia@gmail.com` gerou o **mesmo texto de 214 chars duas vezes**, às
02h02:14Z e 02h03:31Z de **hoje**, as duas com o seletor tocado e as duas
descartadas. É o comportamento de quem não viu efeito e tentou de novo: vítima
**nova**, 10,7h atrás, com o PR #132 escrito e parado. Mesmo fato que o Vigia
anotou no #203 às 12h — vale igual aqui, e ninguém tinha medido.

### 5. Uma hipótese minha que caiu, e eu registro a queda

Tentei provar o mecanismo comparando gerações do Reinaldo com `rate_qa=true`
contra `rate_qa=null`, mesmo fator 1.15: `3fe23b28` (true) **2,916 pal/s**,
`16956cb0` (null) **2,780**, `1037ce66` (null) **2,933**. O "true" ficou **no
meio** dos dois "null" — não provou nada.

Não é contradição do defeito: são textos diferentes, e `rate_qa=true` não é
acelerador cego — ele mira a **régua natural da pessoa** (`target_wps` medido da
referência) e aplica o fator em cima disso, então a saída não tem que ficar mais
rápida que uma geração qualquer. Registro porque quase virou "achado" e teria
mandado o time pro lugar errado. **A prova do descarte é o par do Leonardo (mesmo
texto), não a comparação entre textos diferentes.**

**Consequência prática:** o texto já enviado ao Túlio e ao Reinaldo diz *"marque
a caixa e aí o ajuste acontece de verdade"*. Está certo no mecanismo, mas é
incompleto — dá a entender acelerador linear. No e-mail do Leonardo escrevi a
versão honesta. **Não vou reescrever pros outros dois:** seria um terceiro e-mail
sobre o mesmo assunto para quem já recebeu dois, e a imprecisão não muda a ação
que eles têm que tomar.

### 6. O e-mail

Enviado 12h48:30Z, cópia em Enviados **uid 367**, **sem `--bcc`** de propósito
(lição do #201, onde o bcc foi junto no 550). Conferido depois de enviar: cópia
presente e **nenhum bounce novo** — os únicos seguem sendo uid 380/381, de 30/08.
O bounce do #201 voltou em ~2s, então ausência aqui é sinal, não esperança.

Dois erros meus **pegos no `--dry-run`**, antes de sair: escrevi "sábado" (30/08
foi **domingo**) e os horários em UTC (09h53/09h57) em vez do fuso dele
(**06h53/06h57**). O ensaio pagou o próprio custo nesta ronda.

Não prometi data, não prometi estorno e não assinei como Johnny.

## Por que o #200 não foi para `fixed`

Causa medida, conserto escrito, **PR #132 OPEN**. PR aberto não é produção
(regra 14). Nenhum PR foi mergeado: merge na main deploya, e produção precisa do
aval.

## Fim de ronda

`git log origin/main..HEAD` vazio antes de commitar este registro; `git status
--porcelain` limpo (lição da ronda das 01h — o passo fixo não pega arquivo nunca
commitado). Nenhum fix preso em branch.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — vence AMANHÃ (01/09).** Devolver ou segurar os R$ 97. O aluno
   já sabe o prazo certo por escrito, então não perde o direito; a decisão de ser
   proativo é do Johnny.
2. **#200 — decisão NOVA, que esta ronda produziu:** os **8.422 créditos dos 12
   alunos**. 8 nunca foram avisados e ninguém foi estornado. É dinheiro + e-mail
   em massa, então precisa do "pode". **Não estornei ninguém, nem o Leonardo** —
   estornar só quem eu tratei hoje e deixar 11 de fora seria arbitrário.
3. **#132 / #133 / #134** — aval de merge; 3 incidentes fecham no mesmo dia, e o
   #200 segue fazendo vítima nova enquanto isso.
4. **#135** — decisão binária (guarda inteira ou só o bucket reverte-protegida;
   recomendo a segunda).
5. **#192** — alguém **ouvir** o timbre. Pedido aberto desde 30/08 02h.
