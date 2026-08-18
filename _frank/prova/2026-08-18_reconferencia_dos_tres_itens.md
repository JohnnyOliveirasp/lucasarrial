# Reconferência dos 3 itens do item 8 — rodada agora, do zero

**Quando:** 18/08/2026, depois da ordem `2026-08-19_INCIDENTE_zeramento_indevido.md`.
**Por quê:** a resposta já estava escrita em `2026-08-18_os_14_nunca_pagaram.md`,
mas ela contradiz a ordem em cheio. Afirmação que contradiz o chefe não vale por
estar escrita — vale por ter sido medida. Rodei tudo de novo, ao vivo.

**Scripts (todos somente leitura):** `_Bugs/causa_14_por_pessoa.cjs`,
`_Bugs/janela_10min_afetados.cjs`, `_Bugs/janela30_datas_reais.cjs` (novo),
`_Bugs/confere_funcao_desligada.cjs` (novo).

---

## Item 1 — dos 14, quantos com última cobrança paga anterior a 18/07?

**Zero. E não é por causa da data: é porque nenhum dos 14 tem cobrança paga,
de data nenhuma.**

Medido por dois caminhos independentes, por PESSOA (não por assinatura):

| Caminho | Fonte | Resultado |
|---|---|---|
| A | Hotmart, todas as assinaturas do e-mail | **0 de 14** com `valor > 0` e `status ∈ (COMPLETE, APPROVED)` |
| B | Nosso `payment_events` | **0 de 14** com `PURCHASE_APPROVED` e valor > 0 |

`clinicanutrisecrets` tem 2 assinaturas — nas duas, zero pagamento.
Erros de consulta: **0** (zero de consulta que erra não seria prova de nada).

### A hipótese dos 30 dias está refutada, e agora está medida

A ordem supõe que a API corta em 30 dias e esconde o pagamento antigo. Medi a
cobrança **mais antiga que a API devolveu** para cada um:

```
ANTES 18/07 | lucas.m.arrial       2026-06-30 (49d)   ultima PAGA: NENHUMA
ANTES 18/07 | itabenke             2026-07-02 (47d)   ultima PAGA: NENHUMA
ANTES 18/07 | lineucastilho22      2026-07-05 (44d)   ultima PAGA: NENHUMA
ANTES 18/07 | renildoephb          2026-07-07 (42d)   ultima PAGA: NENHUMA
ANTES 18/07 | ddfleury             2026-07-07 (42d)   ultima PAGA: NENHUMA
... 11 de 14 com cobrança ANTERIOR a 18/07 · 0 de 14 com cobrança paga
```

**A API devolveu cobrança de até 49 dias atrás.** Ela não trunca em 30 dias.

> ⚠️ **Não construa a paginação mês a mês para consertar este incidente.** Não há
> pagamento escondido para achar. Se ela for útil, é por outro motivo.

### Então qual foi a causa

`price.value > 0` foi lido como "pagou". A Hotmart **emite** a mensalidade de
R$97 quando o trial vence e a deixa `OVERDUE` para quem nunca pagou. Padrão
idêntico nos 14: `rec#1 R$0 COMPLETE` (o trial), `rec#2/#3 R$97 OVERDUE`.

**Cobrança existir não é cobrança paga. O campo que decide é o `status`.**

---

## Item 2 — a janela entre débito e devolução

**Ninguém tentou. Não há e-mail a mandar.**

- Janela real: débito **18:45:05Z** → devolução **18:46:39–42Z** = **~95 segundos**,
  não 10 minutos.
- Consultei numa janela **alargada de propósito** (débito −10min → devolução
  +30min) as tabelas `generations`, `image_generations`, `video_clones`,
  `training_jobs`, `react_jobs`.
- **0 de 14 tentaram usar. 0 erros de consulta.**

`react_jobs` usa `criado_em`/`erro`, não `created_at`/`error_message` — a primeira
versão do script deu "0 afetados" com as 14 consultas dessa tabela **errando**.
O script agora conta os erros e invalida o próprio zero se houver algum. Este
zero foi obtido com o contador em 0.

---

## Item 3 — a função continua desligada

Corpo vivo lido agora no banco (`pg_get_functiondef`):

```sql
CREATE OR REPLACE FUNCTION public.expire_trial_credits(p_grace_days integer DEFAULT 10)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  -- DESATIVADA POR FRANK EM 18/08 18:5x ...
  return jsonb_build_object('ok', false, 'error',
    'DESATIVADA MANUALMENTE 18/08: deteccao de pagante errada, zerou 14 pagantes. Nao reativar sem novo teste.');
end $function$
```

Não toca em saldo — só devolve erro. Confirmado também no dado:

- `trial_credit_expirations` com `debited > 0`: **0 linhas**.
- `credit_transactions`: só `estorno_de_engano`, **14 lançamentos**, último em
  `18:46:42Z`. Nenhum débito novo desde então.

O sweep de 5min continua chamando e recebendo `ok:false` no log: barulhento,
inofensivo.

> ⚠️ **O comentário dentro da função está errado.** Ele diz "zerou 14 pagantes".
> Zerou 14 **não-pagantes**. Quem ler isso depois repete o engano que originou o
> estorno. Corrigir o texto exige DDL em produção — não fiz, está pendente de aval.

---

## O que continua de pé (não faz parte dos 3 itens, mas não pode sumir)

1. **1.356.554 créditos estão com 14 pessoas que nunca pagaram**, devolvidos por
   engano. Desfazer mexe em saldo → regra 9-A: **detector propõe, humano executa**.
   Precisa de aval, dry-run seco com a lista na tela e teto por rodada.
2. **Os 231 `marked_paid` podem ter falso positivo pelo mesmo motivo** (valor lido
   como pagamento). Revalidar com `valor > 0 AND status ∈ (COMPLETE, APPROVED)`
   antes de confiar naquele número.
3. **A allowlist da equipe não está dentro do SQL.** `bypassesBilling` vive no
   código do app; a função no banco não passa por lá — foi assim que o sócio
   (`lucas.m.arrial`) foi zerado. Isso é defeito separado da detecção.
4. **Não há incidente aberto registrado** para este caso (fila em 0 open /
   0 investigating, 42 no total). O incidente é real e está vivo.
