# Rodada das falhas — 19/08 01h UTC (18/08 22h BRT)

**Resultado:** fila estável em 1 incidente, ninguém travado, nenhum crédito
pendurado — e **a nota do `d3d8d1b2` estava afirmando uma coisa falsa**. Ela
dizia "3 dias sem reincidência" enquanto o incidente havia reincidido **duas
vezes no mesmo dia**. Corrigida, com duas hipóteses derrubadas na medição.

## Estado da fila

| Incidente | Antes | Agora | Movimento |
|---|---|---|---|
| `d3d8d1b2` Geração de áudio: tempo estourado | investigating (13x), nota falsa | investigating (13x), **nota real** | 2 hipóteses descartadas |

`varredura_travados`: **0 itens presos** (o script imprime `⚠️ tabela: erro` em
falha de consulta e não imprimiu nenhum — o zero é dele, não meu).
Falhas novas desde a rodada das 00h: **0** em generations, image_generations,
video_clones, voices, react_jobs e training_jobs.

## A nota que afirmava saúde

O `resolution_note` dizia, palavra por palavra: *"Última ocorrência 07/08 23:11
BRT; 3 dias sem reincidência."* O `last_seen_at` do mesmo registro apontava
**18/08 20:46**. As duas coisas não podiam ser verdade juntas.

Eram 2 ocorrências novas em 18/08, e a rodada anterior só tinha olhado uma:

| Quando (UTC) | Aluno | Texto | Endpoint |
|---|---|---|---|
| 18:05 | `namaiimoveis@gmail.com` (André Gabriel) | 1620 chars | `-e1` |
| 20:46 | `dralizbethginecologista@gmail.com` | 456 chars | `-e2` |

**Nota velha que afirma saúde é pior que nota nenhuma** — a rodada seguinte lê
"3 dias limpos" e não confere. Por isso substituí o resumo em vez de só
acrescentar comentário.

### Os dois alunos estão inteiros (conferido, não deduzido)

- **André**: falhou 18:05 (−1620), estornado 18:43 (+1620), refez às 18:42
  `ready` e emendou 2 Vídeos Clone (18:47 e 20:01) + imagem 4K às 19:17.
  Acesso ATIVO até 25/08, 72.957 créditos.
- **dralizbeth**: falhou 20:46 (−456), estornada 21:17 (+456), refez 21:24
  `ready` em 27,04s e emendou 2 vídeos (21:29, 21:40).

Nenhum dos dois escreveu para o suporte. **Não mandei e-mail**, de propósito:
para os dois o problema acabou sozinho horas atrás e o dinheiro voltou
inteiro. Avisar agora seria estrear um problema que eles já não têm.

## As duas hipóteses da nota antiga, mortas na medição

Medido sobre os **15 timeouts da base inteira** (não amostra).

### 1. Não é o tamanho do texto

Um texto de **59 caracteres** estourou o teto (07/08 13:30). Textos desse
tamanho levam **p50 9,9s** (min 1,5s, max 77s). Não existe forma de consumir
20 minutos gerando 59 caracteres.

E a correlação vai para o lado contrário do esperado:

```
timeouts (15):  min=59   p50=730   max=1999 chars
sucessos(2890): min=7    p50=364   p95=1628  max=2000 chars
sucessos MAIORES que o maior timeout: 10
```

As faixas se sobrepõem inteiras e o **maior sucesso da base (2000 chars) é
maior que o maior timeout (1999)**.

### 2. Não é capacidade nem fila

Em **9 dos 15** timeouts havia **zero** outra geração em voo. O perfil de
carga no instante da falha é idêntico ao normal (p50 = 0 nos dois).

⚠️ **Limite honesto do método:** `elapsed_seconds` é null em toda a base, então
presumi janela de 60s por job para calcular "em voo". Isso **superestima**
concorrência (gerações reais costumam ser bem mais curtas) — ou seja, "o
endpoint estava ocioso" é o **piso** da conclusão, não o teto.

