# INCIDENTE FECHADO — zeramento indevido dos 14 (18/08)

**Fechado por ordem do Johnny em 19/08.** O diagnóstico está resolvido, provado
e documentado. O que sobra não é incidente, é uma decisão.

---

## O que ficou provado

`_frank/prova/2026-08-18_os_14_nunca_pagaram.md` fecha a questão com prova em
dois caminhos independentes:

> **Nenhum dos 14 pagou.** A varredura acertou ao zerar. O erro foi a
> **devolução**.

A leitura errada foi minha: li `price.value > 0` como "pagou". A Hotmart emite
a mensalidade de R$97 com status `OVERDUE` assim que o trial vence, inclusive
para quem nunca pagou nada. Quem decide é o **status**, não o valor.

Padrão idêntico nos 14: recorrência 1 de R$0 `COMPLETE` (adesão ao trial), todo
o resto `OVERDUE`.

## O que o incidente entregou

- Causa raiz identificada e provada.
- Rastro contábil completo: 14 débitos `trial_expirado` + 14 estornos
  `estorno_de_engano`, todos com nota.
- Ninguém foi prejudicado: zero geração, voz, clone ou imagem nesses 14 nas 48h
  seguintes. Janela real de exposição: 1min34s.
- A `expire_trial_credits` continua **desligada** e só religa passando as quatro
  travas de `_frank/ordens/2026-08-18_detector_nunca_executa.md`.

## O que NÃO foi feito (e não é incidente, é decisão)

Os **1.356.554 créditos devolvidos continuam nas contas.** Ninguém os retirou —
o outro agente produziu a prova, não a correção de saldo.

Descontando o Lucas (sócio, `bypassesBilling`, saldo decorativo, nunca entra em
conta de vazamento), sobram **13 pessoas com 1.256.554 créditos** que nunca
compraram.

Pela regra do trial isso é o caso de **zerar** — o dinheiro nunca esteve com a
gente. Não se confunde com a recarga em dobro, onde o dinheiro está com a gente
e o prejuízo foi assumido.

**Fica parado esperando o "pode" do Johnny**, em modo seco e com a lista na
tela, como manda a regra nova: nada mexe em saldo de aluno sem dry-run e
aprovação.

| conta | crédito devolvido |
|---|---|
| charlesangio@hotmail.com | 100.000 |
| lineucastilho22@gmail.com | 100.000 |
| casatumca@gmail.com | 100.000 |
| clinicanutrisecrets@gmail.com | 100.000 |
| pedrovale2v2@gmail.com | 100.000 |
| itabenke@gmail.com | 100.000 |
| edersolucaoid@gmail.com | 100.000 |
| ddfleury@gmail.com | 100.000 |
| tatyalvesdubai@gmail.com | 100.000 |
| jemaaz@gmail.com | 100.000 |
| renildoephb@gmail.com | 95.380 |
| azevedoadvogadocriminalista@gmail.com | 89.600 |
| tikomuscl@gmail.com | 71.574 |
| ~~lucas.m.arrial@gmail.com~~ | ~~100.000~~ — sócio, não conta |

## A lição que fica no manual

Nunca decidir por um campo que chama atenção quando existe um campo que decide.
E: detector nunca executa, detector propõe.
