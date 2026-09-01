# Ronda das falhas 01/09 02hZ

Rodada 01:41–02:2xZ (22:41–23:2x BRT de 31/08). Ronda seguinte à das 01hZ.

## 0. O que esta ronda entrega, em uma linha

Um fix em produção que impede a fila de esconder defeito NOSSO (PR #143, merge
`a81242d`), e a correção de uma leitura errada que a ronda anterior deixou no
registro.

---

## 1. A fila: 9 abertos, e a bola não está com ninguém aqui

Peguei os 9 pelo critério serial (mais antigo com aluno afetado primeiro) e
confirmei o estado de cada um lendo a última nota, não o status:

| # | idade | em que passo está | de quem é a vez |
|---|---|---|---|
| #99 | 8d | avaliação técnica saiu 29/08, aluno não respondeu desde 28/08 | aluno |
| #173 | 3d | decisão COMERCIAL (o que a compra avulsa dá direito dentro do FastCloner) | Johnny |
| #192 | 2d | texto resolvido e no ar; timbre sem causa medida | ouvido humano |
| #197 | 1d | perguntamos onde ele comprou o curso, 30/08 11:54Z | aluno |
| #202 | 1d | mesma decisão comercial do #173 | Johnny |
| #206 | 0d | respondida 31/08, arquivo de 10GB recusado corretamente | aluna |
| #207 | 0d | medição feita, nada quebrado; falta ouvido humano + o #212 comercial | Johnny/humano |
| #212 | 0d | pedido de REEMBOLSO | Johnny |
| #214 | 0d | e-mail 31/08 22:34Z, ela precisa entrar na conta paga | aluna |

