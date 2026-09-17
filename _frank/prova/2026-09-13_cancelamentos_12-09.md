# Cancelamentos de 12/09/2026 — ronda de 13/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-12`
Janela UTC `2026-09-12T00:00:00Z → 2026-09-13T00:00:00Z`.
6 eventos `SUBSCRIPTION_CANCELLATION` → 6 pessoas. Nada foi alterado: ronda
somente-leitura, nenhum saldo tocado (regra 9-A).

## Resumo

4 trial, 2 assinantes. **Ninguém teve crédito zerado indevidamente** — o lado
que TIRA dinheiro está correto nesta rodada. Os dois achados são de outra
natureza (crédito que deveria expirar e não vai; e um pagante sem conta).

| pessoa | tipo | ficou | crédito hoje | situação |
|---|---|---|---|---|
| thiagofieker@gmail.com | TRIAL | 3 d (08/09→12/09) | 67.570 | dia 10 = 18/09, não vai expirar |
| dramaryannepdovale@gmail.com | TRIAL | 0 d (12/09) | 55.414 | dia 10 = 22/09, não vai expirar |
| drpaulomendes2020@gmail.com | TRIAL | 1 d (12/09) | 72.866 | dia 10 = 22/09, não vai expirar |
| jsadvocacia.net@gmail.com | TRIAL | 0 d (12/09) | 62.890 (+1.320 extra) | dia 10 = 22/09, não vai expirar |
| irina.marques@flame.pt | ASSINANTE | 7 d (05/09→12/09) | 186.610 | **correto** — pagou R$19 em 12/09, manteve (regra 9) |
| zambiasitiago@gmail.com | ASSINANTE | 25 d (18/08→12/09) | — | pagou R$97, **não tem conta na plataforma** |

Crédito de trial em jogo só nesta rodada: **258.740 cr**.

## Achado 1 — a varredura que cumpre o prazo continua DESLIGADA

`expire_trial_credits` está desativada desde 18/08 (ela zerou 14 pagantes e foi
travada de propósito — regra 9-A). Conferido no corpo vivo da função, não no
código do repo:

```sql
select pg_get_functiondef(oid) from pg_proc where proname='expire_trial_credits';
-- devolve um stub: return jsonb_build_object('ok', false, 'error',
--   'DESATIVADA MANUALMENTE 18/08: deteccao de pagante errada, zerou 14 pagantes.')
```

`frontend/src/lib/credits/trial-expiry.ts` só chama essa RPC, e o sweep de 5min
chama o `trial-expiry`. Ou seja: **não existe caminho alternativo**. Os 4 trials
acima chegam no dia 10 e nada acontece.

Isto não é regressão nova nem descuido — foi decisão consciente de 18/08, e
desligado é melhor que zerando pagante. O que importa é que o passivo cresce.

### Tamanho do passivo (ESTIMATIVA, não agir sobre ela)

Pessoas que nunca pagaram o FastCloner, já passaram do dia 10, e ainda têm
saldo de mensalidade:

```sql
with compras as (
  select lower(payload->'data'->'buyer'->>'email') as email,
         (payload->'data'->'purchase'->'price'->>'value')::numeric as valor,
         upper(payload->'data'->'purchase'->>'status') as st,
         received_at
  from payment_events
  where provider='hotmart' and event_type in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
    and payload->'data'->'product'->>'id' = '7851642'   -- FastCloner (e SimplePost, mesmo id)
    and payload->'data'->'buyer'->>'email' is not null
),
pessoa as (
  select email, min(received_at) as inicio,
         max(case when valor>0 and st in ('APPROVED','COMPLETE','COMPLETED') then 1 else 0 end) as pagou
  from compras group by 1
)
select count(*), coalesce(sum(p.credits_subscription),0)
from pessoa x join profiles p on lower(p.email)=x.email
where x.pagou=0 and x.inicio < now() - interval '10 days'
  and coalesce(p.credits_subscription,0) > 0;
-- 334 pessoas / 25.780.847 cr
```

⚠️ **Este número é estimativa e NÃO autoriza nada.** Ele sai dos NOSSOS webhooks,
e foi exatamente uma detecção de "pagou" feita no nosso lado que zerou 14
pagantes em 18/08. Antes de encostar em qualquer saldo, cada pessoa tem que ser
confirmada **na Hotmart**, uma a uma, e a regra 9-A continua inteira: detector
propõe, execução é passo separado sobre lista aprovada, com teto por rodada.

### A contraprova que salvou o número

A primeira versão da consulta não filtrava por produto e classificou
`dramaryannepdovale@gmail.com` como **pagante** — a Hotmart diz que ela é trial.
Motivo: em 11/09 ela comprou **outro** produto, "Sistema de Geração Pronto"
(R$ 597,01, id 7283229), e no dia seguinte abriu o trial do FastCloner. Sem o
filtro de produto, a compra de um produto virava "pagamento" do outro.

É a mesma família de erro do 18/08 (detecção de pagante errada), só que na
direção oposta: falso POSITIVO, que esconderia trials em vez de zerar pagantes.

Com `product.id = '7851642'` a consulta bate **6 de 6** com a Hotmart nas
pessoas desta rodada (pagou=1 só para irina e zambiasi). Amostra de 6 é pequena:
serve para mostrar que o instrumento não está obviamente quebrado, **não** para
validar as 334.

⚠️ `product.id` 7851642 aparece com dois nomes ("FastCloner" e "SimplePost").
Filtrar por NOME perde linhas; filtre por id.

> Nota de produto, não de regra: a Maryanne pagou R$ 597 num produto irmão um
> dia antes de abrir o trial. Se um dia a varredura voltar, zerar o trial dela
> é tecnicamente correto e comercialmente ruim. Quem decide isso é o Johnny com
> o Lucas, não a varredura.

## Achado 2 — zambiasitiago@gmail.com pagou R$97 e não tem conta

Assinou em 18/08 (trial R$0), **pagou R$97 em 25/08** (`PURCHASE_APPROVED`
APPROVED, confirmado na Hotmart: rec#2 R$97 COMPLETE), e cancelou em 12/09.

- `profiles` com esse e-mail: **não existe** (procurado por e-mail exato e por
  `%zambiasi%`; total de 2.576 profiles responde, então a consulta funciona).
- `entitlements`: existe 1 linha — `750WTD8D`, hotmart, `status=canceled`,
  `access_until=2026-09-18`, **`user_id = null`** (órfã, nunca ligada a conta).
- Webhooks dele: `PURCHASE_APPROVED` 0 (18/08) → `CLUB_FIRST_ACCESS` (20/08) →
  `PURCHASE_APPROVED` 97 (25/08) → `PURCHASE_COMPLETE` 0 (26/08) →
  `PURCHASE_COMPLETE` 97 (02/09) → `SUBSCRIPTION_CANCELLATION` (12/09).

Leitura honesta: ele **entrou na área da Hotmart** (CLUB_FIRST_ACCESS em 20/08),
então recebeu o material. O que nunca houve foi cadastro em fastcloner.com. Não
dá para afirmar daqui se ele tentou e falhou ou se simplesmente não quis — os
dados não dizem. Pagou 25 dias e não usou a plataforma.

Não é violação da regra 9 (sem conta, não há crédito para manter ou tirar) e
**não requer ação de saldo**. Vale como sinal de onboarding/churn.

## O que NÃO foi feito

Nenhum saldo alterado, nenhuma varredura executada, nenhuma assinatura mexida.
A função `expire_trial_credits` foi **lida** (`pg_get_functiondef`), nunca
chamada — chamar executaria a varredura.
