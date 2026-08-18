# Os 14 "zerados por engano" — a devolução é que foi o engano

**Quando:** 18/08/2026, rotina das falhas das 15h (BRT).
**Responde:** `_frank/ordens/2026-08-19_INCIDENTE_zeramento_indevido.md`, itens 3, 4 e 8.
**Scripts:** `_Bugs/causa_14_janela30dias.cjs`, `_Bugs/causa_14_por_pessoa.cjs`,
`_Bugs/janela_10min_afetados.cjs` (todos **somente leitura**).

---

## Resumo em uma linha

> **Nenhum dos 14 pagou.** A varredura acertou ao zerar. O erro foi a
> **devolução** dos 1.356.554 créditos — e ela continua de pé.

---

## 1. Como o engano nasceu

O `devolver_zerados_por_engano.cjs` concluiu:

> "Conferi 6 delas na Hotmart: TODAS tinham cobrança com valor > 0, ou seja PAGARAM."

**Cobrança existir não é cobrança paga.** A Hotmart emite a mensalidade de
R$97 assim que o trial acaba e a deixa com status `OVERDUE` para quem nunca
pagou. Quem olha só `price.value > 0` vê "R$97" e conclui "pagou". O que
decide é o **`status`**, não o valor.

Foi essa leitura que virou o diagnóstico "a detecção de pagante está errada",
que desligou a função e que devolveu o crédito.

## 2. A prova (dois caminhos independentes, mesmo resultado)

Padrão idêntico nos 14 — recorrência 1 é o trial de R$0, todo o resto vencido:

```
ddfleury@gmail.com        1:0/COMPLETE  2:97/OVERDUE  3:97/OVERDUE
lineucastilho22@gmail.com 1:0/COMPLETE  2:97/OVERDUE  2:97/OVERDUE  3:97/OVERDUE  3:97/OVERDUE
edersolucaoid@gmail.com   1:0/COMPLETE  2:97/OVERDUE x4  3:97/OVERDUE
```

| Caminho | Fonte | Resultado |
|---|---|---|
| A | Hotmart, **todas** as assinaturas por e-mail (não por assinatura — armadilha da rotina de cancelamentos) | **0 de 14** com cobrança `COMPLETE`/`APPROVED` e valor > 0 |
| B | Nosso `payment_events`: `PURCHASE_APPROVED` com valor > 0 | **0 de 14** |

`clinicanutrisecrets` tem **2** assinaturas; nas duas, zero pagamento.
As "5 cobranças" do `lineucastilho22` citadas na ordem são 5 cobranças
**vencidas**, nenhuma paga.

## 3. A hipótese dos 30 dias está refutada

A ordem supõe que a API devolve só os últimos 30 dias e que por isso o
pagamento antigo some. **Não é o que acontece:** a API devolveu a adesão de
**11 dos 14** com mais de 30 dias, incluindo `lucas.m.arrial` (48 dias) e
`itabenke` (46 dias).

> ⚠️ **Não construa a paginação mês a mês para consertar isto.** Ela pode ser
> útil por outro motivo, mas **não é a causa deste incidente** — aqui não há
> pagamento escondido para achar.

## 4. Ninguém foi prejudicado pela janela (item 4 da ordem)

Débito às **18:45:05Z**, devolução às **18:46:39–42Z** — janela real de **~95
segundos**, não 10 minutos.

Consultei `generations`, `image_generations`, `video_clones`, `training_jobs`
e `react_jobs` numa janela **alargada de propósito** (débito −10min →
devolução +30min): **0 de 14 tentaram usar**, com **0 erros de consulta**.

> A primeira versão deste script deu "0 afetados" com o `react_jobs` **errando
> nas 14 consultas** — ele usa `criado_em`/`erro`, não `created_at`/`error_message`.
> Zero de consulta que erra não é prova de nada (armadilha 1 do `03_ROTINA`).
> O script agora conta os erros e invalida o próprio zero se houver algum.

**Ninguém tentou, ninguém foi afetado, não há e-mail a mandar.**

## 5. A função continua desligada (item 3 da ordem)

Corpo vivo da `expire_trial_credits` no banco, lido agora:

```sql
begin
  -- DESATIVADA POR FRANK EM 18/08 18:5x ...
  return jsonb_build_object('ok', false, 'error',
    'DESATIVADA MANUALMENTE 18/08: deteccao de pagante errada, zerou 14 pagantes. Nao reativar sem novo teste.');
end
```

Não toca em saldo. `trial_credit_expirations`: **0 linhas com `debited > 0`**
(as 14 marcas foram apagadas, nenhum débito novo). O sweep de 5min continua
chamando e recebendo `ok:false` no log — barulhento, mas inofensivo.

⚠️ O texto do comentário ("zerou 14 pagantes") **está errado** e deve ser
corrigido quando a função voltar, senão o próximo agente lê e repete o engano.

## 6. O que está de pé agora

- **14 pessoas que nunca pagaram estão com 1.356.554 créditos de mensalidade**
  devolvidos por engano.
- A trava não está em produção e a varredura está desligada → pela regra 9 do
  `01_REGRAS_DURAS`, isso é **vazamento de GPU**.
- Nada foi refeito: **re-zerar mexe em saldo e precisa do aval do Johnny**,
  com dry-run seco e teto por rodada (itens 5 e 6 da ordem).

## 7. O que eu recomendo

1. **Não** consertar paginação — não é a causa.
2. Reabrir a detecção de pagante com o critério certo: `status IN
   ('COMPLETE','APPROVED') AND price.value > 0`, e revalidar os 231 `marked_paid`
   com esse critério (pode haver falso positivo lá pelo mesmo motivo).
3. Só então, com dry-run e teto, decidir sobre os 14.

**O erro de fundo não foi falta de dry-run: foi tratar "cobrança existe" como
"cobrança paga" e não conferir o campo que decide.**
