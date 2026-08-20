# Cancelamentos de 19/08 — apuração e as duas coisas fora da regra

Rodado em 20/08 pela rotina diária de cancelamentos.
Ferramenta: `_frank/ferramentas/cancelamentos_ontem.cjs` (somente leitura).

```
node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-19
```

Janela: `2026-08-19T00:00:00Z` → `2026-08-20T00:00:00Z`.
9 eventos `SUBSCRIPTION_CANCELLATION` → **9 pessoas** (nenhum e-mail repetido).

Classificação feita contra a **Hotmart viva**, não contra o nosso banco, e por
**pessoa** (e-mail), lendo TODAS as assinaturas de cada uma. Nenhuma tinha
segunda assinatura viva.

⚠️ Critério de "pagou" usado aqui é o do `pagou_de_verdade.cjs`:
`price.value > 0` **E** `status ∈ {COMPLETE, APPROVED}`. A ordem da rotina diz
só "valor > 0" — isso está incompleto e é exatamente a armadilha de 18/08 (a
Hotmart deixa a mensalidade em `OVERDUE` pra quem nunca pagou). Ontem os dois
critérios dariam o mesmo resultado, mas o estrito é o que ficou no código.
Caso real na amostra: `dr.bruno` tem `rec#2 R$97 OVERDUE` **e**
`rec#2 R$97 COMPLETE` — só o segundo é pagamento.

---

## 1. FORA DA REGRA — pagou, cancelou, e perdeu o acesso no mesmo dia

**Afeta os 3 assinantes de ontem e mais 9 pessoas: 12 no total, 1.004.089
créditos que são delas e que elas não conseguem gastar.**

A regra 9 diz: *"pediu cancelamento depois de já ter pago → para a cobrança
recorrente, mas o crédito é dela e ela usa até acabar"*. O saldo está intacto
(essa metade foi cumprida). O que não foi é o **acesso**.

O webhook faz a coisa certa. Em `webhooks/hotmart/route.ts:236`:

```ts
// cancelamento de assinatura mantém o acesso até o fim do período já pago
const keepUntil = eventType === "SUBSCRIPTION_CANCELLATION" ? extractNextChargeIso(data) : null;
```

e grava `entitlements.status='canceled'` com `access_until` no futuro. Confere:

| pessoa | entitlements.access_until | profiles.access_until | crédito |
|---|---|---|---|
| dr.bruno@blradvogados.com.br | 2026-08-21 | **NULL** | 87.121 |
| potduarte@gmail.com | 2026-09-01 | **NULL** | 96.850 |
| vinymoras@gmail.com | 2026-09-06 | **NULL** | 111.481 |

O que desfaz a intenção é `recomputeProfileAccess`
(`lib/payments/entitlements.ts:137`), que só aceita entitlement **`active`**:

```ts
const active = (ents ?? []).find(
  (e) => e.status === "active" && (e.access_until === null || e.access_until > nowIso),
);
```

Entitlement `canceled` com `access_until` no futuro cai no `else` e o cache vai
pra `access_until: null`. E `hasActiveAccess` (`lib/credits/access.ts:34`) lê
justamente `profiles.access_until` — `null` = sem acesso. Todas as telas do app
(`app/layout.tsx:58`, `voice-cloning`, `videos/clone`, `roteiro`, `images`…)
usam esse gate.

Ou seja: **as duas partes do código se contradizem.** O webhook guarda o
direito, o recompute joga fora.

Hoje, `entitlements` tem 15 linhas `canceled` com período vigente; 12 dessas
pessoas estão com o cache nulo (as outras 3 têm uma segunda assinatura ativa —
armadilha 2 funcionando).

**O saldo delas NÃO foi tocado por rotina nenhuma** — não há lançamento
negativo de `trial_expirado`/`estorno`/`subscription_expired` em nenhuma das 3.
Isso eu conferi antes de escrever "o crédito está intacto".

**Correção proposta (não executada):** em `recomputeProfileAccess`, aceitar
também `status='canceled'` enquanto `access_until > now()`. Um `find` só.
Não mexe em saldo; devolve acesso a 12 pessoas que pagaram por ele.
**Não apliquei**: isso concede acesso (e portanto GPU) a um grupo, e a decisão
de conceder é do Johnny. Card aberto pro coder.

---

## 2. FORA DA REGRA — o crédito de trial não expira mais, e não é de ontem

Os 6 trials de ontem vencem entre **26 e 29/08**. Pela regra deveriam ter o
`credits_subscription` zerado no dia 10. **Não vão.**

`expire_trial_credits` está **desligada desde 18/08**. Corpo vivo lido agora no
banco (`pg_get_functiondef`, não é suposição):

