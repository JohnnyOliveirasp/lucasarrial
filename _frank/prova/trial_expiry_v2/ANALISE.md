# expire_trial_credits v2 — por que a detecção errou e o que a v2 muda

**Quando:** 20/08/2026. **Contexto:** a função está desligada no banco desde
18/08 (corpo vivo só devolve `ok:false`); o outro lado da regra 9 parou junto —
crédito de trial não expira mais no dia 10.

**Entrega:** `scripts/85_trial_expiry_v2.sql` (ESPELHO, não aplicado — regra 21)
+ dry-run seco (`_frank/ferramentas/dryrun_trial_expiry_v2.cjs`, somente
leitura) + 23 testes (`node --test _frank/ferramentas/dryrun_trial_expiry_v2.test.cjs`).
**Nada foi religado, nenhum saldo foi tocado.**

---

## 1. Onde a detecção de "pagou" errou — a resposta honesta tem duas partes

### 1a. O que a v1 NÃO errou (e o comentário em produção afirma que errou)

O corpo vivo diz *"zerou 14 pagantes"*. **Está errado**, e a prova é de 18/08
(`_frank/prova/2026-08-18_os_14_nunca_pagaram.md`): 0 de 14 tinham cobrança
`COMPLETE/APPROVED` com valor > 0, por dois caminhos independentes (Hotmart
viva + `payment_events`). Quem errou foi a **devolução**, que leu
`price.value > 0` na API REST e tratou mensalidade `OVERDUE` como paga.

Essa armadilha do OVERDUE é **da API REST, não do webhook**. Confirmado em
produção hoje (20/08, 3.446 eventos): `payment_events` não tem OVERDUE — os
equivalentes de "cobrança emitida e não paga" chegam como `PURCHASE_DELAYED`
(278 com valor > 0) e `PURCHASE_BILLET_PRINTED` (221 com valor > 0), e a v1
**já os ignorava corretamente** ao filtrar `event_type = 'PURCHASE_APPROVED'`.
`PURCHASE_APPROVED` no webhook só chega quando a cobrança foi aprovada de fato
(status dentro do payload: 1.110 de 1.110 = `APPROVED`).

### 1b. Onde a v1 errou DE VERDADE

1. **Sem allowlist.** Zerou o Lucas (sócio, `bypassesBilling`). A allowlist
   vive no código do app (`lib/credits/access.ts`); a função no banco não passa
   por lá. Detecção "nunca pagou" estava tecnicamente certa pro Lucas — sócio
   não paga — e ainda assim zerá-lo foi errado.
2. **Fonte única comprovadamente incompleta.** "Pagou" = só `payment_events`.
   Ausência de evento ≠ ausência de pagamento: hoje **126 pessoas** no filtro
   têm entitlement ATIVO vigente — quase certamente pagaram e o evento é que
   não está no nosso banco. A guarda de entitlement salvava essas, MAS:
3. **Guarda estreita demais.** Só aceitava `status='active'`. Quem pagou,
   cancelou e ainda está no período pago fica `canceled` + `access_until`
   futuro (webhook grava assim; há 15 linhas nesse estado hoje). Se o evento de
   pagamento dessa pessoa faltar no banco, a v1 zera um pagante — a assinatura
   exata do 18/08.
4. **Sem teto.** Uma rodada zerou 14 pessoas / 1.356.554 créditos de uma vez,
   sem freio.
5. **Desligar exigiu mutilar a função em produção**, divergindo do repo por
   dias e derrubando junto o lado legítimo da regra (o vazamento atual).

## 2. Grafia — confirmada ANTES de mudar (item 2 do card)

Consulta em produção 20/08, todos os 3.446 eventos hotmart paginados:
**2.516 purchases com `recurrence_number`, ZERO com `recurrency_number`.**
As migrations 80/81 usavam a grafia certa pro webhook; a v2 mantém.
`recurrency_number` é a grafia da API REST `/subscriptions/{code}/purchases` e
só interessa às ferramentas `.cjs`. O teste
"grafia da API REST não conta como pagamento no webhook" pina isso.

Bônus conferido no caminho: pessoas pagas só via `PURCHASE_COMPLETE` (sem o
`PURCHASE_APPROVED` correspondente) = **0 hoje**. A v2 passa a aceitar COMPLETE
como fonte de "pagou" mesmo assim — não muda ninguém hoje, protege contra
entrega perdida do webhook amanhã.

## 3. O que a v2 muda (migration 85)

| # | Mudança | Motivo |
|---|---|---|
| 1 | `billing_allowlist` em SQL (johnny, lucas, eduardo), pulada antes de tudo | lição do Lucas 18/08 |
| 2 | Guarda alargada: `active` vigente OU `canceled` com `access_until` futuro | buraco 3 acima |
| 3 | "Pagou" = APPROVED **ou** COMPLETE, valor > 0, `recurrence_number` presente | robustez de fonte |
| 4 | Teto por rodada (`max_zeroed_per_round`, default 20 **débitos reais**): estourou → rollback de TUDO + `ok:false` (o sweep alarma a cada 5min) | zerar em massa é sintoma de erro, não rotina |
| 5 | Kill-switch em tabela (`trial_expiry_config.enabled`, nasce **false**): aplicar o DDL **não religa**; desligada devolve `ok:true, disabled:true` (no-op silencioso e proposital) | religar vira decisão explícita de uma linha, sem DDL e sem divergência repo×banco |
| 6 | Cabeçalho conta a história VERDADEIRA do 18/08 | o comentário "zerou 14 pagantes" em produção ensinaria o engano ao próximo agente |

Inalterado de propósito: critério de trial (painel/mig 63), zerar SÓ
`credits_subscription` (extra nunca), marcador de idempotência, sem-conta não
marca (compra órfã reivindicável), `security definer set search_path = public`,
mesma assinatura (o sweep chama sem argumentos e o contrato do
`trial-expiry.ts` continua satisfeito).

## 4. Dry-run seco de hoje (somente leitura — `dryrun_2026-08-20.txt`)

- 742 trials distintos; 234 dentro do prazo; 328 já resolvidos; **15 marcaria
  `paid`** (pagaram depois de 18/08); 22 sem conta; **126 pulados por
  entitlement ativo** (não são caloteiros — confirmação individual antes de
  qualquer conclusão sobre eles); 1 allowlist (Lucas).
- **SERIAM ZERADOS: 15 pessoas / 1.416.584 créditos** — bate exatamente com o
  número limpo do card. Teto de 20 não estoura.
- **Confirmação individual na Hotmart viva já feita para os 15**
  (`confirmacao_hotmart_2026-08-20.txt`): **15 de 15 NUNCA PAGARAM**, lendo
  todas as assinaturas de cada pessoa (inclusive a 2ª da clinicanutrisecrets),
  critério estrito `valor > 0 E status ∈ {COMPLETE, APPROVED}`. Zero
  divergência entre Hotmart e a lista do dry-run.

## 5. Caminho pra religar (decisão do Johnny, nada disso foi feito)

1. Aprovar e aplicar `scripts/85_trial_expiry_v2.sql` (não religa nada).
2. Conferir que a função nova está no ar e devolvendo `disabled:true` no sweep.
3. `update public.trial_expiry_config set enabled = true, updated_at = now();`
4. Primeira rodada real zera os 15 confirmados; acompanhar o summary no log do
   sweep. Os 126 com entitlement seguem pulados toda rodada — investigação
   separada de por que os pagamentos deles não estão em `payment_events`.
