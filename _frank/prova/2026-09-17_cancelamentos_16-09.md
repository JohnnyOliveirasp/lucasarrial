# Cancelamentos de 16/09/2026 — ronda de 17/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-16`
Janela UTC `2026-09-16T00:00:00Z → 2026-09-17T00:00:00Z`.
5 eventos `SUBSCRIPTION_CANCELLATION` → 5 pessoas. Ronda somente-leitura,
nenhum saldo tocado (regra 9-A).
JSON cru: `_frank/prova/2026-09-17_cancelamentos_16-09.json`.

## Achado que vem PRIMEIRO — o relatório de 15/09 nunca foi feito

Não existe prova de ronda para o dia 15/09: a última é
`2026-09-15_cancelamentos_14-09.md`. Rodei a janela de 15/09 agora, em atraso:
**19 pessoas cancelaram (7 assinantes, 12 trials)** e ninguém foi avisado.
JSON em `_frank/prova/2026-09-17_cancelamentos_15-09_atrasado.json`.

Conferido: **nenhum dos 7 assinantes de 15/09 teve crédito zerado**
(`zeramentos: []` nos 7), zero estornos, zero chargebacks. Ou seja, o buraco foi
de **aviso**, não de dinheiro — nada ficou errado no saldo por causa do dia
pulado. Mas 19 saídas num dia é o maior número das últimas rondas (15 em 14/09,
6 em 13/09) e passou em branco.

Não sei por que a ronda de 16/09 não rodou. Não investiguei a causa nesta ronda.

## Hipótese que levantei e que estava ERRADA (registrada de propósito)

Em 15/09, 15 das 19 assinaturas estavam `CANCELLED_BY_SELLER`, várias de gente
que tinha acabado de pagar. Parecia cancelamento em massa pelo lado do vendedor.
Fui conferir a linha de base antes de reportar: **14/09 teve 11 de 15
`CANCELLED_BY_SELLER` e 01/09 teve 7 de 13**. É o padrão normal da Hotmart, não
um evento. Descartada — não é achado.

## Resumo de 16/09

**4 trial, 1 assinante.** O lado que tira dinheiro está correto: a única
assinante **não teve crédito zerado**. Zero estornos e zero chargebacks.
Os 4 desvios são todos do lado do trial e têm a mesma causa única de sempre:
a `expire_trial_credits` continua desligada desde 18/08.

| pessoa | tipo | ficou | crédito hoje | situação |
|---|---|---|---|---|
| adrianepignatti@gmail.com | TRIAL | 14 d (02/09→16/09) | 79.400 | dia 10 foi **12/09**, 5 d vencido, **não expirou** |
| silvanabrito87@gmail.com | TRIAL | 7 d (09/09→16/09) | 98.950 | dia 10 = 19/09, não vai expirar sozinho |
| jakson_correia@outlook.com | TRIAL | 5 d (11/09→16/09) | 73.942 | dia 10 = 21/09, não vai expirar sozinho |
| well.160790@gmail.com | TRIAL | 0 d (16/09→16/09) | 64.729 | dia 10 = 26/09, não vai expirar sozinho |
| portalenfermagemquantica@gmail.com | ASSINANTE | 7 d (09/09→16/09) | 164.080 | **correto** — manteve (regra 9) |

Crédito de trial em jogo nesta rodada: **317.021 cr**.

## Classificação: o atalho do valor erraria 2 das 5

A ordem diária diz, em atalho, "cobrança com `price.value > 0` = pagou". Pelo
atalho, duas trials virariam ASSINANTE e manteriam crédito sem nunca ter pago:

```
silvanabrito87@gmail.com   R$0/APPROVED | R$97/WAITING_PAYMENT | R$0/CANCELLED x2  <- TRIAL
adrianepignatti@gmail.com  R$0/COMPLETE | R$97/OVERDUE                              <- TRIAL
```

Vale o critério FORTE fixado em 18/08 (`pagou_de_verdade.cjs`): **valor > 0 E
status COMPLETE/APPROVED**. A ferramenta usa o critério forte.

