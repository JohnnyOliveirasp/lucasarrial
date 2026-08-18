# TODO — Vigia noturno: nada pode dormir travado

**Pedido do Johnny em 18/08**, depois do dia em que descobrimos 43 vozes
paradas em silêncio (19 tinham o áudio inteiro no R2 e ninguém sabia; a mais
antiga esperava desde 3 de agosto — 15 dias).

> "Precisamos criar uma rotina preventiva todos os dias à noite: verificar se
> não tem nada travado, nada em fila para processamento, e a partir daí ver
> como corrigir isto."

## Por que isso é diferente do que já existe

Hoje cada sweep cuida do SEU pedaço e só do que ele conhece:

| Já existe | Cobre | Roda |
|---|---|---|
| `sweep-clones` | Vídeo Clone preso em pending/generating | 5 min |
| `sweep-clones` → `rescueStuckVoiceUploads` | voz parada em "uploading" (18/08) | 5 min |
| `mail-sweep` | caixa do suporte@ | 5 min |
| Vigia/Sentinela | rotina 21h/9h + executor :23 | horário |

O que **ninguém** faz: olhar a plataforma inteira e perguntar *"tem alguém
esperando por algo que nunca vai chegar?"*. Todo travamento que achamos hoje
foi encontrado **porque um aluno reclamou** — nunca porque o sistema avisou.

## O que a rotina deve varrer (toda noite)

1. **Filas que não andam** — qualquer linha em estado intermediário há mais
   tempo que o razoável: `voices` (uploading/validating/training),
   `generations`, `image_generations` (pending), `video_clones`
   (pending/generating), `react_jobs` (fila/baixando/clonando/montando),
   `training_jobs` (queued), `studio`/`edicao`.
2. **Divergência banco × R2** — linha que aponta pra objeto que não existe
   (caso da foto fantasma do Ricardo, 17/08) e objeto órfão sem linha.
3. **Divergência banco × RunPod/Kie** — job que o provedor já terminou (ou
   nem conhece mais) e continua "rodando" pra nós.
4. **Dinheiro pendurado** — débito sem entrega e sem estorno; estorno sem
   débito correspondente.
5. **Aluno pagante parado** — assinatura ativa, créditos no bolso e nenhuma
   voz pronta há N dias. É o sintoma que resume todos os anteriores.
6. **Cron que morreu em silêncio** — sweep/rotina sem execução registrada nas
   últimas X horas (a Fast ficou 2 dias muda em 08/08 e ninguém soube).

## Como deve se comportar

- **Corrige sozinha o que tem receita conhecida** (o resgate de upload de
  18/08 é o modelo: achar o áudio no R2 e aplicar a mesma regra do
  `uploads-complete`) e **registra o que corrigiu**.
- **O que não tem receita vira incidente** na aba Falhas + e-mail pro Johnny,
  com o aluno, o valor pendurado e o que a máquina tentou.
- **Relatório diário** mesmo quando está tudo bem ("varri X, nada preso") —
  silêncio não pode ser confundido com saúde. Foi exatamente isso que faltou.
- **Nunca cobra e nunca dispara nada caro sozinha** (treino/clone custam GPU e
  crédito): ela deixa pronto pro aluno clicar, ou escala pra decisão humana.

## Notas de implementação

- Endpoint no padrão dos outros sweeps (`agentTokenOk`), chamado pelo cron do
  Hetzner num horário de baixa (ex.: 04:00 BRT), com teto por tabela pra não
  brigar com o tráfego do dia.
- Reaproveitar o que já está provado: `finalizeVideoClone`,
  `finalizeTraining`, `handleTechFailure` (estorno idempotente por contagem),
  `rescueStuckVoiceUploads`.
- Ordenar sempre do **mais antigo pro mais novo** — quem espera há mais tempo
  é quem mais perde.
- ⚠️ Armadilha aprendida em 18/08: item que a varredura não consegue resolver
  **volta pra fila em toda rodada** e come o teto, deixando o resolvível pra
  trás. Ou resolve, ou tira da fila, ou marca como "já olhei".

## Quem vai fazer

Conversado com o Johnny em 18/08: passar pro **Frank** (agente Claude
orquestrador, em outra máquina) coordenar os agentes de desenvolvimento nesta
tarefa. Assunto a fechar na sequência.
