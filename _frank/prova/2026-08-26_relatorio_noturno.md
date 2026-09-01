# Relatório noturno — 26/08/2026 (consolidado do dia)

Fecha o dia inteiro: 8 rondas do vigia (10h→00h UTC) + 11 rondas da rotina das
falhas (00h→23h40 UTC). Este arquivo é o lastro técnico da mensagem enviada ao
Johnny no Telegram — a mensagem aponta para cá, não repete os números.

Regra que governa este relatório: `_frank/06_RELATORIO_E_LIMITES.md`.
**Manda todo dia, inclusive em dia limpo.** Silêncio não pode parecer saúde —
foi essa confusão que deixou 43 vozes paradas por semanas.

---

## 1. Prova de produção — BUILD_ID no servidor, não Action verde

Johnny pediu explicitamente que "está no ar" seja provado no **servidor**. Foi.

```
curl -s https://fastcloner.com | head -c 60
<!DOCTYPE html><!--MhNDSFFdG76u1_yy1jkJJ--><html>...
```

| | |
|---|---|
| BUILD_ID servido pela produção | **`MhNDSFFdG76u1_yy1jkJJ`** |
| Commit que gerou esse build | **`85fcd3e`** (run `33027165010`, SUCCESS 00:32Z) |
| Nenhum deploy de frontend mais novo existe | conferido em `gh run list` |

**O que está DENTRO desse build** (provado com `git merge-base --is-ancestor`,
não por leitura de log):

| commit | o que faz | incidente |
|---|---|---|
| `def14fb` | run que não mediu nada não afirma duração ao aluno (Parte A) | `146` |
| `2dd1150` | OneDrive pós-SPO baixa via cadeia FedAuth + `_api/v2.0` | `144` |
| `6c15df8` | 401/403 para de dizer ao aluno que o link dele venceu | `144` |
| `37d982f` | lista passa a dizer que falta o **clique do aluno** | `137` |
| `1013b20` | registra o ramo da cura do transcript e o build do worker | `52` |

### 1.1 O que NÃO está em produção, e eu digo com todas as letras

