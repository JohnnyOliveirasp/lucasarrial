# Rotina das Falhas — 26/08/2026, ronda das 22h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia em
`4928228`. Índice de ordens lido. Ronda anterior committada: **20h UTC**.

**Placar honesto: 0 incidente fechado, 0 e-mail pra aluno, 0 código meu, 0 crédito
devolvido — porque não havia nada a devolver e ninguém esperando, e isso eu MEDI
em vez de supor. O que esta ronda entrega é a primeira medição do lado da GERAÇÃO
no `#52`, que estava aberto há uma semana investigado inteiramente pelo lado do
TREINO. O enquadramento do chamado estava errado, e duas das três condições de
fechamento caíram por medição.**

---

## 1. O serial: `#52` (`37bacb68`), escolhido pela regra 8

Mais antigo com aluno afetado e com a bola do nosso lado: aberto 19/08, 24
ocorrências, 17 e-mails afetados. Os mais velhos (`#72`, `#65`, `#47`) estão em
`aguardando_aluno` com e-mail mandado e data anotada — pela regra 8 saíram do colo.

### 1.1 O que ninguém tinha lido: a coluna `generations.qa`

Sete rondas investigaram treino — cura da referência, `worker_image`, whisper,
`REFERENCE_SECONDS`. A telemetria do QA da **geração** está gravada no banco
**desde 24/08** e nunca foi consultada. Tudo desta seção é leitura pura:
**0 GPU, 0 crédito, 0 whisper, 0 migration, 0 e-mail.**

### 1.2 Crédito: não há nada a devolver (medido)

24 falhas desde 19/08. **20 tiveram débito; as 20 têm exatamente 1 lançamento com
`ref_type='generation_refund'`.** As outras 4 não tiveram débito nenhum.

Conferido por `ref_type`, **nunca por `kind`** — a armadilha da ordem de 20/08 que
quase pagou em dobro pra 13 alunos. O estorno do Dirceu, por exemplo, está gravado
com `kind='extra_purchase'`; filtrar por `kind` o faria sumir.

**Saldo devido: ZERO.** Condição de fechamento nº 2 satisfeita e medida.

### 1.3 Aluno: ninguém está travado (medido)

14 alunos distintos. **13 geraram áudio com sucesso DEPOIS da própria última falha.**

O 14º — `dirceu.walber64@gmail.com`, falha em 20/08 00:35, nenhuma geração de áudio
desde então — eu quase reportei como "aluno abandonado em silêncio". **Fui conferir
antes e a leitura estava errada:** ele seguiu usando a plataforma (vídeo clone em
20 e 21/08, imagem em 22/08) e `pagou_de_verdade.cjs` diz **NUNCA PAGOU** (trial
R$0, 1 assinatura, 0 `PURCHASE_APPROVED`). Está sem acesso pela regra final de
crédito de 20/08 — assunto encerrado, não reabri.

**Não há aluno esperando neste chamado.** Condição de fechamento nº 3 satisfeita e
medida. Por isso não escrevi e-mail: não haveria a quem.

### 1.4 A assinatura do defeito está errada no próprio título

O chamado é lido há uma semana como "faltou o fim do texto" — herança do caso Kátia.
Os números dizem outra coisa. Nas 6 falhas com telemetria:

| geração | coverage_best | intrusion_flagged | regens |
|---|---|---|---|
| `03af4c2b` | **0** | 10/16 | 10 |
| `2ba45f4e` | **0** | 2/3 | 2 |
| `17cd7665` | **0,077** | 2/3 | 2 |
| `ed8a5e6b` | **0,1** | 6 | 4 |
| `e0de4212` | **0,15** | 3 | 2 |
| `678267fe` | 0,6 | 3 | 8 |

**5 de 6 com cobertura ≤ 0,15.** Cauda cortada daria 0,7–0,95. Cobertura ~0 quer
dizer que o áudio **não contém** o texto pedido — não que ele acabou cedo.

