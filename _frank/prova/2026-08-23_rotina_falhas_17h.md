# 23/08 ~17h UTC — Rotina das Falhas (dono da fila)

`git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido. Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐) e
a `2026-08-21_passagem_incidentes_para_claude.md`. Método serial e comunicação
pela ordem de 21/08 (`fd0b0f5`).

**Peguei UM incidente e levei até o meu limite. Não abri um segundo.**

---

## Placar

| | |
|---|---|
| Incidentes na fila no início | **8** — 79, 82, 90, 94, 95, 96, 97, 98 |
| Peguei | **1** — `07af5758` (#82, Luciano), que voltou de `fixed` pra `open` às 17:00 |
| Fechei | **0** — motivo na seção 5 |
| Aluno avisado | **1** — Luciano, e-mail enviado |
| Escalado com nome e canal | **2** — Johnny, `message_id 317` e `318` |
| Crédito que eu mexi | **nenhum** |
| GPU que eu gastei | **nenhuma** |

---

## 1. Por que escolhi o `07af5758` (#82)

Regra 8: o mais antigo aberto com aluno afetado. Ele é de **22/08 09:15**. Os
dois mais velhos que ele (`ce47c3b9`/79, Rafael, e `7963388e`/90, Kessuly) estão
parados em **decisão do dono**, não em trabalho meu — o 79 foi trabalhado e
escalado na ronda das 15h, e esperar decisão não é estar travado.

Peso que confirmou: o #82 **voltou de `fixed` para `open` às 17:00 UTC de hoje**,
depois que a Fast trocou quatro mensagens com o aluno. Ele não aparecia na ronda
do Vigia das 16:17 porque ainda estava fechado. Acesso dele vence **26/08**.

O #82 e o #95 (`bc8f234a`) são **o mesmo aluno e o mesmo caso**. Assumi os dois
como um só, com um dono só, e deixei ponteiro cruzado nas notas pra ninguém
investigar em dobro.

---

## 2. O que eu medi (leitura de código e de banco, não impressão)

**O Vídeo Clone NÃO treina com vídeo. Não existe essa capacidade no produto.**

- `POST /api/v1/video-clone` aceita `{ image_key, audio_key, tier }` e nada mais
  (`route.ts:97-101`).
- `video_clones` tem `image_path` e `audio_path` e **nenhuma coluna de treino**
  (conferido em `information_schema`).
- As LoRA dos dois tiers são arquivos **fixos**
  (`lightx2v_I2V_14B_480p_cfg_step_distill`), **iguais para todo usuário**; o
  campo `lora` do config está vazio nos dois porque os modelos já estão fixos nos
  templates V2/V3.
- `import-take` só copia **áudio** entre buckets.

Não existe rota, coluna ou worker que consuma vídeo de treino. Portanto **um
vídeo de 45 minutos não tem onde ser aproveitado** para melhorar rosto ou
movimento. O único uso possível de um vídeo é extrair áudio para treinar **voz**
— e ele já tem voz de **31min29** que ele mesmo disse que está boa.

---

## 3. O que a medição expôs: a Fast prometeu, de novo, o que não existe

Às **14:00 e 14:15 -0300** (17:00/17:15 UTC), **depois** do e-mail da ronda das
16:52, a Fast escreveu ao aluno:

- *"Você tem razão: se foi isso que você comprou, você não deveria ter que fazer
  sozinho na plataforma"* — **endossando a afirmação comercial que estava
  escalada e não decidida**;
- *"pode mandar o link aqui mesmo que eu repasso"* e *"A equipe vai receber e
  cuidar disso pra você"* — **processo que não existe e que ninguém assumiu**.

O aluno respondeu *"Ok, então. Vou preparar aqui e enviar"* (uid 267). Ou seja:
ia gravar 45 minutos em cima de uma promessa vazia.

É a **quarta** afirmação inventada da Fast em 48h: `87` (Creator Ouro), `90`
(Kessuly) e as **duas de hoje cedo para o próprio Luciano** — que **ele mesmo**
pegou (*"mas como vocês estão treinando se eu não enviei vídeo?"*).

---

## 4. O que eu fiz (fato consumado, não plano)

- **Escrevi pro Luciano.** SMTP do suporte@, bcc suporte@, enviado ok. Endereço
  conferido contra homônimo (armadilha do Cláudio): existem **4 outros Luciano**
  no banco (`lucmacri`, `jfreitasluciano`, `luciano.sfan`, `lucvila`) e **uma
  única** conta `lucianodepinho@gmail.com`. Assunto: *"Nao grave o video de 45min
  ainda"*. No e-mail: **não grave**, com a medição da seção 2; que a mensagem das
  14h prometeu mais do que estava decidido; que os **3 clones dele têm 2,56s
  cada** (`deb39e9b`, `8aaa1fbe`, `14e58549`, todos `ready`, tiers v3/v2/v3) e
  que 2,5s é a pior amostra possível para julgar realismo; e uma **oferta** de
  gerar um clone longo (~90s, o teto `CLONE_MAX_AUDIO_SECONDS`) **por conta da
  casa**, que só executo se ele responder "pode fazer". Sobre o pacote comercial
  **não afirmei nem neguei nada**.
- **Escalei pro Johnny** (`317`): o reel promete o que o produto não faz; a Fast
  inventou pela 4ª vez; e a pergunta comercial com relógio (acesso vence 26/08).
- **Anotei o #82** (`--confirmar`, conferido na releitura: **1 linha afetada**,
  `agent_notes` 2 → 3, status `open` → `investigating`).
- **Anotei o #95** (`--confirmar`, conferido: **1 linha afetada**, `agent_notes`
  2 → 3, status inalterado) com ponteiro para o #82.

**Ele já tinha respondido a pergunta da ronda anterior**, no uid 265: *"o clone
que fiz na plataforma tá muito artificial, com cara de IA"* e *"essa parte do
áudio me parece bem resolvida"*. O incômodo dele **não é a voz, é o realismo do
vídeo**. Treino novo de voz (10.000 créditos) fica descartado pela palavra dele,
não por chute meu.

**Estado dele, conferido:** acesso até 26/08, 73.680 créditos, voz `ready` desde
19/08, 3 clones `ready`, zero falha técnica e **zero cobrança indevida** —
conferido por `ref_type`, **nunca** por `kind`. **Nada a estornar.**

---

## 5. Por que NÃO marquei `fixed`

O que falta no #82 e no #95 é **decisão do dono** (o pacote comercial e o que
fazer com a promessa do reel), não trabalho meu. Fechar agora repetiria
exatamente o erro que **criou** o #95: o `07af5758` foi fechado **2h17 antes** de
o aluno responder.

---

## 6. O gargalo real: 18 PRs abertos e NENHUM revisado

As rondas de hoje vinham reportando *"PR #16 e #29 parados"*. **Fui contar: são
18 abertos, e nenhum tem `reviewDecision` — não é review negado nem mudança
pedida, é review nunca feito.** O mais velho tem **5 dias**. Eu vinha reportando
2 quando eram 18; o número estava errado por 9x e está corrigido aqui.

Isso importa mais que qualquer item da fila: **a fila está produzindo conserto e
o conserto não chega no ar.** Só a main deploya.

| PR | idade | o que trava |
|---|---|---|
| `#38` | 0,2d | MP3 sem header Xing corta o final do áudio — incidente `96`, **2.585 ocorrências** |
| `#16` | 3,3d | referência cortada no meio da palavra — o próprio PR estima **1 em cada 3 vozes novas** |
| `#29` | 2,1d | refazer treino `failed` **sem cobrar** — a lacuna que trava Cláudio e Marcelo, sem voz desde 15 e 10/08 |
| `#39` | hoje | aceitar `.mov` no treino de voz (da ronda das 16:52) |