**`d399d78` (PR #63 — telemetria de cobertura do `#52`) NÃO está no ar.**

Mergeado na `main` às **20h48 local**. Ele mexe em `runpod-worker/`, então não
passa pelo deploy de frontend: ele depende do workflow **`Build RunPod Worker`**,
run `33028068037`, que estava **`in_progress` no fechamento deste relatório**.

Registro isto porque é exatamente a armadilha que derrubou a ronda das 23h hoje
(§4): **PR mergeado ≠ em produção**. A régua fica: só afirmo "no ar" com
`git branch -r --contains <sha>` **mais** o artefato servido (BUILD_ID no
frontend, imagem publicada no worker).

---

## 2. O que foi resolvido hoje — 8 incidentes fechados, 9 abertos

Fechados (`resolved_at` dentro de 26/08, ordenados):

| hora | id | o que era |
|---|---|---|
| 00h49 | `42741499` | varredura rotulava **trial R$0 como "pagante"** — 4 de 5 da lista nunca pagaram |
| 02h36 | `62e2216c` | aluna mandou pasta OneDrive com fotos de IA, link não abria |
| 10h51 | `fc02db41` | Sidney sem acesso à plataforma |
| 11h40 | `07af5758` | link do áudio corrigido no Google Drive |
| 11h50 | `a3ced7ac` | **12 alunos com 20–50min gravados e voz nunca treinada** |
| 13h44 | `86a27343` | aluno reenviou link após erro 401 |
| 14h50 | `9c6cc7e6` | **OneDrive morreu no onboarding: 5 de 5 links devolviam 401**, inclusive 2 que provadamente funcionavam |
| 19h55 | `70b6b807` | Sandra — reembolso da compra de 23/08 (virou o `#120`) |

O de maior alcance é o `9c6cc7e6`: enquanto ele esteve vivo, **todo** aluno que
mandou material por OneDrive foi recusado com uma mensagem que culpava o link
dele. Foi o que segurou a Luziélia.

### 2.1 A Ivanilde — a promessa cumprida que ninguém contou

Achado da ronda das 19h, e é o tipo que dói mais que bug:

| promessa feita em 24/08 21h52Z | estado medido |
|---|---|
| reprocessar o áudio por conta da casa | **CUMPRIDA** — voz `4c2c4abc` `ready` em 24/08 22h53 BRT |
| avisar quando ficasse pronta | **NÃO CUMPRIDA** — 0 e-mail depois do uid 57 |

A parte cara (GPU, treino) saiu 4h depois do e-mail. Ela ficou **41 horas** com a
voz pronta sem saber. O que faltava custava um e-mail. Mandado.

---

## 3. O achado que mais vale do dia: 13,6% das entregas saem abaixo da régua

Ronda do vigia das 00h. **Ninguém tinha olhado esse contador em nenhum dia** —
`grep exhausted _frank/prova/*.md` voltava vazio.

`runpod-worker/jobs/inference.py:306`, `_entregar_mesmo_com_cobertura_baixa()`,
mudança de 20/08: cobertura abaixo de `coverage_qa_min` (0,85) **só** derruba o
job se a lacuna for um trecho **contínuo**. Lacuna **espalhada** entrega assim
mesmo. A decisão tem motivo medido (sem ela, áudio bom reprovava toda vez que o
texto tinha markdown). **Não é a decisão que está em questão.**

A linha 331 do próprio código pediu a medição — *"deixa o rastro no log pra medir
se essa decisão está certa na prática"* — e ela **ficou 6 dias sem ser feita**.

Base: **286 gerações entregues** (`status='ready'`) com telemetria, desde 24/08.

| | |
|---|---|
| Entregues pela escotilha (`coverage_espalhada` > 0) | **39** = **13,6%** |
| Chunks entregues abaixo da régua | **68** |
| Alunos distintos | **28** |
| `coverage_best` gravado em entrega | **0 de 286** |

**O ponto cego é o achado de verdade.** `coverage_best` só entra no payload de
falha (`inference.py:455`). Então das 39 que passaram pela escotilha, **não dá
para saber hoje** se a cobertura era 0,84 (inofensivo, é markdown) ou 0,1 (o
defeito do caso Kátia, com a lacuna por acaso picotada). As duas leituras cabem
nos dados que existem — e é exatamente esse o problema:

> 13,6% de entrega correta **ou** 13,6% de aluno recebendo áudio furado em
> silêncio. Sem falha, sem estorno, sem incidente, sem nada que acenda.

**Correlação declarada como correlação, não causa:** 4 dos 28 alunos já estavam
nomeados em chamado aberto de qualidade de áudio (`danicale`, `kessulyl`,
`godoyalessandroadv` no `#52`; `giovannaveterinaria` no `#133`). Ninguém tinha
ligado uma coisa na outra. **Não é afirmável** que a escotilha causou a queixa
deles sem o `coverage_best` — por isso virou **nota** no `#52` e no `#133`, e não
chamado novo nem e-mail para aluno.

**O conserto existe e está mergeado** (PR #63, `cc822b3`): o worker passa a
chamar `registrar_cobertura(self.qa_stats, ...)` no caminho de **entrega**, não
só no de descarte — inclusive dentro de `_resgatar_por_subdivisao`, para medir o
sub-pedaço que o aluno realmente recebe. Falta a imagem do worker subir (§1.1).

---

## 4. O achado de processo: o board dizia "pronto" e o fix estava fora do ar

Ronda das 23h40. O card `93f56e4d` estava **completed**, o PR **#64 aberto**, e a
ronda anterior havia registrado `git log origin/main..HEAD` **vazio**. Mesmo
assim o commit do fix (`0abaeb0`) estava **só na main local**, não empurrado —
`origin/main` seguia em `349525b`.

**Lição, e ela vale para toda ronda futura:** `origin/main..HEAD` vazio **não
prova** que o fix está no ar. Ele sai vazio tanto quando não há nada pendente
quanto quando alguém commitou depois da checagem. A pergunta que prova é:

```
git branch -r --contains <sha>     # se origin/main não aparece, NÃO está em produção
```

Desfeito no mesmo turno: main local resetada para `origin/main` (nada se perdeu,
o conteúdo estava dentro do branch do PR #64) e a Parte A subiu pelo caminho
certo — `feat/inc146-parte-a` → PR #65 → merge `def14fb`.

---

## 5. O `#146` está partido de propósito

**Parte A — no ar.** `import/route.ts`: `audioCurto` passa a exigir `imported > 0`.
Um run que não mediu nada não afirma nada ao aluno sobre duração. Para a
repetição do e-mail de recusa: **16 recusas duplicadas medidas** (robson 3×,
itabenke 3×, isabella 3×, adrianomarques 2×, aleciotenório 2×, kelinnavelar 2× —
esta levou recusa de **áudio** por causa de uma **foto**). A régua não mudou:
`MIN_TOTAL_SECONDS` e `estimateSpeechSeconds` intactos. O objetivo é o portão
**rodar**, não afrouxar.

**Parte B — NÃO subiu, e é decisão do Johnny.** Ela reabre a importação quando
chega `fileId` novo — é o que destranca a porta. Só que o caminho termina em
`tentarTreino` → `dispararTreinoOnboarding` → `debitCreditsOnboarding`, que
debita `TRAINING_CREDIT_COST` **sem trava de saldo** (o aluno fica negativo). Os
**5 alunos hoje parados** em `rejected_too_short` **nunca pagaram** (conferido em
`pagou_de_verdade.cjs`). Escalado nas msgs 474 e 475, sem resposta até o
fechamento. **PR #64 fica aberto de propósito** e precisa de rebase quando
liberar (a lógica pura e os 18 testes já entraram pelo #65).

---

## 6. Dois falsos alarmes que a medição derrubou antes de virarem ruído

**(a) "O e-mail do Luciano saiu embaralhado".** O último e-mail para ele aparece
nos Enviados cheio de `Voc&ecirc;`, `n&atilde;o`. Parecia regressão do bug de
acentos de 25/08, no caso mais sensível que existe hoje. **Não é.**
`enviar_email.cjs` manda `Content-Type: text/html` + base64; a entidade HTML
**renderiza certo** no cliente do aluno. Quem não decodifica é o nosso leitor
(`ler_caixa.cjs` tira as tags e deixa a entidade crua). **O aluno leu certo.**
⚠️ Auditar "o que o aluno recebeu" pela pasta de Enviados **engana**.

**(b) A Telma como "pagante travada".** Aparece no bloco 🚨 da varredura (acesso
vivo, 58.775 créditos, nenhuma voz pronta, acesso vencendo **27/08**), 60min de
áudio em `awaiting_training`. **`pagou_de_verdade.cjs`: NUNCA PAGOU** —
assinatura R$0 APPROVED, que é trial. E `awaiting_training` **não é travamento
nosso**: a voz espera o aluno **clicar** (há registro de gente parada 43 dias
aí). Cai na REGRA FINAL DE CRÉDITO de 20/08. **Não escrevi para ela.**

**(c) O `last_seen_at` parado do `#52` está CORRETO.** A suspeita de detector
cego era plausível e foi conferida antes de virar alarme: o incidente é
alimentado por `generations.error_message`, que só conta `status='failed'`. Não
houve falha desde 15h47Z, então o campo **não deveria** ter se movido. O ponto
que sobra é mais fino: **o detector enxerga a falha e é cego à entrega
degradada**, que por desenho não vira falha.

---

## 7. Estado no fechamento

### 7.1 Incidentes abertos: 6 (mesma contagem de ontem, composição outra)

| # | idade | estado |
|---|---|---|
| `120` Sandra — pré-venda / reembolso com CDC | aberto hoje 19h55Z | Termos **em rascunho**. Prazo que ela alega: **30/08** |
| `146` portão de 20min reprovou 27min de fala | aberto hoje 19h31Z | Parte A no ar; Parte B com o Johnny |
| `52` qa_coverage (24 ocorrências) | 19/08 — **7 dias** | telemetria mergeada, imagem do worker subindo |
| `99` Luciano | 23/08 — **3 dias** | respondido 5× (última hoje 20h51Z). Falta **posicionamento de pessoa**. Prazo: **02/09** |
| `143` turno da noite nunca ligado | aberto hoje 10h19Z | espera a linha do Johnny |
| `97` video clone muda o rosto (drift) | 23/08 — **3 dias** | **sem correção técnica possível hoje**; alunos respondidos, entregue ao time em 24/08 |

Ontem (25/08 22h) eram também 6, mas eram `47`, `97`, `99`, `52`, `108`, `135`.
**9 abertos e 8 fechados hoje** — a contagem estável esconde a rotatividade.

### 7.2 Aguardando aluno: 6 (a bola não é nossa, mas 7d+ pede segunda tentativa)

| # | idade | |
|---|---|---|
| `47` | **7d** | ⚠️ vencido — pede segunda tentativa, não silêncio |
| `65` | **6d** | ⚠️ Marcelo é **pagante**, parado desde 10/08 |
| `72` | 5d | upload silencioso, 7 alunos |
| `124` | 2d | Dr. Leonardo Negrini, voz treinada 03/08 (antes do fix) |
| `133` | 1d | Giovanna — **aguarda há 15 dias**; é dela a pista do §3 |
| `139` | 1d | 2 trials recusados no portão de 20min |

### 7.3 Presos na varredura: 4 (acesso vivo, com crédito, sem nenhuma voz pronta)

| aluno | sem voz há | acesso até | pagou? |
|---|---|---|---|
| `leandro.fitoway@gmail.com` | **27 dias** | **29/08** | — |
| `marcelopersonalthe32@gmail.com` | 17 dias | 05/09 | **pagante** (`#65`) |
| `definidameta@gmail.com` | 1 dia | 01/09 | nunca pagou |
| `telma@centia.com.br` | 0 dias | **27/08 (hoje)** | **nunca pagou** — trial R$0 (§6b) |

Mais 1 linha obsoleta em `training_jobs` (job `ebf5cc56` → voz `f4b9b0f2` já
`ready`): escrituração pendente, **ninguém esperando**.

### 7.4 Pagante trancado: 0

`pagante_trancado.cjs` conferiu **132 suspeitos um a um na Hotmart**:
**0 pagante trancado · 0 na fronteira · 0 sem prova.** Trancar está certo nos
132: 50 cancelaram, 72 inadimplentes, 10 trial que nunca virou pagamento.

### 7.5 Motor

| | |
|---|---|
| Gerações hoje | **126** — 3 falhas |
| Pendente agora | **1**, parada há **1 minuto** (em voo, não travada) |
| Vozes que ficaram prontas hoje | **15** |
| Fila de não-lidos da Fast | **0** |
| Fechados que voltaram a disparar | 1 de 127 (`acf8acd6`), última ocorrência **100,7h** atrás — **0 vivos em 72h** |

---

## 8. A janela cega começa agora (`#143`)

Premissa conferida no cron, não repetida do título:

| rotina | cron (hora local) | cobre |
|---|---|---|
| Vigia | `10 6-21/2 * * *` | 06h10 → **20h10** |
| Rotina das falhas | `40 6-21 * * *` | 06h40 → **21h40** |

Depois da rotina das 21h40 local **não há ninguém até 06h40** — **~9h por dia**.
Não é teórico: foi dentro dessa janela que a bola da Luziélia ficou **7h45**
parada. Ligar turno é decisão do Johnny; o chamado está aberto e honesto.

---

## 9. O que eu NÃO fiz, e por quê

- **Não escrevi para a Giovanna** (`#133`), apesar de ser dela a pista mais
  concreta do dia. A medição foi para o incidente e para o Johnny; sem
  `coverage_best` não há o que afirmar a ela.
- **Não escrevi para os 6 que levaram recusa duplicada.** São trial churnado e
  seis destinatários com conteúdo novo — é e-mail em massa, precisa do "pode".
- **Não toquei em crédito, acesso, assinatura ou estorno** — inclusive na Telma,
  cujo acesso vence hoje.
- **Não mergeei o PR #64.** Envolve dinheiro de aluno e a resposta não veio.
  Reverter em silêncio uma escalação sobre cobrança não é decisão de ronda.
- **Não liguei o turno da noite**, mesmo tendo medido o buraco de 9h.
- **Não apliquei migration. Não mexi em cron, nginx, endpoint do RunPod ou
  variável de ambiente.**

---

## 10. Para quem pegar a próxima ronda

1. **Conferir se a imagem do worker subiu** (run `33028068037`). Só depois disso
   a telemetria do §3 começa a medir — e só aí o `#52` fica julgável.
2. **`#146` fecha quando a Parte B subir.** Se liberar: rebase do PR #64 sobre a
   main; o diff vira só `import.ts` (a lógica pura e os 18 testes já estão lá).
3. **Não confie em `origin/main..HEAD` vazio** para afirmar produção (§4).
4. **Não audite e-mail de aluno pela pasta de Enviados** (§6a).
5. **Fila que pede segunda tentativa:** `#47` (7d), `#65` (6d, Marcelo é pagante
   parado desde 10/08), `#72` (5d, leandro.fitoway sem voz há **27 dias** e
   acesso vencendo **29/08**).
6. **`#137`** está `fixed` de 25/08 e a Telma caiu no mesmo estado em 26/08.
   Vale conferir se o conserto cobre caso **novo** ou só curou os 12 de então.
7. **Não gaste tempo** com timeout de 90s, `MAX_FILES` ou stderr do ffmpeg no
   `speech-estimate.ts` — refutado no código.
