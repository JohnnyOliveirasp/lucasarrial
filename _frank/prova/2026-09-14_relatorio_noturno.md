# Ronda noturna 14/09/2026 — medições cruas

Relatório consolidado postado no GRUPO (`notify-grupo.sh`) em 15/09 ~01:10Z.
Este arquivo é a prova: número por número, comando por comando. Nada aqui foi
herdado do arquivo de ontem — tudo foi remedido nesta ronda.

## 1. Produção — o que está REALMENTE no ar

```
ssh root@91.99.15.213 'cat /mnt/volume/aiverse/frontend/.next/BUILD_ID'
→ g__ILnx1iMkcVTRqUMsgV   (arquivo datado 2026-09-15 00:48:49Z)
```

⚠️ `/mnt/volume/aiverse` **não é repositório git** — não dá pra conferir HEAD
por lá. A conferência foi por **presença do código novo + mtime**, um arquivo
por commit. **Action verde não foi usada como prova** (ordem do relatório).

| commit | PR / card | arquivo conferido no servidor | como provei |
|---|---|---|---|
| `7023af7` | #279 / #259 | `src/lib/agent/mail-respond.ts` | mtime 15/09 00:47Z · 4 ocorrências de "message id" |
| `dcc6653` | #285 / #404 | `src/lib/video-clone/finalize.ts` | `elapsed_seconds` presente no ramo de SUCESSO (linha 63), não só no de falha |
| `86b4acb` | #278 | `src/lib/video/transcribe.ts` | arquivo existe (118 linhas), mtime 15/09 00:47Z — é arquivo NOVO do commit |
| `3bc856e` | #274 | `src/lib/sgp/painel.ts` | 10 ocorrências de `situacao` (a régua nova) |

Os quatro entraram no build das 00:48Z. **Nenhum merge do dia ficou fora do ar.**

## 2. O resgate do dia: Marcelo (36 dias esperando, cancelou dia 13)

`marcelopersonalthe32@gmail.com` — o mesmo nome que apareceu no relatório de
10/09 com **32 dias**; hoje são **36**. Entre um e outro, ele **cancelou a
assinatura (13/09)**. Foi por isso que eu fui atrás em vez de só recontar:
o número que envelhece sozinho no relatório é o que vira cliente perdido.

Estado medido antes de tocar em nada:

