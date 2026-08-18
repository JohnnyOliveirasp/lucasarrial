# A FastCloner tem problema de churn? — 18/08/2026

Análise **somente-leitura**. Nenhuma escrita, nenhuma migration.
Fonte: `payment_events` (3.247 eventos), `entitlements` (750), `profiles` (1.239).
Scripts em `frontend/_Bugs/2026-08-18-churn-analise/` — **essa pasta é gitignorada
(`.gitignore:87`)**, então o código que produziu cada número está colado ABAIXO,
dentro deste arquivo, pra poder ser auditado sem re-executar nada.

---

## 0. A prova que o gerente pediu: o filtro de pagamento

A lição de hoje (devolução indevida de 1.356.554 créditos a 14 não-pagantes) foi
causada por ler **valor** e não **status**. Então aqui todo número-chave foi
calculado **duas vezes**:

| | definição |
|---|---|
| **FRACO** | `event_type IN ('PURCHASE_APPROVED','PURCHASE_COMPLETE') AND price.value > 0` |
| **FORTE** | o FRACO **e mais** `payload.data.purchase.status IN ('APPROVED','COMPLETE','COMPLETED')` |

### Primeiro achado: o vocabulário do banco não é o que eu supus

O status de conclusão neste banco é **`COMPLETED`**, não `COMPLETE`. Minha
primeira versão da auditoria usou `['APPROVED','COMPLETE']` e acusou **211
"divergências"** que eram falso alarme — todas `PURCHASE_COMPLETE` →
`status=COMPLETED`. Corrigido o vocabulário, o cruzamento real é:

```
=== CRUZAMENTO event_type x payload.data.purchase.status (produto 7851642) ===
  1037 PURCHASE_APPROVED        ->  status=APPROVED
   743 PURCHASE_COMPLETE        ->  status=COMPLETED
   257 PURCHASE_DELAYED         ->  status=DELAYED
   207 PURCHASE_BILLET_PRINTED  ->  status=BILLET_PRINTED
    97 PURCHASE_CANCELED        ->  status=CANCELED
     7 PURCHASE_PROTEST         ->  status=DISPUTE
     5 PURCHASE_REFUNDED        ->  status=REFUNDED
     2 ORDER_FULFILLMENT        ->  status=APPROVED
     1 PURCHASE_EXPIRED         ->  status=EXPIRED
     1 PURCHASE_CHARGEBACK      ->  status=CHARGEBACK
eventos de compra SEM o campo purchase.status: 0
```

**`event_type` e `purchase.status` são 1-para-1 nesta tabela.** Não existe um só
evento `PURCHASE_APPROVED` carregando status de não-pagamento. `OVERDUE` não
aparece em lugar nenhum do webhook — o equivalente aqui é `PURCHASE_DELAYED`
(257 eventos), que **nunca esteve na lista de pagamento**.

### Resultado do teste FRACO vs FORTE

```
############ 1. DENOMINADOR — PAGANTES ############
assinantes FastCloner distintos ..................: 836
com >=1 pagamento (FRACO, so tipo+valor) .........: 294
com >=1 pagamento (FORTE, tipo+valor+status) .....: 294
PAGANTES ATIVOS HOJE (FRACO) .....................: 267
PAGANTES ATIVOS HOJE (FORTE) .....................: 267
assinantes cuja contagem de pagamentos MUDA com o status: 0 []
em trial vivo hoje (<=10d, sem pagar, sem cancelar): 148

############ 2. CONVERSAO DE TRIAL POR MEIO (coorte madura >=12d) ############
-- FRACO -- total 216/458 = 47.2%
   CREDIT_CARD    trials  308 | pagaram 184 =  60% | cancelaram 92 | cobranca falhou 32
   PIX            trials  144 | pagaram  28 =  19% | cancelaram 26 | cobranca falhou 90
   PAYPAL         trials    4 | pagaram   2 =  50% | cancelaram 2 | cobranca falhou 0
   APPLE_PAY      trials    2 | pagaram   2 = 100% | cancelaram 0 | cobranca falhou 0
-- FORTE -- total 216/458 = 47.2%
   CREDIT_CARD    trials  308 | pagaram 184 =  60% | cancelaram 92 | cobranca falhou 32
   PIX            trials  144 | pagaram  28 =  19% | cancelaram 26 | cobranca falhou 90
   PAYPAL         trials    4 | pagaram   2 =  50% | cancelaram 2 | cobranca falhou 0
   APPLE_PAY      trials    2 | pagaram   2 = 100% | cancelaram 0 | cobranca falhou 0
```

