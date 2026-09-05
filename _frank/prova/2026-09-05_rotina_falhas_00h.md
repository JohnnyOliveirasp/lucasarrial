# Ronda das falhas — 05/09/2026 ~00:44–00:55Z (Frank, dono da fila)

Fila no início: **12 abertos** (`open`/`investigating`), 13 aguardando aluno,
3 itens presos. Peguei **UM** e levei até onde dava pra levar hoje (regra 8).

## Qual eu peguei, e por que este

Pela regra 8 o critério é **o mais antigo com aluno afetado**. Ordenei por
`first_seen_at` na fonte, não pelo que a varredura imprime:

| # | visto pela 1ª vez | alunos | assunto |
|---|---|---|---|
| **15** | **2026-07-30** | **18** | **timeout de execução** |
| 222 | 2026-09-01 | 5 | presos fora da conta |
| 226 | 2026-09-01 | 1 | áudio reprovado pelo QA |
| 234 | 2026-09-02 | 10 | palavra decapitada |

O **#15** é o mais antigo e o que tem mais gente. Confirmei antes que não havia
aluno pagante travado agora furando a fila: no **#222** as três rondas
anteriores mediram e concluíram que, pelo defeito original, **hoje não há
ninguém sem acesso** — então ele não tinha prioridade sobre o #15.

## O que a nota anterior pedia, e o que eu achei conferindo

A ronda das ~23hZ deixou: *"FALTA: (1) merge do PR #183 + deploy da imagem do
worker; (2) com setup_s gravado, remedir e levar ao Johnny a decisão do teto."*

**Item (1) — conferido no runner, não herdado do card.** PR #183 está mergeado
(`2bd3c3f`) e o `runpod-worker.yml` rodou nele com os **dois** jobs verdes:
`build` success e `deploy-runpod` success às **00:41:43Z**, apontando o template
pra tag imutável do sha e reciclando os workers (0 → N) nos dois endpoints.
A instrumentação de fase **está em produção**. Item (1) fechado.

### O achado: o `setup_s` não estava sendo gravado

O item (2) começa com *"com setup_s gravado"*. Fui conferir se estava. **Não
estava.**

O worker manda `setup_s` como **irmão** de `qa` no dict de `_entregar()`
(`inference.py:613-620`), fora do bloco `qa`. Do outro lado, `qaTelemetria()`
é uma **lista branca**: copia `out.qa` e depois só os campos que **nomeia** —
`coverage_failed_chunk`, `coverage_best`, `coverage_min`. `setup_s` não estava
nomeado, então era **descartado antes do INSERT, sem erro e sem log**.

Prova, três caminhos independentes:
- `grep setup_s frontend/src/` → **vazio**;
- os dois caminhos que gravam `qa` (`finalize.ts:124` e o webhook
  `route.ts:255`) passam pela **mesma** função;
- no banco, `qa->>'setup_s'` é **null em 100%** das linhas.

**Por que isso importa mais do que perder um campo:** a próxima ronda ia ler
`null` e concluir que o **worker** não estava mandando o número — e ia
investigar o worker, que estava certo. Seria a régua calibrada no escuro pela
**segunda vez**, pelo mesmo motivo da primeira: medir uma coisa e limitar outra.
O PR #183 fechou a cegueira do lado do worker e abriu outra do lado do app.

## O que executei — PR #184, em produção

`fix/inc15-persistir-setup-s` → **PR #184** → merge **`492d418`** → **Deploy
Frontend (production) success às 00:52:38Z** (conferido no runner, não presumido).

1. `setup_s` entra na lista branca e passa a chegar no banco.
2. O contrato de saída (`GenerationOutput` + `qaTelemetria`) saiu pra
   `telemetria-saida.ts`, **lógica pura sem I/O**. O `finalize.ts` é server-only
   (R2/Supabase/ffmpeg) e não carrega em `node --test` — era exatamente por isso
   que a única parte que já quebrou calada **não tinha teste nenhum**.
   Reexportado do `finalize.ts`, **nenhum call site mudou**.
3. **8 testes novos**, incluindo o **zero legítimo** (`setup_s: 0` não pode
   sumir numa checagem por veracidade) e payload sujo de worker antigo durante
   o rollout.

### Prova de que o teste pega o defeito (não é teste decorativo)

Removendo **só** a linha do `setup_s`: **4 dos 8 falham**. Com ela: **8/8**.
Suite inteira de `generations`: **31/31**. `tsc --noEmit` limpo. `eslint` limpo.

### Conferi a classe inteira, não só o caso

Varri todos os campos que o worker manda no topo do output: `sample_rate`,
`duration_s` e `elapsed_s` vão pra **coluna própria** (`finalize.ts:120-122`);
`coverage_*` e agora `setup_s` passam pela lista branca. **Não sobrou nenhum
outro campo sendo descartado calado.**

## Por que o #15 segue `investigating` e não `fixed`

A **causa** do #15 continua desconhecida. Eu não consertei o hang — consertei o
**instrumento** que ia medir o hang. Marcar `fixed` aqui é exatamente o que a
regra 14 proíbe.

**Não mexi no teto, de propósito:** a régua é decisão do Johnny (#89) e o número
honesto só existe depois que o `setup_s` acumular série.

## O que falta, sem maquiagem

1. **Prova em produção ainda não existe.** As duas metades só ficaram vivas
   agora (worker 00:41:43Z, frontend 00:52:38Z) e às 00:53Z **nenhuma geração
   nova tinha rodado**. `qa.setup_s` só aparece na **próxima geração real**.
   **Não disparei geração pra testar de propósito** — gastaria GPU sem aluno
   pedir. A próxima ronda confere com:
   `select qa->>'setup_s' from generations where created_at > '2026-09-05T00:52:38Z'`.
   Se vier `null` **com** geração existindo depois desse horário, o problema é
   **outro** e não este.
2. Com a série na mão, somar `setup_s + elapsed_s` e **levar ao Johnny a decisão
   do teto**.
3. A próxima ocorrência do timeout agora **nomeia a fase**
   (`inference.setup.lora/.reference/.model`) — era o ponto cego que a
   `86254b30` gravou como *"(sem fase instrumentada)"*.

**Crédito:** não mexi em crédito e não havia estorno pendente — as 8 falhas de
04/09 já tinham sido conferidas por `ref_type='generation_refund'` na ronda
anterior, todas estornadas.

## Herdado das rondas anteriores, ainda aberto (não é meu item de hoje)

- **PR #179** (`feat/cancelar-assinatura-orfa`, `6274f5d`) continua **fora da
  main**. Só a main deploya.
- **Diego Send Zap** tem prazo: os dois trials viram **R$ 194 em 08/09**.
- **3 promessas de reembolso ao Jackson** seguem sem mandato (decisão do Johnny).
- O **"pode"** para os 4 pares preventivos de trial.

## Próxima ronda começa por aqui

1. **Conferir `qa.setup_s` na primeira geração depois de 00:52:38Z** — é a prova
   que falta pro trabalho de hoje valer.
2. Prazo do **Diego (08/09)**.
3. **Mergear o PR #179**.
4. Item novo da fila pela regra 8 — o próximo mais antigo com aluno é o **#222**.