**Nenhum deles destrava com trabalho meu nesta janela.** Não escrevi e-mail
novo em nenhum: em todos, ou a bola é do aluno com pergunta objetiva já feita,
ou é decisão do Johnny, e segundo e-mail sem fato novo é ruído (regra que já
está anotada no #173).

Por isso a ronda foi pro trabalho onde a bola É minha: os 3 patches do Vigia
que a ronda anterior deixou registrados como "dívida real".

---

## 2. Correção do registro: a "dívida dos 3 patches" era, em 2 de 3, fantasma

A ronda das 01hZ escreveu que os 3 patches eram *"trabalho dele que morre
igual"* e destacou que o portão anti-alucinação *"segue sem o portão há 2
dias"*. **Fui conferir antes de aplicar e a frase estava errada.** Os três
incidentes correspondentes já estavam `fixed`. Ponto a ponto:

### 2.1 `patch_10d50178` (#193) — SUPERADO, e aplicar seria REGREDIR

O portão está na main desde **29/08 20:35, commit `fd1730a`**. Conferido no
arquivo, não no commit: `medirCauda()` com `CAUDA_S=4`, `ffmpeg -sseof`, 3
leituras, e os três portões antes do `update`.

Comparei linha a linha com o patch. Nos dois portões de comparação **a main é
mais estrita**: casa a cauda inteira (`endsWith`) e as últimas `nCauda`
palavras, enquanto o patch casava só as **2 últimas palavras**. Aplicar por
cima pioraria o portão. **Recusado.**

**Lacuna real que sobra:** o portão do `--medir`. A main só o tem no `--curar`,
então o `--medir` ainda conta como `cauda_diverge` o que pode ser ruído do
whisper no clipe inteiro — a estatística da classe #108 segue **inflada**. O
patch resolvia isso com `ok=null` ("indeterminada"), ao custo de +3 chamadas
whisper por voz divergente. É medição, não escrita em voz de aluno: sem risco
de dano, só custo. Fica como item **delimitado** da próxima ronda.

### 2.2 `patch_9dc59356` (#166) — hipótese DERRUBADA por medição

O patch assumia *"o MP4 nunca chegou ao R2, o link dá 404"* e punha um HEAD no
`finalize.ts` antes de marcar `ready`. Em vez de aplicar, **medi a hipótese**:

| chave | resultado do HEAD |
|---|---|
| `e84dc74b` 27/08 21:08 (8.085 cr) | EXISTE — 8.487.892 bytes |
| `29d5ebaa` 27/08 21:51 (6.160 cr) | EXISTE — 11.035.200 bytes |
| `902c91b3` 30/08 17:27 (9.135 cr) | EXISTE — 10.312.258 bytes |

Baixei os dois de 27/08 por URL assinada (HTTP 200, `video/mp4`) e passei o
`ffprobe`: **H.264 High / yuv420p + AAC LC, 480x832, 77s** nos dois. Vídeos
íntegros e reproduzíveis. Bate com o que este incidente já havia concluído em
28/08: a causa era **link presignado vencido** (1h, a tela nunca renovava),
corrigida pelo PR #80 / merge `d6393ff`.

Medi também o risco que o próprio Vigia cravou na entrega (*"se o worker gravar
em bucket diferente, o patch converteria clones BONS em failed em massa"*):
**HEAD nos 200 clones `ready` mais recentes (28/08 → 01/09): 200/200 existem, 0
ausentes.** O motivo é que produção **não tem `R2_BUCKET_IMAGES`**, então
`imagesBucket()` cai no fallback `R2_BUCKET_VOICES`, que **é** o bucket do
worker (`voices-clone-ai-verse`). Não há divergência de bucket.

**Recusado:** resolve um problema que não existe e cobra um HEAD por finalize.
Script e dados em `_frank/prova/2026-09-01_patches_vigia/`.

### 2.3 `patch_d73f827c` (#183) — o único com carne, e virou o fix desta ronda

Ver seção 3.

### Encerramento contábil

Os 3 patches foram **arquivados** em `_frank/prova/2026-09-01_patches_vigia/`
(`_Bugs/` é gitignored — arquivo lá não sobrevive à próxima ronda) e as 3
chaves `patch_*` foram apagadas do `agent_state` com `DELETE` **depois** do
arquivamento, e o banco reconferido: `patches = 0`. Cada uma tem a decisão
escrita na nota do seu incidente. **Nenhum patch do Vigia está pendente hoje.**

---

## 3. O fix que entrou: a fila parou de poder esconder defeito nosso

### O que estava errado na main

O `741a02e` (29/08 11:44 EDT) fechou o falso positivo certo do #183 — arquivo
ruim do aluno virava chamado técnico ABERTO — mas ligou o fio no campo errado:

```ts
inputError: a.alertSupport === false,
```

`alertSupport` está **sobrecarregado**: ele só quer dizer *"não mande e-mail
agora"*, e há **duas razões opostas** pra isso. Auditei os 3 (e só 3) call
sites do repo que passam o campo:

| call site | por que passa `false` | classificação real |
|---|---|---|
| `studio/finalize.ts:105` | erro de INPUT do aluno (`no_speech`, `audio_too_long`, ...) | **do aluno** |
| `studio/face.ts:174` | o alerta já saiu por segmento; aqui é só o estorno | **técnica, NOSSA** |
| `studio/scenes.ts:261` | cena reprovada no QA de texto ilegível | **técnica, NOSSA** |

### O efeito, medido — não deduzido

Rodei a expressão real com a fiação antiga e a nova, nos dois `rawError` de
produção:

```
F4 rosto (face.ts:174)
  fiacao ANTIGA -> nasce IGNORED (falso negativo, nunca reabre)
  fiacao NOVA   -> nasce OPEN (correto: e defeito nosso)

cena QA ilegivel (scenes.ts:261)
  fiacao ANTIGA -> nasce IGNORED (falso negativo, nunca reabre)
  fiacao NOVA   -> nasce OPEN (correto: e defeito nosso)
```

E `reopened = closed && !userError` fecha a porta: nascendo `ignored`, **nunca
mais reabre**. Trocaria 1 falso positivo (ruído) por 2 falsos **negativos**
(cegueira em defeito nosso) — que é o caro, e é exatamente a armadilha que a
ordem da ronda manda vigiar (*"classe fechada que segue disparando esconde bug
nosso"*).

### Honestidade sobre o tamanho disto

**Ainda não aconteceu.** As 8 rajadas `fail-burst:studio_*` do banco são todas
de 23–27/08, **anteriores** ao `741a02e`. Não há aluno prejudicado, não há
estorno devido, não há nada a remediar. Isto entra **antes** do primeiro caso,
não depois — e é a única vez em que isso foi possível ultimamente.

**O crédito do achado é do Vigia.** O risco estava escrito com nome e linha na
entrega dele de 29/08 12:10Z, e ficou 3 dias sem ninguém ler. A lição não é
sobre o código: é que patch não lido custa caro mesmo quando o incidente já
está `fixed`.

### O que mudou

- campo novo e explícito `userInputError`, setado **só** em
  `studio/finalize.ts:105` (`isInputError`), o único ponto que classifica input
  de verdade;
- `openBurstIncident` lê esse campo, não mais o `alertSupport`;
- os outros **21** call sites de `handleTechFailure` não passam nada →
  `undefined` → comportamento idêntico ao de hoje em todos;
- a decisão saiu de dentro do `openBurstIncident` para uma função pura
  exportada, `rajadaNasceFechada`. Foi **essa linha** que errou duas vezes
  (primeiro descartando a classificação, depois lendo o sinal errado) e ela não
  tinha teste. Agora tem.

### Verificação minha, do zero

| verificação | resultado |
|---|---|
| `npx tsc --noEmit` (projeto inteiro) | exit **0** |
| `npx eslint` nos 3 arquivos | exit **0** |
| `npx tsx --test rajada-nasce-fechada.test.ts` | **7/7 pass, 0 fail** |
| auditoria dos call sites de `alertSupport` | 3 no repo, todos lidos |

Os casos (c) e (d) do teste são o falso negativo acima. Moderação (regra do
Johnny 17/08) e aluno travado (`escalateStuckUser`) ficam **inalterados** e
agora cobertos por teste — eram as duas coisas que não podiam sumir.

Registro um erro meu no caminho: na primeira passada removi a variável
`moderationBlock` que ainda era usada mais abaixo, na nota de fechamento. O
`tsc` pegou (`TS2552`), corrigi e rodei de novo. Só afirmo verde depois de
rodar; foi por isso que rodei duas vezes.

### Prova de produção

Não me contento com "Action verde" — foi essa a lição que custou um dia ao #192
ontem. Conferi no servidor:

- PR **#143**, commit `9df010e`, merge **`a81242d`**;
- deploy run `33460320355` do sha `a81242d`: **completed success**;
- `BUILD_ID` no Hetzner mudou: `7Xla8OY6l5i94pYDGNOIr` → **`m6fJkGytW3wztNyWda8HV`**;
- fonte no servidor: `rajadaNasceFechada` 2× em `src/lib/support/failure-alert.ts`,
  `userInputError` 2× em `src/lib/studio/finalize.ts`;
- **o literal `userInputError` está DENTRO de 15 bundles compilados**, entre eles
  `.next/server/app/api/v1/studio/[id]/route.js`, `studio/[id]/face/route.js`,
  `studio/[id]/montage/route.js` e `video-clone/[id]/route.js` — ou seja, está
  no caminho que o job do aluno percorre, não só no repositório.

Ressalva honesta de método: `rajadaNasceFechada` dá **0** ocorrências no bundle
compilado. Isso é esperado — o bundler renomeia nome de função, mas **não**
renomeia nome de propriedade de objeto. Por isso a prova que vale é o
`userInputError`, e é nela que me apoio.

---

## 4. O que eu NÃO fiz nesta ronda

- **não escrevi a nenhum aluno** — nos 9 abertos, a bola é do aluno ou do
  Johnny, e e-mail sem fato novo é ruído;
- **não toquei em crédito, acesso ou estorno de ninguém**, em nenhum ponto;
- **não fechei nenhum incidente** — nenhum dos 9 foi resolvido, e fechar
  qualquer um seria `fixed` sem ter resolvido (regra 14);
- **não fiz a lacuna do `--medir`** do #193 (seção 2.1), que fica registrada e
  delimitada;
- **não rodei nada que gaste GPU ou crédito**, nenhuma migration.

## 5. Placar de não-fechados: 9 (5 `investigating` + 4 `aguardando_aluno`)

Igual ao da ronda anterior. **O placar não baixou, e a resposta honesta é essa:
dos 9, 4 dependem de decisão do Johnny, 2 de ouvido humano e 3 de resposta de
aluno.** Nenhum está parado por falta de diagnóstico.

O gargalo continua sendo **decisão**, não investigação — terceira ronda seguida
com a mesma leitura.
