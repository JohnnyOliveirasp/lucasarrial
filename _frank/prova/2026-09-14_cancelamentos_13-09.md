# Cancelamentos de 13/09/2026 — ronda de 14/09

Ferramenta: `node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-13`
Janela UTC `2026-09-13T00:00:00Z → 2026-09-14T00:00:00Z`.
6 eventos `SUBSCRIPTION_CANCELLATION` → 6 pessoas. Nada foi alterado: ronda
somente-leitura, nenhum saldo tocado (regra 9-A).

## Resumo

**5 trial, 1 assinante. Ninguém teve crédito zerado indevidamente** — o lado que
TIRA dinheiro está correto nesta rodada. Zero estornos.

| pessoa | tipo | ficou | crédito hoje | situação |
|---|---|---|---|---|
| josericardo_62@hotmail.com | TRIAL | 49 d (26/07→13/09) | 71.680 | dia 10 foi **05/08**, 40 d vencido, não expirou |
| alexandreullmann@yahoo.com | TRIAL | 20 d (24/08→13/09) | 64.535 | dia 10 foi **03/09**, 11 d vencido, não expirou |
| brunodeluca1982@gmail.com | TRIAL | 4 d (09/09→13/09) | 67.205 | dia 10 = 19/09, não vai expirar |
| allan-zequini@hotmail.com | TRIAL | 6 d (06/09→13/09) | 0 | **ver achado 2** — voz treinada sem débito |
| parceiro@multistorers.com.br | TRIAL | 0 d (13/09, ~12 min) | — | sem conta na plataforma, sem crédito em risco |
| marcelopersonalthe32@gmail.com | ASSINANTE | 39 d (05/08→13/09) | 288.950 (+10.000 extra) | **correto** — pagou 2×R$97, manteve (regra 9) |

Crédito de trial em jogo nesta rodada: **203.420 cr**.

## Classificação: por que dois "pagantes aparentes" são TRIAL

A ordem diária diz, em atalho, "cobrança com `price.value > 0` = pagou". Pelo
atalho, `josericardo_62` e `alexandreullmann` seriam ASSINANTES — os dois têm
cobrança de R$97 na Hotmart. **Não têm pagamento.** As cobranças estão `OVERDUE`:
a Hotmart emite a mensalidade e a deixa vencida pra quem nunca pagou.

```
josericardo_62@hotmail.com   R$0/COMPLETE | R$97/OVERDUE | R$97/OVERDUE
alexandreullmann@yahoo.com   R$0/COMPLETE | R$97/OVERDUE
marcelopersonalthe32@gmail.com  R$0/COMPLETE | R$97/COMPLETE | R$97/COMPLETE  <- este pagou
```

Vale o critério FORTE já fixado em 18/08 (`pagou_de_verdade.cjs`): **valor > 0 E
status COMPLETE/APPROVED**. Foi exatamente o atalho do valor que custou 1.356.554
créditos devolvidos a 14 não-pagantes naquele dia. A ferramenta usa o critério
forte; o atalho da ordem, se aplicado ao pé da letra, reclassificaria essas duas
pessoas como pagantes e mandaria manter crédito que deveria expirar.

**Armadilha 2 conferida:** as 6 pessoas foram lidas por e-mail, todas as
assinaturas de cada uma. Nenhuma tem outra assinatura viva (`outrasVivas: []`
nas 6). Ninguém foi tratado como saída tendo assinatura ativa.

## Achado 1 — a varredura continua DESLIGADA (não é novo)

`expire_trial_credits` está desativada desde 18/08, conferida no corpo vivo da
função (`pg_get_functiondef`), não no código do repo:

```
varredura expire_trial_credits: DESATIVADA — "DESATIVADA POR FRANK EM 18/08 18:5x:
a primeira rodada real zerou 14 pessoas"
```

