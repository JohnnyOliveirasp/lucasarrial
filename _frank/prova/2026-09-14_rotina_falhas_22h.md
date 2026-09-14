# 14/09 ~21h40-22h50Z — Rotina das falhas

Método serial (regra 8): peguei **um** caso e levei até o fim do que era meu.
Fila **81 abertos** na abertura (1 com 30d+, 3 entre 15-30d, 29 entre 7-15d).
Fecha em **80**.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa, mais a ordem de **29/08** (planilha desligada) e a
**REGRA FINAL DE CRÉDITO de 20/08**. **Nada da planilha foi lido, escrito,
classificado ou reprocessado.** Ordem de canal de **31/08**: o aviso desta ronda
foi **no grupo**, com `notify-grupo.sh`, e só lá.

Varreduras fixas, antes de tudo:

- **2 (travados):** 3 em "acesso vivo, com crédito e sem voz pronta", **nenhum
  novo** — Marcelo (35d, já tratado), Eric e Euneiva em `awaiting_training`
  esperando o clique **deles** (1d e 0d). Mais 1 `training_jobs` obsoleto (voz
  já `ready`, ninguém esperando). Nada a fazer.
- **2-B (pedido de saída × assinatura viva):** **0 sangrando**, 26 já fora, com
  os dois controles OK.

## Qual peguei, e por que

Não ordenei por idade bruta. Os 8 mais velhos foram conferidos pelas rondas das
13h–21h de hoje e seguem em decisão alheia ou prazo datado — reconferir de novo
1h depois seria teatro.

Ordenei a fila pela **data da última nota**, que é a pergunta que interessa:
*quem está aberto e ninguém encosta?* A resposta foi o **`#263`**
(`5c68eb33`, rossiclinicas@gmail.com) — última anotação **05/09 14:25Z**, ou
seja **9,3 dias parado**, com aluno e dinheiro envolvidos. Era o item mais
abandonado da fila inteira, e nenhuma ronda tinha olhado por esse ângulo.

## O que era, de verdade

**Uma pergunta que ficou 9 dias sem resposta porque, em 05/09, ela ainda não
tinha como ser respondida — e ninguém voltou quando passou a ter.**

O aluno reclamou "cancelei o plano e veio cobrança nova". A ronda de 05/09
mediu e disse a ele que a renovação de **08/09 12:00Z** não ia acontecer. Mas
aquilo era **previsão**: a data não tinha chegado, e a própria nota registrou a
ressalva do Solon — *"cancelado na Hotmart ≠ Hotmart não vai disparar"*.

Hoje a data passou **há 6 dias**. Então medi, em vez de supor:

| fonte | resultado |
|---|---|
| Hotmart `sales/history` (viva) | **3 cobranças e só 3** — 08/07 R$0, 15/07 R$97, 08/08 R$97 |
| nosso `payment_events` | último evento 16/08; **nada depois** |

**Não existe cobrança depois de 08/08.** A queixa está refutada com a data já
vencida, não mais por promessa.

⚠️ **Armadilha de instrumento, medida aqui:**
`/subscriptions/7YJ9TJHJ/purchases` devolveu **total 0** com HTTP 200. Quem
medisse só por ele concluiria *"nunca houve cobrança nenhuma"*, que é
obviamente falso. É endpoint **cego para assinatura cancelada**. O que vale é
`/sales/history?buyer_email=`, que serviu de **controle positivo**: ele devolveu
3, logo o zero do outro é cegueira do instrumento, não ausência de fato.

## O defeito grave que eu ia abrir, e que não existia

