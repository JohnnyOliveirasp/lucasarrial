# Cancelamentos de 26/08/2026 — apurado em 27/08

Comando: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-08-26`
Janela UTC 2026-08-26T00:00 -> 2026-08-27T00:00.
**14 eventos `SUBSCRIPTION_CANCELLATION` -> 14 pessoas** (nenhum e-mail repetido).

Classificação feita na **Hotmart viva** (`GET /subscriptions/{code}/purchases`,
array puro), por PESSOA: para cada e-mail foram lidas TODAS as assinaturas e
TODAS as cobranças. Pagou = `price.value > 0` **E** status COMPLETE/APPROVED
(OVERDUE não é pagamento — armadilha que custou 1.356.554 cr em 18/08).

**10 trials · 4 assinantes · 0 estornos.**
Ninguém do dia tem outra assinatura viva — a armadilha 2 foi checada e não
pegou hoje.

## O que está fora da regra

### 1. A varredura `expire_trial_credits` continua DESATIVADA
Motivo gravado no corpo da função: *"DESATIVADA POR FRANK EM 18/08 18:5x: a
primeira rodada real zerou 14 pessoas"*. Consequência para o dia de ontem:
**7 trials com crédito de mensagem que não vai expirar sozinho** (total
558.491 cr), porque a máquina que cumpriria o prazo do dia 10 está parada.

Lido por `pg_get_functiondef` (inerte). A RPC **não** foi chamada de propósito:
chamar executaria a varredura a partir de um relatório somente-leitura.

| e-mail | dia 10 vence | crédito parado |
|---|---|---|
| diogomoreirafranco1991@gmail.com | 2026-09-04 | 74.887 |
| edsonfranconeto.adv@gmail.com | 2026-09-03 | 97.480 |
| little.wing@hotmail.com | 2026-08-31 | 69.611 |
| gabrielfernandes.ef@gmail.com | 2026-09-05 | 91.495 |
| godoyalessandroadv@gmail.com | 2026-09-05 | 69.678 |
| pumpmodafitness@gmail.com | 2026-09-04 | 66.185 |
| guilhermealves5334@gmail.com | 2026-09-04 | 89.155 |

### 2. maison.bolzan@gmail.com — trial JÁ passou do prazo e não expirou
Adesão 2026-07-26, dia 10 venceu **2026-08-05** (22 dias atrás), ainda com
**100.000 cr** e `access_until` 2026-09-26. Nunca pagou: rec#1 R$0 COMPLETE,
depois rec#2/rec#3 de R$97 todas OVERDUE/WAITING_PAYMENT. Sem marcador em
`trial_credit_expirations`. Este é o único cujo prazo já estourou — os outros 7
ainda estão dentro da janela.

### 3. Dois cancelamentos são de gente que NUNCA criou conta (entitlement órfão)
`entitlements.user_id = NULL` nos dois — a compra entrou, o login nunca bateu.

- **alinecuida@gmail.com** (Fernando Longato Artilha) — **PAGOU R$97**
  (COMPLETE 2026-08-17), entitlement de 2026-08-10 com acesso até 2026-09-10,
  `CANCELLED_BY_SELLER` em 26/08. Pagou um ciclo e nunca entrou no produto.
  Nome e e-mail não batem entre si; procurado por "Longato" e "Artilha" em
  `profiles.display_name` — nada.
- **mmaiasiqueira@gmail.com** (Marina Maia Siqueira) — trial R$0, mesma
  situação, mas sem dinheiro envolvido: não perde nada.

`[]` das buscas por nome não foi tratado como prova: o mesmo script consulta um
e-mail de controle que existe e ele volta preenchido
(script de apuração em `_Bugs/2026-08-27_confere_sem_conta.cjs` — `_Bugs/` é ignorado pelo git, fica só na máquina; o que reproduz o relatório inteiro é a ferramenta versionada `_frank/ferramentas/cancelamentos_ontem.cjs`).

## O que NÃO é problema (checado e descartado)

- **Nenhum assinante teve crédito zerado.** Os 4 pagantes
  (felipepalmasilva2013, caetano.msr, paulohglima1 + alinecuida) mantêm o
  saldo. Regra 9 cumprida no lado que tira.
- **`edsonfranconeto.adv` com `credits_extra` = -11.575 é esperado.** As
  transações são de onboarding, marcadas no próprio `note`:
  `[onboarding: pode ficar negativo]` (treino de voz -10.000 + 3 avatares
  -525). Não é zeramento de rotina.
- **`rogerhenriquemoreira` com mensalidade 0 cr** já estava em 0 antes: tem
  18.569 de `credits_extra` intactos e nenhum lançamento de zeramento.

## Nada foi alterado
Somente leitura, do começo ao fim. Nenhum saldo tocado — regra 9-A: detector
propõe, quem executa é a varredura, e ela está parada.

## A decisão que sobra pro Johnny
Os 558.491 cr de trial parados não são um bug novo: são o custo conhecido de
manter a `expire_trial_credits` desligada desde 18/08. Religar exige o teto por
rodada e a allowlist dentro do SQL (regra 9-A) — não é coisa de fazer no meio
de um relatório.
