# Rotina das Falhas — 26/08/2026, ronda das 17h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido. Ronda anterior: 16h UTC (trabalhou o `52`, não fechou).

**Placar honesto: 0 incidente fechado, 1 aluno avisado, 1 escalada ao dono,
2 conclusões de rondas anteriores retiradas por erro de método.**

---

## 1. A correção que vale a ronda: o instrumento e o worker usam whispers diferentes

Isto não é detalhe. É a razão de o `52` ter queimado três rondas.

| quem | motor de transcrição | onde conferi |
|---|---|---|
| **worker** (quem **grava** o `reference_transcript`) | `faster_whisper`, **large-v3**, CUDA | `voice_pipeline/training.py:20-24`; default em `jobs/train.py:53` e `jobs/inference_setup.py:72` |
| **`conferir_transcript_referencia.cjs`** (quem **mede** e quem `--curar` reescreve) | **API da OpenAI**, `model=whisper-1` | linhas 35-39 do próprio script |

São modelos diferentes. Divergência entre eles no mesmo áudio é o **esperado**,
não é sinal de defeito. Isso derruba três raciocínios que já estavam na fila —
dois deles **meus**:

1. **"O whisper engole a frase de cabeça"** (minha nota das 15h51). A medição
   está certa e eu a mantenho: a frase *"Foram necessárias mais duas impressões"*
   **está** no áudio (`mean_volume` -25,4 dB × -25,0 dB do resto,
   `silencedetect` sem silêncio antes de 4,15s, transcrição isolada da cabeça
   devolvendo a frase). O erro foi deixar isso virar argumento sobre a **cura
   automática**: o ponto cego foi medido no whisper-1, e a cura roda no
   large-v3. Não prova nada sobre o worker.

2. **A pergunta "(a) imagem antiga × (b) `transcricao_fiel` com o mesmo ponto
   cego" está mal formulada.** A hipótese (b) exige que o ponto cego seja do
   motor do worker, e a evidência do ponto cego é do motor do instrumento. O
   Vigia pesou "a favor de (b)" (nota 29, 16h16Z) apoiado nessa evidência.
   **Retiro a base dessa leitura** — não para afirmar (a), mas porque (b) não
   está sustentada. Nenhuma das duas está.

3. **Contamina a medição das 40 vozes.** Ela compara transcript **gravado**
   (large-v3) contra transcrição **whisper-1** e chama a diferença de "palavras
   a mais que o texto reivindica". Parte do delta é defeito, parte é troca de
   motor, e assim medido não dá para separar. As 5 candidatas
   (`6ce4f84c` +12, `16c34e6a` +10, `3a601c63` +9, `ac48e09e` +6,
   `65e8c7d4` +5) seguem candidatas — delta grande dificilmente é só motor —
   mas o corte em "+4" perdeu a base. **Não curei nenhuma.**

### O corolário prático

Nenhuma das hipóteses do `52` é decidível por arqueologia no banco, porque:
(i) nada registra qual ramo da `transcricao_fiel` rodou; (ii) nada registra o
transcript **antes** da cura; (iii) `training_jobs` não guarda imagem nem digest
(colunas conferidas uma a uma); (iv) a única régua que temos roda em outro motor.
Continuar cavando daqui é queimar ronda — foi o que aconteceu três vezes.

---

## 2. Estrago colateral do `--curar` de ontem: conferido, está contido

Desde 14h00Z apenas **3 vozes** tiveram `reference_transcript` alterado:

| voz | o que é |
|---|---|
| `4b0e315d` | a do Alessandro, revertida à mão na ronda das 16h — relida agora, termina em *"…aeroporto de San Diego."* ✅ |
| `bdfd9762` | criada **15h47**, treino novo (`ready` 15h54) |
| `105d9b9d` | criada **16h29**, treino novo (`ready` 16h35) |

As duas últimas nasceram hoje, não são sobra do `--curar`. **A corrupção ficou
em uma voz e está desfeita.** Achado negativo, mas é o que fecha a pergunta.

---

## 3. `99` — Luciano: a premissa da decisão do Johnny caiu, e um dado da fila não existe

### 3.1 O dado que eu quase repeti como fato

As notas do chamado citam `warranty_date` duas vezes: 25/08 ~21h
(*"Lendo o raw_event da Hotmart: warranty_date = 2026-08-26T00:00:00Z"*, usada
para cravar urgência) e Vigia hoje 14h16Z (*"warranty_date do payload: 02/09"*,
usada para enquadrar a janela de reembolso). **Eu tinha a mensagem para o Johnny
já escrita com o "02/09" dentro.** Fui conferir antes de mandar:

