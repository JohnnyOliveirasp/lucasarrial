# Trancadas hoje × histórico de pagamento — 2026-08-20

**Pergunta única do card:** das pessoas TRANCADAS hoje, quantas já tiveram
pagamento APROVADO alguma vez?

## RESPOSTA

**Das 55 pessoas trancadas hoje, 8 já tiveram pagamento aprovado** (cobrança
com `price.value > 0` e status COMPLETE/APPROVED na Hotmart). 47 nunca
pagaram nada além do trial R$0. **0 sem prova** — o histórico de compras da
Hotmart veio completo para todas as 55.

⚠️ **DIVERGÊNCIA do enunciado:** o card falava em "47 trancadas"; o número
real medido às 14:26 UTC de 20/08 é **55**. Não forcei pra bater.
Coincidência que merece registro: 47 é exatamente o subgrupo "trancadas que
NUNCA pagaram" — é provável que o 47 do enunciado tenha vindo de uma contagem
que já excluía os 8 pagantes, mas isso é hipótese, não fato medido.

## Como foi medido

1. `node _frank/ferramentas/pagante_trancado.cjs` (ferramenta oficial) —
   confirma o lote do dia: 55 suspeitos, **0 pagante trancado indevidamente**,
   0 fronteira, 0 sem prova (23 cancelaram · 26 inadimplentes · 6 trial).
2. A oficial só consulta `/purchases` de assinatura ACTIVE (a pergunta dela é
   "pagou E está trancado por bug"). A pergunta do card é sobre **histórico**,
   então o variante leitura-pura `2026-08-20_pagante_trancado_historico.cjs`
   (nesta mesma pasta) consulta `GET /subscriptions/{code}/purchases` para
   **todas** as 55 — canceladas e inadimplentes incluídas — por PESSOA
   (todos os subscriber codes de cada uma, com fallback de busca por
   `subscriber_email` se faltasse code; não foi preciso para nenhuma).
3. Critério de "pagou": cobrança `price.value > 0` **e** status
   COMPLETE/APPROVED. OVERDUE com valor > 0 NÃO conta (armadilha de 18/08:
   a Hotmart deixa mensalidade OVERDUE pra quem nunca pagou).
4. **Leitura pura**: nenhum destrave, nenhum saldo/entitlement alterado,
   nenhuma migration. Só `select` no Supabase e GET na Hotmart.

## As 8 que já pagaram (e por que estão trancadas mesmo assim)

Todas as 8 têm o mesmo padrão: trial R$0 → **pagaram a recorrência #2
(R$97 COMPLETE)** → recorrência #3 ficou OVERDUE → acesso venceu. São
**inadimplentes de verdade**, não vítimas de bug — a ferramenta oficial
confirma 0 pagantes trancados indevidamente. Trancar está certo pela regra
de 13/08 (sem assinatura em dia = trancado; regra dura 9 mantém acesso de
cancelado só enquanto `access_until` está no futuro, e o delas já venceu).

| e-mail | pagou? | prova (transação) |
|---|---|---|
| beatrizsrl021@gmail.com | SIM | XQ55UVIL rec#2 R$97 COMPLETE tx=HP2754290965 em 2026-07-20 |
| dinicleia.nascimento93@gmail.com | SIM | O79MCQT4 rec#2 R$97 COMPLETE tx=HP0686640509 em 2026-07-26 |
| erwintst@gmail.com | SIM | 82O60D4N rec#2 R$97 COMPLETE tx=HP3248282838 em 2026-07-25 |
| lelequisdias@gmail.com | SIM | GNMOTJE6 rec#2 R$97 COMPLETE tx=HP1568696834 em 2026-07-17 |
| maciel10anjos@gmail.com | SIM | Q598BW58 rec#2 R$97 COMPLETE tx=HP2185836762 em 2026-07-27 |
| renildoe@yahoo.com.br | SIM | MBRGY4O0 rec#2 R$97 COMPLETE tx=HP0343657981 em 2026-07-16 |
| talineschneider@gmail.com | SIM | D6S4QS7Z rec#2 R$97 COMPLETE tx=HP1644526305 em 2026-07-17 |
| zecunha@hotmail.com | SIM | AN0379Z6 rec#2 R$97 COMPLETE tx=HP0694136272 em 2026-07-26 |

