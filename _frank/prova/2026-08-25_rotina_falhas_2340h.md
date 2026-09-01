# Rotina das Falhas — 25/08/2026, ~23h40–23h55 UTC (dono da fila)

`git checkout main && git pull --ff-only origin main` → em dia. Índice de ordens
lido. Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐), a
`2026-08-20_REGRA_FINAL_CREDITO.md` e a de 21/08 (`fd0b0f5`: método serial,
regra 7 de fato consumado, regra 8 de e-mail individual).

## Placar

| | |
|---|---|
| Fila no início (sem cláusula de assinatura) | **2** abertos — `47` e `97` |
| Fila no fim | **2 abertos + 1 novo que eu abri** (`137`) — e `47` saiu pra `aguardando_aluno` |
| Incidente que eu trabalhei até o fim do que era meu | **1** — `47`/`ce6e157d` (Katia) |
| Incidente novo que eu abri | **1** — `137`/`a3ced7ac` (§4) |
| Aluno avisado por mim | **nenhum** — e digo por quê em §4 |
| Crédito indevido devolvido | **nada devido** — conferido, §2 |
| GPU que eu queimei | **nenhuma** |
| Crédito / acesso / `entitlements` que eu toquei | **nenhum** |
| Commit preso que eu destravei | **2** (§0) |
| Causa que eu levantei e **derrubei** com medição | **1** (§4) |

---

## 0. Cheguei e a main local estava 2 commits à frente do origin

`git status` na chegada: **"ahead of 'origin/main' by 2 commits"**. Os dois eram
da ronda anterior, de 25/08 22:49Z:

- `1f82c3a` — a seção 10 do log das 21h, que tinha ficado na árvore sem commit.
- `d29959b` — `refazer_audio_conta_da_casa: --texto-arquivo e --nome`, que é **a
  própria ferramenta usada pra curar a Katia**.

Ou seja: a ronda anterior consertou a falha "registro fora do commit" e caiu na
seguinte, "commit fora do origin". Em 19/08 um fix de aluno ficou 9h preso assim.
Empurrados nesta ronda (`2825859..d29959b`), conferido com `origin/main..HEAD`
vazio depois.

Os dois só tocam `_frank/` (ferramenta + log), que é o que a ordem manda mandar
direto pra main. Nenhum código de produção foi pra main por fora de PR.

## 1. Por que peguei o `47` e não o `97`

Regra 8, sem desvio: `47` é o mais antigo com aluno afetado (155,5h contra 55,9h).

## 2. `47` (Katia) — a entrega já tinha saído e **ninguém tinha anotado**

Rule 1 da rotina ("já resolveu sozinho?") pagou o ingresso. O estado real, que o
incidente **não** contava:

- Geração `81d4f3f4` (25/08 22:48Z) na conta dela, nome
  `Conta da casa — Portal da Morgana — com respiro entre as frases`.
- E-mail enviado 22:55Z (Enviados uid 112).

O incidente estava em `investigating` com a última nota das 21:37Z dizendo que o
único caminho era retreino com GPU. **A ronda seguinte ia refazer tudo isso.**
Anotei (nota 27) e movi pra `aguardando_aluno`.

**Conferi a promessa que ela vai testar em minutos:** o e-mail diz que o áudio
está na conta com aquele nome. Fui no banco ver se o nome existe mesmo — existe.
Ela vai achar. Promessa escrita que não se sustenta foi o que quebrou a confiança
da Janete hoje mais cedo; não custava nada conferir.

**A cura:** mesmo texto reformatado em parágrafos (cada frase vira um chunk),
sem alterar uma palavra — 99 palavras nos dois áudios.

**Medido** (`medir_pausas_da_entrega`, A=`47dc0f6e` reclamada × B=`81d4f3f4`):

| | A | B |
|---|---|---|
| articulação | 3,205 pal/s | **2,941 pal/s** (−8,2%) |
| `realmente` (o "rápido demais" dela) | 0,40s | **0,48s** (+20%) |
| silêncio total | 6,09s | 6,20s |
| pausas | 15 (mediana 335ms) | 11 (mediana **373ms**) |

