# Rotina das falhas — rodada das 19h BRT (22h UTC) de 18/08

Fila no início: **2 incidentes** (`investigating`). Fila no fim: **2** (os mesmos,
ambos com nota nova). Travados: **0**. Dinheiro pendurado em 24h: **nenhum**
(6 falhas, 6 estornadas). Nenhum aluno esperando.

O que esta rodada entregou: a **prova** de que o incidente mais antigo da casa
(`d3d8d1b2`, aberto em 30/07) foi investigado 19 dias com a premissa errada — e
uma correção **em produção** que faz a próxima ocorrência se explicar sozinha,
sem depender de log que expira. Commit `1c09508`.

---

## Incidente d3d8d1b2 — Geração de áudio: tempo de execução estourado

### 1. A aluna está inteira (passo 1, e de novo era esse o caso)

13ª ocorrência às **20:46:05 UTC**, aluna nova `dralizbethginecologista@gmail.com`
(Lizbeth A Miranda), conta desde 04/08, acesso até 03/09, 47.616 créditos.

| Fato | Evidência |
|---|---|
| Débito da geração | −456 às 20:46:05.98 |
| Estorno automático, valor exato | +456 às 21:17:25.61 (`generation_refund`) |
| Ela mesma refez | 21:24 (476 chars) → `ready` |
| Seguiu produzindo | vídeo clone `ready` às 21:29 e 21:40 |

**Não escrevi pra ela** — mesmo critério do André e da Fernanda nas rodadas
anteriores: não reclamou (incidente veio do ingest automático), não ficou sem
entrega, crédito em dia. **Mas registro o incômodo:** ela ficou 31 minutos na
frente de um botão esperando um job que normalmente leva 1 minuto. Se o Johnny
quiser aviso nesses casos, é um comando e eu escrevo.

### 2. A prova que faltava desde 30/07 — é HANG

A aluna fez sozinha o experimento controlado que nenhum agente tinha conseguido
montar: rodou **o mesmo texto de 456 chars 5 vezes**, na mesma voz, em 37 min.

| Hora | Resultado | Tempo real | Endpoint |
|---|---|---|---|
| 20:09 | ready | **64,67s** | -e2 |
| 20:12 | ready | **77,94s** | -e1 |
| 20:20 | ready | **59,98s** | -e2 |
| 20:41 | ready | **76,77s** | -e1 |
| **20:46** | **failed** | **queimou 31min19s** | **-e2** |
| 21:24 | ready | 27,04s (476 chars) | -e1 |

Entrada idêntica, 4 entregas em 60-78s, 1 morte no teto de 30min. Isso mata de
uma vez, sem log nenhum:

- **tamanho do texto** — idêntico nas 6;
- **teto apertado** — o teto é ~25x o trabalho real;
- **fila/capacidade** — o mesmo `-e2` entregou pra ela às 20:09 e 20:20;
- **entrada ruim** — a mesma entrada passou 4 vezes.

### 3. A premissa que guiava o incidente há 19 dias está errada, e tem número

Levantei as **23 falhas** por `executionTimeout` em 45 dias e a distribuição real
de **2.258 entregas** com `elapsed` preenchido (paginado — o Supabase corta em
1.000):

| chunks | n | p50 | p95 | MAX real | teto atual | folga |
|---|---|---|---|---|---|---|
| 1 | 586 | 7,26s | 73,47s | 460s | 30min | **4x** |
| 2-3 | 604 | 17,54s | 87,01s | 299s | 30min | **6x** |
| 4-6 | 636 | 38,97s | 103,42s | 221s | 30min | **8x** |
| 7-10 | 312 | 57,15s | 114,01s | 161s | 35min | **13x** |
| 11-15 | 120 | 95,99s | 153,49s | 330s | 45min | **8x** |

- **13 das 23 falhas são textos de até 3 chunks.** Duas delas são textos de
  **5 caracteres** (15/07 01:39 e 01:40) que morreram no teto de 30 min. Um
  texto de 5 chars tem p50 de 7,26s.
- **Pior sucesso real em 45 dias: 459,7s (7,7min).** p99 geral: 136,8s.

Toda a linha de fixes (timeout dinâmico `d50010d`, piso de 30min `60fb061`,
quota de GPU `568686f`) foi construída sobre *"texto longo não cabe no teto"*.
O dado diz que a falha é dominada por texto **curto** e que o teto **sobra em
toda faixa**. É por isso que três fixes de timeout não pararam a reincidência.

### 4. O que subiu pra produção — `1c09508`