## As 47 que nunca pagaram

Lista completa com extrato por pessoa na saída crua abaixo (seção ❌).
Padrões: só trial R$0 COMPLETE/APPROVED, com #2/#3 em OVERDUE ou
WAITING_PAYMENT quando existem.

**Nota sobre `lucas.m.arrial@gmail.com`** (aparece nas 47): é o Lucas, sócio.
A conta dele tem `bypassesBilling` no app — o estado "trancado" dessa linha é
decorativo, ele nunca perde acesso e não deve entrar em conta de pagante,
churn ou destrave. Fica na lista só porque o critério mecânico
(saldo > 0 + access_until vencido) o captura.

## Relevância pra decisão (Johnny viaja dia 24)

- **Ninguém que pagou está trancado por erro nosso** (0 na ferramenta oficial).
- Das trancadas, só **8/55 (15%)** algum dia puseram dinheiro; as outras 47
  são trial que nunca converteu.
- Se a decisão em jogo é a regra do trial (zerar `credits_subscription` de
  trial não-convertido em 10 dias, spec de 18/08), as 8 pagantes estão FORA
  do alcance dela por definição — pagaram ao menos uma mensalidade.

## Saída crua — ferramenta oficial (`pagante_trancado.cjs`)

```
suspeitos no nosso banco (a conta antiga, a que mente): 55
conferindo cada um na Hotmart…


────────────────────────────────────────────────────────────────
🔴 PAGANTE TRANCADO — pagou de verdade e está sem acesso: 0
────────────────────────────────────────────────────────────────
  (nenhum — ninguém que pagou está trancado)

────────────────────────────────────────────────────────────────
🟡 NA FRONTEIRA — venceu na virada das 12:00 (recheque em algumas horas): 0
────────────────────────────────────────────────────────────────

────────────────────────────────────────────────────────────────
⚪ TRANCAR ESTÁ CERTO (ordem do Johnny 13/08: sem assinatura = trancado)
────────────────────────────────────────────────────────────────
  23 cancelaram · 26 inadimplentes · 6 trial que nunca virou pagamento

>>> NÚMERO PRO RELATÓRIO: 0 pagante(s) trancado(s) · 0 na fronteira · 0 sem prova
```

## Saída crua — variante histórico (`2026-08-20_pagante_trancado_historico.cjs`)

