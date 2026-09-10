# Ronda das falhas — 10/09/2026, 23hZ (20h BRT)

Dono da fila (14-A). Peguei **UM** caso e levei até onde eu alcanço: o
**`#309` (Victor)**, o mais antigo com aluno esperando (51,7h). Ele destravou um
achado de dinheiro que valia a exceção da regra 8, e eu segui nele.

**1 aluno respondido** (Victor, Enviados uid 1674), **1 chamado novo** (`#350`),
**3 chamados anotados** (`#309`, `#299`, `#350`), **0 fechados**, **0 reabertos**.
Nenhum crédito mexido, nenhuma GPU, nenhuma migration.

Repo em `main`, `pull --ff-only` já em dia. `_frank/ordens/README.md` e
`_frank/rotinas/e-mail_tecnico.md` lidos antes de agir. Ordem de **29/08**
respeitada (nada da planilha). Ordem de canal de **31/08**: os três avisos desta
ronda saíram **no grupo**.

---

## O achado: a garantia estava vencendo com o aluno na fila, a 80 minutos

O `#309` estava sendo tratado como caso de atendimento atrasado. Não é. Fui ler
o payload da compra dele e o campo que ninguém tinha aberto em 4 rondas:

```
payment_events 79e8fd7f · payload.data.product.warranty_date = 2026-09-11T00:00:00Z
```

Isso é **10/09 21h BRT**. Quando medi (22:40Z) faltavam **~80 minutos** para a
garantia dos **R$ 397** dele virar. Ele pediu o reembolso em **08/09**, dentro do
prazo, e recebeu **três** respostas nossas sem nenhum desfecho — a última
prometendo retorno *"ainda hoje"*, 22h antes.

A frase dele de ontem diz que ele entendeu o risco sozinho:

> *"Só para deixar claro caso passe do prazo, que fiz a solicitação bem antes e
> só estou aguardando o retorno."*

**A compra, medida:** `PURCHASE_APPROVED` 04/09 21:52:03Z, produto 7283229
(Sistema de Geração Pronto), **397 BRL**, `APPROVED`, transação **HP0250902700**,
comprador "Victor moraes mendes", `processed_at` preenchido, `error` NULL. O
webhook entrou limpo — não houve falha técnica nenhuma. Só fila.

Ele também **não tem linha em `sgp_pedidos`**: nunca preencheu o formulário,
então a casa não entregou nada por esses R$ 397.

### O que eu fiz

1. **Avisei o grupo na hora**, marcado urgente, com transação e prazo. O estorno
   é na Hotmart e depende de gente com acesso — **eu não executo**, e não ia
   descobrir isso às 21h01.
2. **Escrevi pro Victor** (Enviados **uid 1674**, cópia confirmada). Assumi a
   demora, disse que **vale a data em que ele pediu (08/09)** e que a nossa
   demora não é problema dele. **Não prometi horário** — ele já tinha três
   promessas; a quarta seria pior que o silêncio.
3. Pedi os dados da **segunda compra**: ele fala em duas, e só uma chegou aqui.

### As "duas compras" — só uma chegou

Varri `payment_events` por e-mail, por nome (`ilike victor%mendes%`), por
`checkout_phone` (85994026253) e por `buyer.ucode`: **1 linha**, a de R$ 397.
`order_bump.is_order_bump = false`. **Não afirmo que a segunda não existe** —
afirmo que ela **não chegou ao nosso webhook**, e por isso só a Hotmart resolve.

### Corrigindo a fila: ele NÃO estava travado atrás do `#313`

As rondas de 14hZ e 16hZ registraram que o caso *"segue travado atrás da decisão
dos 15 vitalícios (`#313`)"*. Conferi: os `affected_emails` do `#313` são 12 e
**victor.inscriptio@gmail.com não está entre eles**. Ele não tem `entitlement`
por um motivo **correto**: compra de SGP (7283229) não gera entitlement de
plataforma depois do roteamento por produto — que é justamente o que o `#313`
cobra. O bloqueio dele nunca foi decisão pendente; era só que **ninguém executou
o estorno**. Blocker falso mantém gente parada por educação.

---

## A porta, e a minha hipótese errada sobre ela — `#350`

Abri o `#350` para a classe. Ele quase nasceu com uma premissa falsa minha.

