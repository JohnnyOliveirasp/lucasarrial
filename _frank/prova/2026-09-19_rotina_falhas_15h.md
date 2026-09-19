# RONDA DAS FALHAS — 19/09, ~15hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_14h.md`.

**Método serial (regra 8): peguei UM item e levei até onde ele podia ir.** Usei a
ordenação que a ronda anterior deixou como lição nº1 — **abertos com aluno
nomeado, ordenados pela data da ÚLTIMA NOTA, não pela de criação**. O primeiro da
lista era o `#311`, **10 dias sem ninguém escrever nada**. Ele não se destacava
pela idade de criação (tem vários de 14 dias); destacava-se pelo silêncio.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
720 lidas da pasta "Sent" = 643 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`), instrumento
independente: **0 carta depois do corte**, veredito "buraco é PASSIVO".

Pasta **714 → 720** e tabela **637 → 643** desde as 14hZ: as 6 cartas do intervalo
**já nasceram com linha**. Controle compensatório funcionando.

As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — decisão de produção,
não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 14hZ | 15hZ |
|---|---|---|
| fixed | 278 | 278 |
| investigating | 93 | **94** |
| ignored | 60 | 60 |
| aguardando_aluno | 34 | 34 |
| open | 1 | 1 |

Total varrido 466 → **467**. O `investigating` subiu 1 porque **eu abri o `#481`**
(§3). **Não fechei nenhum cartão nesta ronda, e o número diz isso** — o `#311` não
podia ser fechado sem o dinheiro resolvido, e resolver o dinheiro não é meu.

---

## 2. O item serial: `#311` — a casa só enxergou METADE da compra do aluno

`d14b2f26` · `fast-email:atend:hugo.correa@aol.com` · aberto **08/09** ·
última nota **08/09** · **10 dias de silêncio**.

O cartão dizia: "comprou 08/09 via Pix, não conseguiu acessar, pediu reembolso
com 3h de compra — dentro da garantia até 14/09. Processar reembolso."

### O que eu encontrei medindo do zero

**Ele fez DUAS compras em 08/09, com 7 minutos de diferença** — e a casa inteira
só tratou de uma:

| hora (Z) | transação | produto | valor | status na Hotmart viva |
|---|---|---|---|---|
| 11:45:37 | `HP2419260490` | Fábrica de Conteúdo Invisível | **R$ 252,45** | **COMPLETE** (não estornada) |
| 11:52:38 | `HP2131853062` | Sistema de Geração Pronto | **R$ 597,00** | **REFUNDED** (estornada) |

**TOTAL PAGO R$ 849,45 · DEVOLVIDO R$ 597,00 · AINDA COM A CASA R$ 252,45.**

**As 3 cartas que saíram pra ele** (pasta Sent, uid 1307 / 1343 / 1349) falam
**exclusivamente do SGP R$ 597**. A carta das 20:29Z é boa: corrige uma informação
errada dada mais cedo e escala o reembolso com honestidade. Mas ela escala **"o
reembolso"**, no singular. **A compra de R$ 252,45 nunca foi mencionada a ele e
nunca foi tratada.**

**O que a casa registrou:** `payment_events` tem **1 evento** para ele — o
`PURCHASE_APPROVED` do SGP. A compra de R$ 252,45 **não gerou evento nenhum**, e
o estorno do R$ 597 **também não**. O banco da casa ainda o mostra como pagante
de R$ 597 e é cego para os outros dois fatos. (Não é cegueira global: existem 14
`PURCHASE_REFUNDED` + 3 `PURCHASE_CHARGEBACK` no banco, o mais novo em 18/09.
Falhou **neste** caso.)

**Ele não consumiu nada.** `profiles` `32ae1d8a`: `plan=free`,
`access_until=null`, `credits_subscription=0`, `credits_extra=0`,
**`last_seen_at=NULL` (nunca logou)**, 0 generations, 0 voices. Conta criada pelo
webhook 3s depois do Pix.

