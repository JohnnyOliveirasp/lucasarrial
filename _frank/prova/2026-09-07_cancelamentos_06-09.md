# Cancelamentos de 06/09 — conferência (rodada 07/09)

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-06`
Somente leitura. **Nenhum saldo foi tocado** (regra 9-A: quem age é a varredura,
sobre lista aprovada — nunca o relatório).

Janela UTC `2026-09-06T00:00:00Z -> 2026-09-07T00:00:00Z`.
4 eventos `SUBSCRIPTION_CANCELLATION` -> 4 pessoas. **4 trial, 0 assinantes.**

---

## 1. O achado que vem primeiro: a máquina do prazo está parada

`expire_trial_credits`: **DESATIVADA** desde 18/08 (corpo da função lido por
`pg_get_functiondef`, não por chamada à RPC — chamar executaria a varredura).
Motivo gravado no próprio corpo: *"a primeira rodada real zerou 14 pessoas"*
(incidente de 18/08, 1.356.554 cr, inclusive a conta do Lucas).

Consequência: a regra 9 diz que o crédito do trial que nunca pagou expira no dia
10 da adesão. **Não existe hoje máquina que cumpra esse prazo.**

Magnitude (`node _frank/ferramentas/backlog_trial.cjs`):

| | pessoas | créditos |
|---|---|---|
| já passaram do dia 10, crédito ainda lá | 77 | 5.819.425 |
| ainda no prazo, mas sem máquina pra cumprir | 23 | 1.814.355 |
| **total parado** | **100** | **7.633.780** |

⚠️ **Isto não é novidade de 06/09** — é o acúmulo desde 18/08, e o desligamento
foi deliberado. Está inclusive **de acordo com a regra 9-A** ("nada que mexe em
saldo de aluno executa sozinho"). O que falta não é religar a varredura no
automático: é a lista aprovada + passo de execução separado que a 9-A exige.
Registrado aqui como **processo**, não como chamado — ordem de 27/08, §2.

## 2. As 4 pessoas

### elmanumateosoto@gmail.com — Manuel Mateos Soto
TRIAL. Adesão 03/09 -> cancelou 06/09 = **3 dias**. Assinatura `CYABC3VN`
`CANCELLED_BY_SELLER` (trial). Única cobrança: `rec#1 R$0 APPROVED`.
Banco: 97.630 cr mensalidade, 0 extra, acesso até 10/09.
Dia 10 do trial = **13/09** (ainda vai chegar). Sem marcador em
`trial_credit_expirations`. Crédito **não vai expirar sozinho** (§1).

### andreviana07@gmail.com — André Viana
TRIAL. Adesão 06/09 -> cancelou 06/09 = **0 dias** (entrou e saiu no mesmo dia).
Assinatura `LCL5JZ82` `CANCELLED_BY_CUSTOMER` (trial). `rec#1 R$0 APPROVED`.
Banco: 100.000 cr mensalidade, 0 extra, acesso até 13/09.
Dia 10 = **16/09**. Mesmo caso do anterior.

### estudioelianeguedes@gmail.com — Eliane Guedes ⚠️ NÃO É TRIAL PURA
TRIAL na Hotmart. Adesão 19/08 -> cancelou 06/09 = **18 dias**.
Assinatura `JV2V75KC` `CANCELLED_BY_CUSTOMER` (trial).
Cobranças: `rec#1 R$0 COMPLETE` (19/08) e `rec#2 R$97 **OVERDUE**`.

⚠️ **Armadilha 1 aplicada corretamente:** a `rec#2` de R$97 existe mas está
OVERDUE — a Hotmart emite a mensalidade de quem nunca pagou. Filtrar só por
`price.value > 0` a transformaria em "pagante". Ela **não pagou a assinatura**.

⚠️ **MAS ela pagou dinheiro à plataforma por outro caminho.** Origem do saldo
(`credit_transactions`, lançamentos positivos):

```
2026-08-19T13:23  +100000  subscription_grant  payment_event    recarga do ciclo
2026-08-19T18:53     +414  extra_purchase      generation_refund pacote avulso
2026-08-19T23:22  +120000  extra_purchase      stripe_session    pacote avulso
```

O lançamento de 23:22 é **compra de pacote via Stripe** — dinheiro de verdade.
Pela regra 9 ("crédito PAGO é da pessoa"; bônus/cortesia/estorno não contam, mas
**compra conta**), os **120.414 cr extra são dela e ninguém encosta** — e
`credits_extra` nunca é tocado por nenhuma das três regras, de qualquer forma.
Sobraram **1.861 cr** do grant de trial (consumiu 98.139).
**Não tratar como "trial que saiu"**: é cliente pagante que largou a assinatura.

### sidney@grupomacs.com.br — SIDNEY SILVA DIAS
TRIAL. Adesão 04/09 -> cancelou 06/09 = **2 dias**. Assinatura `PMANE2X7`
`CANCELLED_BY_SELLER` (trial). `rec#1 R$0 APPROVED`.
Banco: **sem conta** na plataforma.

⚠️ **Armadilha do #222 conferida** ("sem conta" por e-mail IGUAL não é prova —
a pessoa pode ter conta com outro e-mail). Busquei por nome e domínio, não só
por e-mail:

- `sidney` -> 2 contas, **outras pessoas**: Sidney Neves Ribeiro dos Santos
  (`sidneyribeiroevolution@`) e Sidney Santos (`sidneysantos100@`). O nosso é
  SIDNEY **SILVA DIAS**.
- `macs` (domínio) -> 0 contas.
- `dias` -> 10 contas, nenhuma com este nome/e-mail.
- Contraprova de que a consulta funciona: `profiles` responde e tem **2.303**
  contas (regra: consulta que erra volta vazia).

Conclusão: assinou o trial e **nunca criou conta**. Nenhum crédito em risco.

## 3. Regra 9 — houve violação?

**Não, no que mais importa: nenhum pagante teve crédito zerado.**

| checagem | resultado |
|---|---|
| ASSINANTE que cancelou com saldo zerado por rotina | **0 casos** (não houve assinante ontem) |
| ESTORNO/chargeback que o webhook não zerou | **0 casos** (nenhum estorno ontem) |
| TRIAL passado do dia 10 ainda com crédito | 1 (Eliane) — mas é pagante via Stripe, ver §2 |
| TRIAL no prazo sem máquina pra cumprir o prazo | 2 (Manuel, André) — ver §1 |

O único item estrutural é o §1, e ele é conhecido, deliberado e coberto pela 9-A.

## 4. O que NÃO foi feito, de propósito

- Não zerei crédito de ninguém (9-A: retirar crédito é sempre decisão do Johnny).
- Não chamei a RPC `expire_trial_credits` (chamar = executar sobre gente real).
- Não abri chamado: §1 é **processo**, e a ordem de 27/08 manda processo pro
  relatório + Telegram, não pra fila de incidentes.