**Crédito: nada devido.** `credit_transactions` da Katia desde 23/08 = **zero
linhas** — as 3 gerações por conta da casa de 25/08 não cobraram nada. Os
estornos antigos conferidos por `ref_type='generation_refund'`, **nunca por
`kind`** (4 linhas em 19/08).

### Por que eu NÃO fechei, tendo número bonito na mão

Entonação e pronúncia são perceptuais e **eu não tenho ouvido**. Tentei delegar a
escuta A/B ao worker de áudio e ele respondeu que não consegue carregar áudio —
**registro a recusa dele em vez de inventar percepção**. Sem isso eu estaria
carimbando "melhorou" a partir de uma régua.

Este chamado **já foi fechado uma vez assim**: 21/08 18:41, com prova de medição,
e a aluna reabriu às 19:20 dizendo que continuava corrido. A nota 22 do próprio
incidente escreve: *"fechei com régua e sem ouvido"*. Não repito o erro que está
documentado duas telas acima.

Quem decide se melhorou é ela, e a pergunta foi feita a ela por escrito. Isso não
é travamento: mandei/estava mandado, anotei a data, o item saiu do meu colo.

### O resíduo que eu não deixei morrer no fechamento

Foi dito **a ela por escrito** que duas marcações continuam abertas:
`reconstrução` mal pronunciada e a pausa do seg 5 caem no **meio da frase**, não
na emenda — a reformatação não alcança. Se ela responder "melhorou", o chamado
**não fecha limpo**: isso sobra, e está na nota 27.

### O fix de raiz não está em produção

**PR #56** (`feat/tts-chunkmax-por-job`, aberto 25/08 20:00) é a correção de raiz
deste chamado e segue **sem merge**. Enquanto não mergear, a cura é manual, um
aluno por vez, via ferramenta. Não mergeei: é código do worker de GPU e merge sem
revisão não é decisão minha.

## 3. `97` — não é tarefa de fila, é decisão parada

Conferido antes de dizer que está bloqueado: os **3** alunos
(`rafapaga`, `kessulyl`, `viniciusramon2009`) já foram estornados — o último,
Rafael, na ronda das 15h. `last_seen_at` **55,9h**, igual ao `created_at`:
**nenhuma ocorrência nova em 2 dias**. Ninguém no silêncio.

O que falta é a decisão de produto formulada em 24/08 (aviso na tela acima de 60s
enquanto o motor não re-ancora o rosto) — **com o Johnny**. Custo de não decidir,
já medido na ronda das 15h: 3 alunos, 24.045 cr devolvidos em 3 dias. Não
re-escalei em texto novo: repetir a mesma pergunta em vez de agir foi exatamente
o que a passagem de 21/08 registra como falha.

## 4. O achado da ronda: 12 alunos a **um clique** de ter voz, alguns há 37 dias

Abri o **`137`/`a3ced7ac`**.

`awaiting_training` é o estado em que a voz **já passou** no portão de 20min e só
espera o aluno clicar em Treinar (`voice-status-panel.tsx:100-122`). Não é
travamento nosso. O problema é que **ninguém nunca fala com essas pessoas**.

| | |
|---|---|
| vozes em `awaiting_training` | **17** — idade média **478,9h (~20 dias)**, mais velha **1028h (~43 dias)** |
| já passaram o portão de 20min | **13** (12 alunos reais + a conta de teste do Lucas) |
| áudio já gravado e enviado | de **20,5 a 50,3 minutos** |
| saldo | **45.371 a 187.000** — 12 dos 13 têm muito mais que os 10.000 do treino |

**Relógio curto, e é por isso que abri agora:**

| aluno | gravado | parado | acesso vence |
|---|---|---|---|
| `danielvsferreira@gmail.com` | 35,5min | 3,4d | **27/08 12:00Z (~36h)** |
| `anderferri85@gmail.com` | 30,3min | 8,3d | **27/08 12:00Z (~36h)** |
| `institutoforumpublico@gmail.com` | 20,8min | 25,3d | **já venceu em 23/08** |

