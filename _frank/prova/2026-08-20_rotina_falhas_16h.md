# Rotina das Falhas — ronda das 16h (2026-08-20, 15:41–15:50 UTC)

Dono da fila: Frank (regra 14-A). Ordem vigente lida:
`_frank/ordens/2026-08-20_dono_da_fila_e_fila_zerada.md`.

**Resumo em uma linha:** fila continua ZERADA e ninguém está esperando — mas a
ronda anterior (15:10Z) deixou dois "alunos prejudicados" no relatório que
**não se confirmam**, e um deles quase virava crédito pago indevidamente.

---

## 1. Fila de incidentes — 0 abertos, conferido de verdade

`varredura_travados.cjs` disse "nada preso, nada aberto". **Não aceitei o zero**
(a armadilha da ordem: consulta que devolve zero pode ser consulta quebrada).
Reconferi em `_Bugs/fila_20ago.cjs`, paginado e com o `error` cru impresso:

- `incidents`: **62 linhas, `count` exact = 62** (uma página, sem corte de 1000).
- Por status: `fixed` 47, `ignored` 15. **`open`/`investigating` = 0.**

Fila zerada é fato, não silêncio de consulta.

## 2. Fechado que segue disparando (a armadilha do 8d370ef5)

26 incidentes fechados têm `last_seen_at` < 72h. Cruzei cada **classe de falha
real de produção** das últimas 48h contra os incidentes fechados
(`_Bugs/falhas_48h.cjs`):

| classe | ocorr. | último | incidente | veredito |
|---|---|---|---|---|
| qa_coverage (texto incompleto) | 7 + 2 | 20/08 10:09 | `37bacb68` / `c4b892e9` | fixed, coberto |
| `executionTimeout exceeded` | 2 | **18/08 20:46** | `d3d8d1b2` | ignored (aceite de risco) |
| video clone falhou | 3 | 18/08 20:19 | `2663506d` | ignored (áudio mudo) |
| ffmpeg `does not contain any stream` | 4 | 19/08 19:19 | `910ea757` / `8d370ef5` | fixed, coberto |
| voz "arquivo corrompido" | 1 | 19/08 17:58 | mesma classe | coberto |

**Nenhuma classe de falha órfã.** Nada disparando escondido atrás de incidente
fechado.

## 3. `d3d8d1b2` (timeout) — NÃO voltou, não reabri

Última ocorrência **18/08 20:46 UTC (≈43h atrás)**, 13 ocorrências desde 30/07.
A ordem manda reabrir e instrumentar **se voltar**. Não voltou.

Reforço independente: no `qa_coverage.cjs` as 8 falhas do período têm
`elapsed_seconds` entre **39,9s e 226,2s** — dentro da faixa normal. Nenhum hang.
Segue `ignored` por decisão do Johnny, com o risco aceito registrado.

## 4. Produção agora — e a régua nova está segurando?

O último `deploy-runpod` verde terminou **11:41:58Z** (sha `aae3ba5`) — vale o
término do deploy, nunca a hora do push.

```
ANTES da régua nova   | 149 gerações | 8 falhas | 5,4%
DEPOIS da régua nova  |  30 gerações | 0 falhas | 0,0%
```

**E não é silêncio por falta de tráfego** — foi a primeira coisa que conferi:
desde 10:09 rodaram 41 gerações (36 `ready`), 29 imagens (29 ready), 26 vídeo
clones, 8 treinos (8 completos). A única `failed` do período é a própria linha
de fronteira das 10:09:20. Os 4 `pending` têm 1 a 4 minutos de vida (tráfego
vivo, nada preso).

**O que isso NÃO prova:** n=30 não fecha o caso. Se a taxa verdadeira ainda
fosse 5,4%, sair zero em 30 tem ~18% de chance por acaso; o limite superior 95%
(regra de três, 3/30) é 10%. **Sinal bom, prova nenhuma** — continua precisando
de ~2 dias limpos, igual a ronda das 15:10 já dizia.

---

## 5. ⚠️ As duas correções da ronda das 15:10 (o achado desta ronda)

O relatório `_frank/prova/2026-08-20_qa_coverage.md` (15:10Z) listou dois alunos
prejudicados. **Fui conferir aluno por aluno no banco e nenhum dos dois se
confirma.**

### 5.1 `serescastro6@gmail.com` — NÃO perdeu 1080 créditos

