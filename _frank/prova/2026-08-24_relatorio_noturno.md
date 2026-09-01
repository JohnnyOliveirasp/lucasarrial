# 24/08 — Relatório noturno (consolidado do dia)

Fechado **25/08 01:20 UTC** (22:20 BRT de 24/08). Este arquivo é a prova
técnica; o Telegram levou o resumo e o caminho daqui.

Janela contada: **24/08 03:00 UTC → 25/08 01:20 UTC** (o dia 24/08 em BRT).

---

## 1. Produção — o que está NO AR agora (medido, não deduzido)

### 1.1 Site (Hetzner)

| | |
|---|---|
| Commit no ar | **`42e3b68`** — `fix(orphan-outreach)` (#127) |
| BUILD_ID no servidor | **`5kvbar5U0iEGwwjKc7XQ9`** |
| Build gerado em | **25/08 00:24:37 UTC** (Action `Deploy Frontend` de `42e3b68`, 00:22Z) |
| pm2 `aiverse` | **online** · 405 restarts acumulados |
| `main` × `origin/main` | **0 ↔ 0** — em sincronia, nada preso local |
| Deploys de frontend no dia | **15** |

**Prova por md5, não por Action verde.** O servidor não é checkout git
(`git rev-parse` lá devolve `not a git repository`), então "está no ar" tem que
ser medido no arquivo. O `42e3b68` alterou **um** arquivo:

| arquivo | local (`42e3b68`) | servidor | bate? |
|---|---|---|---|
| `frontend/src/lib/payments/orphan-outreach.ts` | `be3aa7872155f326e09b24b07bf33c63` | `be3aa7872155f326e09b24b07bf33c63` | ✅ |

**Está no ar.**

### 1.2 Worker de GPU (RunPod) — deploy SEPARADO

O worker não passa pelo deploy do site: `runpod-worker/` vira imagem Docker
apontada no template do RunPod. Confundir os dois é dar por entregue o que
nunca saiu.

| | |
|---|---|
| Último `Build RunPod Worker` **na main** | `7f0c796` — **success** (24/08 23:13 UTC) |
| Template `itkncnhn7y` (VOX B) | `ghcr.io/johnnyoliveirasp/lucasarrial-runpod:`**`7f0c796`** ✅ lido pela REST |
| Template `03vs3iiph6` (principal) | **404 na REST** — mesma limitação de ontem, não consegui ler de volta |
| Builds de worker no dia | **16** |

**Honestidade sobre o template principal:** não li a imagem dele com meus olhos.
O que tenho é que o passo de deploy falha o job de propósito se o `saveTemplate`
não voltar com a imagem nova, e o job passou — prova indireta forte, **não é o
md5**. O VOX B, que recebe a mesma imagem no mesmo passo, confirma `7f0c796`
diretamente.

⚠️ Havia um `Build RunPod Worker` **ainda rodando** às 00:59Z para `73a60bb`,
sha que **não está na main**. Push na `dev` aponta o **endpoint de TESTE**
(`fast_cloner_TESTE_dev`, commit `2018670`) — não toca produção.

---

## 2. O que eu resolvi hoje

**17 incidentes fechados** (15 `fixed`, 2 `ignored`), contra 5 ontem.
Números fechados: `112 102 101 111 95 90 79 94 109 121 82 125 126 15 108 52 127`.

### 2.1 Dois pagantes presos há um mês atrás de um incidente marcado "resolvido"

O `#72` (UPLOAD SILENCIOSO) estava `fixed`. A medição dos 7 afetados achou
**dois que nunca se recuperaram**, os dois pagantes ativos:

| aluno | parado há | crédito | acesso até |
|---|---|---|---|
| `jrfengenhariadf@` | **30 dias** (25/07) | 100.000 | **25/08 12:00 UTC** |
| `leandro.fitoway@` | **25 dias** (30/07) | 97.620 | 29/08 12:00 UTC |

**`leandro.fitoway` — medido, não inferido.** No R2, prefixo da voz `a6bc8184`:
**6 objetos** de 14 (índices `006 007 008 010 012 013`), gravados entre
19:02:59 e 19:03:02 de 30/07 — o envio durou **3 segundos** e parou. Baixei os
6 e medi com ffmpeg (`silencedetect -35dB`, leitura, sem GPU, sem crédito):

| | bruto | fala | razão |
|---|---|---|---|
| os 6 que chegaram | 575s (9min35s) | 561s (9min21s) | **0,976** |
| projeção p/ os 14 | **22,4min** | **21,8min** | — |

A gravação dele **servia** (passa nas duas réguas: 20min brutos e 10min de fala
limpa). Ele não tem voz **só** por causa do nosso upload.

**E-mail individual enviado 25/08 00:47:30Z**, conferido na pasta Enviados
depois de gravar (**uid 67, 4KB**). Diz: 8 de 14 arquivos não chegaram com a
numeração exata, a falha foi nossa, a gravação servia com os números medidos,
reenviar +3–5min de folga, as duas réguas explicadas, e **não promete** que o
defeito está 100% corrigido — porque não está. Crédito intacto, nunca cobrado.

⚠️ **A carta do jrf teria que ser diferente**: ele projeta ~18min e seria
recusado de novo se eu só dissesse "reenvie". Mandar a mesma carta pros dois
teria errado num dos dois casos.

**Causa real do `#72`, lida no código:** não foi o browser —
`voice-creator.tsx:369-374` **aborta** se qualquer PUT rejeita e manda
`slots.map(...)` (todas as chaves), e esse aborta existe desde `4848826`
(22/07), **antes** das duas vozes. Foi `rescue-stuck-uploads.ts:170-179`, que
lista o R2 e grava **o que achou** — corretamente. O defeito é **a aba/conexão
morrer entre os PUTs e o `uploads-complete`**, e ele **NÃO está corrigido** —
o que foi corrigido em 21/08 foi a mensagem parar de culpar o aluno.

**O buraco que custou 30 e 25 dias:** no caminho self-service **ninguém avisa o
aluno**. `rescue-stuck-uploads.ts` e `uploads-complete/route.ts` não importam
nenhum módulo de e-mail; só o caminho do onboarding/planilha avisa
(`import/route.ts:362`). A voz vira `rejected_too_short`, a mensagem honesta
fica numa linha que o aluno só lê se voltar na tela, e ninguém escreve pra ele.
**Não subi correção pra isso de propósito** — aviso automático é comportamento
NOVO de e-mail em massa e esbarra na regra 1 do `onboarding/avisos.ts`
("erro NOSSO não vai pro aluno"). Está na lista de perguntas binárias.

**`#72` continua `investigating`, e está certo que esteja.** Fechar agora seria
trocar "medi e avisei" por "resolvi" (regra 14).

### 2.2 A voz que saía "artificial" — três fixes na mesma família, no ar

A referência de voz era cortada no meio da palavra e o transcript não batia com
o áudio. Casos Kessuly (`#108`) e Dr. Negrini (`#124`).

| commit | o que corrigiu |
|---|---|
| `d912809` | transcript da referência = o que o **áudio cortado** contém (2ª passada de whisper) |
| `aa4aab9` | transcript fecha com `.` também quando termina em vírgula (validado no endpoint de teste: texto == áudio) |
| `ceac939` | referência **começa E termina** em fronteira de FRASE |
| `b9ff2e2` | treino não grava mais pausa+crossfade 0 na voz |

Mergeados na main em `7f0c796` e **no ar na imagem `7f0c796`** (§1.2).
`#108` fechado 25/08 00:19Z — **sem backfill**: cura sob demanda quando o aluno
reclamar. Isso está escrito na nota do incidente, não é omissão.

**Voz do Dr. Negrini retreinada**: `d1477574`, `trained_at` = **24/08 21:24Z**
(o `created_at` continua 03/08 porque o retreino é no mesmo registro). Amostra
21:24, teste da equipe 21:25 e uma geração 22:40 — **as três sem cobrar**.

### 2.3 "Seus créditos te esperam" ia pra quem cancelou, foi reembolsado ou deu chargeback

Gatilho: **Cássio Fialho** escreveu **duas vezes** na noite de 24/08 (23:06Z e
23:37Z) perguntando por que recebeu o convite depois de cancelar.

**Causa lida, não inferida:** `frontend/src/lib/payments/orphan-outreach.ts`
paginava `payment_events` **só** por `PURCHASE_APPROVED`. Filtros existentes:
`isTestEmail`, `product.id`, `hasAccount`, 1h de idade. **Em nenhum ponto
consultava `entitlements.status`**, nem `PURCHASE_CANCELED` / `REFUNDED` /
`CHARGEBACK` / `SUBSCRIPTION_CANCELLATION`. Compra aprovada uma vez entrava na
lista pra sempre; o lembrete de 3 dias também não reconferia nada.

**Medido** (`agent_state.orphan_invites` × `entitlements`, 171 convidados):
**9 não estão `active`**, 4 receberam **também o lembrete**, 3 deles em 24/08
14:00Z — incluindo **1 chargeback** (`reinaldo.luis9917`, 05/08) e
**1 reembolsado** (`claudiolelio`, 18/07).

Corrigido em **`42e3b68`**, no ar (§1.1): filtra por `entitlements.status =
'active'` no convite **e** no lembrete. `#127` aberto e fechado no mesmo turno.

**Não é o `#57`** (fixed): lá o teto de 1000 do PostgREST deixava o `Set
hasAccount` incompleto e cliente ATIVO COM CONTA recebia "crie sua conta" — a
guarda consertada foi a de **conta**. Aqui falta a guarda de **compra viva**.
Mesmo arquivo, guarda diferente.

`isTestEmail` exclui `@fastcloner.com`, **não** `@fshark.com` — por isso
`fabiano@fshark.com`, que é da casa, entrou na lista dos 9.

### 2.4 O resto que subiu (por peso)

| commit | o que mudou pro aluno |
|---|---|
| `0c306d6` | geração travada não segura mais o aluno 30 min — teto 30min → 8min+ (`#15`) |
| `f181b69` | chunk com trecho comido é resgatado por subdivisão em vez de falhar o job (`#52`) |
| `9d7bc17` + `4f24570` | QA parou de **reprovar áudio BOM**: sigla soletrada e texto em outro idioma |
| `adb09c2` | botão "Remover foto" zera a referência fixa (`#79`, Rafael) |
| `6e2f182` | blurb do Vídeo Clone não promete mais "consistente" — avisa o drift em áudio longo (`#97`) |
| `06a0a2b` + `64ff35f` + `8ac5da9` | chamados: duas filas (técnicos × atendimento), estado "Aguardando o aluno" com volta automática, escalação vai pro grupo e FECHA |
| `fd1d9c5` + `e12642b` | papel **SUPORTE** vê só Falhas e Agente; financeiro fica com admin |
| `de649dd` | escalação da Carol vai **só** pro grupo do WhatsApp — nunca mais zap privado (ordem do Johnny 24/08) |
| `3153332` | Carol retoma mensagem SEM RESPOSTA (sweep a cada 5min) — caso Pati |
| `22ffd9d` | a mesma falha virava 2 assinaturas e congelava o incidente (`#45`) |
| `95297f8` | cópia de todo e-mail enviado gravada na pasta Enviados (`#101`) |
| `28aa6f2` | as ferramentas não rodavam no servidor de produção (Node 18) |
| `a53ad46` | refator do `runpod-worker`: handler **1998 → 93 linhas** |

Ferramentas novas (rodam da minha máquina, não são código do site, nada a
deployar): `fabricar_referencia.cjs`, `normalizar_referencia.cjs`,
`conferir_transcript_referencia.cjs`, `aplicar_patch_vigia.cjs`.

### 2.5 Erro meu, e o que sobrou dele

Abri o `#125` às 20h dizendo **"28% das gerações entregues não cobram"**. Fui
conferir o motivo do fecho em vez de defender o achado: **o fecho estava certo,
o erro era meu.** 3 dias de gerações `ready` sem débito, por `generations.name`:

| name | qtd |
|---|---|
| **Amostra automática** | **110** ← grátis por desenho |
| (NULL) | 14 |
| Teste da equipe FastCloner — 24/08 | 1 |

Os 110 são a amostra que a plataforma gera sozinha depois do treino. **Eu não
tinha olhado a coluna `name`** e li amostra como venda perdida. Os 54% do dia
22/08 são 100% amostra. `#125` fechado como `ignored`.

**O resto, que é por isso que anotei em vez de só pedir desculpa:** dos 14 sem
`name`, **12 são dos alunos que estão exatamente nos chamados abertos**
(kessulyl ×5, clinicadrpepe ×5, lucianodepinho, leonardonogueiramv) — refação
por conta da casa, coerente, e o rótulo só passou a existir hoje (`0b06f26`).
**Sobram 2 sem explicação:** `feniciabh@gmail.com`, pagante ATIVA até 27/08,
86.890 créditos, sem chamado — gerações `c9978925` (20:50:45) e `9036d2be`
(20:50:52), 338 chars cada, as duas `ready`, zero linha em
`credit_transactions`. No dia 23 as gerações dela **foram cobradas normalmente**
(−400 e −400). Duas entregas do mesmo texto com 7s de diferença cheiram a rota
de refazer/take. **É hipótese, não causa: não li a rota.** Não é dano ao aluno
(a casa deixa de cobrar). Anotado no `#125`, não reabri.

---

## 3. O que precisa do Johnny (as perguntas binárias)

| # | pergunta | prazo |
|---|---|---|
| 1 | `jrfengenhariadf@` perde acesso **25/08 12:00 UTC**, pagante, 30 dias sem voz por falha nossa. **Estendo?** | **~11h** |
| 2 | `leonardonogueiramv@` (Dr. Negrini) vence **na mesma hora**, avaliando um retreino que a casa reconheceu que devia. **Estendo?** | **~11h** |
| 3 | Luciano de Pinho pediu **reembolso** e quer resposta do Lucas — 4ª promessa da casa na thread. **Autorizo?** | vence 26/08 |
| 4 | Voz recusada no self-service **não avisa o aluno** (custou 30 e 25 dias). **Ligo aviso automático por e-mail?** | — |
| 5 | `FASE_TELEMETRIA_SECRET` não está no servidor — o código sobe e **se desliga sozinho**. **Ponho a variável em produção?** | — |
| 6 | WAHA não está provisionado nesta máquina — **4ª ronda** sem conseguir postar no grupo do Lucas. **Provisiono?** | — |
| 7 | Cássio Fialho espera **uma linha** confirmando que o cancelamento dele está registrado (está: `canceled` desde 19/08). **Mando?** | — |

Detalhe do `#99` (Luciano), porque muda a resposta: ele **separou os dois
problemas** (uid 282, 17:45): *"A falta de naturalidade está muito mais no clone
do que na voz… O clone parece um boneco falando e com Lip Sync meio estranho."*
**Mandar ele gravar mais áudio não alcança o que ele reclama.** E ele diz de
quem quer a resposta: *"quem tem que resolver isso é o Lucas, ou alguém que ele
indicar. Afinal, comprei tudo dele."*

---

## 4. Estado geral

### 4.1 Incidentes abertos: **7** (5 `investigating` + 2 `aguardando_aluno`)

| nº | quem espera | idade | últ. vez | oc |
|---|---|---|---|---|
| `65` | **aluno** — pagantes ativos sem nenhuma voz pronta | 104,2h | 104,2h | 3 |
| `72` | **aluno** — upload silencioso (§2.1) | 92,8h | 92,8h | 26 |
| `97` | **aluno** — Vídeo Clone troca o rosto (Rafael) | 33,2h | 33,2h | 4 |
| `99` | **aluno** — Luciano, reembolso (§3) | 32,3h | 4,2h | 7 |
| `123` | **aluno** — Pepe, 3 promessas quebradas | 8,6h | 8,6h | 1 |
| `120` | `aguardando_aluno` — Sandra Diniz, pré-venda | 14,8h | 12,1h | 1 |
| `124` | `aguardando_aluno` — Dr. Negrini (§2.2) | 8,6h | 8,6h | 1 |

**Fechou ontem com 20; fecha hoje com 7.** Abertos hoje: 7. Fechados hoje: 17.

⚠️ `120` e `124` estão em `aguardando_aluno` e **não aparecem em nenhuma
contagem de "aberto"**. Registro de novo pra ninguém ler "5 de aluno" como
"5 pessoas esperando" — são 7.

⚠️ **A ronda das 00:2xZ reportou 9 abertos e este relatório reporta 7.** Não é
divergência: `15`, `52`, `108` e `127` foram fechados entre 00:19 e 00:22Z, ou
seja, **depois** da leitura daquela ronda. E `65` e `72` só voltaram pra
`investigating` porque a ronda das 23h50 achou o `72` em `fixed` escondendo dois
alunos presos há um mês (`e140c59`).

### 4.2 Filas: nada preso

As 6 tabelas da varredura (`voices`, `video_clones`, `react_jobs`,
`image_generations`, `generations`, `training_jobs`) — **zero** registro parado
em estado intermediário além do prazo.

### 4.3 Pagantes

- **Pagante trancado (pagou e está sem acesso): 0.** Conferido um a um na
  Hotmart viva: **107 suspeitos** no banco → **0 trancado, 0 na fronteira, 0 sem
  prova**. Trancar está certo em 107: 39 cancelaram, 58 inadimplentes, 10 trial
  que nunca virou pagamento. (Ontem: 93 suspeitos / 34 / 52 / 7.)
- **Pagante com crédito e SEM nenhuma voz pronta: 6** — era **4** ontem:

| aluno | crédito | sem voz há | acesso até | motivo |
|---|---|---|---|---|
| `jrfengenhariadf@` | 100.000 | **30 dias** | **25/08** | 3 dos 7 arquivos nunca chegaram |
| `leandro.fitoway@` | 97.620 | **25 dias** | 29/08 | 8 dos 14 arquivos nunca chegaram — **escrito hoje** |
| `ivanildezuca@` | 200.000 | 16 dias | 08/09 | 2 tentativas, só ~6min úteis (bug nosso já corrigido em 09/08) |
| `marcelopersonalthe32@` | 198.950 | 15 dias | 05/09 | falha técnica nossa no treino |
| `dr.aleciotenorio@` | 98.425 | 8 dias | 31/08 | **NOVO** — 17min < mínimo de 20min |
| `ycarlosk@` | 100.000 | 1 dia | 26/08 | **NOVO** — 1min < mínimo de 20min |

**`ycarlosk@` foi conferido e NÃO é 3ª vítima do `#72`:** 1 arquivo só, índice
`000` de 1, prefixo `onboarding_`, sem buraco de numeração — veio pela planilha,
e o caminho do onboarding **avisou** (4 e-mails na pasta Enviados, uid 4–7,
24/08 12:36Z). Aluno informado, dono existe, não mexi.

### 4.4 GPU

| endpoint | fila | workers |
|---|---|---|
| voz/treino (`2jcta960`) | 0 | 7 idle, 0 throttled ✅ |
| vídeo/react (`9get7wv7`) | 0 | 3 running, **2 throttled** |
| VoxBR (`0qd28qwo`) | 0 | 3 idle ✅ |

`throttled` no vídeo = o datacenter não tem GPU livre. **Nada a fazer no
código**, e com fila 0 não está segurando ninguém agora.

### 4.5 Dinheiro

**Estornos nas últimas 24h: 10 linhas / 12.072 créditos** (ontem: 36 / 64.779).

| tipo | linhas | créditos |
|---|---|---|
| `video_clone_refund` | 3 | 7.995 |
| `generation_refund` | 4 | 2.502 |
| `image_refund` | 3 | 1.575 |

**Dinheiro pendurado (débito sem entrega e sem estorno): 0.** Conferido item a
item nas 24h:

| tabela | falhas | com estorno |
|---|---|---|
| `generations` | 6 | 4 |
| `video_clones` | 0 | 0 |
| `image_generations` | 1 | 1 |

As **2 gerações sem estorno** são as duas da `kessulyl@` (18:47 e 18:53,
`qa_coverage`) e **não tiveram débito nenhum** (0 débitos, 0 estornos): são
refação **por conta da casa**. Nada a devolver. O "6 falhas × 4 estornos" lido
sem essa conferência viraria um alarme falso.

### 4.6 Caixa e canais

- **Fila não lida: 0** em todas as pastas (INBOX 285, Sent **67**, Archive 0,
  Trash 1, Spam 0, Drafts 0). Lido com `EXAMINE` + `BODY.PEEK`, sem atropelar a
  Fast.
- **Vigia: 0 patch pendente** (`agent_state` `patch_%` vazio) e **0 recado
  pendente** (`para_frank_%` vazio). Nada do trabalho dele morreu na fila hoje.

### 4.7 Números que mudaram de ontem pra hoje

| | 22/08 | 23/08 | **24/08** |
|---|---|---|---|
| Vozes criadas | 42 | 32 | **25** |
| Vozes `ready` | 37 | 31 | **24** (1 não) |
| Gerações de áudio prontas | 96 | 95 | **132** |
| Gerações **falhadas** | 0 | 5 | **5** |
| Taxa de falha | 0% | 5,0% | **3,6%** |
| Incidentes abertos no fecho | 3 | **20** | **7** |
| Incidentes fechados no dia | 10 | 5 | **17** |
| Pagante trancado | 0 | 0 | **0** |
| Pagante com crédito e sem voz | — | 4 | **6** |
| Estornos (24h, créditos) | — | 64.779 | **12.072** |

**Leitura honesta dos dois números que pioraram:**

- **Pagante com crédito e sem voz: 4 → 6.** Os 2 novos (`dr.aleciotenorio@`,
  `ycarlosk@`) **não são falha técnica nossa** — os dois enviaram menos áudio do
  que a régua exige (17min e 1min contra 20min). O que é falha nossa é o item 4
  da §3: no self-service **ninguém escreve pra eles**.
- **Vozes criadas caíram 32 → 25.** Não tenho causa medida. Pode ser volume
  normal de domingo→segunda. **Não conte como saúde nem como problema até ter
  série maior.**

---

## 5. O que NÃO foi verificado — não conte isto como saúde

- **A telemetria de fase está INERTE em produção.** Medido: **0 de 92**
  gerações desde 24/08 16:00Z carregam `qa->fase_corrente`. O código foi lido:
  `fase-telemetria.ts` retorna `{}` quando `FASE_TELEMETRIA_SECRET` está ausente
  ou tem menos de 16 chars — a feature **se desliga em silêncio** e o worker não
  posta nada. Ou seja: `b9bc646` e `1c72d77` estão no ar e não fazem nada.
  Isso já tinha sido apontado às 16:49 (`406c03b`) e continua de pé.
  ⚠️ **Não confirmei a ausência da variável no servidor com meus olhos** — meu
  próprio guard de segredo bloqueou o `ssh + grep .env`. O que eu tenho é o
  efeito medido (0/92) mais o código que documenta o off-switch. É pergunta 5
  da §3.
- **O `#15` foi fechado como `fixed` hoje 00:19Z carregando nota de 20/08 que
  diz, com todas as letras, "FECHADO POR DECISAO DO JOHNNY (20/08) — NAO E UM
  FIX, e aceite de risco consciente".** O `0c306d6` de hoje reduziu o teto de
  30min pra 8min+, o que encurta o sofrimento do aluno, mas **a causa do
  `executionTimeout` continua sem diagnóstico** — e a telemetria que ia
  diagnosticar é a que está inerte (acima). Duas falhas por timeout hoje
  (`brauliomarcos3@` 15:49, `gusperandio2@` 20:05), as duas estornadas.
- **A imagem do template principal do RunPod (`03vs3iiph6`)** — 404 na REST,
  prova indireta (§1.2), não medida direta.
- **O defeito do `#72` NÃO está corrigido**, só mitigado: a aba/conexão morrer
  entre os PUTs e o `uploads-complete` continua possível.
- **A projeção de 22,4min do leandro é projeção**, não medição — os 8 arquivos
  perdidos não existem pra medir. Está dito assim no e-mail dele e aqui.
- **Envio ≠ entrega.** Tenho o uid 67 na pasta Enviados; não tenho confirmação
  de leitura, e **bounce não escreve `last_seen_at` em lugar nenhum** — aluno
  que não recebeu a resposta é invisível pro detector. Toda vez que eu digo
  "aluno avisado", vale o que esse registro vale.
- **O detector de "fechado que volta a disparar" tem 3 buracos conhecidos:**
  só olha `last_seen_at`; bounce de e-mail não o alimenta; e **e-mail errado
  ENVIADO com sucesso** (o caso do `#127`) também não dispara nada. Hoje ele
  reportou 1 de 109 (`acf8acd6`, quieto há 53h, zero disparo novo).
- **As 2 gerações da `feniciabh@` sem cobrança** (§2.5) — hipótese de rota de
  refazer, não li a rota.
- **A cota do Supabase continua sem monitor.** A causa do apagão de 22/08
  (7,5M requisições de polling em 98 dias) está intacta. A data do próximo 402 é
  aritmética, não azar.

---

## 6. Regra 7 — o grupo do Lucas segue inalcançável (4ª ronda)

Medido de novo, não herdado: `avisar_grupo.cjs` aborta com
`WAHA_API_URL/WAHA_API_KEY ausentes nesta máquina`, e o `--fato` do **PR #37**
continua **fora da main** (o script ainda exige `--assunto`/`--pergunta`).
Os fatos do dia foram pro Telegram. **Isso precisa de provisionamento, não de
mais uma anotação.** É a pergunta 6 da §3.