E não é instrumento cego: **`coverage_none = 0` em todas** (o whisper transcreveu,
a régua rodou). E não é eco da referência: **`echo_flagged = 0` em todas**. Com
`intrusion_flagged` alto, sobra uma leitura: **o modelo emitiu fala não pedida.**
Alucinação de chunk, não truncagem.

### 1.5 O achado que reenquadra o chamado: reprovar é a REGRA, não a exceção

279 gerações **entregues** (`status='ready'`) desde 24/08 carregam `qa.regens`:

| regenerações | gerações entregues | |
|---|---|---|
| 0 | **57** | 20,4% |
| 1 ou mais | **222** | **79,6%** |
| 11 ou mais | 42 | 15,1% |

**4 de cada 5 áudios entregues ao aluno só ficaram prontos depois de o QA reprovar
e mandar gerar de novo, pelo menos uma vez.** As 24 falhas não são um bug isolado:
são a cauda de uma distribuição que já reprova na primeira tentativa na esmagadora
maioria dos jobs. Enquanto essa taxa não cair, "esgotou as regenerações" volta.

### 1.6 Consequência de prazo — e o elo com o `d3d8d1b2`

Tempo de execução por faixa de regeneração, nas mesmas 279:

| regens | n | tempo médio | máximo |
|---|---|---|---|
| 0 | 57 | **56s** | 170s |
| 1–2 | 73 | 69s | 151s |
| 3–5 | 50 | 98s | 215s |
| 6–10 | 57 | 114s | 180s |
| 11+ | 42 | **177s** | **461s** |

O relógio do job é governado pela contagem de regeneração. A fórmula do teto
(`inferenceExecutionTimeoutMs`, `generate/route.ts:79`) conhece **só o tamanho do
texto**: `max(8min, 5min + chunks×30s)`. O teto foi apertado em 24/08 (`#15`) com
base em *"p99 ≤ 271s em todas as faixas, máximo absoluto 460s"* — medido **sem
separar por carga de regeneração**. O pior caso que eu medi **depois** do aperto é
**461s**. A margem é estreita e a variável que a consome não entra na conta.

**NÃO reabri o `d3d8d1b2`.** Ele está `ignored` por decisão do Johnny com aceite de
risco, e a condição de reabertura é *"se voltar"*. As 3 falhas por `executionTimeout`
(`2e2938b7` 23/08 23:41, `7ef17c4e` 24/08 15:49, `44227a0c` 24/08 20:05) são todas
**anteriores** a 24/08 20:05 e não houve nenhuma em ~2 dias. Fica registrado o
**mecanismo**, que até aqui estava descrito como "hang": não é pendura, é o laço de
QA queimando o relógio.

---

## 2. O caminho morto que eu abri e fechei sozinho — e a deriva era NOSSA

Eu achei que tinha causa. A voz `4b0e315d` (Alessandro Godoy) tem **um único**
`training_job` (`ea0caa1b`, terminado 26/08 14:50) e mesmo assim gravou **três**
`prompt_text` diferentes nas gerações do dia: 347 chars às 15:01, **288** às 15:47,
**319** das 15:56 em diante. `prompt_text` que não corresponde ao WAV de referência
produziria exatamente cobertura ~0. Hipótese bonita.