A nota dizia: a 2ª falha (10:09, gen `db811e2f`) "não tem nenhuma transação
apontando pra ela — o aluno perdeu 1080 créditos".

É verdade que **não existe estorno** (conferido por `ref_type='generation_refund'`,
nunca por `kind`). Só que **também não existe o DÉBITO**. Ledger completo:

```
19/08 18:39  subscription_grant   +100000   bal=100000
19/08 21:11  training             -10000    bal= 90000
20/08 01:04  generation (1495ch)  - 1495    bal= 88505
20/08 08:39  generation (1080ch)  - 1080    bal= 87425
20/08 08:41  generation_refund    + 1080    bal= 88505
```

- Soma de todos os `amount` = **88.505**
- Saldo real hoje = `credits_subscription` 87.425 + `credits_extra` 1.080 = **88.505**
- Último `balance_after` = **88.505**

**Fecha nos três lados.** As gerações de 10:09 (falha) e 10:15 (sucesso, 1080ch)
não foram cobradas — ele não só não perdeu crédito, como levou o áudio de graça.

> Se a ronda seguinte tivesse "corrigido" isso, teríamos creditado 1080 a quem
> não foi cobrado. É a mesma família da armadilha que quase pagou em dobro pra
> 13 alunos: **olhar só o lado do estorno e não o do débito.**

### 5.2 `dirceu.walber64@gmail.com` — NÃO está travado

A nota dizia: falhou 00:35, "não voltou desde então (~14h30), ele não tem o
áudio que pediu".

O banco diz o contrário:
- Ele fez **duas gerações de 2000ch bem-sucedidas ANTES da falha** (00:24 e 00:29).
- A falha das 00:35 **foi estornada** (+2000 em 00:39:40, por `ref_type`).
- E ele **está ativo o dia todo**: vídeo clone 11:17, vídeo clone 11:52,
  imagem 14:57.

Aluno usando a plataforma normalmente, crédito devolvido. Não é caso aberto.

**Conclusão: nenhum aluno esperando, nenhum crédito devido.** Não escalei nada
pro Johnny na hora porque não há aluno pagante travado — o que havia era erro de
leitura do relatório anterior.

## 6. Gerações sem débito — varri e não é vazamento

O caso do seres me fez desconfiar do geral. Varri 7 dias
(`_Bugs/sem_debito.cjs`): **214 de 864 gerações (24,8%) sem débito**. Assusta,
mas se explica inteira:

| grupo | qtd | o que é |
|---|---|---|
| ≤150ch | 196 | amostra grátis pós-treino (normal) |
| admin/sócio | 11 | johnny (8), lucas (2), rayanne (1) — não debitam |
| por conta da casa | 5 | katia (4, refação do 4396496b) + tiago (1, `ba6fd8cf`, prova do 2949257c) |
| seres | 2 | item 5.1 |

Sem vazamento de receita e sem aluno cobrado a mais. Não mexi em nada.

## 7. Item 2 da ordem (referência cortada no meio da palavra) — 2 heurísticas testadas, **as 2 reprovadas**

Tentei achar as "3-4 de 14 vozes" com um detector barato. **Não subi nada, e
recomendo não subir**, pelo que segue.

**Tentativa A — duração × taxa de fala.** Usei os 16,5 char/s do laudo da Katia
para estimar quanto do áudio o transcript explica. Baixei as **273 referências
distintas** e medi com `ffprobe`. Resultado: flagou **praticamente 100%** delas.
Heurística inválida — quase toda referência tem exatamente 30,0s (a janela) e
transcript de 200–290ch, ou seja **7 a 9,7 char/s**, que é fala normal. Os
16,5 char/s não representam a base.

> Consequência incômoda, e registro porque muda a leitura de um laudo antigo: o
> `_Bugs/r15_dur_ref.cjs` concluiu "sobra de ~14s não descrita" na Katia **com
> essa mesma constante errada**. Pela distribuição real, a Katia é
> **estatisticamente típica**, não outlier. O laudo dela precisa ser refeito com
> régua válida antes de servir de base pra qualquer cura em massa.

**Tentativa B — transcript terminando em "...".** Sinal de fala interrompida
marcada pelo Whisper. Distribuição das 273:

| padrão | qtd | % |
|---|---|---|
| termina em `...` | 78 | 28,6% |
| transcript **vazio** | 9 | 3,3% |
| sem pontuação terminal | 3 | 1,1% |
| termina limpo | 183 | 67,0% |