**Ressalva que eu faço questão de deixar escrita:** como o produto FCI não manda
evento pro nosso webhook, **eu não consigo afirmar daqui se ele acessou o curso
no Hotmart Club**. Isso é pergunta pra Hotmart, não pro nosso banco. Não vou
dizer "ele não recebeu nada" sobre um produto que eu não enxergo.

**O prazo venceu enquanto a casa estava calada.** Ele pediu em 08/09, ~3h depois
de comprar. `warranty_date` do SGP era **15/09**. Hoje é 19/09. **O atraso é
nosso, não dele** — e isso está escrito no cartão com essas palavras.

### O que eu fiz, e o que deixei de fazer de propósito

- **Nota medida no cartão** (3 → 4 notas), gravada e **conferida na releitura, 1
  linha afetada**.
- **Escrevi pro aluno** (§2.1). Nota do envio no cartão (4 → **5 notas**),
  também conferida.
- **NÃO devolvi dinheiro e NÃO prometi devolução.** Os R$ 252,45 são decisão do
  Johnny (ordem 27/08). Levei ao grupo na hora, marcado como urgente.
- **Cartão segue `investigating`, não `aguardando_aluno`** — de propósito. O
  bloqueio principal não é a resposta dele, é a **decisão de dinheiro da casa**.
  `aguardando_aluno` esconderia que a dívida de decisão é nossa.

### 2.1 A carta

Enviada para `hugo.correa@aol.com`, assunto *"Hugo: o seu estorno, e uma segunda
compra que a gente não tinha te falado"*. Registrada em `emails_enviados`
(origem `ronda-manual`) e **cópia CONFIRMADA na pasta de enviados, uid 2889** —
conferido, não é "mandei".

Ela diz, nesta ordem: (a) o silêncio de 10 dias não tem desculpa; (b) o R$ 597
está estornado; (c) **existe uma segunda compra de R$ 252,45 que nunca foi
mencionada e não foi estornada**; (d) pergunta se ele quer o estorno dela;
(e) deixa registrado que ele pediu dentro do prazo e que a demora foi nossa;
(f) que ele não consumiu nada.

**O que ela não faz: prometer valor ou prazo.** Está escrito na carta que quem
processa devolução não sou eu.

Escolhi contar a compra de R$ 252,45 em vez de calar. Calar seria manter o
dinheiro de alguém que pediu reembolso 3h depois de comprar e nunca logou, e
contar com ele não conferir o extrato.

---

## 3. O achado que vale além deste cartão: **a consulta de compras por e-mail é cega a estorno** (`#481`)

Isto não fui procurar; apareceu porque o número do `#311` não fechava.

`GET /sales/history?buyer_email=<email>` **devolve somente transações
`COMPLETE`**. Estorno e chargeback **não aparecem**, e a API **não avisa que
filtrou** — a resposta tem cara de lista completa das compras da pessoa.

**Medido nos 17 estornos/chargebacks que a casa conhece: 17 de 17 invisíveis.
Zero apareceram.** Não é amostra, é a população inteira.

**O exemplo que mostra o tamanho** (`vazilg@gmail.com`):

```
por buyer_email (como a casa pergunta hoje) -> 1 transação  [1 COMPLETE]
com transaction_status explícito            -> 4 transações [1 COMPLETE + 3 REFUNDED]
```

A casa enxerga **1 de 4** compras dessa pessoa e não sabe que está vendo um quarto.

**Por que é perigoso, e por que é a MESMA família do `ref_type` × `kind`:** quem
auditar *"essa pessoa já foi estornada?"* por esse caminho recebe **sempre
"não"** — e pode estornar de novo. Foi exatamente o que quase aconteceu aqui: o
estorno de R$ 597 do Hugo só apareceu quando consultei **por transação**. A
consulta por e-mail me dizia, com ar de completa, que ele tinha uma compra só.

**Quem depende disso:** `_frank/ferramentas/pagou_de_verdade.cjs` — que o índice
de ordens declara como **"a fonte de verdade"** enquanto `profiles.ja_pagou` está
suspensa. Ele usa `/sales/history` e **herda o filtro em silêncio**.

