# Cancelamentos de 24/08 — apuração

Rodado em 25/08 pela rotina diária de cancelamentos.
Ferramenta: `_frank/ferramentas/cancelamentos_ontem.cjs` (somente leitura).

```
node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-24
```

Janela: `2026-08-24T00:00:00Z` → `2026-08-25T00:00:00Z`.
11 eventos `SUBSCRIPTION_CANCELLATION` → **11 pessoas** (nenhum e-mail repetido).

Classificação feita contra a **Hotmart viva**, por **pessoa** (e-mail), lendo
TODAS as assinaturas de cada uma. Critério de "pagou": `price.value > 0` **E**
`status ∈ {COMPLETE, APPROVED}` — `OVERDUE` não é pagamento (armadilha 1).

**Armadilha 2 conferida:** nenhuma das 11 tem outra assinatura viva
(`ACTIVE`/`STARTED`/`DELAYED`). Dois casos tinham várias assinaturas —
`contato@lucianapepino.com.br` (2) e `paulovasconste@gmail.com` (6) — todas
`INACTIVE`/`CANCELLED`. Nenhuma delas salva a pessoa.

Nada foi alterado. Nenhum saldo tocado, nenhuma função religada.

---

## 1. FORA DA REGRA — o crédito de trial continua não expirando

**Causa única, já conhecida:** `expire_trial_credits` está **DESATIVADA desde
18/08**. Corpo vivo lido agora (`pg_get_functiondef`, não é suposição):

```
DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas
que PAGARAM (conferido na Hotmart, 6 de 6 na amostra).
```

Ela foi desligada por um motivo certo. O problema é que ninguém religou, e o
outro lado da regra parou junto. **Sétimo dia consecutivo.**

### 1a. Já vazou — passaram do dia 10 e ainda têm o crédito

| pessoa | adesão | dia 10 | crédito parado |
|---|---|---|---|
| juliana.caran@hotmail.com | 04/08 | **14/08** | 100.000 |
| paulovasconste@gmail.com | 08/08 | **18/08** | 98.425 |

**Subtotal: 198.425 créditos.**

Conferido que não é a armadilha do Stripe (o caso `martinmendezagiluilar7` de
19/08, trial na Hotmart que comprou crédito por fora). O extrato das duas em
`credit_transactions` só tem `subscription_grant | payment_event`
("recarga do ciclo"), nenhuma compra avulsa:

```
juliana.caran     04/08 +100000 subscription_grant/payment_event "recarga do ciclo"
paulovasconste    08/08 +100000 subscription_grant/payment_event "recarga do ciclo"
                  08/08  -525 / -525 / -525  image_generation   (consumo normal)
```

Na Hotmart as duas têm `rec#1 R$0` e `rec#2 R$97 OVERDUE` — cobrança emitida e
**nunca paga**. São trial, sem dúvida.

### 1b. Vai vazar — ainda no prazo, mas não existe máquina pra cumprir o prazo

| pessoa | adesão | dia 10 | crédito |
|---|---|---|---|
| diretoria@grupoperes.com.br | 18/08 | 28/08 | 10.330 |
| pc.sul157@gmail.com | 19/08 | 29/08 | 65.573 |
| ricardobarbosavicente@gmail.com | 22/08 | 01/09 | 64.622 |
| contato@lucianapepino.com.br | 23/08 | 02/09 | 100.000 |

**Subtotal: 240.525 créditos.** O primeiro vence em 3 dias.

> Este bloco existe por causa da lição de 24/08: relatório que só olha o prazo,
> e nunca a máquina que cumpre o prazo, imprime "tudo certo" enquanto o crédito
> vaza. Estas 4 estão dentro do prazo **e** condenadas.

**Total parado pela varredura desligada: 438.950 créditos, 6 pessoas.**
`credits_extra` (525 + 1.050 + 1.320) não entra na conta — a regra nunca toca
nesse saldo, e está correto que não tenha tocado.

---

## 2. FORA DA REGRA (menor) — cancelou na Hotmart e não existe conta aqui

| pessoa | adesão | cancelou |
|---|---|---|
| danisostisso93@gmail.com | 24/08 | 24/08 (mesmo dia) |
| math.sg97@gmail.com | 20/08 | 24/08 |

Nenhum crédito em jogo (sem perfil, sem saldo). Fica registrado porque é sinal
de **onboarding que não completou**: a pessoa comprou na Hotmart e nunca chegou
a existir na plataforma. Vale ver se é o mesmo padrão do playbook I.

**Zero conferido, não presumido** (armadilha 3). Busca exata e por semelhança
voltaram vazio, com controle positivo na mesma consulta:

```json
{"total_perfis":1510,"com_gmail":1165,"dani":0,"math":0,"controle_positivo":1}
```

`controle_positivo` = `paulovasconste@gmail.com`, que existe e retornou 1. A
consulta funciona; o vazio é real.

---

## 3. Os 3 assinantes — regra 9 cumprida, inclusive o acesso

| pessoa | ficou | crédito | acesso até | zeramentos por rotina |
|---|---|---|---|---|
| leandropangaio10@gmail.com | 32 d | 100.000 | 24/09 | **0** |
| joaoreispersonaltrainer@gmail.com | 9 d | 197.555 | 15/09 | **0** |
| maralage.adm@gmail.com | 8 d | 200.000 | 16/09 | **0** |

Os três pagaram de verdade:

```
leandropangaio10   rec#1 R$97 COMPLETE 24/07 | rec#2 R$97 OVERDUE (não conta)
joaoreis           rec#1 R$0  COMPLETE 15/08 | rec#2 R$97 APPROVED 22/08
maralage.adm       rec#1 R$0  COMPLETE 16/08 | rec#2 R$97 APPROVED 23/08
```

Os dois últimos são o caso "trial que virou pagante": `rec#1` zerado é o
período de teste, `rec#2 R$97 APPROVED` é a venda. Classificar por `rec#1`
faria os dois virarem trial e perderem 397.555 créditos que são deles.

**Item 1 do relatório de 20/08 está resolvido.** Naquele dia os assinantes que
cancelavam mantinham o saldo mas perdiam o acesso na hora
(`profiles.access_until` ia pra `NULL`). Os três de ontem estão com data futura.
A correção está no código, em `frontend/src/lib/payments/entitlements.ts:151`:

```ts
const valeAcesso = (e: { status: string; access_until: string | null }) => {
  if (e.status === "active") return e.access_until === null || e.access_until > nowIso;
  if (e.status === "canceled") return e.access_until !== null && e.access_until > nowIso;
```

Não é preciso reabrir.

---

## O que não foi feito, de propósito

- Nenhum saldo alterado, nenhuma função religada (regra 9-A: detector propõe,
  não executa).
- Religar a `expire_trial_credits` continua dependendo de consertar a detecção
  de "pagou" dentro dela — foi isso que zerou 14 pagantes em 18/08. Enquanto
  estiver desligada o custo é vazamento, não prejuízo pro aluno; nessa ordem é
  o lado certo pra errar. Mas já são 7 dias e a conta cresce todo dia.