Os 28,6% batem bonito com o "3-4 de 14" (21–29%) da ordem — e foi por pouco que
não comprei. **Mas o teste que importa reprova:** o transcript da **Katia
termina em "entendeu?"**, pontuação limpa. O detector **não pega o único caso
positivo confirmado**. Casar com a prevalência esperada não é validação.

**Veredito:** terceira heurística barata a falhar neste assunto. A ordem está
certa — isso exige **timestamps de palavra**, não estimativa.

**E o mais relevante:** já existe a branch **`feat/ref-corte-em-palavra`**
(`93f9b3b`, "referência cortada em FRONTEIRA DE PALAVRA via word_timestamps do
whisper") — exatamente a abordagem que a ordem endossa, **parada fora da main**.
Isso é decisão de merge/revisão (Johnny/Claude, área do worker), não coisa de eu
inventar régua. Deixo apontado, não mergeei.

**Achado sólido, esse sim (não acionado):** **9 das 273 referências têm
`reference_transcript` VAZIO** — pilotodfox, andressarovanivolare, adoniasgs10,
luiz.almeida.santos (2), flaisdaniela, draraissacampos, alcidessabino22,
manu_emily. Anomalia inequívoca e independente da questão do corte. Nenhum
desses alunos reclamou; **não gastei GPU nem toquei em nada**, fica registrado
pra virar card.

## 8. Higiene de branch — 2 registros resgatados pra main

`git log origin/main..HEAD` estava vazio no começo (nada preso na minha ponta),
mas `git rev-list main..<branch>` achou **registro morando em branch**, que é
justamente o que a ordem manda caçar (o fix que ficou 9h preso em 19/08):

| branch | conteúdo | ação |
|---|---|---|
| `prova/2026-08-20-pagante-trancado` | `2026-08-20_pagante_trancado.md` + script | **cherry-pick pra main** (`04cea32`) |
| `rescue/relatorio-noturno-7e02e90` | `2026-08-20_relatorio_noturno.md` + `refazer_audio_conta_da_casa.cjs` | **cherry-pick pra main** (`2d8bb68`) |

Só conteúdo `_frank/` (registro e ferramenta minha, zero código de produto) —
por isso vai direto na main, conforme a regra de canal. Usei **cherry-pick e não
merge de propósito**: as duas branches estão atrás da main e um merge arrastaria
reversão de código de produto (`normalize.ts`, `handler.py`, `import.ts`).

Também estavam **fora do git** (nunca commitados) e entram nesta ronda:
`_frank/prova/2026-08-20_qa_coverage.md` — o relatório da própria ronda das
15:10 — e `_frank/mensagens/2026-08-20_frank_para_claude_eco.md`.

As demais 13 branches com commit fora da main são **PRs de código em revisão**
(inclusive `feat/fix-image-upload-retry`, que a ordem marca como STALE — **não
mergear**). Nenhum fix de aluno preso ali.

---

## O que NÃO fiz

- Não abri nem fechei incidente (fila estava zerada; nada novo se confirmou).
- Não mexi em crédito de ninguém — em particular **não creditei os 1080 do
  seres**, porque ele não foi cobrado.
- Não mandei e-mail pra aluno (nenhum aluno esperando; e sem "pode" do Johnny).
- Não gastei GPU, não rodei migration, não mergeei `feat/ref-corte-em-palavra`.
- Não li a caixa do suporte@ pra triagem.

## Pendências pro Johnny (relatório da noite, nada urgente)

1. **`feat/ref-corte-em-palavra` parada fora da main** — é a abordagem certa do
   item 2 da ordem. Merge/revisão é decisão de vocês.
2. **9 referências com transcript vazio** — vira card de investigação.
3. **Laudo da Katia (`r15_dur_ref`) apoiado em constante errada** — refazer com
   régua válida antes de usar como base de cura em massa.
4. **n=30 pós-régua ainda não conclui melhora** — reconferir amanhã com ~2 dias.

## Ferramentas desta ronda

`_Bugs/fila_20ago.cjs` (fila paginada + fechados recentes), `_Bugs/falhas_48h.cjs`
(classes de falha), `_Bugs/trafego.cjs` (denominador), `_Bugs/seres_dirceu.cjs` +
`_Bugs/seres_saldo.cjs` (conciliação de ledger), `_Bugs/sem_debito.cjs`,
`_Bugs/screen_refs.cjs` (heurística A — **reprovada**), `_Bugs/refs_texto.cjs`
(heurística B — **reprovada**).
