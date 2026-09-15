# Cancelamentos de 14/09/2026 — ronda de 15/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-14`
Janela UTC `2026-09-14T00:00:00Z → 2026-09-15T00:00:00Z`.
15 eventos `SUBSCRIPTION_CANCELLATION` → 15 pessoas. Nada foi alterado: ronda
somente-leitura, nenhum saldo tocado (regra 9-A).
JSON cru da rodada: `_frank/prova/2026-09-15_cancelamentos_14-09.json`.

## Resumo

**7 trial, 8 assinantes.** O lado que TIRA dinheiro está correto: **nenhum dos 8
assinantes teve crédito zerado** (`zeramentos: []` nos 8). Zero estornos e zero
chargebacks na rodada. Os 7 desvios estão todos do lado do trial e têm **uma
causa só**: a `expire_trial_credits` continua desligada.

Maior dia de saída das últimas rondas: 15 pessoas contra 6 em 13/09 e 8 em 11/09.

| pessoa | tipo | ficou | crédito hoje | situação |
|---|---|---|---|---|
| juliana_varejao@icloud.com | TRIAL | 33 d (12/08→14/09) | 84.209 | dia 10 foi **22/08**, 23 d vencido, não expirou |
| alexmultiliverpool@gmail.com | TRIAL | 0 d (13/09→14/09) | — | **sem conta na plataforma**, sem crédito em risco |
| dr.adrianoyamada@gmail.com | TRIAL | 0 d (13/09→14/09) | 40.433 | dia 10 = 23/09, não vai expirar |
| evelyn.cheida@gmail.com | TRIAL | 4 d (10/09→14/09) | 31.690 | dia 10 = 20/09, não vai expirar |
| franciswd.oficial@gmail.com | TRIAL | 6 d (08/09→14/09) | 89.600 | dia 10 = 18/09, não vai expirar |
| maemis2palma@gmail.com | TRIAL | 3 d (11/09→14/09) | 87.706 | dia 10 = 21/09, não vai expirar |
| mary.020220@gmail.com | TRIAL | 1 d (13/09→14/09) | 62.063 | dia 10 = 23/09, não vai expirar |
| lelequisdias@gmail.com | ASSINANTE | 66 d (10/07→14/09) | 114.180 | **correto** — manteve (regra 9) |
| contatoecocannabis@gmail.com | ASSINANTE | 46 d (30/07→14/09) | 200.000 | **correto** — manteve |
| blancolucila539@gmail.com | ASSINANTE | 53 d (23/07→14/09) | 200.000 | **correto** — manteve |
| opedidoquerealiza@gmail.com | ASSINANTE | 59 d (17/07→14/09) | 200.000 | **correto** — manteve |
| beatrizsrl021@gmail.com | ASSINANTE | 63 d (13/07→14/09) | 100.000 | **correto** — manteve |
| luminous.assessoria@gmail.com | ASSINANTE | 35 d (11/08→14/09) | 176.788 | **correto** — manteve |
| costa.anaelson@gmail.com | ASSINANTE | 16 d (29/08→14/09) | 124.149 (+23.310 extra) | **correto** — manteve |
| amanda@mira-move.com | ASSINANTE | 31 d (14/08→14/09) | 295.260 | **correto** — manteve |

Crédito de trial em jogo nesta rodada: **395.701 cr**.

## Classificação: o atalho do valor reclassificaria 4 pessoas erradas

A ordem diária diz, em atalho, "cobrança com `price.value > 0` = pagou". Pelo
atalho, `juliana_varejao` viraria ASSINANTE (tem duas cobranças de R$97) e não
perderia nada. **Ela não pagou nada**: as duas estão `OVERDUE` — a Hotmart emite
a mensalidade e deixa vencida pra quem nunca pagou.

```
juliana_varejao@icloud.com    R$0/COMPLETE | R$97/OVERDUE | R$97/OVERDUE   <- TRIAL
beatrizsrl021@gmail.com       R$0/COMPLETE | R$97/COMPLETE | R$97/OVERDUE  <- pagou 1x, ASSINANTE
luminous.assessoria@gmail.com R$0/COMPLETE | R$97/COMPLETE | R$97/OVERDUE  <- pagou 1x, ASSINANTE
lelequisdias@gmail.com        R$0/COMPLETE | R$97/COMPLETE | 5x OVERDUE | R$97/APPROVED <- pagou, ASSINANTE
```

Vale o critério FORTE fixado em 18/08 (`pagou_de_verdade.cjs`): **valor > 0 E
status COMPLETE/APPROVED**. A ferramenta usa o critério forte. O atalho da ordem,
ao pé da letra, mandaria manter crédito de quem nunca pagou.

**Armadilha 2 conferida:** as 15 pessoas foram lidas por e-mail, todas as
assinaturas de cada uma. `outrasAssinaturasVivas: []` nas 15 — ninguém foi
tratado como saída tendo outra assinatura ativa hoje.

## Achado 1 — a varredura continua DESLIGADA (não é novo, mas é o que sangra)

`expire_trial_credits` lida no corpo vivo da função (`pg_get_functiondef`), não
no código do repo:

```
varredura expire_trial_credits: DESATIVADA — "DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas"
```

Consequência nos 6 trials com saldo: nenhum expira sozinho. Um deles
(`juliana_varejao`) **já passou do dia 10** — 23 dias de atraso. Decisão
consciente de 18/08, e desligado continua sendo melhor que zerando pagante. O que
muda a cada ronda é só o tamanho do passivo.

## Achado 2 — cancelou na Hotmart e não existe conta na plataforma

`alexmultiliverpool@gmail.com` assinou em 13/09 e cancelou em 14/09 sem nunca
criar conta (`banco: SEM CONTA`). Zero crédito em risco, então não é dinheiro
vazando — é o mesmo padrão de `parceiro@multistorers.com.br` em 13/09. Dois casos
em dois dias: se virar rotina, vale olhar se o checkout está deixando gente pagar
e não chegar na plataforma. Não medi isso nesta ronda.

## Observação (não é desvio de regra)

Duas contas com o mesmo nome de titular cancelaram no mesmo dia, ambas com
200.000 cr: `contatoecocannabis@gmail.com` (LUCILA BLANCO, adesão 30/07) e
`blancolucila539@gmail.com` (lucila blanco, adesão 23/07). São assinaturas
distintas (`6JEANY3Z` e `2Q4Y1CDE`) e as duas pagaram de verdade, então pela
regra 9 ambas mantêm o crédito e nada aqui está errado. Fica registrado porque
tem cheiro de assinatura em dobro — `assinatura_em_dobro.cjs` responderia, mas
não rodei nesta ronda.

`opedidoquerealiza@gmail.com` é o LUCAS DE MATOS ARRIAL. Assinante de verdade
(2×R$97), cancelou depois de 59 dias, crédito mantido. Registrado só porque é
conta conhecida, não porque tenha algo fora da regra.

## O que NÃO foi feito, de propósito

Nenhum saldo foi tocado. A ronda é somente-leitura (regra 9-A): quem age é a
varredura automática, e ela está desligada por decisão de 18/08. Religar não é
decisão minha — a última vez que rodou de verdade zerou 14 pessoas.
