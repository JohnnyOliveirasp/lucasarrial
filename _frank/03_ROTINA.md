# 03 — Rotina: a varredura de todo dia

Faça isto **uma vez por dia** (de manhã cedo é o ideal) e sempre que o Johnny
disser "vê como estão as coisas". Leva ~10 minutos.

> Enquanto o vigia noturno automático não existir
> (`docs/TODO_vigia_noturno.md`), **você é o vigia**.

## 1. Incidentes abertos

```sql
select status, title, occurrences, last_seen_at, sample_error
from incidents
where status in ('open','investigating')
order by last_seen_at desc;
```

Pra cada um: é falha nossa ou erro do aluno? Falha nossa → conserte e feche
com `fixed` + nota. Erro do aluno → `ignored`. **Não deixe nada "investigando"
de véspera** — ou você está investigando agora, ou tem que fechar.

## 1-B. Patch do Vigia esperando (faça ANTES do resto)

O Vigia **não consegue subir código** — o sandbox dele clona o repo público sem
credencial de escrita, e toda branch `agent/*` que ele criou em um mês se perdeu.
Desde 21/08 ele entrega **patch** em vez de PR. Se você não ler, o trabalho dele
morre igual. Regra 14-B.

```sql
select key, updated_at, value->>'assunto' as assunto,
       value->>'incident_id' as incidente, value->>'verificacoes' as verificacoes
from agent_state
where key like 'patch\_%'
order by updated_at desc;
```

Para cada patch novo:

```bash
# 1) extrai (o patch inteiro está em value->>'patch')
node _frank/ferramentas/aplicar_patch_vigia.cjs --chave patch_<id> --seco

# 2) aplica numa branch PRÓPRIA — o prefixo vigia/ é o que impede
#    o trabalho dele de se misturar com as outras branches em voo
git checkout -b vigia/<incidente> origin/main
git am /caminho/do.patch
```

3. **LEIA O CÓDIGO.** Você é a segunda opinião, e é o único ponto de revisão
   que existe — o Johnny não vai olhar merge (estrada, a partir de 24/08).
   ⚠️ **`tsc` verde não é revisão.** A correção de 19/08 passou verde e foi ELA
   que criou a regressão que queimou crédito do Valtermir. O compilador não vê
   comportamento; você vê.
4. Rode as SUAS verificações do zero (`npx tsc --noEmit` + `npx eslint`), não
   confie no que ele reportou.
5. Convencido → push + PR + merge, e anote no incidente que o autor foi o Vigia
   e o revisor foi você. **Não convencido → NÃO MERGEIE**: escreva a objeção
   como nota no incidente e deixe a branch publicada. Backlog é melhor que
   regressão.
6. Aplicado ou recusado, apague a chave (`set_state` com value null) pra não
   reprocessar todo dia.

⚠️ Patch que não aplica (`git am` falha) quase sempre é base velha: o dele saiu
de `origin/main` no momento da rodada. Rebase em cima do main de agora e siga —
se conflitar de verdade, recuse e anote, não remende no escuro.

## 2. Filas que não andam

O sintoma de tudo é o mesmo: registro parado num estado intermediário.

| Tabela | Estado suspeito | Prazo normal |
|---|---|---|
| `voices` | `uploading`, `validating` | minutos |
| `voices` | `training` | até ~40 min |
| `video_clones`, `react_jobs` | `pending`/`clonando`/`montando` | até ~30 min |
| `image_generations` | `pending` | até ~5 min |
| `generations` | `pending`/`processing` | até ~5 min |
| `training_jobs` | `queued` | minutos |

Use `ferramentas/varredura_travados.cjs` — ele já lista tudo isso de uma vez,
do mais antigo pro mais novo.

**Regra da fila:** ou você resolve o item, ou tira ele da fila, ou marca que
já olhou. Item irresolúvel que volta toda rodada **entope a varredura** e
esconde o que dava pra resolver (aconteceu em 18/08).

## 3. Aluno pagante parado

O resumo de tudo: alguém com assinatura ativa, crédito no bolso e **nenhuma
voz pronta**. Se aparecer alguém assim há mais de 2 dias, investigue o caso
inteiro — e provavelmente há mais gente na mesma situação.

## 4. Os sweeps estão vivos?

Os automáticos rodam no cron do Hetzner a cada 5 min. Pra rodar na mão:

```bash
ssh root@91.99.15.213 'cd /mnt/volume/aiverse/frontend && \
  T=$(grep -m1 "^AGENT_MONITOR_TOKEN=" .env.local | cut -d= -f2- | tr -d "\"\r"); \
  curl -sS -X POST http://localhost:3002/api/v1/agent/sweep-clones -H "x-agent-token: $T"'
```

A resposta traz `sweep` (clones), `courtesy` e `voice_rescue` (vozes
resgatadas). Se `errors` > 0 várias rodadas seguidas, algo quebrou.

Outros: `/api/v1/agent/mail-sweep` (caixa do suporte),
`/api/v1/agent/winback-sweep`.

⚠️ **Cron que morre é silencioso.** Em 08/08 a Fast ficou **2 dias muda** por
causa de um anexo grande e ninguém soube. Se a caixa está estranhamente
quieta, desconfie.

## 5. GPU

`health` dos endpoints (ver `02_ACESSOS.md`). Sinais ruins:
- `inQueue` alto com `workers.running` no teto → fila; avise o Johnny se
  passar de ~15 min de espera.
- `throttled` > 0 → o datacenter não tem GPU livre; nada a fazer no código.
- Muitos `failed` acumulados → olhe o erro de um job.

## 6. Dinheiro pendurado

Débito sem entrega e sem estorno. Confira quem falhou nas últimas 24h
(`generations`, `image_generations`, `video_clones` com status `failed`) e
veja se existe o estorno correspondente em `credit_transactions`. O estorno
automático é **idempotente por contagem** — devolve uma vez por débito.

## 7. Fecho do dia

**Varra de manhã, relate à noite** (decidido 18/08, porque o Johnny dirige o
dia inteiro e só lê quando para). Assim o problema é corrigido cedo e ele
recebe uma mensagem só, já com o resultado. Formato em
`06_RELATORIO_E_LIMITES.md`.

Mande **mesmo quando não houve nada**. Silêncio não pode ser confundido com
saúde — foi exatamente essa confusão que deixou 43 vozes paradas por semanas.

## ⚠️ Duas armadilhas que já custaram caro numa varredura

1. **Consulta que erra volta VAZIA.** Pedir uma coluna que não existe faz o
   Supabase devolver erro e `data: null` — e o script imprime alegremente
   "0 travados". Aconteceu comigo em 18/08 (pedi `credits_cost` numa tabela
   que não tem essa coluna) e quase dei o dia por limpo com 2 itens presos.
   **Sempre cheque o `error` da consulta antes de acreditar no zero.**
2. **Registro velho entope a fila.** Item que a varredura não consegue
   resolver volta em toda rodada e come o teto, escondendo o que dava pra
   resolver. Ou resolve, ou fecha, ou tira da fila.