**Os dois filtros dão exatamente o mesmo resultado. Zero assinantes mudam de
lado.** Os 267 pagantes, os 47,2% de conversão e os números de PIX **não**
reproduzem o bug de classificação — mas isso agora está provado, não suposto.

### O código exato de (a) denominador, (b) conversão por meio, (c) churn de agosto

Os três números saem do mesmo script, `11_final_com_status.cjs`. Não é SQL: o
acesso é via cliente Supabase e o filtro vive em JavaScript sobre o JSON do
webhook, porque `purchase.status` é um campo **dentro do payload**, não uma
coluna. Cláusula de filtro, literal:

```js
const PRODUTO    = "7851642";                                  // FastCloner
const TIPO_PAGO  = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"];
const STATUS_PAGO= ["APPROVED", "COMPLETE", "COMPLETED"];      // vocabulario REAL do banco

// (a) o que conta como PAGAMENTO — deduplicado por transacao
const pagamentos = (evs, forte) => {
  const m = new Map();
  for (const e of evs) {
    if (!TIPO_PAGO.includes(e.type)) continue;                 // <- event_type
    if (!(e.value > 0)) continue;                              // <- price.value
    if (forte && !STATUS_PAGO.includes(e.status)) continue;    // <- purchase.status  ***
    if (!e.tx) continue;
    const t = e.order || e.at;
    if (!m.has(e.tx) || t < m.get(e.tx).t) m.set(e.tx, { t, value: e.value, rec: e.rec });
  }
  return [...m.values()].sort((a, b) => a.t - b.t);
};

// filtro de produto aplicado na leitura dos eventos:
//   const pid = String(d.product?.id || "");
//   if (pid && pid !== PRODUTO) continue;
// chave do assinante (a unica presente em TODOS os eventos):
//   d.subscription?.subscriber?.code || d.subscriber?.code

// (a) DENOMINADOR: pagante ativo hoje
const ativos = rows => rows.filter(r =>
  r.pag.length > 0 &&                                   // tem pagamento FORTE
  r.cancel == null &&                                   // nao cancelou
  HOJE - r.pag[r.pag.length - 1].t <= 45*D);            // ultima cobranca <= 45 dias

// (b) CONVERSAO DE TRIAL POR MEIO
// trial = evento de pagamento com recorrencia 1 e valor 0 (mesmo criterio do painel)
const trial = evs.find(e => TIPO_PAGO.includes(e.type) && e.rec === 1 && e.value === 0);
const meio  = trial?.pay;                               // d.purchase.payment.type
const maduros = rows.filter(r => r.trial && HOJE - r.inicio >= 12*D);  // ja teve chance de virar
//   converteu  = r.pag.length > 0        (pagamento FORTE)
//   cancelou   = !pagou && r.cancel != null
//   falhou     = !pagou && !cancelou && teve DELAYED/CANCELED na recorrencia 2

// (c) CHURN MENSAL — base = quem JA era pagante no dia 1 e ainda estava vivo
const baseIni = forte.filter(r => r.pag.length > 0 && r.pag[0].t < a && (r.cancel == null || r.cancel >= a));
const saiu    = baseIni.filter(r => r.cancel != null && r.cancel < b);
const invol   = r => r.cancel != null &&
  falhasDe(r.code).some(t => t <= r.cancel + D && t >= r.cancel - 45*D);  // falha de cobranca perto da saida
// churn voluntario = saiu.filter(r => !invol(r)).length / baseIni.length
```

---

## 1. Denominador

| | |
|---|---|
| Assinantes FastCloner distintos (histórico) | **836** |
| Já pagaram ao menos 1 cobrança real | **294** |
| **Pagantes ativos hoje** | **267** |
| Em trial vivo hoje (≤10d, sem pagar, sem cancelar) | **148** |

### Correção de um número do relatório anterior: o MRR estava errado

O relatório anterior dizia **MRR 56.490**. Está **errado** — eu somei moedas
diferentes como se fossem uma só. Uma única assinatura em pesos argentinos
(32.499 ARS) representava 57% daquele total. O correto:

```
=== MRR POR MOEDA (ultima cobranca de cada pagante ativo) ===
  BRL    245 assinantes | soma 23573
  USD     11 assinantes | soma 232
  EUR      9 assinantes | soma 169
  ARS      1 assinantes | soma 32499
  CHF      1 assinantes | soma 17
  TOTAL de pagantes ativos: 267
```

**MRR real ≈ R$ 23.573/mês** (245 assinantes BRL) **+ ~US$232 + €169 + 32.499 ARS
+ 17 CHF.** Não converti para uma moeda só porque não tenho taxa de câmbio
confiável no banco — seria estimativa minha, não dado.

### Um registro de teste na base

