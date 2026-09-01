# Rotina das Falhas — 26/08/2026, ronda das 20h UTC

Dono da fila: Claude. Método serial (regra 8, ordem de 21/08).
Entrada: `git checkout main && git pull --ff-only origin main` → trouxe `8d4f934..47b954f`.
Índice de ordens lido. Ronda anterior: 19h UTC (1 aluna destravada, 0 incidente fechado).

**Placar honesto: 0 incidente fechado, 0 aluno avisado, 0 código escrito por mim,
0 crédito devido. O que esta ronda entrega é a DECISÃO da pergunta que travou o
`#52` por três rondas — e ela veio de dado do próprio worker, não de mais um
palpite. Além disso derrubei uma afirmação da ronda das 17h45 que, se ficasse de
pé, faria as próximas rondas perderem evidência em silêncio.**

Digo já o que não fiz: não fechei chamado nenhum e não escrevi para aluno nenhum.
Nenhum dos abertos estava resolvido, e nenhum aluno tinha bola nossa nesta ronda.

---

## 1. O serial: `#52` (`37bacb68`) — escolhido pela regra 8

Critério: mais antigo com aluno afetado **e com a bola do nosso lado**. Os mais
velhos (`#72` 19/07, `#65` 10/08, `#47` 19/08) estão todos `aguardando_aluno`
com e-mail mandado e data anotada — pela regra 8 saíram do meu colo. O `#52` é
o mais antigo em que o trabalho é **nosso**: 24 ocorrências, última hoje 15:47Z,
e aluno pagante levando falha de geração.

### 1.1 Como consegui o dado que "não existia"

A nota das 17h45 (minha, ronda anterior) afirmou que o ramo da cura ficaria
*"no LOG, que já é o que resolve a pergunta na próxima ronda"*. **Fui usar o log
e ele não resolve** — a seção 4 mostra por quê.

O caminho que funcionou é outro e ninguém tinha tentado: o worker **devolve**
`reference_cura_ramo`, `reference_cura_texto_antes` e `worker_image` no payload
de retorno do job, e a API da RunPod serve esse payload em
`/v2/<endpoint>/status/<runpod_job_id>`. Li de lá com a credencial da RunPod que
o projeto já usa em produção. **Leitura pura: zero GPU, zero crédito, zero whisper.**

### 1.2 Hipótese (a) REFUTADA — o worker não está servindo imagem velha

Treino `d1767e22` (voz `541d3f4d` "Allan", 19:09:33 → 19:15:15Z) devolveu
`worker_image = main@b3d1bad478… pod=lay9crjl9by1an endpoint=2jcta960kzc2m4`.

`b3d1bad` é **descendente de `1013b20`** (conferido por `merge-base --is-ancestor`,
não por olhar data de commit), logo carrega a instrumentação do PR #61. O build
dessa imagem terminou **18:42:38Z** e o treino começou **19:09:33Z**: o pod pegou
imagem nova **~27 min** depois do build.

A armadilha de 20/08 — *"worker quente do RunPod ainda serve imagem antiga"* — que
era a hipótese **(a)** e que três rondas não conseguiram descartar, **não está
acontecendo**. Medido, não inferido.

Detalhe que eu conferi porque quase me enganou: o build do PR #61 (`1013b20`)
aparece **`cancelled`** no CI. Não é falha — é o grupo de concorrência, o push
seguinte cancela o build em voo. Quem entregou a imagem foi o build de `b3d1bad`,
que contém o mesmo código. **Ler "cancelled" e concluir "a instrumentação não
subiu" teria sido errado.**

### 1.3 A cura rodou

`ramo="curado"`, `reference_cura_erro=null`, `language=pt`, `sample_qa="passed"`
(similaridade 1).

### 1.4 Achado novo, e é o mais pesado: a cura é LOAD-BEARING

Na mesma voz:

| campo | tamanho | conteúdo |
|---|---|---|
| `reference_cura_texto_antes` (o **previsto**, saída do corte por palavra) | **52 chars** | "Agora, umas palavras mais difíceis. Outra sequência." |
| `reference_transcript` **gravado** (o **real**, 2ª passada de whisper) | **407 chars** | "Amarelo dourado, cinza prateado […] Extraordinário, incompreensível, circunstancialmente […]" |

Baixei o `ref/auto.wav` e medi com `ffprobe`: **29,70s**. 407 chars em 29,7s =
**13,7 chars/s**, que é fala normal em português (a média da frota é 12,9 — seção 2).
Ou seja **o texto de 407 chars cabe no áudio e está certo**; quem estava errado era
o *previsto*, que descrevia **~13% do clipe**.