Consequência nos 3 trials com saldo: nenhum vai expirar sozinho. Dois deles
(`josericardo_62`, `alexandreullmann`) **já passaram do dia 10** — 40 e 11 dias
de atraso. Decisão consciente de 18/08, e desligado continua sendo melhor que
zerando pagante. O que muda a cada ronda é só o tamanho do passivo.

## Achado 2 — voz treinada sem débito: o débito do onboarding é fire-and-forget

Saiu do caso `allan-zequini@hotmail.com` desta rodada: conta criada 14/09,
`SEM ACESSO`, 0 créditos, razão de créditos **vazio** — e mesmo assim 1 voz
`ready` (20 min), 5 áudios e imagens, todos de 14/09 03:27–03:32.

Comparação com um aluno normal (`marcelopersonalthe32`), que tem lançamento pra
cada geração — `-10000 training (voice)`, `-525 image` — confirma que o razão
deveria ter linha:

```
2026-08-10T10:39 -10000 training (voice) clonagem/treino de voz
2026-08-05T11:41   -525 image (image_generation) geração de imagem (1K)
```

Não é cortesia: a allowlist de `bypassesBilling` é só Johnny, Lucas e Eduardo
(`src/lib/credits/access.ts`). Nenhum dos casos abaixo está nela.

**Não é caso isolado.** Medido em `_frank/rascunhos/uso_sem_debito_0914.cjs`
(somente leitura), vozes `ready` desde 01/09:

```
vozes ready desde 2026-09-01: 261  |  donos distintos: 211
VOZ PRONTA E NENHUM DEBITO NO RAZAO: 16 pessoa(s)
```

15 das 16 estão com 0 crédito e SEM ACESSO; 1 (`dellapria@hotmail.com`) está com
os 100.000 intactos e acesso até 20/09 — treinou e não foi cobrada.

### O mecanismo (hipótese principal, falta o coder confirmar)

O treino do onboarding **não tem trava de saldo** — decisão do Johnny de 21/08,
documentada em `src/lib/onboarding/treino.ts:11-16`: dispara mesmo a zero e o
aluno fica NEGATIVO até assinar. O problema não é a ausência de trava, é que o
débito é disparado e **o resultado é descartado**:

```ts
// src/lib/onboarding/treino.ts:154-163
if (billed) {
  await debitCreditsOnboarding({ userId, amount: TRAINING_CREDIT_COST, ... });
}
return { ok: true, runpod_job_id: runpodJob.id };
```

`debitCreditsOnboarding` (`src/lib/credits/service.ts:88-109`) devolve
`{ok:false}` em silêncio quando a RPC dá erro ou quando o perfil ainda não
existe (`no_profile`) — e ninguém lê esse retorno. O treino já foi disparado
antes (linha 147) e não é desfeito. Resultado: voz treinada, 10.000 cr nunca
cobrados, **nenhuma linha no razão** — que é exatamente o retrato das 16.

Encaixa com o perfil dos casos: contas recém-criadas, onde o profile pode ainda
não existir no instante do débito.

**Não confirmado:** que as 16 passaram especificamente por essa rota e que a RPC
falhou por `no_profile`. Isso precisa do log da RPC — é o que o card pede.

Ordem de grandeza, se a hipótese se confirmar: 16 × 10.000 = **160.000 cr** de
treino em ~2 semanas, fora áudios e imagens.

## Nada foi alterado

Nenhum saldo tocado, nenhuma assinatura mexida, nenhuma RPC de varredura
chamada (a checagem lê `pg_get_functiondef`, que é inerte — chamar a RPC
executaria a varredura). Regra 9-A cumprida: quem age é a varredura, aqui só se
reporta.

## Reprodução

```bash
node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-13
node _frank/ferramentas/cancelamentos_ontem.cjs --dia 2026-09-13 --json
node _frank/ferramentas/aluno.cjs allan-zequini@hotmail.com
node _frank/rascunhos/uso_sem_debito_0914.cjs
```
