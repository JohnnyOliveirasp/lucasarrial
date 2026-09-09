# Ronda diaria qa_coverage — 2026-09-09

Medido as 15:10Z. Base: `/tmp/perf/qacov.cjs` (atualizada hoje).

## PASSO 1 — qual regua esta no ar

Ultimo run VERDE do `runpod-worker.yml`: **2adb080**, terminou **2026-09-08T15:22:32Z**.
Nao ha run falho nem em curso. Nada pendente de deploy.

**Armadilha do dia (nova):** `git show --stat 2adb080` mostra UM arquivo,
`test_fase_telemetria.py`. Pelo reflexo das licoes de 07 e 08/09 ("verde de
telemetria nao e corte") eu teria carimbado "telemetria" e medido a regua VELHA
o dia inteiro. Errado: 2adb080 e **merge commit** (PR #213), e `--stat` num merge
mostra o diff combinado, que **esconde** o que os commits do ramo trouxeram.

O PR levou ao ar dois commits de DECISAO:

| commit | inference.py | tts_settings.py | o que muda |
|---|---|---|---|
| `80872f5` | 23+/2- | 29+/0 | piso `coverage_espalhada_min=0.65` na escotilha de lacuna espalhada |
| `243aa73` | 52+/10- | 10+/2- | o piso NAO vale no gate TERMINAL do resgate |

`c1db335` (cancelado 14:48Z) e ancestral de 2adb080 -> esta no ar (licao de 05/09).

=> **Corte REAL de regua: 2026-09-08T15:22:32Z.** Caiu ONTEM, entao nao existe
"hoje antes do corte": hoje inteiro ja e regua nova, e a janela que vale e a
ACUMULADA (corte -> agora), conforme a licao de 28/08.

O aviso que deixei em 08/09 ("o acumulado que conclui hoje morre quando esse
build ficar verde") se cumpriu: o pool de 638 da regua eccc3d59 zerou.

## PASSO 2 — medicao

Sanidade: 1 geracao presa (resolvida, ver abaixo); 0 falhas invisiveis;
elapsed NULL em `ready` = 23% (faixa normal 13-29%, encerrada em 08/09 — sem alarme).

### Taxa de falha

| janela | total | falhas | qa_coverage |
|---|---|---|---|
| REGUA ANTERIOR eccc3d59 (05/09 08:28Z -> 08/09 15:22Z) | 181 | 0 | 0 |
| ONTEM antes do corte | 27 | 0 | 0 |
| ONTEM depois do corte | 62 | 0 | 0 |
| HOJE 09/09 inteiro | 40 | 0 | 0 |
| **ACUMULADO REGUA NOVA (08/09 15:22Z -> agora)** | **102** | **0** | **0** |

Zero falha de qa_coverage desde 27/08. As 2 falhas de 04/09 eram executionTimeout,
ja fechadas em 07/09.

### O indicador certo desta regua NAO e a taxa de falha

A taxa ja era 0 ANTES da mudanca — nao ha o que melhorar ali. O piso 0.65 nao foi
feito pra derrubar falha: ele converte **entrega silenciosamente ruim** (cobertura
0,333 no incidente 702cc916) em **resgate por subdivisao**. Julgar essa regua pela
taxa de falha e medir a regua certa com o indicador errado.

O indicador certo e `qa.coverage_min_visto` — a cobertura que o aluno REALMENTE
recebeu. Excluindo texto degenerado (<20ch):

| janela | entregas < 0.65 | taxa | piores |
|---|---|---|---|
| 02/09 -> 05/09 | 6/153 | 3.9% | 0.448 |
| ANTERIOR (05->08/09) | 8/140 | 5.7% | 0, 0, 0, 0 |
| **NOVA (08/09 15:22Z ->)** | **1/77** | **1.3%** | 0.6 |

**Fisher exato unilateral, NOVA vs ANTERIOR: p = 0.11 — NAO conclusivo.**
Direcionalmente bom (5.7% -> 1.3%, e sumiram os quatro `cov=0` com texto real),
mas com n=77 e 1 evento isso ainda cabe no acaso. Pra concluir preciso de n~150
na regua nova: ~1 dia a mais de trafego. **Nao anuncio melhora hoje.**

### O piso disparou — e o que aconteceu importa

2 acionamentos em ~24h, batendo com os ~2,7/dia projetados no proprio commit.
Mas **os dois foram `coverage_espalhada_piso_terminal`**, e no gate terminal o
piso, por desenho (`243aa73`), so CONTA e entrega assim mesmo — bloquear ali
faria o job cair e estornar o aluno. Ou seja: o piso **reduziu**, mas **nao
eliminou**, entrega abaixo da regua. Isso e comportamento projetado, nao bug.

- `f88b149f` 08/09 22:26 — texto de **1 caractere**, cov=0. Entrada degenerada, ignorada na conta.
- `8488dc5e` 09/09 14:02 — 759ch, cov=**0.6**, 20 regens, entregue como `ready`.

### Custo projetado (elapsed) NAO apareceu

| | mediana | media | p90 |
|---|---|---|---|
| ready ANTERIOR (n=140) | 98.4s | 100s | 169.1s |
| ready NOVA (n=78) | 90.6s | 92s | 164.6s |
| >=1000ch ANTERIOR (n=26) | 168.9s | 190s | 330.9s |
| >=1000ch NOVA (n=10) | 163.4s | 160s | 228.3s |

Sem regressao de tempo. Se algo, levemente menor.

## PASSO 3 — quem foi afetado

**Nenhum aluno travado. Nenhuma falha, nenhum estorno devido.** Mas um caso
que estorno nao cobre:

**EDESIO ANDRADE CAMPOS** (grupouniprox@grupouniprox.com.br, acesso ate 16/09)
— assinou HOJE (subscription_grant 14:01:34).

- 14:02 — 1a geracao real, 759ch, voltou com **cov 0.6** (40% do texto sumido). Cobrado **759 creditos**. `status=ready` => **sem estorno** (`generation_refund` = 0).
- 14:15 — refez o MESMO texto, veio 0.955. Cobrado **mais 759 creditos**.

Ele nao ficou travado (resolveu sozinho na segunda tentativa), mas **pagou duas
vezes no primeiro dia de assinatura** por uma entrega ruim que o sistema
registrou como sucesso. A pergunta certa nao e "foi estornado?" — e "o aluno
conseguiu o que queria?": conseguiu, mas pagando em dobro. **Decisao do Johnny**,
nao mexi em credito.

**Luis Felipe** (luisfelipe.silva@ibccoaching.com.br) — geracao `d6d9ba71` ficou
`pending` por 703s. Acompanhei ate resolver: virou `ready` com elapsed **126s**.
Ou seja ~9,6 min de espera de fila + retry (`request_attempts=2`) que o
`elapsed_seconds` **nao enxerga**. Nao e incidente, mas fica o registro: a regua
mede o processamento, nao o que o aluno sente. Unico `pending` em 215 geracoes
desde 07/09.

## Conclusao

1. Regua nova (piso 0.65) no ar desde 08/09 15:22Z, deploy limpo.
2. Falha de qa_coverage: **0** em todas as janelas. Nada quebrado.
3. Entrega abaixo de 0.65 caiu 5.7% -> 1.3%, **mas p=0.11: nao concluo hoje.**
   Reavaliar amanha com n~150.
4. Custo em tempo projetado nao apareceu; frequencia do piso (2 em 24h) bateu com o previsto.
5. O piso nao bloqueia no gate terminal por desenho — entrega abaixo da regua
   ainda e possivel, e foi o que pegou o Edesio.

## Pendencia pro Johnny

- Edesio cobrado 2x (759 + 759) — decidir se estorna a primeira.
- Vale discutir: no gate terminal, entrega com cobertura muito baixa segue
  cobrando cheio e sem sinal nenhum pro aluno. Hoje isso e invisivel pro suporte.