Quatro (`#17`, `#18`, `#4`, `#5`) estão parados **de propósito**, esperando aval
ou migration — esses não contam. Sobram **14 só esperando alguém olhar**.
Escalado no `318`, com oferta de preparar para merge os que ele priorizar.

---

## 7. Fixes presos em branch SEM PR (o passo fixo pegou 7)

`git rev-list origin/main..origin/<branch>` em todas as branches remotas, cruzado
com a lista de PRs abertos:

| branch | commits | veredito |
|---|---|---|
| `fix/trava-foto-nova-8379549c` | 2 (21/08) | trava bloqueante extra do incidente `74`. **Não é ferida aberta** — o fix principal `f48358c` **está na main** (conferido com `--contains`) e o `74` **não dispara desde antes do fechamento**. Trabalho abandonado, decidir se ainda se quer. |
| `feat/reconciliar-imagens-kie` | 1 (22/08) | sweep de imagem presa em `pending` (incidente `69f0aec5`). Sem PR, 1 dia. |
| `feat/incidents-resolved-at` | 2 (20/08) | higiene de incidente + migration 85→86. Sem PR, 3 dias. |
| `rescue/relatorio-noturno-7e02e90` | 1 (19/08) | relatório + `refazer_audio_conta_da_casa` (a ferramenta **já está** na main). |
| `feat/vigia-noturno` | 1 (18/08) | espinha do vigia, provavelmente superada. |
| `dev` | 2 | refactor do worker para build de teste, intencional. |
| `feat/fix-image-upload-retry` | 1 | **STALE por ordem de 19/08 — não mergear.** Correto ficar parado. |