```sql
CREATE OR REPLACE FUNCTION public.expire_trial_credits(p_grace_days integer DEFAULT 10)
...
begin
  -- DESATIVADA POR FRANK EM 18/08 18:5x: a primeira rodada real zerou 14 pessoas
  -- que PAGARAM (conferido na Hotmart, 6 de 6 na amostra). A deteccao de "pagou"
  -- dentro da funcao esta errada. Enquanto nao for corrigida e reprovada, ela
  -- NAO mexe em saldo - devolve erro alto para aparecer no log do sweep.
  return jsonb_build_object('ok', false, 'error', 'DESATIVADA MANUALMENTE 18/08: ...');
end
```

Ela foi desligada **por um motivo certo** (zerou 14 pagantes; revertido em 94s).
O problema é que ninguém religou e o outro lado da regra parou junto:

- `trial_credit_expirations`: 328 linhas, **todas** de `2026-08-18 18:45:05`.
  Nenhuma nova desde então.
- `credit_transactions` com `ref_type='trial_expirado'`: 14 lançamentos, todos
  de 18/08 18:45 — e revertidos no minuto seguinte por `estorno_de_engano`.
- `sum(debited)` em `trial_credit_expirations` = **0**.

Tamanho de hoje (trial na Hotmart, sem nenhum `PURCHASE_APPROVED` com valor > 0
no nosso `payment_events`, passou do dia 10, ainda com `credits_subscription`,
fora da allowlist da equipe):

| | pessoas | créditos |
|---|---|---|
| total no bolo | 139 | 11.775.265 |
| **destes, com entitlement ATIVO vigente** | **124** | — |
| caso limpo (sem entitlement vivo) | **15** | **1.416.584** |
| já gastaram depois do dia 10 | 18 | 531.272 |

⚠️ **Os 124 com entitlement ativo NÃO podem ser tratados como caloteiros.**
É a armadilha 2 em escala: entitlement vivo pra quem "nunca pagou" segundo o
`payment_events` quase sempre quer dizer que o pagamento existe e o evento não
está no nosso banco. Cada um precisa de confirmação individual na Hotmart antes
de qualquer conta ser fechada sobre ele. O número que eu defendo sem ressalva é
o de **15 pessoas / 1.416.584 créditos**.

⚠️ Nota de implementação achada no caminho: a grafia do campo muda de fonte pra
fonte. O **webhook** manda `recurrence_number`; a **API REST** de
`/subscriptions/{code}/purchases` manda `recurrency_number`. As migrations 80/81
usam a grafia certa pro webhook. Minha primeira consulta usou a errada e voltou
`0 trials` — zero que teria virado "não há vazamento". Fica o registro de por
que zero nunca fecha sozinho.

**Nada foi zerado nem religado.** Regra 9-A: detector propõe, não executa.

---

## 3. As 9 pessoas

| e-mail | tipo | ficou | crédito | situação |
|---|---|---|---|---|
| potduarte@gmail.com | assinante | 49 d | 96.850 + 35.500 extra | mantém (certo) — mas sem acesso, item 1 |
| dr.bruno@blradvogados.com.br | assinante | 30 d | 87.121 | mantém (certo) — mas sem acesso, item 1 |
| vinymoras@gmail.com | assinante | 13 d | 111.481 + 10.000 extra | mantém (certo) — mas sem acesso, item 1 |
| froemmingds@gmail.com | trial | 3 d | 100.000 | deveria expirar 26/08 — não vai, item 2 |
| drrousseff@gmail.com | trial | 3 d | 96.580 | deveria expirar 26/08 — não vai |
| pmumaster.daniela@gmail.com | trial | 2 d | 100.000 | deveria expirar 27/08 — não vai |
| reliton.rodrigues@hotmail.com | trial | 2 d | 709 | deveria expirar 27/08 — não vai |
| caemilani@uol.com.br | trial | 1 d | 76.805 | deveria expirar 28/08 — não vai |
| pestanatiago2008@gmail.com | trial | 0 d | 31.586 + 928 extra | deveria expirar 29/08 — não vai |

Os 3 assinantes têm marcador `paid` em `trial_credit_expirations` desde 18/08 —
estão fora da varredura pra sempre, então nem se a função religar eles correm
risco. Os 6 trials não têm marcador nenhum.

"Ficou" = da adesão na Hotmart (`accession_date`) até o `cancellation_date` do
evento. `pestanatiago2008` assinou e cancelou no mesmo dia (19/08).

---

## O que não foi feito, de propósito

- Nenhum saldo alterado. Nenhuma função religada. Nenhum acesso concedido.
- O item 1 tem correção de uma linha e eu não a apliquei: ela **dá** acesso a
  12 pessoas, e conceder é decisão do Johnny.
- O item 2 depende de consertar a detecção de "pagou" dentro da função antes de
  religar. Enquanto ela estiver desligada, ninguém é zerado por engano — o
  custo é vazamento, não prejuízo pro aluno. Nessa ordem, é o lado certo pra
  errar.