**Está errada, e a causa somos nós.** `voices.reference_transcript` tem três
escritores: `finalize-training.ts:301` (produção) e **duas ferramentas de ronda**,
`conferir_transcript_referencia.cjs:95` e `fabricar_referencia.cjs:137`. Os nossos
próprios logs confessam: a ronda das **16h** curou a voz na mão (*"1 aluno pagante
curado (4b0e315d)"*) e a das **17h** reverteu na mão (*"revertida à mão na ronda
das 16h"*). Conferi também que o webhook da geração **não** escreve
`reference_transcript` — o valor na linha da geração é o snapshot do envio, então a
mudança foi mesmo na voz.

Levantei o mesmo teste nas outras 5 vozes com deriva: `c127b74e` (1 treino, 3
variantes) e `ed09e26a` (1 treino, 2 variantes) têm mais variantes que treinos;
`82849009` e `f4b9b0f2` têm treinos suficientes pra explicar.

Duas lições, e a segunda é a que importa:
1. **Não gastem ronda nessa pista de novo.**
2. **Curar referência de voz VIVA à mão troca o `prompt_text` embaixo do aluno**
   enquanto ele produz, e contamina a evidência do próprio chamado que a gente está
   investigando. Aconteceu hoje, duas vezes, na voz do caso mais quente da fila.

---

## 3. Sub-caso com nome próprio (1 das 6), que fica como dúvida e não como causa

`ed8a5e6b`, `janetecasarotto2@gmail.com`, 25/08 21:44. O texto pedido está em
**inglês** (*"Nowadays, English is the most important global language…"*) e a voz
`f5c13d55` é `language='pt'`. `chunk_coverage` normaliza com o idioma da **voz** e o
whisper transcreve com o idioma forçado — o próprio código avisa disso em
`tts_qa/loop.py:272`.

Já existe guarda: a segunda opinião por autodetecção do **PR #47** (merge `9214e86`
em 24/08 13h53Z, portada pro `tts_qa/loop.py` em `6be302b` às 18h27Z) — **antes**
desta falha. Mas a `qa` dela não traz `coverage_idioma_corrigido`, e essa chave só é
gravada **quando a segunda leitura melhora**. **Não dá pra distinguir "rodou e não
ajudou" de "não rodou".** Por isso vai como dúvida honesta, não como causa — e é
metade do card da seção 5.

Hipótese que eu testei e **refutei** antes de escrever qualquer uma dessas linhas:
"texto em CAIXA ALTA quebra a régua". Os textos que falharam têm 0,9% a 9,1% de
maiúsculas em `text_normalized`. A menção a "CAIXA ALTA" no log das 15h era sobre o
texto **cru**, antes da normalização.

---

## 4. Fila e higiene no fim

- **Abertos: 5** (`52`, `97`, `99`, `120`, `143`) — mesmo número da entrada.
- **`aguardando_aluno`: 6** (`47`, `65`, `72`, `124`, `133`, `139`) — inalterado.
- **Sem falha nova de geração:** entre 15h47Z e 21h35Z foram **59 gerações, 59
  `ready`, 0 `failed`** — ~6h limpas, depois de PR #61 e PR #62 entrarem hoje. O
  `last_seen_at` do `#52` continua 26/08 15:47.
- **Fechado que voltou a disparar:** 1 (`acf8acd6` / `#8`), última ocorrência
  **98,4h** atrás. Recorte de 72h **vazio**. Critério `last_seen_at > resolved_at +
  2min`, não "last_seen recente".
- `telma@centia.com.br` apareceu na varredura como "acesso vivo, com crédito, sem
  voz pronta". **Não é caso:** a voz `9d753bec` foi criada 26/08 20:59, ~45 min
  antes desta ronda, e está `awaiting_training` — em voo, não parada. Registro pra
  ronda seguinte não tratar como travamento novo; se ainda estiver assim na próxima,
  aí é caso.

---

## 5. Delegado, não feito por mim

**Card `daeb037d` no `coder`** — as duas lacunas de observabilidade que fazem toda
ronda parar no mesmo lugar:
1. `generations.qa` **não grava `coverage_best` no SUCESSO** (só no payload de
   falha, `inference.py:455`). Sem isso ninguém sabe a que distância da régua
   (`coverage_qa_min = 0.85`) os áudios entregues estão passando — e portanto
   ninguém sabe se mexer na régua move a taxa de 80% da seção 1.5.
2. A segunda opinião de idioma só deixa rastro quando ajuda (seção 3).

Card carrega o diagnóstico pronto, os testes exigidos e a armadilha do
`unittest.main()` ausente, que já matou 4 testes em silêncio neste repo. **Eu não
escrevi o código**: orquestrar é o meu papel e o defeito está localizado o bastante
pro worker executar.