**Não abri PR pra nenhuma.** O gargalo que acabei de medir é **review**, e
despejar 5 PRs de código que eu não escrevi nem verifiquei numa fila saturada
pioraria o problema em vez de resolver. Ficam registradas para decisão.

---

## 8. O que eu NÃO fiz, de propósito

- **Não gerei o clone longo** que ofereci. Ele custa GPU e o aluno ainda não
  pediu. Só rodo com o "pode fazer" dele.
- **Não afirmei nada sobre o pacote comercial**, nem a favor nem contra.
- **Não verifiquei o conteúdo do reel do Instagram** — não consigo assistir, e
  quem tem que olhar é o Lucas, que gravou. Não afirmo o que o reel diz, só
  repito o que o aluno diz que ele diz.
- **Não postei linha separada no grupo** pela regra 7: o `317` já carregou o fato
  consumado ("escrevi pro aluno, sobre o quê") com o contexto. Duas mensagens
  para o mesmo fato seria o ruído que a ordem manda evitar.
- **Não abri os outros 6 incidentes da fila** (regra 8).
- Não toquei em crédito, não gastei GPU, não rodei migration, não mexi em cron.

---

## 9. Buracos que continuam abertos (não conte como saudável)

- **`79` (Rafael)** e **`90` (Kessuly, os −9.240)** seguem esperando decisão do
  dono, agora há mais tempo.
- **`98` (Adriane Teka)** — aberto pelo Vigia às 16:17, ainda `open`, sem dono.
  Ela escreveu **duas vezes** e nunca foi respondida (~40h agora).
- **Os 4 pagantes sem voz** (jRF, Leandro, Ivanilde, Marcelo). **jRF tem acesso
  até 25/08 — dois dias.**
- **`acf8acd6`** — sétima ronda sem confirmar produção de `74ae65a`/`1e5a893`.
  Não foi meu foco e não vou fingir que olhei.
- **Turno da noite** segue descoberto, com a ordem afirmando que está coberto.

---

## 10. Higiene do repositório

Continuam **não commitados** na `main`, de rondas anteriores (**não são meus, não
toquei**): `_frank/ferramentas/resgatar_voz.cjs` e
`_frank/ferramentas/2026-08-21_medir_8379549c.cjs`. **Quinta ronda** com esses
dois pendurados.

Investigação desta ronda em `_Bugs/ronda17h/` (fora do git, confirmado com
`git check-ignore`). Commitei **apenas este arquivo**, por caminho explícito, na
`main`.