`HP16015479281022`, R$1.500, `order_date` de **2017-11-27**, recebido em
09/06/2026 (o primeiro dia da tabela), **sem `product.id`** — é evento de teste
do webhook. Ele entra na contagem histórica de 294 mas **não** nos 267 ativos
(a data de 2017 o joga fora da janela de 45 dias). Impacto: 1 pessoa no número
histórico. Fica registrado.

### Cross-check: uma fonte que eu queria usar não existe

`profiles.ja_pagou` existe como coluna mas está **vazia nas 1.239 linhas** —
`ja_pagou=true: 0`. **Não serve de conferência.** Não usei, e digo que não usei
em vez de fingir que houve validação cruzada.

---

## 2 e 3. Churn mensal e série histórica

```
| Mes | Base pagante dia 1 | Saiu | Voluntario | Involuntario | Churn vol. | Churn total |
|---|---|---|---|---|---|---|
| 2026-05 | 1 | 0 | 0 | 0 | 0.0% | 0.0% |
| 2026-06 | 1 | 0 | 0 | 0 | 0.0% | 0.0% |
| 2026-07 | 5 | 0 | 0 | 0 | 0.0% | 0.0% |
| 2026-08 (1-18) | 102 | 11 | 11 | 0 | 10.8% | 10.8% |
```

**A série histórica de 6 meses pedida NÃO EXISTE.** O evento mais antigo em
`payment_events` é de **09/06/2026** e o primeiro pagamento real é do mesmo dia:
**2,3 meses de operação**. Maio, junho e julho têm base de 1 a 5 pessoas — os
"0,0%" ali não são saúde, são **ausência de gente para cancelar**. Só agosto tem
denominador com significado estatístico.

E agosto ainda não fechou:

```
base pagante em 01/08: 102 | saiu ate 18/08: 11 | churn parcial: 10.8%
ritmo diario: 0.61 saidas/dia -> projecao 31 dias: 18.9 saidas = 18.6% [PROJECAO]
```

> **[INFERÊNCIA]** os 18,6% assumem que o ritmo dos primeiros 18 dias continua
> igual. Não é um número medido. O número medido é **10,8% em 18 dias**.

Churn involuntário (cobrança falha) em agosto: **0** entre os que já eram
pagantes no dia 1. Os 4 casos "por cobrança" do relatório anterior são de gente
que entrou e saiu dentro do mesmo mês, ou seja, não estavam na base do dia 1.

---

## 4. Conversão de trial

**47,2% (216 de 458)** na coorte madura (trial iniciado há ≥12 dias, já teve
chance de virar cobrança). Isso é **bom** para trial sem cartão obrigatório.

Mas o agregado esconde o achado principal:

| Meio escolhido no trial | Trials | Viraram pagante | Conversão |
|---|---|---|---|
| CREDIT_CARD | 308 | 184 | **60%** |
| PIX | 144 | 28 | **19%** |
| PAYPAL | 4 | 2 | 50% |
| APPLE_PAY | 2 | 2 | 100% |

Dos 144 trials de PIX, **90 tiveram a cobrança falhar sem que a pessoa cancelasse**.
Ela não desistiu — a cobrança recorrente por PIX simplesmente não acontece
sozinha, e ninguém foi atrás.

**Sobre os 145 cancelamentos de trial em 30 dias:** com ~5-6 trials cancelados
por dia contra uma entrada que sustenta 148 trials vivos e 47,2% de conversão,
isso está **dentro do normal da operação**, não é anomalia. Cancelamento de
trial não é churn.

---

## 5. Sobrevivência: quantas cobranças pagaram antes de sair

```
   pagou 1x antes de cancelar: 22 pessoas
   pagou 2x antes de cancelar:  4 pessoas
   total de pagantes que ja cancelaram (historico inteiro): 26
   maior numero de cobrancas pagas por um unico assinante na base: 3

   cancelaram no MESMO DIA da 1a cobranca:  7 de 26
   cancelaram em ate 3 dias ..............: 12 de 26
   cancelaram em ate 10 dias .............: 20 de 26
```

**85% dos que saem, saem depois da PRIMEIRA cobrança. 27% cancelam no mesmo dia
em que foram cobrados.**

⚠️ **O "0% com 3+ cobranças" não é saúde.** Ninguém na base inteira pagou mais de
3 vezes — a operação tem 2,3 meses, então **não houve oportunidade** de existir
churn tardio. Não dá para dizer nada sobre esgotamento de valor com esses dados.
Só dá para dizer que o problema **começa** na primeira cobrança.

---

## 6. Achado colateral: 129 pessoas com acesso vivo sem nunca ter pago

