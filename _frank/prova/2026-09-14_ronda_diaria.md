# 14/09 — Ronda diária

Ordem: pull na main, `varredura_travados.cjs` conferindo o campo `error`,
`prova_raio.cjs` tratando **147 (18/08)** como baseline, listar incidentes
com idade, seguir o `03_ROTINA.md`.

## 1. Filas

`varredura_travados.cjs` → **2 itens presos**, 81 incidentes abertos,
15 aguardando aluno, 0 fechado sem retorno humano.

Confirmei o tratamento de `error` antes de acreditar em qualquer zero
(armadilha 1 do `03_ROTINA.md`): o script destrincha `errInc`, `errEsp` e
`errFech` e **imprime "consulta FALHOU" na cara** em cada um (linhas 392, 430,
488), além de `throw` na paginação (184) e `⚠️` por tabela (54-55). Nenhum
aviso desses apareceu na saída → os zeros de hoje são zeros de verdade.

Itens presos:
- `marcelopersonalthe32@gmail.com` — 298.950 cr, sem voz há 35 dias (ver §3).
- `ericb.malzone@gmail.com` — voz `awaiting_training` há 1 dia, dentro do prazo.
- 1 `training_jobs` obsoleto (voz já `ready`, escrituração pendente, ninguém esperando).

## 2. O número dos "147" — a ordem parte de uma premissa falsa

`prova_raio.cjs` hoje → **248** (era 147 em 18/08). **Subiu 101.**

**Não reporto isso como piora, e não é o "problema mais grave aberto".**
O próprio repo já provou que esse script mede a coisa errada:
`_frank/prova/2026-08-19_os_147_nao_eram_pagantes.md`. `entitlements.status`
é o status da LINHA, não da assinatura; e o grosso do número é o lote que
vence todo dia às 12:00 UTC. Histórico do mesmo indicador: 147 (18/08),
68 (19/08), 102 (22/08), 118 (23/08), 248 (hoje) — ele balança porque mede
o tamanho do lote do dia.

O doc manda usar `pagante_trancado.cjs`, que cruza com a Hotmart. Rodei:

| Situação conferida na Hotmart | Quantos |
|---|---|
| **Pagou de verdade e está sem acesso** | **0** |
| Na fronteira das 12:00 (recheque hoje à noite) | 32 |
| Inadimplentes (`DELAYED`) | 196 |
| Cancelaram | 16 |
| Trial que nunca virou pagamento | 3 |
| Não consegui provar (`drfabiovilhena29@`, sem subscriber code) | 1 |

Fecha exato: 196+16+3+32+1 = 248.

**O que de fato mudou não é "pagante trancado", é INADIMPLÊNCIA.** Em 19/08
eram 25 inadimplentes; hoje são 196. Esse é o número que merece olho, e ele
é comercial, não um bug nosso.

## 3. Marcelo — pagante que nunca teve voz e agora saiu

`marcelopersonalthe32@gmail.com`, confirmado pagante de verdade
(`pagou_de_verdade.cjs`): R$ 368,64 avulso 27/07, assinatura R$ 97 `COMPLETE`
em 12/08 e de novo em 05/09.

Linha do tempo: treino de voz em 10/08 **falhou por erro nosso de
infraestrutura**; os 10.000 créditos foram devolvidos no mesmo dia. Ele nunca
mais treinou. Pagou o ciclo de setembro. Agora está `SUR21VU9:CANCELLED_BY_SELLER`
— saiu com acesso até 05/10, 298.950 créditos no bolso e **nenhuma voz, 35 dias
depois**.

Crédito já foi estornado, então não há dinheiro pendurado no nosso banco. O que
sobra é reembolso/cortesia do ciclo que ele pagou sem usar — **decisão do Johnny**
(regra: promessa que custa dinheiro não é minha).

## 4. Incidentes e recados

- **81 incidentes abertos**, 15 aguardando aluno (mais velho: #172, 16 dias).
- **61 recados `para_frank_*` na fila**, o mais velho há **7,2 dias**
  (`orfa_PPEVZBRG`, compra paga sem conta). Vários passaram de 7d.
- Mais grave por dinheiro, aberto hoje: **o SGP não enxerga contestação**
  (`route.ts:206` desvia o SGP antes da lógica de revogação) — 12 clones já
  montados e entregues a quem contestou (R$ 7.449,00), 7 pedidos ainda em
  produção, e 49 disputas de SGP (R$ 28.032,73) invisíveis do nosso lado.

## 5. Resto

- `saida_x_assinatura.cjs`: **0 sangrando**, 0 a revisar, 26 já fora. Fila limpa.
- Estornos: 3.201 linhas varridas, 13 devolução + 13 não-devolução, nada por classificar.
- Produção: `fastcloner.com` → HTTP 200 em 0,8s.

## Lição

A ordem da ronda carrega "147 = o problema mais grave aberto" desde 18/08, e
o repo desmentiu isso em 19/08. Reportar 248 como piora seria repetir o erro
com números maiores. O indicador honesto é `pagante_trancado.cjs`, e hoje ele
dá **0**.
