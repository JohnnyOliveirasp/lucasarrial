# Josilene NÃO perde os 85.969 em 22/08 — o alarme é falso

Data: 20/08/2026 · Apurado por: Frank (dono da fila) · Status: **derrubado com prova**

## O alarme

A ronda do vigia das 12h UTC subiu como item 1 de decisão do Johnny:

> "Josilene perde 85.969 créditos em 22/08, daqui a 2 dias. (…) os outros 85.969
> são `credits_subscription`, e a recarga do ciclo **substitui** o saldo em vez
> de somar."

Prazo de 2 dias, aluna que já cobrou duas vezes. Se estivesse certo, era pra
agir hoje.

**Está errado.** A recarga **acumula**.

## A prova, em três camadas

### 1. O código que decide

Quem decide não é o app, é a função SQL `grant_subscription_credits`. Existem
duas versões no repo, e a diferença é o alarme inteiro:

| arquivo | o que faz |
|---|---|
| `scripts/13_credits.sql` | `set credits_subscription = p_amount` → **substitui** |
| `scripts/67_credits_accumulate.sql` | `greatest(credits_subscription, least(credits_subscription + p_amount, 300000))` → **acumula** |

A 67 entrou em **10/08** (`feat(creditos): crédito acumula em vez de ser
apagado`) e está na `main`. O próprio comentário dela diz por que tem `greatest`:
*"a recarga NUNCA reduz o saldo de quem já estiver acima do teto — o piso é o que
a pessoa já tem, então o pior caso é somar zero."*

### 2. Por que a conta da Josilene *parecia* confirmar o alarme

A última recarga dela foi **06/08**, quatro dias ANTES da migration. Naquela
época substituía mesmo, e a aritmética fecha certinho com "substitui":

```
06/08 08:45  recarga → 100.000
06/08 22:15  -1.300          →  98.700
19/08        -10.000 -1.104 -1.102 -525  →  85.969  ✓
```

Ou seja: o histórico dela é evidência do comportamento **antigo**. Usar isso pra
prever 22/08 é medir com a régua que já foi trocada — o mesmo erro que eu cometi
hoje de manhã com o `qa_coverage`.

### 3. O que a produção faz HOJE (esta é a que vale)

DDL commitado não é DDL aplicado, então fui atrás de uma recarga real depois da
migration, com saldo diferente de zero antes (as de saldo zero não distinguem as
duas hipóteses — acumular e substituir dão o mesmo número):

```
cbaldo.fetal@gmail.com
  antes da recarga : ~55.713
  20/08 09:58      : +100.000 (subscription_grant / payment_event)
  se SUBSTITUI     : 100.000
  se ACUMULA       : 155.713
  SALDO REAL AGORA : 155.713   <-- acumulou
```

Recarga de hoje, 2h antes desta apuração. Não é teoria.

## O que isso muda

- **Josilene não perde crédito em 22/08.** Se a assinatura renovar, o bolsão de
  assinatura vai de 85.969 para 185.969 (teto de 300.000, longe). Os 100.000 de
  `credits_extra` (bônus de desculpas) nunca foram tocados por essa função.
- **Não existe prazo duro dela.** O que existe em 22/08 é o `access_until`: se
  ela **não** renovar, perde o ACESSO — o que é outra conversa, e vale pra
  qualquer assinante, não é dívida nossa com ela.
- **Não mandar e-mail avisando que ela vai perder crédito.** Seria avisar de
  algo que não acontece, para uma aluna que já reclamou duas vezes. Piora.

## A lição, que é a mesma de hoje de manhã

Duas vezes no mesmo dia eu (e o vigia) descrevemos o presente usando o
comportamento de antes de uma correção:

1. `qa_coverage` medido com a janela do push em vez do fim do deploy;
2. crédito da Josilene projetado pelo histórico de 06/08, anterior à migration 67.

**Quando o sistema mudou recentemente, histórico não é previsão.** A pergunta
certa não é "o que aconteceu com essa pessoa antes", é "o que o sistema faz
AGORA" — e isso se responde com um caso real depois da mudança, não com
aritmética em cima do passado.

Nota anexada ao incidente `4ce5b24c` (Josilene) sem mexer no status.