O aluno está com **110.000 créditos e `SEM ACESSO`** (acesso venceu 08/09).
Montei a tese de que isso era **confisco por porta fechada** — o saldo não
zera, mas a porta fecha, e o efeito é o mesmo —, contra a REGRA FINAL DE
CRÉDITO de 20/08 (*"mantém o acesso, não há trava, não há saldo parado, não há
confisco"*).

**A tese estava errada e morreu com medição, em quatro camadas:**

1. `middleware.ts` só checa **login**, não checa acesso.
2. `layout.tsx:95-101` — *"Entrada LIVRE: o paywall não bloqueia mais o acesso"*.
3. As rotas que **gastam** travam por **saldo**, não por assinatura:
   `voices/[id]/generate:159`, `voices/[id]/start-training:112`,
   `images/generate:167`. O `subscribed` só escolhe o **texto do popup** dentro
   do 402 de saldo insuficiente.
4. E porque **código no repositório não é código em produção** (lição da ronda
   das 21h), medi a produção: **107 débitos de 14 pessoas cujo `access_until`
   já estava vencido no instante do débito**, entre 20/08 e hoje **14/09
   16:17Z**. Caso extremo: acesso vencido em **19/07** gastando crédito em
   **06/09** — 49 dias depois.

**A decisão do Johnny está sendo cumprida em produção.** Não abri chamado, não
escalei e não propus refinamento — a ordem de 20/08 manda aplicar e fechar.

## O que era verdade contra nós, e que eu corrigi

O e-mail que **eu mesmo** mandei em 05/09 (enviados uid 1070) dizia *"o seu
acesso está pago até 08/09"* e o convidava a *"aproveitar esses últimos dias"*.
Isso dá a entender que os 110.000 créditos morreriam em 08/09. Pela medição
acima, **é falso**.

O aluno não produz nada desde **21/07**. Ele passou esses dias provavelmente
acreditando que tinha perdido o saldo. **O dano vivo neste card não era
cobrança indevida: era uma informação errada nossa que ele não tinha como
conferir.**

## O que fiz

- **Escrevi pra ele** (Enviados **uid 2342**, cópia confirmada na 1ª tentativa):
  (1) a renovação de 08/09 não aconteceu, dito como **fato**, com as 3 cobranças
  listadas; (2) a **correção explícita do meu próprio e-mail de 05/09**,
  assumindo que fui eu quem deu a entender errado; (3) o caminho de entrar e
  usar os 110.000 com as 3 vozes prontas — com *"Esqueci minha senha"* em vez de
  link de recovery, **que expira** (defeito de desenho medido na ronda das 19h);
  (4) a verdade sobre a restituição, **sem promessa de data nem de valor**.
- **Anotei o `#263`** (nota 4, 1 linha afetada na releitura), com o passo que
  falta nomeado.
- **Fechei o `#247`** (Jackson) — abaixo.

## Correção do parecer de dinheiro (me corrijo aqui também)

O parecer de 05/09 dizia *"ele pagou R$97 em 08/08 por um mês que não usou"*.
A metade que faltava: **esse ciclo virou +100.000 créditos em 08/08 14:27 e eles
continuam na mão dele, gastáveis, sem prazo.** Então não houve perda do
**dinheiro**, houve perda de **uso**, por informação errada nossa — que é o que
acabei de reparar.

A devolução em dinheiro continua sendo decisão do Johnny (9-C), agora com esse
fato na mesa. Não decidi por ele e não prometi nada ao aluno. Posto no grupo.

## O `#247` fechado (Jackson), e por que não foi fechamento barato

Dois agentes deixaram o card pronto e marcaram *"só o Frank fecha"* (14-A).
**Conferi os 3 fatos na fonte viva, não herdei das notas:**

- Hotmart: duplicada `6VHWPHB9` = **CANCELLED_BY_SELLER**; mantida `X74ADBMN` =
  **ACTIVE**, renova 19/09 — exatamente o que o titular pediu por escrito.
- Banco: retorno dos R$97 existe — 04/09 21:44:53, **+100.000**,
  `ref_type=courtesy_grant`. ⚠️ `kind=extra_purchase`, **não** `refund`: quem
  procurar estorno por `kind` **não acha e paga em dobro**. É a armadilha medida
  em agosto, e ela continua de pé.
- Caixa: resposta dele hoje 13:22Z — *"Está tudo certo. Vamos continuar desta
  forma mesmo."* É encerramento, não terceira opção.

Não respondi de novo (responder um agradecimento só gera ruído).

## O que NÃO fiz, e por quê

- **Não abri nada sobre crédito**, de propósito — a tese de confisco foi
  refutada, e a ordem de 20/08 proíbe reabrir, escalar ou refinar o assunto.
- **Não decidi a devolução dos R$97** — é dinheiro do Johnny (9-C).
- **Não marquei o `#263` como `fixed`** (regra 14): o que era meu está feito,
  mas a definição do dinheiro não é minha, e `fixed` esconderia isso.
- Não mexi em crédito, acesso, assinatura, plano nem entitlement. Não gastei
  GPU, não apliquei migration, não abri nem mergeei PR, não toquei nos branches
  STALE, não liguei nem mandei WhatsApp, **não toquei em e-mail não lido**, e
  **não li nem reprocessei nada da planilha**.

## Lições

1. **Pergunta que não pôde ser respondida tem que voltar pra fila com data.** O
   `#263` não ficou 9 dias parado por ser difícil: ficou porque a resposta
   dependia de uma data no futuro e ninguém marcou de voltar quando ela
   chegasse. Previsão registrada como se fosse fato é dívida silenciosa.
2. **Ordenar a fila por idade esconde o abandono.** Os 8 mais velhos são
   revisitados toda ronda e o `#263`, no meio do bolo, passou 9 dias intocado.
   Ordenar por **data da última nota** achou em um comando o que a ordenação por
   idade não mostrava.
3. **Zero de endpoint precisa de controle positivo, sempre.** O
   `/subscriptions/{code}/purchases` devolve `0` com HTTP 200 pra assinatura
   cancelada. Só o `sales/history` desmentiu. Sem controle, eu teria escrito ao
   aluno um "nunca houve cobrança" absurdo.
4. **A informação errada que a gente mesmo mandou é dívida nossa, não ruído.**
   Não havia cobrança indevida neste card — havia uma frase minha que fez um
   aluno achar que perdeu 110.000 créditos. Reler o que a casa escreveu é parte
   da investigação, não cortesia.

## Estado do repo ao fim da ronda

- **Nenhum código subiu.** Só este log e 2 scripts de leitura pura em
  `_frank/rascunhos/` (não escrevem nada). Logo não há branch `feat/` com
  commit preso.
- Entregas: **1 incidente fechado** (`#247`), **1 e-mail a aluno** (uid 2342),
  **2 notas**, **0 chamados abertos**.
- Fila: **81 → 80**.
