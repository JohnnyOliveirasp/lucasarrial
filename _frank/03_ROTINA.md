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

## 1-C. Recado de rotina esperando (`tell_frank`)

O Vigia e o Executor rodam sozinhos, mas até 21/08 **não tinham como falar com
você**: `notify` ia por e-mail pro Johnny, `PushNotification` pro celular dele.
Em 21/08 o Executor acionou 3× (04:23, 11:23, 12:26) e **nenhuma chegou aqui**.
Com o Johnny na estrada, ele é exatamente quem não pode receber.

Agora eles usam `tell_frank`, que grava o recado **e** te chama no Telegram.
O Telegram é o aviso; isto aqui é a garantia de que nada se perde:

```sql
select key, updated_at, value->>'subject' as assunto,
       value->>'incident_id' as incidente, value->>'message' as recado
from agent_state
where key like 'para\_frank\_%'
order by updated_at desc;
```

Tratou? Apague a chave (`set_state` com value null) pra não reprocessar amanhã.

⚠️ Se o recado citar incidente, responda **no incidente**, não só no Telegram —
o grupo rola e some; o incidente fica.

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

## 7. Fecho do dia — e o que você POSTA durante o dia

⚠️ **MUDOU EM 21/08 (ordem do Johnny). A regra antiga era "varra de manhã,
relate à noite" — silêncio o dia inteiro.** Ela existia pra não interromper o
Johnny dirigindo. O efeito colateral foi outro: ele abria o canal, via silêncio,
e não tinha como saber se você estava trabalhando ou parado. Dezesseis rondas
num dia e nenhuma mensagem.

**Agora você POSTA NO GRUPO, na hora, quando:**
- **fechou** um incidente — uma linha: o que era, o que fez, quem foi afetado;
- **subiu um fix pra produção** — uma linha: o que corrigiu e o PR;
- **escreveu pra um aluno** — uma linha: quem e sobre o quê.

**NÃO poste ronda vazia, progresso parcial nem log de terminal.** Só fato
consumado. Num dia como o de 21/08 isso teriam sido ~3 mensagens, não 16 — e o
grupo agora tem o Lucas dentro. Ruído faz as pessoas pararem de ler, e aí o
canal morre pra valer (regra 27).

**O relatório da noite continua**, como consolidado. Mande mesmo quando não
houve nada: silêncio não pode ser confundido com saúde — foi essa confusão que
deixou 43 vozes paradas por semanas. Formato em `06_RELATORIO_E_LIMITES.md`.

**Avise na hora, sem esperar:** aluno pagante travado sem solução, dinheiro
cobrado errado, produção fora do ar, ou algo irreversível que você fez.

## 8. ELIMINAR O BACKLOG — um de cada vez, até o fim

⚠️ **Ordem direta do Johnny, 21/08.** A fila estava com 6 abertos, todos com
nota sua recente, e **nenhum fechado**. Trabalhar em seis ao mesmo tempo é o que
mantém os seis abertos.

**O método, e ele é serial de propósito:**

1. **Pegue UM.** O mais antigo com aluno afetado ganha; empate, o que tem mais
   gente sofrendo.
2. **Leve até o fim.** Corrigir o código NÃO é o fim. Acabou quando: o fix está
   em produção, o aluno afetado foi avisado, o crédito indevido foi devolvido, e
   o incidente está `fixed` com nota e commit.
3. **NÃO abra o próximo antes de fechar esse.** Única exceção: produção fora do
   ar ou dinheiro sendo cobrado errado agora.
4. **Travou? Diga em que passo.** Não deixe "investigando" sem dizer o que falta:
   - precisa de gente pra ouvir/ver → `ask_humans` (regra 9-D), e siga pro próximo;
   - precisa de dinheiro acima do teto → `notify` pro Johnny (regra 9-B), e siga;
   - precisa que o aluno responda → mande o e-mail, anote a data, e siga.
   **Esperar resposta não é estar travado.** Escreveu e anotou, o item saiu do
   seu colo — vá pro próximo.
5. **Fechou? Poste a linha no grupo** (regra 7) e pegue o próximo.

⚠️ **Mandar e-mail pra aluno você decide sozinho** — individual, sobre um caso
que você está tratando, pelo SMTP do `suporte@`. O que precisa do Johnny é
**e-mail em massa**. Não segure a resposta de um aluno esperando permissão.

⚠️ **A regra 14 continua inteira: nunca marque `fixed` sem ter resolvido.**
Isto aqui é pra você fechar MAIS, não pra fechar mais rápido do que resolve. Se
o backlog não baixar porque os casos são difíceis, isso é uma resposta legítima
— escreva no relatório qual passo emperrou em cada um.

## ⚠️ Duas armadilhas que já custaram caro numa varredura

1. **Consulta que erra volta VAZIA.** Pedir uma coluna que não existe faz o
   Supabase devolver erro e `data: null` — e o script imprime alegremente
   "0 travados". Aconteceu comigo em 18/08 (pedi `credits_cost` numa tabela
   que não tem essa coluna) e quase dei o dia por limpo com 2 itens presos.
   **Sempre cheque o `error` da consulta antes de acreditar no zero.**
2. **Registro velho entope a fila.** Item que a varredura não consegue
   resolver volta em toda rodada e come o teto, escondendo o que dava pra
   resolver. Ou resolve, ou fecha, ou tira da fila.