---

## 6. Duas coisas que eu conferi porque quase viraram alarme falso

**(a) O e-mail do Luciano das 20h51 parecia ter saído com acento quebrado.** No
`ler_caixa` o corpo do uid 162 aparece como `Voc&ecirc;`, enquanto o uid 151 das
16h48 aparece com acento normal. **Não é defeito:** `enviar_email.cjs` monta uma
única parte `Content-Type: text/html` (linha 234) e envia em base64 — em HTML,
`&ecirc;` renderiza **ê** no cliente do aluno. A diferença é só que um corpo foi
escrito com entidade e o outro com UTF-8 literal. Nada a corrigir, e ninguém precisa
reabrir isso.

**(b) O registro da ronda de ~20h50 não está na main.** A nota do `#99` gravada às
**20h50:41Z** afirma *"escrevi para ele… Avisei o Johnny em separado"*. **Conferi o
envio em vez de acreditar na nota:** pasta Enviados, **uid 162, 26/08 20h51:30Z**,
assunto *"Sobre o seu caso: voce foi cobrado em 26/08 e o prazo vai ate 02/09"* —
o e-mail saiu mesmo, e o texto está correto (não promete data, não decide nada
comercial). O que **não** existe é o log dessa ronda: `git fetch` + `ls _frank/prova/`
às 22h15Z mostram `origin/main` em `4928228` e o arquivo mais novo sendo o das 20h.
Trabalho feito e entregue ao aluno, registro invisível pra quem pegar a próxima
ronda — exatamente o que a ordem manda checar no fim. Não é acusação: pode ser
ronda ainda em curso. Fica anotado pra não passar em branco.

---

## 7. O que eu NÃO fiz

Não fechei nem reabri incidente nenhum — o `#52` **continua `investigating`**, porque
a causa não está corrigida e ele disparou hoje às 15h47 (regra 14: fechar mais não é
fechar mais rápido do que resolve). Não escrevi pra aluno (não há aluno esperando no
`#52` — seções 1.2 e 1.3). Não toquei em crédito, acesso, assinatura ou estorno. Não
apliquei migration. Não rodei `--curar`, `--medir`, whisper nem GPU. Não escrevi
código. Não mexi em cron nem em ordem. Não reabri o `d3d8d1b2` nem a decisão das 55.
**Não postei no grupo:** a regra 7 pede fato consumado (incidente fechado, fix em
produção, e-mail pra aluno) e eu não tenho nenhum dos três — ronda sem fato não vira
ruído no canal do Lucas.

**Avisei o Johnny no Telegram** (message_id 472), por dois motivos que a ordem manda
não segurar até o relatório: o prazo de **30/08** da Sandra (`#120`), que é decisão
de pessoa e precisa do Lucas na Hotmart, e o reenquadramento do `#52`.

---

## 8. Para quem pegar a próxima ronda

- **Comece pelo `generations.qa`.** É de graça, está no banco, e responde mais que
  a API da RunPod — que descarta o payload do job em menos de 2h (medido na ronda
  das 20h). A `qa` não expira.
- **Pare de procurar cauda cortada no `#52`.** É cobertura ~0 com intrusão: o áudio
  fala outra coisa. Quem investigar truncagem vai medir o defeito errado.
- **A pergunta que fecha o `#52` mudou.** Não é mais "por que 24 falharam" e sim
  **"por que 80% das entregas precisam de regeneração"**. A cauda seca sozinha quando
  esse número cair.
- **Não cure referência de voz viva à mão** enquanto o chamado dela está aberto
  (seção 2). Se precisar, registre no incidente **antes**, com hora.
- O serial de aluno vivo continua sendo o **Marcelo** (`#65`), bola com ele desde
  24/08 21:52Z; só volta a ser nosso em **31/08**.
- `#99` (Luciano) e `#120` (Sandra) estão os dois esperando **decisão de pessoa**,
  não trabalho técnico. Prazos: **02/09** e **30/08**.