Isso **inverte** a leitura das rondas anteriores, que tratavam a cura como um
retoque de ponta e às vezes como suspeita. Nesta voz o corte por fronteira de
palavra entregou um texto que perdia **~87%** do conteúdo, e foi a cura que salvou.
Sempre que o whisper da cura falhar (`fallback_vazio` / `fallback_erro`), a voz
nasce com um transcript que descreve uma fração do áudio de referência.

---

## 2. Régua nova, de graça, que escapa da contaminação dos DOIS MOTORES

A ronda das 17h estabeleceu que instrumento (whisper-1 da OpenAI) e worker
(faster_whisper large-v3) são **motores diferentes**, e por isso a medição das 40
vozes ficou sem base. Esta régua **não compara transcrição com transcrição**:
compara **tamanho de texto com duração de áudio**.

`REFERENCE_SECONDS = 30` (`worker_config.py:56`), então todo `ref/auto.wav` tem
~30s (conferido em 2: 29,70s e 29,82s). Logo `chars(reference_transcript)/30` é
uma taxa de fala, e fala normal fica ~13–15 chars/s.

**Medido nas 897 vozes `ready` com referência:** média **387 chars** (12,9 chars/s),
min 86, max 2102.

- **Super-reclamação (cauda fantasma grosseira): 2 de 897.** `2ba315cd`
  "Lucas Arrial (cópia teste)" com 2102 chars (**70 chars/s — impossível em 30s**)
  e `165ee880` com 1627. As duas de **29/05 e 02/06**, anteriores ao pipeline de
  hoje, e uma é voz de teste. **Não há classe viva.**
- **Sub-reclamação (cura falhou): 7 alunos** abaixo de 200 chars, o mais novo de
  **17/08** — `defed98f`, `4e04ee86`, `b8dc5f4f`, `754aa6f9`, `52dd6aa8`,
  `2e641e9b`, `2ce44cca`. **Todos anteriores a 24/08**, que é quando a cura
  (`d912809`) subiu. Os 28 com transcript nulo são 22 vozes internas de
  `vozes@fastcloner.com` (05/08) mais 6 alunos de julho.
- **Conclusão:** nenhuma voz nascida **depois** da cura aparece nas duas pontas.
  Evidência a favor de a cura estar funcionando, e **contradiz** o *"5 de 40 =
  12,5% candidatas a fantasma"* da ronda das 16h — número que já estava sob
  suspeita por ter sido colhido comparando motores diferentes.

### 2.1 O limite desta régua, dito antes que alguém a use errado

Ela **não enxerga a cauda fantasma FINA**, que é justamente a classe
Katia/Negrini/Alessandro. 5 palavras fantasma são ~40 chars sobre uma base de 387:
move a taxa de 12,9 para 14,2, **dentro do ruído**. São dois defeitos de escalas
diferentes.

Esta régua fecha a pergunta *"existe classe grosseira?"* (**não existe**) e
**não** fecha *"existe cauda fina?"*.

---

## 3. Defeito de código novo: o QA da amostra não testa o que vai pro ar

Lido na main e conferido linha a linha, em `jobs/train_reference.py`,
`_amostra_pos_treino`:

```
216  for tentativa, (clip, texto) in enumerate(candidatas):
218      if tentativa > 0 ...:
223          cura = transcricao_fiel(clip, texto, ...)
224          ref.clip, ref.transcript, ref.cura = clip, cura.texto, cura
228      info = generate_training_sample(..., ref_wav=clip, ref_text=texto, ...)
```

`ref.candidatas` é atribuído **uma** vez (linha 92, saída do seletor) e **nunca**
recebe texto curado — conferido por grep, só existem as ocorrências 56/92/104/213/214/216.
Então `texto` no laço é **sempre o texto CRU**. Mas o que vai para o banco é
`ref.transcript`, que é o **CURADO**.

**Resultado:** a amostra de QA é gerada com o par (áudio, texto CRU) e o aluno
produz para sempre com o par (áudio, texto CURADO). Na tentativa >0 fica gritante:
a linha 223 calcula `cura.texto` e a 228 não usa.

No caso medido: o `sample_qa` da voz `541d3f4d` passou com **similaridade 1 usando
52 chars**, enquanto a voz que o aluno recebeu carrega **407**.