**Armadilha 2 conferida:** as 5 pessoas foram lidas por e-mail, todas as
assinaturas de cada uma. `outrasAssinaturasVivas: []` nas 5 — ninguém foi tratado
como saída tendo outra assinatura viva hoje.

## Achado — a varredura continua DESLIGADA

Lida no corpo vivo da função (`pg_get_functiondef`), não no repo:

```
varredura expire_trial_credits: DESATIVADA — "DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas"
```

Consequência: nenhum dos 4 trials expira sozinho. Um deles (`adrianepignatti`)
já passou do dia 10 — 5 dias de atraso, 79.400 cr. Decisão consciente de 18/08;
desligado continua sendo melhor que zerar pagante. O que muda a cada ronda é só
o tamanho do passivo.

## Observação (não é desvio de regra)

`portalenfermagemquantica@gmail.com` pagou a mensalidade de R$97 (APPROVED) e
cancelou **no mesmo dia, 16/09**. Pela regra 9 ela é assinante e mantém os
164.080 cr, com acesso até 09/10 — nada aqui está fora da regra. Registro só
porque pagar e cancelar no mesmo dia costuma virar pedido de estorno depois; se
vier o estorno, aí sim o crédito zera pelo webhook.

`silvanabrito87@gmail.com` tem 3 assinaturas, todas trial (1 cancelada, 2
INACTIVE). Tem cheiro de trial repetido no mesmo e-mail. Não medi isso nesta
ronda.

## O que NÃO foi feito, de propósito

Nenhum saldo foi tocado. A ronda é somente-leitura (regra 9-A): quem age é a
varredura automática, e ela está desligada por decisão de 18/08. Religar não é
decisão minha — a última vez que rodou de verdade zerou 14 pessoas.

## Aviso ao grupo — ENVIADO (17/09, ronda de conferência)

`notify-grupo.sh` devolveu **`enviado ao grupo`**. Conteúdo: as 5 saídas, o lado
do dinheiro correto (assinante manteve 164.080 cr, zero zeramentos, zero
estornos), os 4 desvios de trial com a causa única, os 317.021 cr parados, a
armadilha das duas cobranças não pagas, e o buraco de 15/09.

⚠️ **Por que esta seção existe.** Quando cheguei nesta conferência, o relatório
acima estava pronto e commitado (`c2958fa9`, 09:12) mas **não dizia se o aviso
tinha saído**. O `notify-grupo.sh` só grava prova em disco quando FALHA — logo,
ausência de registro não distingue "enviado" de "nunca enviado". Tive que
decidir no escuro, com risco dos dois lados: repetir o aviso é o ruído que mata
o canal (regra 27, o Lucas está lá), e não repetir arriscava repetir o próprio
buraco de 15/09. Daqui pra frente, **toda ronda anota aqui o resultado do
envio** — é a linha que eu queria ter encontrado.

## Conferência independente dos números (17/09)

Rodei `cancelamentos_ontem.cjs --dia 2026-09-16` de novo, do zero, em vez de
confiar no relatório. Bate inteiro: 5 eventos -> 5 pessoas, 4 trial + 1
assinante, os 4 mesmos casos fora da regra, e 73.942 + 64.729 + 98.950 + 79.400
= **317.021 cr**.

⚠️ **Armadilha 3, cometida e corrigida nesta conferência.** Minha primeira
checagem leu `zeramentos` e `estornos` na RAIZ de cada pessoa e voltou
`AUSENTE` nos 5. Quase reportei "zero zeramentos" a partir de um campo que **eu
estava lendo no lugar errado** — `zeramentos` mora dentro de `banco`, e
`estornos` não é campo, se apura pelo status das cobranças. Zero de chave
inexistente não é zero de dado.

Refeito com as chaves certas e **com contraprova**: `banco.zeramentos` existe e
está `[]` nos 5 (presente-e-vazio, não ausente), e a leitura de cobranças
enxerga 5 status distintos na rodada (`APPROVED, CANCELLED, WAITING_PAYMENT,
COMPLETE, OVERDUE`) — instrumento que enxerga é o que dá valor ao zero.