### 3. Não é um endpoint doente

Bate nos dois: `-e2` = 10, `-e1` = 5.

### O que isso implica

O remédio descrito na nota antiga — timeout dinâmico maior, mais GPU
(VOX A 9 / VOX B 8) e balanceamento por menos-carregado — ataca **duração** e
**contenção**. Nenhuma das duas é a causa. Foi por isso que não segurou: voltou
10 dias depois.

Hipótese viva e **não provada**: o job nunca executou (cold start, ou worker
que morre sem erro estruturado) e o `executionTimeout` do RunPod dispara no
vazio. Um job sozinho no endpoint, com 59 caracteres, "estourando 20 minutos"
descreve exatamente isso.

## Por que continua `investigating` e não `fixed`

Não consigo provar o que o job fez. O status do job no RunPod **expira em
~30min** (`02_ACESSOS.md`) e as duas ocorrências de hoje já passaram disso.
Regra 14: não se marca `fixed` sem ter resolvido.

**A instrumentação atual não fecha essa lacuna.** O `elapsed_seconds`
(commit `1c09508`) mede o *nosso* tempo de ponta a ponta e **não separa "ficou
na fila" de "rodou demais"** — que é exatamente a pergunta. Além disso segue
`null` em 100% da base: nunca escreveu. Card `0d99e757` aberto com o `coder`
para gravar o `delayTime` e o `executionTime` que o RunPod devolve, **no
momento da falha** (depois de 30min não existe mais), e com o estorno
protegido em try/catch para a instrumentação nunca poder quebrar o reembolso.

## Dinheiro: nada pendurado

As 6 falhas das últimas 24h foram casadas **pelo `ref_id` do job**, não por
janela de tempo. Todas com débito e estorno que se anulam (soma = 0):

```
generations       ceb82f3d namaiimoveis      -1620 / +1620
generations       f7eb16c6 dralizbeth         -456 / +456
image_generations 8d365b40 avatarlanes        -525 / +525
video_clones      526882dd fcdnanda          -4620 / +4620
video_clones      0c3ca2ec fcdnanda          -4620 / +4620
video_clones      df149637 fcdnanda          -4620 / +4620
```

## ⚠️ Duas vezes em que meu próprio script mentiu nesta rodada

Registro porque a rodada quase entregou número errado — as duas caíram nas
armadilhas que o `03_ROTINA.md` já avisa, e o aviso funcionou.

1. **Coluna que não existe → tudo vazio.** Pedi `credit_transactions.type`
   (o campo real é `kind`). A consulta errou e imprimiu `NENHUM <-- CONFERIR`
   nas 6 falhas — parecia **6 alunos sem estorno**, um alarme falso grave. Só
   não passou porque o script imprime o `error` antes de acreditar no vazio.
2. **Teto de 1000 linhas → metade da história.** A primeira análise de carga
   trouxe exatamente 1000 linhas (só 01–30/07) e mostrou **3** dos 15
   timeouts, com cara de resultado completo. Refeito com paginação: 2.914
   linhas, os 15 timeouts. As conclusões acima são todas da versão paginada.

Também descartei um "achado" meu antes de reportá-lo: notei que o estorno
automático entra como `kind=extra_purchase` (mesmo balde de compra real) e
achei que fosse risco novo para o backfill do `ja_pagou`. **Já estava
documentado** na tabela do `04_PLAYBOOKS.md` (linhas 268-285), que separa por
`ref_type`. Conferi a tabela contra o banco vivo: os `ref_type` presentes
batem com o documentado, sem drift. É confirmação, não descoberta.

## Nada gasto, nada irreversível

Nenhum crédito mexido, nenhuma GPU disparada, nenhuma migration, nenhum
e-mail. As únicas escritas foram a nota nova (`agent_notes` #22) e a correção
do `resolution_note` do `d3d8d1b2`. Scripts em
`_Bugs/2026-08-19_rotina_falhas/`.
