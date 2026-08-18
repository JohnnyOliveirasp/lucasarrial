# Os 14 debitados de 18/08: NENHUM pagou — a auditoria confundiu cobrança emitida com cobrança paga

**Data:** 2026-08-18 · **Fonte:** Hotmart `GET /subscriptions/{code}/purchases`
(o endpoint certo, lição da Viviana — array puro, corpo cru conferido), caso a
caso, cruzado com `payment_events` transação por transação.
**Scripts:** `_Bugs/hotmart_14_debitados.cjs` (consulta) e
`_Bugs/harness_trial_expiry_v2/` (testes) — fora do git por convenção; saída
bruta colada no PR.

## O achado, sem rodeio

A premissa do card era "a detecção de *pagou* falhou: os 14 tinham cobrança com
valor > 0 na Hotmart, ou seja pagaram". **A segunda metade da frase não se
sustenta.** Cobrança com valor > 0 existe para os 14 — mas em status `OVERDUE`
ou `WAITING_PAYMENT`: **boleto emitido e nunca pago**. Nenhum dos 14 tem uma
única compra com valor > 0 em `APPROVED`/`COMPLETE`. Nenhum centavo entrou.

A auditoria de 18/08 contou **valor** e não olhou **status** — "5 cobranças, 4
com valor" (lineucastilho) bate exatamente com o que a API devolve, só que as 4
com valor estão todas `OVERDUE`.

## A verdade da Hotmart, pessoa a pessoa

| e-mail | assinatura | compras com valor > 0 | alguma paga? |
|---|---|---|---|
| lineucastilho22@gmail.com | PAST_DUE | 4× R$97 OVERDUE | não |
| renildoephb@gmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| casatumca@gmail.com | ACTIVE | 2× R$97 OVERDUE | não |
| ddfleury@gmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| charlesangio@hotmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| pedrovale2v2@gmail.com | PAST_DUE | 1× OVERDUE + 1× WAITING_PAYMENT | não |
| tikomuscl@gmail.com | PAST_DUE | 1× R$97 OVERDUE | não |
| lucas.m.arrial@gmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| clinicanutrisecrets@gmail.com | PAST_DUE | 1× R$97 OVERDUE | não |
| itabenke@gmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| edersolucaoid@gmail.com | PAST_DUE | 5× R$97 OVERDUE | não |
| tatyalvesdubai@gmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| azevedoadvogadocriminalista@gmail.com | PAST_DUE | 2× R$97 OVERDUE | não |
| jemaaz@gmail.com | PAST_DUE | 1× OVERDUE + 1× WAITING_PAYMENT | não |

Em todos: `rec#1` valor 0 `COMPLETE` (o trial). O nosso `payment_events` bate
transação por transação com a Hotmart — cada cobrança em aberto aparece aqui
como `PURCHASE_BILLET_PRINTED`/`PURCHASE_DELAYED`. **O webhook não perdeu
nada**; o espelho está fiel.

## Então o débito estava certo? NÃO — mas por outro motivo

Os 14 estão **em cobrança ativa**: Hotmart segue emitindo boleto novo a cada
ciclo (2 deles com boleto `WAITING_PAYMENT` dentro do prazo AGORA), assinatura
`PAST_DUE`, não cancelada. A regra do trial
(`_frank/ordens/2026-08-18_regra_do_trial.md`) diz explícito que a pergunta do
código é **"tem alguma cobrança em voo?"** — pagamento atrasado tem que
reativar a pessoa, não encontrar a conta zerada. E a regra 9 do manual manda
não zerar `PAST_DUE`. A função não conhecia esse estado intermediário: só via
"pagou" ou "não pagou", e mandou o meio-termo pro "não pagou".

O bug real portanto não é "detecção de pagamento furada" — é **ausência da
categoria EM COBRANÇA**. A migration 82 cria essa categoria: quem tem qualquer
cobrança com valor e nenhum pagamento é PULADO sem marcador, visível no summary
(`skipped_em_cobranca`), e vira `paid` sozinho se o boleto compensar.

## Consequências práticas

1. **A devolução dos 1.356.554 fica como está** — política do Johnny: crédito
   que já apareceu na tela não se tira; e sob a regra corrigida essas pessoas
   não seriam debitadas mesmo.
2. **Dry-run da função corrigida contra a base inteira** (18/08): 141 pessoas
   em cobrança (nenhum débito), 15 trials puros a marcar — **todos já com saldo
   0**, ou seja a primeira rodada real da mig 82 debita **zero crédito**.
3. **Decisão de negócio em aberto (não é do coder):** os 141 em cobrança
   seguram hoje **11.400.613 créditos** (133 contas com saldo > 0) usando a
   plataforma sem nunca ter pago — boleto atrasado há semanas em muitos casos.
   A mig 82 os deixa intactos e visíveis de propósito: se e quando zerar quem
   está `OVERDUE` há N dias é decisão do Johnny, não default de código.
4. **97 marcadores `zeroed` com `debited=0`** continuam na tabela de
   marcadores. Parte dessas pessoas é "em cobrança" e ficou resolvida pra
   sempre por uma regra que não existe mais. Sem efeito em saldo (nada foi
   tirado), mas se quiserem que voltem ao monitoramento, é um
   `delete from trial_credit_expirations where outcome='zeroed' and debited=0`
   — deliberadamente NÃO incluído na migration; decisão à parte.