**Não estou dizendo que isto é a causa do `#52`.** Estou dizendo que, enquanto for
assim, `sample_qa="passed"` **não é evidência** sobre o comportamento em produção —
e isso explica como este chamado sobrevive a QA verde e segue intermitente.

**Card `2333ec2f` aberto no `coder`** com o diagnóstico pronto, o teste exigido e a
armadilha do `unittest.main()` (que já matou 4 testes em silêncio). Eu não escrevi
o código: orquestrar é o meu papel, e o defeito está localizado o bastante para o
worker executar.

---

## 4. O que eu derrubei da MINHA PRÓPRIA nota das 17h45 — e muda a urgência da migration 96

Consultei os 4 treinos de hoje na API da RunPod:

| treino | horário | resposta |
|---|---|---|
| `d1767e22` | 19:15Z | **HTTP 200, payload completo** |
| `118cfe4f` | 18:58Z | **404** |
| `0c3c06ab` | 17:49Z | **404** |
| `d97b1b31` | 16:35Z | **404** |

A RunPod **descarta o resultado do job em menos de 2 horas**. E o `logger.info` do
`finalize-training` escreve em **disco/console** (`frontend/src/lib/logger/server.ts`
— não há insert em tabela nenhuma), que na Vercel é efêmero.

Logo a afirmação da nota das 17h45 — *"enquanto a DDL não for aplicada o dado existe
no LOG, que já é o que resolve a pergunta na próxima ronda"* — **está errada na
prática**. Três dos quatro treinos de hoje **já perderam a evidência**, e eu só
consegui o dado desta ronda por ter chegado **6 minutos** depois do treino terminar.

**A migration 96 deixa de ser conveniência e vira a única forma de o dado sobreviver.**
Cada ronda que passa sem ela é evidência perdida em silêncio. Continua dependendo de
aval do Johnny (**não apliquei DDL**), mas agora com o custo medido.

---

## 5. Fila conferida no fim

- **Abertos: 4** (`52`, `97`, `99`, `143`) — mesmo número da entrada.
- **`aguardando_aluno`: 7** — inalterado.
- **Falhas de geração entre 15:50Z e 20:25Z: ZERO** (19 gerações no período,
  18 `ready` + 1 `pending`). A última falha do `#52` continua sendo a `03af4c2b`
  das 15:47Z.
- Nenhum incidente `fixed`/`ignored` com `last_seen_at` recente (a armadilha do
  `8d370ef5`): conferido, nada disparando escondido.
- Nota gravada: `#52`, **31 → 32 notas**, `.select()` conferido na volta,
  **1 linha afetada**.

---

## 6. Placar, sem inflar

- **1 pergunta de 3 rondas DECIDIDA** — hipótese (a) refutada com `worker_image`.
- **1 régua nova**, de custo zero e imune à troca de motores, aplicada às 897 vozes.
- **1 defeito de código novo** achado e delegado (card `2333ec2f`).
- **1 afirmação minha anterior derrubada** por medição, com consequência prática.
- **0 incidente fechado, 0 aluno avisado, 0 e-mail, 0 código meu, 0 PR meu.**
- **0 GPU, 0 crédito, 0 whisper, 0 migration aplicada, 0 voz curada, 0 cron tocado.**

## 7. Para quem pegar a próxima ronda

- **A evidência é perecível: <2h.** Se um treino novo rodar, leia
  `/v2/<endpoint>/status/<runpod_job_id>` **na hora**. Depois disso o dado sumiu.
  Os `runpod_job_id` estão em `training_jobs`.
- **O que falta pra fechar o `#52`:** capturar um treino cujo ramo **não** seja
  `curado` (`fallback_vazio`/`fallback_erro`) e comparar; ou instrumentar a
  **geração**, não mais o treino. A hipótese (b) que sobra é "a cura roda, grava
  texto certo, e a geração falha por cobertura mesmo assim".
- **Não repita a régua das 40 vozes comparando whisper com whisper** — está
  contaminada por motores diferentes (nota das 17h). Use a da seção 2, e respeite
  o limite da seção 2.1.
- O serial de aluno vivo continua sendo o **Marcelo** (`#65`), bola com ele desde
  24/08 21:52Z; só volta a ser nosso em **31/08** (7d+).
- Novidade que o Vigia mediu às 14h20 e não estava no meu radar: **`ycarlosk`
  deixou de ser trial** — pagou R$97 em 26/08 14:13Z. É **pagante com ZERO voz**,
  gripado, prometeu regravar. Não está travado, mas mudou de categoria.