- `pagou_de_verdade.cjs` (10/09): **PAGOU** — assinatura + avulsa R$ 368,64.
- acesso **até 05/10** (o cancelamento não o tirou ainda) · **298.950 créditos**.
- voz `f6f82819` **failed** desde 10/08, com a nota da casa dizendo, com todas
  as letras, que **a falha foi nossa** ("erro nosso de infraestrutura no
  servidor de treino, e os 10.000 créditos foram devolvidos").

`listar_arquivos_da_voz.cjs f6f82819` — a pergunta que decide se dá pra
resgatar (sem áudio, não há resgate, só desculpa):

```
1 arquivo · 000_Avaliac_a_o_e_reabilitac_a_o_apo_s_AVC_isque_mico__1_.mp3
47min05s · 45.2MB · ÁUDIO de verdade 1/1
✅ PORTÃO DE 20min: passa com 27min05s de folga
```

O áudio **estava intacto o tempo todo**. Ensaio primeiro, depois execução:

```
node _frank/ferramentas/resgatar_voz.cjs f6f82819-… --confirmar
✅ voz restaurada (awaiting_training)
✅ treino disparado: 89fd949b-f359-4595-aeb7-0dc0775c4e65-u2 (IN_QUEUE)
✅ sem débito: treino de resgate por conta da casa
```

Conferido na releitura: `voices.status = training`, `updated_at` 15/09 01:08:59Z.

**Por que decidi sozinho:** `06_RELATORIO_E_LIMITES.md` — "resgatar aluno
travado; refazer de graça o que falhou por culpa nossa" está na lista do que eu
decido. **Por que NÃO escrevi pra ele:** ele já cancelou, então escrever é
retenção/comercial — foi a mesma linha usada com o Anaelson em 14/09. Virou
pergunta binária no relatório.

⚠️ Efeito colateral conhecido e aceito (cabeçalho da ferramenta): se este treino
**falhar**, o estorno automático credita 10.000 que não foram cobrados. A ordem
de 18/08 manda compensar o aluno, então fica assim de propósito.

## 3. Vídeo Clone: 7 derrubados hoje, 7 estornados — conferido por mim

O card #404 (aberto pela ronda das 23:53Z) diz 43.050 cr estornados 1:1.
**Não copiei o número: refiz a conta pelo ledger**, cruzando falha com estorno
por `ref_id`:

```sql
with f as (select id, user_id, created_at from video_clones
           where status='failed' and created_at >= '2026-09-14T00:00:00Z')
select (select count(*) from f) as falhas_hoje,
       (select count(*) from f join credit_transactions c
          on c.ref_id = f.id::text and c.amount > 0) as com_estorno,
       (select coalesce(sum(c.amount),0) from f join credit_transactions c
          on c.ref_id = f.id::text and c.amount > 0) as cr_devolvidos;
→ {"falhas_hoje":7, "com_estorno":7, "cr_devolvidos":43050}
```

**7 de 7, sem sobra.** Ninguém pagou pelo teto de execução.

## 4. Franklin Reis — o pagante que eu NÃO destravei, e por quê

`franklindfreis@gmail.com`, recado `para_frank_f6d5f20c` de hoje 00:25Z,
incidente `f6d5f20c`. **Pagou R$ 894 em 07/09 e está há 8 dias pedindo acesso.**

Medido na fonte, nesta ronda:

| fonte | resultado |
|---|---|
| Hotmart (`pagou_de_verdade.cjs`) | **PAGOU** — `HP0570988071` R$ 597 "Sistema de Geração Pronto" + `HP0966894689` R$ 297 "Fábrica de Conteúdo Invisível", ambas APPROVED 07/09 |
| `entitlements` | **nenhuma linha** — busquei por e-mail (franklin/dfreis/freis), pelos DOIS códigos de transação e por `raw_event ilike`. As quatro vazias. |
| `profiles` | plan `free` · `access_until` NULL · `credits_subscription` 0 · `credits_extra` 0 · `ja_pagou` false |
| `credit_transactions` | **zero linhas** — nunca creditado, nunca debitado |
| `sgp_pedidos b4a9190a` | status **`pronto`** · enviado 13/09 01:37Z · **voz pronta 13/09 01:43Z** |

Ou seja: **a entrega do SGP saiu.** Ele tem voz `ready` e gerou 5 áudios e 1
imagem em 13/09, com saldo zero e sem uma linha no razão.

**A pergunta que eu me recusei a responder no chute:** comprador de Clone Pronto
tem direito a acesso de plataforma? Medi a paridade antes de supor:

```sql
select count(*) as prontos,
       count(*) filter (where p.access_until > now()) as com_acesso_vivo,
       count(*) filter (where p.access_until is null)  as sem_acesso_nenhum
from sgp_pedidos s join profiles p on p.id = s.user_id where s.status='pronto';
→ 80 prontos · 38 com acesso vivo · 41 sem acesso nenhum
```

**A paridade não decide** (quase meio a meio), então "comprou SGP logo tem
plataforma" seria chute meu. Quem decide é a medição do **PR #272 de hoje**:
*"`15 com 0 crédito e SEM ACESSO` não é sintoma: é o estado esperado de um
comprador de SGP que não assinou"*. Por essa régua, o Franklin **recebeu o que
comprou** — e o que falta é alguém dizer isso a ele, o que é falar em nome da
empresa sobre o que ele comprou. **Virou pergunta binária no relatório, com a
minha recomendação junto.**

O que eu **fiz** sozinho: corrigi o status do card de `aguardando_aluno` →
`investigating`. Ele voltou a escrever hoje 00:12Z depois de já ter sido
"respondido" em 10/09 sem nada mudar — **a bola é nossa, e o status errado o
escondia da fila.** Nota de 7 parágrafos gravada no incidente com tudo acima.

Não mandei mais um e-mail de espera: ele já levou um em 10/09 que não mudou nada.

## 5. Fila, travados, dinheiro, GPU

**Incidentes** (janela do dia = 04:00Z → 04:00Z):

```sql
abertos_hoje 16 · abertos_ontem 15 · fechados_hoje 13 · fechados_ontem 8
```

Fila no começo do dia **98** → **100** agora (80 abertos + 20 aguardando aluno).
**1 dos movimentos fui eu** (o Franklin saindo de `aguardando_aluno`): antes da
minha edição a varredura media 79 abertos + 21 aguardando, depois 80 + 20. A
soma bate nos dois lados — declaro porque a conta do dia (98 + 16 − 13 = 101,
medi 100) **não fecha sozinha**: `incidents` não tem `updated_at`, então
mudança de status no meio do dia não aparece em contagem por data.

**Varredura** (`varredura_travados.cjs`): **3 itens presos, nenhum com gente
esperando** — 1 `training_jobs` (`ebf5cc56`) cuja voz já está `ready`
(escrituração pendente) e 2 vozes `awaiting_training` recentes
(`ericb.malzone` 2 dias, `euneivaprestes` hoje).

**Acesso vivo + crédito + nenhuma voz pronta: 3** — o Marcelo (resgatado nesta
ronda, §2) e esses mesmos 2 recentes, que são fluxo normal.

**Pagante trancado** (`pagante_trancado.cjs`): **0 trancado · 0 na fronteira ·
1 sem prova** (`drfabiovilhena29@gmail.com`, sem subscriber code no payload).
220 suspeitos conferidos um a um na Hotmart. Trancar está certo em 16 cancelados
· 194 inadimplentes · 9 trials.

**Estornos:** 10 tipos, **3.255 linhas** varridas, **nenhum tipo desconhecido**.

**GPU** (`/v2/<id>/health`, medido ao vivo):

| endpoint | inQueue | inProgress | unhealthy | throttled |
|---|---|---|---|---|
| voz `2jcta960kzc2m4` | 0 | 2 | 0 | 2 |
| vídeo `9get7wv7trn3wg` | 0 | 0 | 0 | 2 |

`throttled` é o datacenter sem GPU livre — não há nada a fazer no código.

**Automações vivas** (`agent_state`): `executor_cursor` 15/09 00:25Z,
`last_run` 00:11Z, `sgp_boas_vindas` 14/09 23:32Z. O cron não está mudo.

## 6. 🔴 O achado que piorou: a fila de recados

```sql
select count(*) from agent_state where key like 'para\_frank\_%';  -- 81
select count(*) from agent_state where key like 'patch\_%';        -- 0
select min(updated_at) …                    -- 2026-09-03 22:24:40Z (11 dias)
```

**Em 10/09 eram 64, o mais velho com 223h. Hoje são 81 e 266h.** O relatório
daquele dia dizia, com todas as letras, "a próxima ronda começa por aqui" — e
não começou. Eu drenei **um** (o do Franklin, §4) e os outros 80 seguem lá.

Amostrei os assuntos pra não reportar um número cego: **não são duplicatas nem
lixo** — são casos individuais com gente esperando (`#245 igorlramalho`
esperando resposta no app desde 03/09, `Lucila Blanco` cobrando reembolso de
R$ 291 desde 07/09, `Emanuel #304` descrente desde 08/09, a promessa de áudio
de teste do `mastroianni` de 12/09).

**Patches do Vigia: 0** — essa fila, ao contrário, está limpa.

É o buraco de sempre do `03_ROTINA.md` §1-C: ninguém reclama de recado parado,
então silêncio parece saúde. Foi assim que 43 vozes ficaram semanas paradas.
**Vai no relatório como número que PIOROU, não diluído no meio do estado geral.**

## 7. A lição da ronda

O relatório de 10/09 tinha o Marcelo em **32 dias** e o registrou direitinho.
Quatro dias depois ele estava em **36 dias e cancelado** — e o áudio dele estava
intacto no servidor o tempo todo, a um comando de distância.

**Registrar um número que envelhece não é cuidar dele.** A varredura de hoje
cuspiu exatamente a mesma linha de quatro dias atrás; a diferença foi abrir o
arquivo do aluno em vez de copiar a linha pro relatório. O mesmo vale pros 81
recados: todo dia eles são reportados, e todo dia crescem.

Por isso a ronda fez UMA coisa até o fim (resgate do Marcelo, §2) em vez de
anotar seis. `03_ROTINA.md` §8 já dizia isso — é serial de propósito.