**Conserto PROVADO contra a API viva** (testado, não é hipótese): passar
`transaction_status` explícito e repetido na query string devolve a união.
`start_date` **não** resolve (testado: segue 1 item).

**Não consertei nesta ronda, de propósito.** É código, mexe no instrumento de
dinheiro da casa, e vai por branch `feat/` + PR **com teste** — não no fim de uma
ronda. Fica registrado no `#481` com a prova e o conserto na mão.

---

## 4. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 720 = 720, 0 escrituráveis, conferida por
   instrumento independente.
2. **Medi o dinheiro do `#311` do zero:** R$ 849,45 pagos em 2 compras,
   R$ 597,00 estornados, **R$ 252,45 ainda com a casa**, conferido por transação
   na Hotmart viva.
3. **Descobri que a casa só tratou metade da compra dele** — as 3 cartas de 08/09
   falam só do R$ 597.
4. **Escrevi pro aluno** depois de 11 dias, contando a segunda compra e
   perguntando se ele quer o estorno. Entrega confirmada (uid 2889).
5. **Abri o `#481`**: a consulta de compras por e-mail esconde todo estorno,
   17/17 medidos, com o conserto já provado.
6. **Postei no grupo** os dois fatos, o do aluno marcado como urgente.

## 5. O que eu NÃO fiz

- **Não devolvi dinheiro, não prometi devolução e não escrevi valor nenhum como
  promessa.** Os R$ 252,45 estão na mesa do Johnny.
- **Não fechei nenhum cartão.** 94 `investigating` é o número honesto, e ele
  subiu 1 porque eu abri um defeito real.
- **Não consertei o `pagou_de_verdade.cjs`.** Declarado e provado, não feito.
- **Não consertei o `percepcao_travada.cjs`** (dívida da ronda anterior, §4 dela).
- **Não toquei no `#329`.** Os 41.600 cr seguem na mesa do Johnny.
- **Não li a caixa do suporte@ pra triagem** — li a pasta Sent, que é outra coisa
  (saber o que já foi dito ao aluno antes de escrever pra ele).
- **Não gastei GPU**, não toquei em crédito, acesso, voz nem migration.
- **Não mergeei nada.** O PR **#351** segue aberto.

## 6. Para quem pegar a próxima ronda

1. **A lição nº1 da ronda anterior funcionou de novo: ordene por ÚLTIMA NOTA.**
   O `#311` estava a 10 dias parado e não era o mais velho por criação. Duas
   rondas seguidas o cartão mais abandonado apareceu só nessa ordenação.
2. **Compra de aluno não é uma linha — confira se existe mais de uma.** O Hugo
   comprou 2x em 7 minutos e a casa tratou 1. Nenhuma das 3 cartas percebeu.
3. **`?buyer_email=` NÃO lista tudo (`#481`).** Se a pergunta envolve estorno,
   consulte **por transação** ou passe `transaction_status` explícito. Consulta
   por e-mail dizendo "1 compra" pode ser 1 de 4.
4. **Nosso `payment_events` também pode não ter o evento.** No caso do Hugo
   faltaram DOIS (a compra de R$ 252,45 e o estorno de R$ 597). Quando as duas
   fontes estão furadas no mesmo caso, só a consulta por transação salva.
5. **O `#311` está esperando DUAS coisas:** a decisão do Johnny sobre os
   R$ 252,45 e a resposta do Hugo. Se ele responder pedindo o estorno, isso não
   autoriza ninguém a estornar — continua sendo decisão de dinheiro.
6. **O conserto do `#481` está pronto pra escrever** e tem teste óbvio (os 17
   estornos conhecidos viram fixture: hoje 0 aparecem, depois do conserto os 17
   têm que aparecer).

## 7. Fim de ronda — passo fixo conferido

Conferência registrada em §8 do commit desta ronda (`git log origin/main..HEAD`
vazio e nenhuma branch com commit preso). **Esta ronda não produziu código**: as
entregas foram 3 escritas no banco (2 notas no `#311` + o `#481`, todas conferidas
na releitura com 1 linha afetada), 1 carta ao aluno com cópia confirmada na pasta,
e este arquivo.