### A causa que eu levantei e **derrubei** com medição

A hipótese óbvia era a mensagem velha de saldo do incidente `64`/`bea487b7`
(*"você tem 0 créditos"* para quem tem saldo) — ainda mais que o **PR #20** está
aberto e sem merge há 5 dias e descreve exatamente esse modo de falha.

**Medido: `voices.error_message` está VAZIO nos 13, sem exceção.** Não é a
mensagem velha. O fix `dafd7fd` (`destravar-aviso-credito.ts`) está na main desde
20/08 e cobre a entrada de crédito.

**Não cravei causa nova.** Não sei por que eles não clicaram, e este repo já
cravou causa errada 2× — prefiro registrar a hipótese morta a entregar uma viva
sem prova.

### Por que eles são invisíveis

`onboarding/pronto.ts:122-124` exclui `awaiting_training` da contagem de voz
morta **de propósito**, e a varredura só os mostra quando o aluno não tem nenhuma
voz `ready`. Quem está parado ali há 37 dias não dispara nada e não recebe nada.

### O que eu NÃO fiz, e por quê

**Não mandei e-mail.** São 12 pessoas que **nunca escreveram pra gente** — isso é
disparo proativo em lote, e a regra 8 de 21/08 diz que e-mail em **massa** precisa
do "pode" do Johnny. Individual, de aluno que escreveu, eu mando sozinho e não
seguro; **este não é o caso**. Escalado ao Johnny nesta ronda, com os dois
relógios de 36h na frente.

## 5. As verificações que a ordem manda fazer

- **`ignored`/`fixed` com `last_seen_at` recente:** os `52`, `108` e `135` foram
  fechados como `ignored` por **`johnny.oliveirasp@gmail.com`** às 22:39Z — três
  em 11 segundos. Decisão do dono, não relitigo. **Registro dois fatos**, porque
  a ordem manda olhar isso e não porque eu discorde: o `135` ficou **sem
  `resolution_note` nenhuma**, e o `52` foi fechado carregando uma nota de 20/08,
  depois de ter sido reaberto pelo sistema às 21:48Z pela falha da Janete
  (pagante que recebeu promessa escrita de que o inglês estava liberado). Se
  alguém abrir esses dois amanhã, não vai achar o porquê escrito.
- **`135` tem relógio e ele não parou de andar com o fechamento:** o Douglas
  (76.320c, *"seus créditos não expiram nunca"* por escrito) vence **29/08** —
  ~3,5 dias. Fechar o chamado não cumpre a promessa; a varredura do trial segue
  sem escrever desde 18/08. Fica dito.
- **`d3d8d1b2` (timeout):** a ordem de 20/08 manda reabrir **se voltar**. Não
  voltou. Segue a divergência já anotada na ronda das 21h (a ordem o descreve
  como `ignored` por risco aceito; o banco diz `fixed`) — não mexi.

## 6. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` → **vazio** depois do
push da §0. Nada meu preso em branch: não criei branch nesta ronda e não toquei
em código de produção.

**PRs que seguem parados e são fix de aluno** (medição da ronda das 21h, ainda
válida): **#56** (raiz do `47`, da Katia), **#20** (mensagem de saldo velha),
**#5** (expiração de trial com cobrança em voo), **#4**, **#17**, **#10**.
Revisar/mergear é de quem revisa — registro porque *"card completed não significa
em produção; só a main deploya"*.

## O que eu NÃO fiz

- Não queimei GPU, não mexi em crédito, acesso ou `entitlements` de ninguém.
- Não fechei incidente nenhum e não carimbei `fixed` em nada que não resolvi.
- Não li a caixa do suporte@ pra triagem — a fila foi a fonte. Li **só** a pasta
  de enviados, pra conferir o que já tinha sido prometido à Katia antes de
  escrever qualquer coisa por cima.
- Não mandei e-mail em massa sem o "pode".
- Não postei no grupo: nesta ronda não fechei incidente, não subi fix pra
  produção e não escrevi pra aluno — os três gatilhos da regra 7. Ronda sem fato
  consumado não vira post, por ordem expressa de 21/08.