```
=== ACESSO VIVO SEM PAGAMENTO, destrinchado ===
  ainda dentro da janela de trial (<=10 dias) ....: 162 (legitimo)
  JA PASSOU do trial e nunca pagou ...............: 129 <-- VAZAMENTO
  sem evento de assinatura correspondente ........: 0
  pagantes que cancelaram mas mantem acesso ......: 22 (correto pela regra 9)
```

São **574 entitlements ativos** com acesso no futuro, contra **267 pagantes**.
As **129** são exatamente o vazamento que a regra 9 do manual descreve como
urgente: passou do trial, nunca entrou dinheiro, continua gastando GPU. Não
mexi em nada — é leitura.

---

## VEREDITO

**Não dá para afirmar que a FastCloner tem problema de churn, porque a operação
não tem idade para medir churn. O que os dados mostram é um problema de
CONVERSÃO e de PRIMEIRA COBRANÇA — que é uma doença diferente e mais tratável.**

Contra o benchmark pedido (SaaS B2C: 3-5%/mês normal, >7% sangramento):
os **10,8% em 18 dias** de agosto ficam acima da faixa de sangramento. Mas eu
não trataria esse número como churn de verdade, por três razões:

1. **A base é nova.** 102 pagantes no dia 1, quase todos com 1 mês de casa. Uma
   coorte jovem sempre cancela mais que uma base madura — comparar isso com o
   benchmark de um SaaS estabelecido superestima o problema.
2. **Não é churn, é arrependimento de primeira cobrança.** 85% saem após a 1ª
   cobrança, 27% no mesmo dia. Isso é expectativa quebrada na virada do trial,
   não cliente que consumiu o produto e esgotou o valor.
3. **Um mês só não é tendência.** Não existe série para dizer se piora ou melhora.
   Com dois meses de dados a mais, a resposta muda.

O buraco maior não é quem sai — é quem **nunca entra**: 242 trials maduros não
converteram, e o PIX sozinho responde por 116 deles.

## As 2 alavancas de maior impacto

**1. Consertar a cobrança recorrente por PIX** — a maior e a mais barata.
144 trials de PIX, 90 com cobrança falhada sem cancelamento. PIX converte 19%
contra 60% do cartão.

> **[INFERÊNCIA]** o cálculo abaixo assume que quem escolhe PIX tem a mesma
> intenção de compra de quem escolhe cartão. Isso **não é verificável no banco** —
> é possível que PIX atraia um público mais frio. Trate como teto, não como
> previsão.
>
> - PIX a 40% (metade do caminho até o cartão): +30 clientes ≈ **+R$2.910/mês**
> - PIX a 60% (igual ao cartão): +58 clientes ≈ **+R$5.626/mês**
>
> Referência: MRR BRL atual é R$23.573/mês. Mesmo o cenário conservador é **+12%**.

Ação concreta: cobrança de PIX não se renova sozinha. Ou manda lembrete com link
antes do vencimento, ou empurra cartão no checkout, ou avisa o aluno de que o PIX
exige ação dele. Hoje ninguém avisa e 90 pessoas caíram nesse buraco.

**2. Atacar a virada do trial para a 1ª cobrança.**
7 de 26 cancelam no mesmo dia da cobrança, 12 em até 3 dias. Não é o produto que
decepcionou em 30 dias — é a cobrança que chegou como surpresa. Aviso claro 48h
antes ("sua assinatura vai renovar em R$97 no dia X"), com o que a pessoa já
produziu na plataforma, ataca exatamente esses 12.

> Se metade dos que saem em ≤3 dias ficasse, seriam ~6 clientes/mês ≈ **+R$582/mês**
> recorrentes e crescentes. Impacto financeiro menor que o PIX, mas o custo de
> implementar é quase zero e o efeito é permanente.
> **[INFERÊNCIA]** a taxa de recuperação de 50% é suposição minha; não existe
> teste anterior na base para calibrá-la.

**Fora do escopo da pergunta, mas maior que as duas:** as **129 pessoas com acesso
liberado sem nunca ter pago** são perda de GPU hoje, não amanhã. É o item de maior
retorno imediato dos três, e já está mapeado na regra 9 do manual.

---

## O que eu NÃO consegui responder

- **Série de 6 meses:** não existe. O banco começa em 09/06/2026.
- **Churn tardio (3+ cobranças):** não existe amostra. Ninguém pagou mais de 3x.
- **Motivo declarado do cancelamento:** não existe campo no webhook da Hotmart
  (já registrado no card anterior). Está no painel da Hotmart, não no nosso banco.
- **MRR em moeda única:** não converti, não tenho câmbio confiável no banco.
- **Validação cruzada por `profiles.ja_pagou`:** a coluna está vazia (0 de 1.239).
