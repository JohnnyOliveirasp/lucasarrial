# ORDEM — Detector nunca executa. Detector propõe.

Verifiquei os 14 direto no banco. **O conserto está correto** — e o que falta
é impedir que aconteça de novo, o que não se resolve com mais cuidado.

---

## 1. O que a verificação mostrou (independente, feita por fora)

- **Os 14 estão com o saldo de volta**, valor por valor idêntico ao debitado.
- **Rastro contábil completo**: 14 débitos `adjustment|trial_expirado` e 14
  estornos `adjustment|estorno_de_engano`, com nota.
- **A janela foi de 1min34s** (18:45:05 → 18:46:42), não dez minutos.
- **Ninguém foi impedido de fazer nada.** Zero `generations`, `voices`,
  `video_clones` e `image_generations` nesses 14 nas últimas 48h. **A
  incerteza que você declarou está resolvida: não há o que comunicar a
  ninguém.**

Boa reação: detectar sozinho, desligar e reverter em 94 segundos, com
lançamento nomeado. Isso é resposta a incidente bem feita.

## 2. ⚠️ O que ainda está errado agora

**`ja_pagou = false` nos 14, inclusive no Lucas.** Se a função religar antes
de a detecção ser corrigida, ela zera os mesmos 14 de novo. **A função fica
desligada até o card fechar** — você já decidiu isso e está certo.

## 3. Os três erros

**a) A barreira estava escrita e foi pulada.** `2026-08-19_FECHAMENTO.md` e
`2026-08-19_watchdog_primeiro.md`: *"🛑 conferir 5 pagantes conhecidos; se um
vier `false`, a trava não sobe"*. Você mesmo tinha parado o backfill ontem por
essa razão. Aplicar no banco foi o passo que ligou; o portão vinha antes dele.

**b) A função ignora a allowlist da equipe.** Zerou o **Lucas**. Isso é um
defeito **separado** da detecção — e significa que a conta do Johnny estava
igualmente exposta.

**c) "Os testes passaram" foi lido como "é seguro".** Teste em banco limpo
prova que a lógica funciona. **Não prova que o dado real cabe na lógica.** É
sempre a segunda coisa que quebra, e foi a segunda que quebrou.

## 4. A correção estrutural: separar detectar de executar

O defeito de fundo não é a detecção — é que **uma função automática tinha
permissão de mexer em saldo sozinha**.

> **Detector nunca executa. Detector propõe.**

Reescreva em dois passos:

1. **Detectar** → grava a lista de candidatos numa tabela, com motivo e valor
   por pessoa. **Não toca em saldo.**
2. **Executar** → passo separado, que age **só** sobre uma lista já gravada e
   aprovada. Nunca recalcula na hora.

É exatamente o desenho que a gente combinou pro zeramento dos 99 — congelar,
o Johnny aprovar, e só então executar. Essa função nasceu **por fora** desse
desenho, e é por isso que ela pôde errar sozinha.

## 5. As quatro travas no código (critério de aceite do card)

1. **Dry-run permanente**, não só desta vez: toda rodada roda seca e mostra os
   nomes antes de qualquer débito. Hoje isso teria mostrado os 14 antes.
2. **Teto por rodada.** Ela decidiu zerar **111 pessoas de uma vez** e
   executou. Acima de N, **para e reporta** em vez de executar.
3. **Desconhecido nunca é debitado.** Quem a Hotmart não confirma não é "não
   pagou" — é **sem informação**. Só debita com confirmação **positiva** de
   que não houve pagamento.
4. **A allowlist protegida dentro do SQL.** `bypassesBilling` (Johnny, Lucas,
   Edu) e admins vivem no código do app; a função no banco **não passa por
   lá**. A proteção tem que estar na própria função.

**Critério de aceite:** os **14 nomes reais** passam sem serem debitados, e um
trial puro continua sendo. Sem isso provado, a função não religa.

## 6. E a causa da detecção

A nota do débito diz *"trial de 2026-07-07 sem pagamento em 10 dias"*. Cheque
se a consulta de pagamento tem **janela de tempo** — é a mesma armadilha dos
30 dias da Hotmart que você achou ontem e que te fez parar o backfill. Se for
isso, a causa é a mesma e a cura também: paginar/ampliar a janela até a
primeira venda real.

## 7. Regra nova pro manual

> **Nada que mexe em saldo de aluno executa sozinho.** Detector propõe, humano
> (ou uma etapa separada sobre lista aprovada) executa. E nada mexe em saldo
> em produção sem dry-run seco antes, com a lista de afetados na tela — **nem
> que os testes tenham passado.**

Acrescente à seção "Dinheiro do aluno" do `01_REGRAS_DURAS.md`.

## 8. Uma coisa que eu errei hoje, e que serve de exemplo

Na minha primeira verificação, filtrei as transações por uma data errada e a
consulta voltou **vazia**. Quase reportei "não há registro de estorno". É a
mesma armadilha que já te pegou quatro vezes — **vazio que parece resposta** —
e ela pega todo mundo, inclusive quem está escrevendo o playbook sobre ela.

Por isso a regra do dry-run não é sobre confiar mais ou menos em você: é
porque **ninguém** enxerga o próprio ponto cego.
