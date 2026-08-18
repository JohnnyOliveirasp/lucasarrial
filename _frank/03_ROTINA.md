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

Mande o relatório pro Johnny (formato em `06_RELATORIO_E_LIMITES.md`)
**mesmo quando não houve nada**. Silêncio não pode ser confundido com saúde —
foi exatamente essa confusão que deixou 43 vozes paradas por semanas.