| conferência | resultado |
|---|---|
| payload do `PURCHASE_APPROVED` de 26/08 (rec#2, R$97, `HP2024654259`) | **sem** a chave `warranty_date` (objeto `purchase` dumpado campo a campo) |
| payload de 19/08 (rec#1, R$0) | **sem** |
| **todos** os `PURCHASE_APPROVED` da base | **0 de 1367** com a chave. Nas 434 recorrências: **0** |
| `information_schema` | nenhuma coluna `warranty`/`garantia` em tabela nenhuma |
| `grep warranty` no repo (`.ts/.cjs/.js/.mjs`, fora `node_modules`) | **0 ocorrências** |

O campo **não existe** no nosso dado nem no nosso código. As duas datas entraram
na fila com cara de medição e não são medição nossa. Não estou dizendo que o
prazo não existe — estou dizendo que **ninguém aqui sabe** até quando dá para
estornar esse R$97, e que isso se confere na Hotmart. Registrei com esse detalhe
porque o próximo a ler as notas repetiria "02/09" achando que era fato apurado.

### 3.2 O que mudou de verdade

`rec#2 R$97 APPROVED`, `order_date`/`approved_date` **26/08 14h11Z**, processado
14h13Z, acesso até **19/09**, **+100.000** de recarga, `date_next_charge` 19/09.
`pagou_de_verdade.cjs` agora lê **PAGOU DE VERDADE**. A ordem do Johnny de 25/08
23:45Z (*"sem reembolso; ele nunca pagou"*) foi tomada sobre uma premissa que
**deixou de valer às 14h11 de hoje**.

### 3.3 O que eu fiz

- **Johnny avisado na hora** (Telegram grupo, `message_id 460`) com o fato novo
  **e** com a correção do `warranty_date`. Pergunta única: fica ou sai; se fica,
  o que se promete por escrito; se sai, dentro do prazo real da Hotmart. Não
  repeti a escalada anterior — o que justificou nova mensagem foi a **premissa
  ter caído**, não o tempo passando.
- **Aluno avisado** (regra 8, decido sozinho). E-mail para
  `lucianodepinho@gmail.com`, bcc `suporte@`, assunto *"Sobre a cobrança de hoje
  e o seu pedido"*. Contei que **vimos a cobrança de R$97** e que ela está
  anotada **junto** com o pedido dele, não em separado. **Não dei data** (a
  resposta não é minha e ele já esperou prazo que não se cumpriu), não prometi
  reembolso, não pedi nada dele. Disse que o teste que ele mesmo propôs (áudio
  próprio no lugar da voz clonada) é a comparação certa e que olho o resultado.
  Confirmei que acesso e créditos estão de pé.
- **Não** mexi em assinatura, acesso, crédito ou estorno. Não cancelei nada — ele
  segue sem pedir cancelamento; as palavras dele hoje são *"aguardo o
  posicionamento"*.

Continua `open` pela regra 14: o que falta não é código, é decisão comercial do
Johnny e do Lucas, pedida nominalmente pelo aluno há ~74h.

---

## 4. Card do `coder`: falhou, e o que eu fiz com isso

O `7a20c24b` (aberto na ronda das 16h) voltou **`failed`, sem entregar saída**
(*"Worker não entregou saída"*). Não fiquei empurrando o mesmo card:

- modelo do `coder` trocado de `claude-fable-5` → `claude-opus-5`;
- lição registrada (`remember` #989): card grande e vago tende a voltar vazio, fatiar;
- card **reaberto com escopo fechado**: `484fffc3`, **só observabilidade** —
  fazer a `transcricao_fiel` registrar **qual ramo** rodou (`curado` /
  `fallback_vazio` / `fallback_erro`), guardar o **texto antes** da cura,
  gravar a **identidade da imagem** do worker, migration **commitada mas NÃO
  aplicada** (migration precisa de aval), e testes cobrindo os três ramos.

Sem isso, a próxima ronda chuta igual às três anteriores.

---

## 5. Fila conferida

- **Abertos: 4** (`52`, `97`, `99`, `143`) — mesmo número da entrada, nada fechou.
- **`52`** `investigating` com nota nova (30 notas). **`99`** `open` com nota nova
  (17 notas). **`97`** sem ocorrência nova desde 23/08 15h50. **`143`** parado em
  decisão do Johnny.
- **`aguardando_aluno`: 7** — inalterado.
- **Presos no painel: 4.** ⚠️ `leandro.fitoway@gmail.com` está sem voz há **27
  dias** e o acesso dele vence **29/08** — não o toquei nesta ronda (o serial
  estava no `52`/`99`) e fica **marcado como o próximo**, porque o relógio dele
  é o mais curto da lista.

---

## 6. Placar da ronda, sem inflar

- **0 incidente fechado.** Nada estava resolvido e eu não fecho o que não resolvi.
- **2 conclusões de rondas anteriores retiradas** por erro de método (uma delas
  minha, da ronda passada), com a medição que as derruba.
- **1 dado da fila desmentido** (`warranty_date`, 0 de 1367) **antes** de virar
  base de decisão comercial e de e-mail para aluno.
- **1 aluno avisado**, sem promessa e sem data inventada.
- **1 escalada ao dono** com premissa corrigida.
- **1 achado negativo conferido** (corrupção do `--curar` contida em 1 voz).
- **1 card falhado tratado**: modelo trocado, lição banked, escopo refeito.
- **0 crédito, 0 GPU, 0 migration, 0 voz curada.**

Gasto: zero de whisper nesta ronda (não rodei `--medir` nem `--curar`), zero GPU.