O RunPod **já mandava** `executionTime` no webhook (e em `RunpodStatusResponse`
no poll) e o caminho da falha jogava fora, gravando só `status` e
`error_message`. A coluna `generations.elapsed_seconds` **já existia** e ficava
nula em toda falha. Agora o tempo é gravado na hora da falha, nos dois caminhos
(webhook e poll, pelo mesmo gate idempotente).

⚠️ **Correção a uma nota minha das 20:20 desta mesma noite:** eu escrevi que
capturar isso exigia *"coluna nova, migration, aval do Johnny (regra 21)"*.
**Estava errado — a coluna já existia.** O incidente ficou parado esperando uma
aprovação que nunca foi necessária.

O dado entra em coluna própria de propósito: a assinatura vem do texto do erro
(`incidents/classify.ts:87-109`) e identificador alfanumérico não normaliza —
concatenar no `error_message` estilhaçaria a mesma falha em vários incidentes de
"1x", como já aconteceu com o Errno 28. `error_message` **intocado**.

Junto foi um guard de UI: com `elapsed_seconds` preenchido na falha, o rodapé do
`voice-generator` mostraria *"gerado em 1879.6s"* embaixo da mensagem de erro
vermelha. Agora só renderiza em take `ready`.

**Verificado onde importa (playbook P):** `tsc --noEmit` e `eslint` limpos
(rodados por mim, não só pelo executor); presente em `origin/main`; presente no
arquivo em `/mnt/volume/aiverse/frontend`; Action `success` em 2m38s; pm2
reiniciou (PID 254828 → 259898, restart 250 → 251); `localhost:3002` HTTP 200.

### 5. O que isso destrava

Na **próxima** ocorrência, sem ninguém correr contra o relógio, a linha do banco
responde sozinha:

- `elapsed_seconds` **alto** (queimou o teto) → **HANG confirmado**. Aí o piso de
  30min do cold start cai por terra e o teto pode ser cortado com segurança — o
  pior sucesso real é 7,7min, então o aluno pararia de esperar 30min por um job
  já morto.
- `elapsed_seconds` **baixo** com morte tardia → **COLD START real**, e o piso
  está certo.

**A única hipótese que eu não consegui matar hoje:** o job das 20:46 pode ter
caído num worker recém-subido do `-e2`, e cold start de verdade não se distingue
de hang sem esse dado. É exatamente o que o `1c09508` passa a medir.

### 6. Tentei o log de novo, e de novo 404

`GET /v2/2jcta960kzc2m4/status/e924b05f…` e `/v2/0qd28qwo9ptcp4/status/…` →
**HTTP 404 "job not found"**, 76 min depois da falha. Idem pro job das 18:05
(`1ccc1ecf`). **Terceira rodada consecutiva** provando a mesma coisa.

---

## Incidente 2663506d — Vídeo Clone, fcdnanda@hotmail.com

Sem reincidência desde 20:19 (3,5h). Quadro dela desde as 20h: 20:16 `failed`,
20:17 `failed`, 20:19 `failed`, 20:36 `ready`, 20:49 `ready`. Os 3 débitos
seguem integralmente estornados. Nada preso.

**O mesmo remédio não cobre este incidente, e o motivo é uma coluna.**
`video_clones` tem: `id, user_id, name, image_path, audio_path, duration_seconds,
num_frames, tier, credits_cost, status, runpod_job_id, video_path, error_message,
created_at`. **Não há campo de tempo de execução.** Capturar aqui exige coluna
nova = migration = aval do Johnny (regra 21). Levado como binária.

Diagnóstico da rodada anterior (fast-fail determinístico por entrada) continua de
pé e nada de hoje o contrariou.

---

## Estado geral no fim da rodada

- Travados: **0**. Incidentes abertos: **2** (ambos com nota desta rodada).
- Falhas em 24h: **6** (2 áudio, 1 imagem, 3 vídeo clone) — **todas estornadas**.
- Sweeps **vivos**, rodando de 5 em 5 min até 22:10 UTC.
- ⚠️ `trial_expiry` segue devolvendo erro em toda rodada — é a trava proposital
  de 18/08, **não** é falha nova (já registrado na rodada anterior).
- Ruído novo no log: `[ERROR][client] … M_ID` de minuto em minuto vindo de
  `chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon` em `/app/videos/clone`.
  **Não é nosso código** — é extensão do navegador de um aluno caindo dentro do
  nosso logger de erro de cliente. Não age, mas polui.

## Achado de processo (virou playbook S)

O commit `cce4248` da rodada anterior estava **na máquina e nunca no `origin`**
(`ahead 1`). Docs, sem risco — mas é o padrão exato do playbook P se repetindo
num lugar onde ninguém olha. Subiu junto nesta rodada.
