# Fechados que continuam disparando — medição (card de 20/08)

Script (leitura pura, reprodutível): `_frank/ferramentas/2026-08-20_fechados_que_disparam.cjs`
Rodado em 2026-08-20 (noite). Denominador: **63 incidentes fechados** (fixed/ignored)
examinados, de 68 na tabela. Todos os 63 com `resolved_at` preenchido (os 2 sem data
do dia anterior, 72055f75 e bee2fb8b, foram preenchidos com `resolved_by='backfill'`).

## 1) Fechados com last_seen_at DEPOIS do resolved_at: **1 de 63**

| id | título | status | resolved_at (por) | last_seen_at | occs pós-fechamento | há quanto |
|----|--------|--------|-------------------|--------------|--------------------|-----------|
| acf8acd6 | Treino de voz: áudio insuficiente/sem fala limpa | fixed | 2026-08-09 01:05 (james) | 2026-08-18 00:21 | 6 linhas cruas | disparou até 215h depois do fechamento; última há ~69h |

## 2) Vivos (ocorrência nas últimas 48h): **0**

O único zumbi parou de disparar há ~69h.

## 3) O zumbi é ruído, não classe que voltou

As 6 ocorrências pós-fechamento do acf8acd6 são **um único aluno**
(dirceu.moura.cruz78@gmail.com, 17–18/08), 3 tentativas × 2 linhas de erro cada
(mensagem amigável + código `insufficient_audio`). Erro de usuário, estornado
automático. E `training:user_dataset` sem sufixo é a assinatura CANÔNICA atual
(unificada de propósito em 23/07 — classify.ts:97): esse balde vai bumpar para
sempre por desenho, porque a regra do Johnny de 17/08 manda erro de usuário não
reabrir. O status `fixed` (devia ser `ignored`) é cosmético. O risco real desse
desenho (aluno travado repetindo sem nenhuma voz pronta) já tem cobertura própria
via `escalateStuckUser` — e o dirceu foi investigado hoje (902a1c85/88eef8aa).

## O que o snapshot NÃO enxerga (parte importante da medição)

A query `last_seen_at > resolved_at` mede o estado ATUAL. Episódio que disparou
depois de fechado e foi RE-fechado some do resultado, porque o novo `resolved_at`
passa por cima. É exatamente o caso motivador: 8d370ef5 hoje mostra
resolved_at (20/08 03:29) > last_seen_at (19/08 19:19) e não aparece — as 14
ocorrências enquanto ignored (17→19/08) estão mascaradas. Idem 902a1c85 e
88eef8aa, re-fechados nas últimas 24h.

Pelo histórico de notas `REINCIDÊNCIA` (que o ingest grava ao reabrir): **9
incidentes já reabriram automático** (31 reaberturas no total). Ou seja, o
mecanismo de reabertura EXISTE e funciona (ingest.ts, failure-alert.ts e
mail-respond.ts reabrem fechado que volta a disparar). A brecha é estreita e
específica: **as classes que por desenho NÃO reabrem** — `user_dataset` (regra
17/08, ingest.ts:~70) e bloqueio de moderação (failure-alert.ts) — bumpam
`occurrences`/`last_seen_at` em silêncio. Foi por essa porta que o 8d370ef5
escondeu bug nosso (foto na lista de áudio classificada como culpa do aluno).

## 4) Proposta e custo

**NÃO recomendo reabertura automática.** Motivos medidos: (a) o volume atual é 1
zumbi, 0 vivos — não há fila pra justificar mecanismo novo; (b) o acf8acd6 tem 11
notas de reabertura automática de ANTES da regra 17/08 — é a prova viva de que
auto-reabrir balde de erro de usuário gera loop eterno de reabertura, que foi
exatamente o que a regra 17/08 consertou; reabrir "acima de limiar" recria isso
com atraso.

**Recomendo: item obrigatório na Rotina das Falhas** (03_ROTINA.md), com dono (o
Frank, que é quem já investiga e fecha — regra 14-A) e ferramenta pronta (o script
deste card):

- Toda rodada roda `2026-08-20_fechados_que_disparam.cjs`.
- Linha que aparecer com `cause != user_dataset` → investigação obrigatória na
  rodada (é fechado não-ruído disparando — hoje isso nem deveria existir, porque
  o reopen automático cobre; se existir, é caminho de escrita novo sem reopen).
- Linha `user_dataset`/moderação → só escala se tiver **≥2 alunos distintos**
  pós-fechamento em 48h (padrão de aluno único já é coberto pelo aluno-travado).
  Um aluno só = anota e segue.

**Custo em falso positivo:** no volume de hoje, ~1 linha por rodada, minutos de
leitura, zero reabertura indevida, zero poluição da fila — o mecanismo é um
degrau de atenção, não um gatilho de estado. O ponto fraco honesto: depende da
rotina rodar (ela já roda várias vezes por dia, o que também fecha a janela de
mascaramento do snapshot — o zumbi é visto ENTRE o disparo e o re-fechamento).
Rodada que pular o item perde a janela; por isso o item entra como passo numerado
da rotina, não como sugestão.

**Bônus de assinatura (fora deste card):** bee2fb8b (`training:user_dataset:insufficient_audio`)
é assinatura órfã do esquema antigo — nunca mais casa com nada; e o status do
acf8acd6 fixed→ignored seria mais fiel ao desenho. Cosmético, sem urgência.