```
TRANCADAS HOJE (saldo > 0 e access_until vencido/ausente): 55 perfis = 55 pessoas
data da medição: 2026-08-20T14:26:59.964Z


──────────────────────────────────────────────────────────────────────
✅ JÁ PAGOU ALGUMA VEZ (cobrança APPROVED/COMPLETE com valor > 0): 8
──────────────────────────────────────────────────────────────────────
  beatrizsrl021@gmail.com | saldo 100000 | PROVA: XQ55UVIL rec#2 R$97 COMPLETE tx=HP2754290965 em 2026-07-20
     extrato: XQ55UVIL: #1 R$0 COMPLETE · #2 R$97 COMPLETE · #3 R$97 OVERDUE · #3 R$97 OVERDUE
  dinicleia.nascimento93@gmail.com | saldo 100000 | PROVA: O79MCQT4 rec#2 R$97 COMPLETE tx=HP0686640509 em 2026-07-26
     extrato: O79MCQT4: #1 R$0 COMPLETE · #2 R$97 COMPLETE · #3 R$97 OVERDUE
  erwintst@gmail.com | saldo 26323 | PROVA: 82O60D4N rec#2 R$97 COMPLETE tx=HP3248282838 em 2026-07-25
     extrato: 82O60D4N: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #2 R$97 COMPLETE · #3 R$97 OVERDUE
  lelequisdias@gmail.com | saldo 76058 | PROVA: GNMOTJE6 rec#2 R$97 COMPLETE tx=HP1568696834 em 2026-07-17
     extrato: GNMOTJE6: #1 R$0 COMPLETE · #2 R$97 COMPLETE · #3 R$97 OVERDUE · #3 R$97 OVERDUE · #3 R$97 OVERDUE · #3 R$97 OVERDUE · #3 R$97 OVERDUE
  maciel10anjos@gmail.com | saldo 100000 | PROVA: Q598BW58 rec#2 R$97 COMPLETE tx=HP2185836762 em 2026-07-27
     extrato: Q598BW58: #1 R$0 COMPLETE · #2 R$97 COMPLETE · #3 R$97 OVERDUE
  renildoe@yahoo.com.br | saldo 115 | PROVA: MBRGY4O0 rec#2 R$97 COMPLETE tx=HP0343657981 em 2026-07-16
     extrato: MBRGY4O0: #1 R$0 COMPLETE · #2 R$97 COMPLETE · #3 R$97 OVERDUE · #3 R$97 OVERDUE · #3 R$97 PRINTED_BILLET
  talineschneider@gmail.com | saldo 6808 | PROVA: D6S4QS7Z rec#2 R$97 COMPLETE tx=HP1644526305 em 2026-07-17
     extrato: D6S4QS7Z: #1 R$0 COMPLETE · #2 R$97 COMPLETE · #3 R$97 OVERDUE
  zecunha@hotmail.com | saldo 100000 | PROVA: AN0379Z6 rec#2 R$97 COMPLETE tx=HP0694136272 em 2026-07-26
     extrato: AN0379Z6: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #2 R$97 COMPLETE · #3 R$97 OVERDUE

──────────────────────────────────────────────────────────────────────
❌ NUNCA PAGOU (só trial R$0 / OVERDUE sem aprovação): 47
──────────────────────────────────────────────────────────────────────
  acarpegiani@gmail.com | saldo 7570
     extrato: 3ON7VM8N: #1 R$0 COMPLETE
  appseguropt@gmail.com | saldo 91045
     extrato: W9IKCKXQ: #1 R$0 APPROVED · #2 R$97 OVERDUE
  atendimento@clinicadrpepe.com | saldo 89075
     extrato: VI1QMPNR: #1 R$0 APPROVED · #2 R$97 WAITING_PAYMENT
  azevedoadvogadocriminalista@gmail.com | saldo 89600
     extrato: Y2GHU69O: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  casatumca@gmail.com | saldo 140000
     extrato: 0AI2RSRG: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #2 R$97 OVERDUE
  charlesangio@hotmail.com | saldo 100000
     extrato: LKBJABNY: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  clinicanutrisecrets@gmail.com | saldo 100000
     extrato: C1XGBTXV: #1 R$0 COMPLETE · #2 R$97 OVERDUE
  cristianotenorio.br@gmail.com | saldo 1050
     extrato: K5HNKP08: #1 R$0 COMPLETE
  daniela.oliveira.bertoli@gmail.com | saldo 37822
     extrato: DOJE9V5W: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  ddfleury@gmail.com | saldo 343468
     extrato: PH7Z9BTJ: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  diaslopesalice@gmail.com | saldo 50000
     extrato: GN9Y8A2N: #1 R$0 COMPLETE
  diegoavilapereira@gmail.com | saldo 12580
     extrato: JJY1BYOH: #1 R$0 COMPLETE
  edersolucaoid@gmail.com | saldo 100000
     extrato: PKPQR1SA: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #2 R$97 OVERDUE · #2 R$97 OVERDUE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  edsbasico@gmail.com | saldo 67039
     extrato: 3J8R9S41: #1 R$0 COMPLETE
  erciliaadv8@gmail.com | saldo 100000
     extrato: OGUMPD0C: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 WAITING_PAYMENT
  ericabiolcati@gmail.com | saldo 10000
     extrato: YV2T28DN: #1 R$0 COMPLETE
  felipe.vendas10@gmail.com | saldo 2640
     extrato: 210XWXBU: #1 R$0 COMPLETE
  fernao82@gmail.com | saldo 2895
     extrato: J322I46B: #1 R$0 COMPLETE
  fyzicalharkerheights@gmail.com | saldo 6630
     extrato: UIW913LG: #1 R$0 COMPLETE
  gercy301@gmail.com | saldo 29392
     extrato: 55X0E5FG: #1 R$0 COMPLETE · #2 R$20 OVERDUE · #2 R$20 OVERDUE · #2 R$20 OVERDUE · #3 R$20 OVERDUE · #3 R$20 OVERDUE · #3 R$20 OVERDUE
  guilhermeactg@gmail.com | saldo 8330
     extrato: CFL0XXXG: #1 R$0 COMPLETE
  itabenke@gmail.com | saldo 100012
     extrato: 9UA497W0: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  jemaaz@gmail.com | saldo 100000
     extrato: EBIYV1FQ: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  jphaakmiranda@gmail.com | saldo 525
     extrato: 1YVUY0Z3: #1 R$0 COMPLETE
  jrsolucoescorporativas@gmail.com | saldo 100000
     extrato: PZLWXK0K: #1 R$0 APPROVED · #2 R$97 WAITING_PAYMENT
  juniorbastos6@gmail.com | saldo 1050
     extrato: CWFAXHYB: #1 R$0 COMPLETE
  karabachiang@gmail.com | saldo 60923
     extrato: UI88ZD0W: #1 R$0 APPROVED · #2 R$97 WAITING_PAYMENT
  lauriane20@gmail.com | saldo 33130
     extrato: H6GLOFBO: #1 R$0 COMPLETE
  leilapatricia.freitas@gmail.com | saldo 67620
     extrato: RMRHA17C: #1 R$0 COMPLETE
  lhszotka@hotmail.com | saldo 29146
     extrato: 0DT0A4WC: #1 R$0 COMPLETE
  lineucastilho22@gmail.com | saldo 100000
     extrato: AP3ZGQMC: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #2 R$97 OVERDUE · #3 R$97 OVERDUE · #3 R$97 OVERDUE
  lucas.m.arrial@gmail.com | saldo 100000
     extrato: R1FPUKA3: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  mcengel1984@gmail.com | saldo 81018
     extrato: J6S8Z00C: #1 R$0 APPROVED · #2 R$97 WAITING_PAYMENT
  michelgarciantunes1981@gmail.com | saldo 18870
     extrato: QEAFFDWZ: #1 R$0 COMPLETE
  moises.cib1@gmail.com | saldo 525
     extrato: 61LYWONR: #1 R$0 COMPLETE
  monalizafita@gmail.com | saldo 3960
     extrato: 4G11D113: #1 R$0 COMPLETE
  nutrimanumartins@gmail.com | saldo 89600
     extrato: JDAIYO25: #1 R$0 APPROVED · #2 R$97 WAITING_PAYMENT
  pedrovale2v2@gmail.com | saldo 100000
     extrato: A7XKDFIR: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  renildoephb@gmail.com | saldo 95905
     extrato: JKBNPPDH: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  sdelmassa72@gmail.com | saldo 58525
     extrato: 8DE6KR1Q: #1 R$0 COMPLETE
  tatyalvesdubai@gmail.com | saldo 100000
     extrato: 5FPNKST3: #1 R$0 COMPLETE · #2 R$97 OVERDUE · #3 R$97 OVERDUE
  tikomuscl@gmail.com | saldo 71574
     extrato: S3IRQIHJ: #1 R$0 COMPLETE · #2 R$97 OVERDUE
  treinadorfn@gmail.com | saldo 95275
     extrato: 3LFEPM8W: #1 R$0 APPROVED · #2 R$97 WAITING_PAYMENT
  viniciushbsilva@gmail.com | saldo 1320
     extrato: II4N9P14: #1 R$0 COMPLETE
  viniciusjac@icloud.com | saldo 25915
     extrato: FIYBKK57: #1 R$0 COMPLETE
  warleysantosfranca@gmail.com | saldo 60555
     extrato: E03X9LF2: #1 R$0 COMPLETE · #2 R$97 OVERDUE
  ybibrazil@gmail.com | saldo 91205
     extrato: UCU9G7ZA: #1 R$0 COMPLETE

>>> RESPOSTA: das 55 pessoas trancadas hoje, 8 já tiveram pagamento aprovado · 47 nunca pagaram · 0 sem prova
```