**Eu ia escrever:** *"o `warranty_date` entra no banco e ninguém lê"*.
**Conferi antes de gravar e é FALSO.** O campo **é** lido: o `#265` foi corrigido
em 05/09 (PR #191, merge `b4a7a39`), a constante de 7 dias saiu e a janela passou
a vir do payload. Registro o erro porque cartão que nasce de premissa não
conferida é como a fila passa a mentir.

**O buraco real, medido.** `grep janelaGarantia` em todo o repo, fora
`node_modules` e testes:

| onde | o quê |
|---|---|
| `garantia.ts:66` | a definição |
| `account.ts:20` | o import |
| `account.ts:174` | **a única chamada** |

`account.ts` monta o contexto para o agente **responder** o aluno. A casa sabe
calcular a janela com precisão, mas **só calcula quando alguém já está
escrevendo** para aquela pessoa. É conhecimento **reativo**. Não existe varredor
que percorra os chamados **abertos** e pergunte *"de quem é que o prazo vence
amanhã?"* — e é exatamente enquanto o chamado espera que o relógio corre.

A função já existe, já é pura (sem import, sem banco) e já é testada. Falta
chamá-la **olhando para a fila**, não para uma conversa.

### O agravante que esconde o caso da busca por palavra

O `#309` nasceu como *"Victor solicita reembolso de duas compras"*. Na 3ª
ocorrência o título foi reescrito para *"aguardando retorno sobre Sistema de
Geração Pronto"* e a palavra **reembolso saiu do título**. Minha própria consulta
por palavra-chave **não acha mais o `#309`** — ele apareceu na medição pelo
caminho do `#312`. Qualquer detector desta classe tem que ler o **histórico**, não
o título de agora, senão nasce cego no caso mais grave: o que já cobrou 3 vezes.

---

## 🔴 Eu errei o número e corrigi na mesma ronda: são 2, não 3

Publiquei o `#350` e avisei o grupo dizendo **3 alunos**. **São 2.** Contei a
**Alana (`#223`)** errado.

**O erro:** cruzei o `warranty_date` de qualquer `PURCHASE_APPROVED` **sem olhar
se entrou dinheiro**. A única compra da Alana na nossa base é `HP4076199980` com
`price.value = 0` — adesão de R$ 0, que **não tem o que reembolsar**. Essa regra
já está escrita e justificada dentro do próprio `garantia.ts` (*"só considera
compra PAGA (`price.value > 0`)"*). Ou seja: **reproduzi na medição exatamente o
descuido que o código de produção já tinha aprendido a evitar** — a armadilha do
`#138` (acesso vivo ≠ pagou) outra vez.

Refeito com `value > 0`, entre os chamados de atendimento abertos:

| caso | pediu | pagou | garantia | veredito |
|---|---|---|---|---|
| `#299` Lucila | 07/09 | R$ 97 | venceu **10/09** | **REAL** |
| `#309` Victor | 08/09 | R$ 397 | vence **11/09 00:00Z** | **REAL** |
| `#263` rossiclinicas | 05/09 | — | vencida 15/08 | fora: pediu **depois** do vencimento; caso dele é cobrança recorrente |
| `#270` pcezardireito | 05/09 | — | 13/09 | fora: quer **reativar**, não reembolso |

A Alana segue sendo caso grave de espera (222h), mas **não** de prazo de
reembolso perdido — o dela é acesso de teste queimado por defeito nosso, e os
cursos não passaram pelos nossos sistemas. Misturar as duas coisas faria a casa
oferecer dinheiro a quem não pediu e sumir com o caso real dela. **Corrigi no
`#350` e no grupo**, para o 3 não virar verdade por repetição.

---

## `#299` (Lucila) — a garantia venceu ontem, esperando a gente

R$ 97 pagos em 03/09 (`HP1377079700`), `warranty_date` **2026-09-10T00:00:00Z**.
Pediu em **07/09**, três dias **dentro** do prazo. Virou dentro da fila.

**Ela não está em silêncio** — conferi os Enviados: respondida com honestidade em
07/09 (uids 1252, 1254, 1263), inclusive dizendo que ninguém prometeria valor nem
prazo. O problema não é falta de resposta, é encaminhamento **sem desfecho**.

Reforça o pedido dela, e já estava medido na própria conversa: **200.000 créditos
intactos e ZERO voz criada** nas duas contas. Pagou R$ 291 e não usou a
ferramenta uma vez.

**Não escrevi pra ela nesta ronda, de propósito.** Ela já tem 3 mensagens
"encaminhado, aguarde". Uma quarta sem desfecho é ruído e gasta a paciência que
sobrou — foi assim que o caso do Victor apodreceu. O que falta ali não é texto, é
a decisão de estorno.

---

## Ressalva honesta sobre o dano

**Garantia vencida na Hotmart não significa dinheiro irrecuperável**: o vendedor
ainda pode estornar por decisão própria. O que se perdeu foi o **direito
automático** do aluno e a posição confortável da casa. **Não afirmo prejuízo
consumado** — afirmo proteção perdida por causa da nossa fila.

---

## O que falta, com o passo exato

| caso | passo que falta | de quem é |
|---|---|---|
| `#309` Victor | executar o estorno de **R$ 397** (`HP0250902700`) e conferir na Hotmart se existe a 2ª compra | **humano com acesso à Hotmart** |
| `#299` Lucila | decidir e executar o estorno de **R$ 291** (mais recente `HP1377079700`) | **humano com acesso à Hotmart** |
| `#350` | escrever a varredura que chama `janelaGarantia()` a partir da **fila**, lendo histórico e não título, filtrando `value > 0` | código |

Os dois primeiros são **dinheiro e acesso que eu não tenho** — não são meus para
decidir sozinho. Por isso os dois cartões ficam **`investigating`**: aluno
respondido não é dinheiro devolvido (regra 14).

---

## Números da ronda

- Fila: **71 abertos** no início → **72** no fim (`#350` nasceu; **nenhum
  fechado**, nenhum reaberto). A conta fecha.
- **2 itens presos** e **11 aguardando aluno**, sem mudança minha.
- Caixa: leitura com `BODY.PEEK`, só `SEEN`. **Não toquei em não-lido.**
- **1 e-mail enviado** (Victor, uid 1674, cópia **confirmada** na 1ª tentativa).
- **3 avisos no grupo**: o urgente do Victor, o da classe, e a **correção** do 3→2.
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais não rastreados em
  `_frank/rascunhos/`. **Sétima ronda seguida.** Não são meus, **não toquei** —
  commitei só o meu log e o meu rascunho.
- Custo: leitura + 1 e-mail. Nenhuma chamada paga de visão, nenhum crédito,
  nenhuma GPU.
